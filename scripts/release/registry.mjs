import { createHash } from 'node:crypto';
import { registry } from './runtime-package.mjs';

export function immutableTag(mainSha, imageId) {
  if (!/^[a-f0-9]{40}$/.test(mainSha ?? '') || !/^sha256:[a-f0-9]{64}$/.test(imageId ?? '')) throw new Error('Invalid immutable release identity');
  return `sha-${mainSha}-image-${imageId.slice(7)}`;
}

async function boundedBody(response, limit) {
  const chunks = []; let size = 0;
  for await (const chunk of response.body ?? []) {
    size += chunk.length;
    if (size > limit) throw new Error('Registry metadata exceeds its bound');
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

async function registryToken(actor, token, fetcher) {
  if (typeof actor !== 'string' || !/^[A-Za-z0-9-]{1,100}$/.test(actor) || typeof token !== 'string' || !token || token.length > 4096 || /\s/.test(token)) throw new Error('Invalid registry authentication context');
  const response = await fetcher('https://ghcr.io/token?service=ghcr.io&scope=repository:anas8273/sers-preview-runtime:pull,push', { redirect: 'error', signal: AbortSignal.timeout(30_000), headers: { Authorization: `Basic ${Buffer.from(`${actor}:${token}`).toString('base64')}` } });
  if (!response.ok) throw new Error(`Registry authentication failed (${response.status})`);
  const value = JSON.parse((await boundedBody(response, 16 * 1024)).toString('utf8'));
  if (typeof value.token !== 'string' || !value.token || value.token.length > 12 * 1024 || /\s/.test(value.token)) throw new Error('Registry returned an invalid credential');
  return value.token;
}

/** Refuse an existing tag with a different config ID; return null only for 404. */
export async function registryManifest(tag, expectedImageId, actor, token, fetcher = fetch) {
  if (!/^sha-[a-f0-9]{40}-image-[a-f0-9]{64}$/.test(tag) || !/^sha256:[a-f0-9]{64}$/.test(expectedImageId)) throw new Error('Invalid immutable registry reference');
  const credential = await registryToken(actor, token, fetcher);
  const response = await fetcher(`https://ghcr.io/v2/anas8273/sers-preview-runtime/manifests/${tag}`, { redirect: 'error', signal: AbortSignal.timeout(30_000), headers: { Authorization: `Bearer ${credential}`, Accept: 'application/vnd.docker.distribution.manifest.v2+json,application/vnd.oci.image.manifest.v1+json' } });
  if (response.status === 404) { await response.body?.cancel(); return null; }
  if (!response.ok) throw new Error(`Registry manifest verification failed (${response.status})`);
  const data = await boundedBody(response, 1024 * 1024);
  const digest = response.headers.get('docker-content-digest');
  if (!/^sha256:[a-f0-9]{64}$/.test(digest ?? '') || digest !== `sha256:${createHash('sha256').update(data).digest('hex')}`) throw new Error('Registry manifest digest cannot be verified');
  const manifest = JSON.parse(data.toString('utf8'));
  if (manifest.schemaVersion !== 2 || !['application/vnd.docker.distribution.manifest.v2+json', 'application/vnd.oci.image.manifest.v1+json'].includes(manifest.mediaType) || manifest.config?.digest !== expectedImageId || !Array.isArray(manifest.layers) || !manifest.layers.length) throw new Error('Immutable tag refers to a different or unsupported image');
  return { digest, reference: `${registry}@${digest}` };
}
