import { constants } from "node:fs";
import { execFile } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { lstat, mkdir, open, realpath } from "node:fs/promises";
import path from "node:path";
import type { PrivateUploadStorage } from "./private-upload-storage";
import { MAX_EVIDENCE_BYTES } from "./upload-validation";

type Reference = { format: 1; keyHash: string; version: string; bytes: number; sha256: string };
const sha256 = (bytes: Uint8Array | string) => createHash("sha256").update(bytes).digest("hex");
const missing = (error: unknown) => (error as NodeJS.ErrnoException)?.code === "ENOENT";
const exists = (error: unknown) => (error as NodeJS.ErrnoException)?.code === "EEXIST";
const validKey = (key: string) => typeof key === "string" && /^[A-Za-z0-9][A-Za-z0-9/_-]{0,255}$/.test(key) && !key.includes("//") && !key.endsWith("/");
const validVersion = (version: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(version);

// Fixed child program, never a shell. flock --no-fork makes its PID the Node
// writer itself; kill/crash releases the kernel lock across local worker
// processes. Network filesystems are not supported.
const LOCKED_STORAGE_PROGRAM = `
const fs=require('node:fs/promises'),c=require('node:fs').constants,p=require('node:path'),crypto=require('node:crypto');
const [root,action,keyHash,version,expectedHash,expectedSize]=process.argv.slice(1);
const at=(dir,name)=>p.join(root,dir,name), hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const missing=e=>e.code==='ENOENT';
async function read(file,max=1024){const h=await fs.open(file,c.O_RDONLY|c.O_NOFOLLOW);try{const s=await h.stat();if(!s.isFile()||s.uid!==process.getuid()||(s.mode&63)||s.size>max)throw Error('private file');return await h.readFile();}finally{await h.close();}}
async function write(file,data){const h=await fs.open(file,c.O_WRONLY|c.O_CREAT|c.O_EXCL|c.O_NOFOLLOW,384);try{await h.writeFile(data);await h.sync();}finally{await h.close();}}
async function sync(dir){const h=await fs.open(p.join(root,dir),c.O_RDONLY|c.O_DIRECTORY|c.O_NOFOLLOW);try{await h.sync();}finally{await h.close();}}
async function get(dir){try{const r=JSON.parse((await read(at(dir,keyHash))).toString('utf8'));if(r.format!==1||r.keyHash!==keyHash||!/^([a-f0-9]{8}-){1}[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(r.version)||!Number.isInteger(r.bytes)||r.bytes<1||r.bytes>16777216||!/^[a-f0-9]{64}$/.test(r.sha256))throw Error('reference');return r;}catch(e){if(missing(e))return null;throw e;}}
async function retired(r){try{const v=(await read(at('tombstones',keyHash),64)).toString('ascii');if(v!==r.version)throw Error('tombstone');return true;}catch(e){if(missing(e))return false;throw e;}}
async function publish(r){await fs.link(at('preparations',keyHash),at('refs',keyHash)).catch(e=>{if(e.code!=='EEXIST')throw e;});await sync('refs');}
async function run(){
 let r=await get('refs'), prep=await get('preparations');
 if(r&&prep&&(r.version!==prep.version||r.sha256!==prep.sha256||r.bytes!==prep.bytes))throw Error('reference mismatch');
 if(action==='put'){
  if(r)return {status:'exists'};
  const chunks=[];let n=0;for await(const chunk of process.stdin){n+=chunk.length;if(n>16777216)throw Error('size');chunks.push(chunk);}const bytes=Buffer.concat(chunks);
  if(n!==Number(expectedSize)||hash(bytes)!==expectedHash)throw Error('hash');
  if(prep){
   if(prep.sha256!==expectedHash||prep.bytes!==n||await retired(prep))return {status:'exists'};
   // A retried output may finish an unpublished partial write, but may never
   // choose a new identity or rewrite a published/deleted version.
   await fs.unlink(at('blobs',prep.version)).catch(e=>{if(!missing(e))throw e;});await sync('blobs');
  }else{
   prep={format:1,keyHash,version,bytes:n,sha256:expectedHash};
   // No payload bytes are written before the full preparation identity is durable.
   // A crash before this link leaves only a bounded metadata temp named by key.
   const pending=at('preparations',keyHash+'.pending');
   await fs.unlink(pending).catch(e=>{if(!missing(e))throw e;});
   await write(pending,Buffer.from(JSON.stringify(prep)));await fs.link(pending,at('preparations',keyHash));await sync('preparations');
   await fs.unlink(pending);await sync('preparations');
  }
  await write(at('blobs',prep.version),bytes);await sync('blobs');await publish(prep);
  return {status:'created',version:prep.version};
 }
 if(action==='recover'){
  if(r)return {status:'known'};
  if(!prep)return {status:'missing'};
  let bytes;try{bytes=await read(at('blobs',prep.version),16777216);}catch(e){if(missing(e))return {status:'unknown'};throw e;}
  if(bytes.length!==prep.bytes||hash(bytes)!==prep.sha256)return {status:'unknown'};
  // A previous writer may have crashed before fsync; persist before publishing.
  const h=await fs.open(at('blobs',prep.version),c.O_RDONLY|c.O_NOFOLLOW);try{await h.sync();}finally{await h.close();}
  await sync('blobs');await publish(prep);return {status:'known'};
 }
 if(action==='inspect')return prep?{status:'prepared',version:prep.version,bytes:prep.bytes,sha256:prep.sha256}:{status:'missing'};
 if(action==='delete'){
  r=r||prep;if(!r)return {status:'unknown'};
  if(r.version!==version)return {status:'version_mismatch'};
  if(!await get('refs'))await publish(r);
  if(!await retired(r)){await write(at('tombstones',keyHash),Buffer.from(version));await sync('tombstones');}
  await fs.unlink(at('blobs',version)).catch(e=>{if(!missing(e))throw e;});await sync('blobs');
  return {status:'deleted'};
 }
 throw Error('operation');
}
run().then(result=>process.stdout.write(JSON.stringify(result))).catch(()=>process.stdout.write(JSON.stringify({status:'unknown'})));
`;

/** Self-hosted POSIX provider: its directory must be on a persistent private
 * local filesystem, never a web/static mount. All workers use the same root.
 * The process UID owns the directory; same-UID administrators are trusted.
 * Immutable references survive deletion, so a late put can NEVER recreate a
 * deleted key. Keep refs/tombstones in backups, not just blobs.
 */
export async function createPrivateFilesystemStorage(options: { rootDirectory: string }): Promise<PrivateUploadStorage> {
  if (process.platform === "win32" || !process.getuid || !path.isAbsolute(options.rootDirectory) || path.resolve(options.rootDirectory) === path.parse(options.rootDirectory).root) throw new Error("Private POSIX storage root required");
  const root = path.resolve(options.rootDirectory), uid = process.getuid();
  // Refuse symlinks and untrusted writable ancestry. A private child inside a
  // non-sticky world-writable parent can otherwise be renamed by another UID.
  let ancestor = path.parse(root).root;
  for (const segment of root.slice(ancestor.length).split(path.sep)) {
    ancestor = path.join(ancestor, segment);
    try {
      const info = await lstat(ancestor);
      if (info.isSymbolicLink() || !info.isDirectory() || (info.uid !== 0 && info.uid !== uid) || ((info.mode & 0o022) !== 0 && (info.mode & 0o1000) === 0)) throw new Error("Untrusted storage ancestry");
    }
    catch (error) { if (!missing(error)) throw error; }
  }
  await mkdir(root, { recursive: true, mode: 0o700 });
  const identities = new Map<string, { dev: number; ino: number }>();
  async function assertDirectory(directory: string, record = false) {
    const info = await lstat(directory);
    if (!info.isDirectory() || info.isSymbolicLink() || info.uid !== uid || (info.mode & 0o077) !== 0 || await realpath(directory) !== directory) throw new Error("Storage directory is not private");
    const prior = identities.get(directory);
    if (prior && (prior.dev !== info.dev || prior.ino !== info.ino)) throw new Error("Storage directory changed");
    if (record) identities.set(directory, { dev: info.dev, ino: info.ino });
  }
  await assertDirectory(root, true);
  const directories = { refs: path.join(root, "refs"), blobs: path.join(root, "blobs"), tombstones: path.join(root, "tombstones"), preparations: path.join(root, "preparations"), locks: path.join(root, "locks") };
  for (const directory of Object.values(directories)) { await mkdir(directory, { mode: 0o700 }).catch(error => { if (!exists(error)) throw error; }); await assertDirectory(directory, true); }
  async function verifyRoot() { await assertDirectory(root); for (const directory of Object.values(directories)) await assertDirectory(directory); }
  async function locked(action: "put" | "recover" | "delete" | "inspect", key: string, version = "", hash = "", bytes?: Uint8Array): Promise<Record<string, unknown>> {
    await verifyRoot();
    const keyHash = sha256(key), lock = path.join(directories.locks, keyHash);
    // Pre-create/check the lock inode without following links; directory ancestry
    // is protected against foreign UIDs, same-UID administrators are trusted.
    const file = await open(lock, constants.O_WRONLY | constants.O_CREAT | constants.O_NOFOLLOW, 0o600);
    try { const info = await file.stat(); if (!info.isFile() || info.uid !== uid || (info.mode & 0o077) !== 0) throw new Error("Invalid storage lock"); }
    finally { await file.close(); }
    return new Promise(resolve => {
      const child = execFile("/usr/bin/flock", ["--no-fork", "--exclusive", "--timeout", "15", lock, process.execPath, "-e", LOCKED_STORAGE_PROGRAM, root, action, keyHash, version, hash, String(bytes?.length ?? 0)],
        { encoding: "utf8", timeout: 25_000, killSignal: "SIGKILL", maxBuffer: 4096 }, (error, stdout) => {
          if (error) { resolve({ status: "unknown" }); return; }
          try { resolve(JSON.parse(stdout)); } catch { resolve({ status: "unknown" }); }
        });
      child.stdin?.on("error", () => {});
      child.stdin?.end(bytes);
    });
  }
  async function readPrivateFile(file: string, maxBytes: number): Promise<Buffer> {
    const handle = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
      const stat = await handle.stat();
      if (!stat.isFile() || stat.uid !== uid || (stat.mode & 0o077) !== 0 || stat.size > maxBytes || stat.size < 1) throw new Error("Invalid private object");
      const result = Buffer.alloc(stat.size);
      let offset = 0;
      while (offset < result.length) { const chunk = await handle.read(result, offset, result.length - offset, offset); if (!chunk.bytesRead) throw new Error("Truncated object"); offset += chunk.bytesRead; }
      const probe = Buffer.alloc(1);
      if ((await handle.read(probe, 0, 1, offset)).bytesRead) throw new Error("Object grew while reading");
      const after = await handle.stat();
      if (after.size !== stat.size || after.mtimeMs !== stat.mtimeMs || after.ctimeMs !== stat.ctimeMs) throw new Error("Object changed while reading");
      return result;
    } finally { await handle.close(); }
  }
  async function reference(key: string) {
    const hash = sha256(key);
    const raw = await readPrivateFile(path.join(directories.refs, hash), 1024);
    const value = JSON.parse(raw.toString("utf8")) as Reference;
    if (value.format !== 1 || value.keyHash !== hash || !validVersion(value.version) || !Number.isInteger(value.bytes) || value.bytes < 1 || value.bytes > MAX_EVIDENCE_BYTES || !/^[a-f0-9]{64}$/.test(value.sha256)) throw new Error("Invalid reference");
    return value;
  }
  async function tombstoned(ref: Reference) {
    try {
      const bytes = await readPrivateFile(path.join(directories.tombstones, ref.keyHash), 64);
      if (bytes.toString("ascii") !== ref.version) throw new Error("Invalid tombstone");
      return true;
    } catch (error) { if (missing(error)) return false; throw error; }
  }
  async function readObject(ref: Reference, maxBytes: number) {
    if (ref.bytes > maxBytes) throw new Error("Object exceeds bound");
    const bytes = await readPrivateFile(path.join(directories.blobs, ref.version), Math.min(maxBytes, MAX_EVIDENCE_BYTES));
    if (bytes.length !== ref.bytes || sha256(bytes) !== ref.sha256) throw new Error("Object checksum mismatch");
    return bytes;
  }
  const adapter: PrivateUploadStorage = {
    capabilities: { privateObjects: true, conditionalCreate: true, versionedDelete: true, permanentKeyRetirement: true },
    async putPrivateIfAbsent(input) {
      if (!validKey(input.key) || !(input.bytes instanceof Uint8Array) || input.bytes.length < 1 || input.bytes.length > MAX_EVIDENCE_BYTES || !/^[a-f0-9]{64}$/.test(input.sha256)) return { status: "unknown" };
      // Own the bytes across awaits; a caller must not mutate a pending write.
      const bytes = Buffer.from(input.bytes);
      if (sha256(bytes) !== input.sha256) return { status: "unknown" };
      try {
        const result = await locked("put", input.key, randomUUID(), input.sha256, bytes);
        if (result.status === "created" && typeof result.version === "string" && validVersion(result.version)) return { status: "created", version: result.version };
        return result.status === "exists" ? { status: "exists" } : { status: "unknown" };
      } catch { return { status: "unknown" }; }
    },
    async headPrivate(key, version) {
      if (!validKey(key) || (version !== undefined && !validVersion(version))) return { status: "unknown" };
      try {
        await verifyRoot();
        const recovered = await locked("recover", key);
        if (recovered.status === "missing") return { status: "missing" };
        if (recovered.status !== "known") return { status: "unknown" };
        const ref = await reference(key);
        if ((version !== undefined && version !== ref.version) || await tombstoned(ref)) return { status: "missing" };
        await readObject(ref, MAX_EVIDENCE_BYTES);
        if (await tombstoned(ref)) return { status: "missing" };
        return { status: "found", version: ref.version, bytes: ref.bytes, sha256: ref.sha256, private: true };
      } catch (error) { return missing(error) ? { status: "missing" } : { status: "unknown" }; }
    },
    async inspectPrivatePreparation(key) {
      if (!validKey(key)) return { status: "unknown" };
      try {
        const prepared = await locked("inspect", key);
        if (prepared.status === "prepared" && typeof prepared.version === "string" && validVersion(prepared.version) && typeof prepared.bytes === "number" && Number.isInteger(prepared.bytes) && prepared.bytes > 0 && prepared.bytes <= MAX_EVIDENCE_BYTES && typeof prepared.sha256 === "string" && /^[a-f0-9]{64}$/.test(prepared.sha256)) return { status: "prepared", version: prepared.version, bytes: prepared.bytes, sha256: prepared.sha256 };
        return prepared.status === "missing" ? { status: "missing" } : { status: "unknown" };
      } catch { return { status: "unknown" }; }
    },
    async readPrivate(key, version, maxBytes) {
      if (!validKey(key) || !validVersion(version) || !Number.isSafeInteger(maxBytes) || maxBytes < 1 || maxBytes > MAX_EVIDENCE_BYTES) return { status: "unknown" };
      try {
        await verifyRoot();
        const ref = await reference(key);
        if (version !== ref.version || await tombstoned(ref)) return { status: "missing" };
        const bytes = await readObject(ref, maxBytes);
        if (await tombstoned(ref)) return { status: "missing" };
        return { status: "found", bytes };
      } catch (error) { return missing(error) ? { status: "missing" } : { status: "unknown" }; }
    },
    async deletePrivateIfVersion(key, version) {
      if (!validKey(key) || !validVersion(version)) return { status: "unknown" };
      try {
        const result = await locked("delete", key, version);
        if (result.status === "deleted") return { status: "deleted" };
        if (result.status === "version_mismatch") return { status: "version_mismatch" };
        return { status: "unknown" };
      } catch {
        // An absent reference is not a retirement proof; a put may be preparing
        // it. Only a durable matching reference+tombstone confirms deletion.
        return { status: "unknown" };
      }
    },
  };
  return adapter;
}
