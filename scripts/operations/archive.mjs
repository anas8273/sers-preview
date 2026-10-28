import { command } from './ops-common.mjs';

export async function extractEvidenceArchive(archive, destination) {
  return command('python3', ['-c', `import os,pathlib,sys,tarfile
archive,destination=sys.argv[1:]
os.umask(0o077)
with tarfile.open(archive,'r:gz') as tar:
 members=tar.getmembers()
 if len(members)>1000000 or sum(m.size for m in members)>16*1024**3: raise ValueError('Archive exceeds drill bounds')
 for m in members:
  p=pathlib.PurePosixPath(m.name)
  if p.is_absolute() or '..' in p.parts or not (m.isfile() or m.isdir()): raise ValueError('Unsafe archive member')
 tar.extractall(destination,members=members,filter='data')`, archive, destination]);
}
