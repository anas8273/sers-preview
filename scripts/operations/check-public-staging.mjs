/** Read-only public boundary probe, except creating one normal OAuth attempt.
 * Never follows the provider redirect or prints cookies, codes, state or URLs. */
const origin = new URL(process.env.APP_PUBLIC_ORIGIN ?? '');
const portal = new URL(process.env.OAUTH_PORTAL_URL ?? process.env.VITE_OAUTH_PORTAL_URL ?? '');
if (origin.protocol !== 'https:' || origin.pathname !== '/' || origin.username || origin.password || origin.search || origin.hash || portal.protocol !== 'https:') throw new Error('Set real SERS HTTPS origin and provider portal');
const results = [];
const get = url => fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(15_000) });
const check = (name, passed) => { results.push({ name, passed: Boolean(passed) }); };
try {
  const page = await get(new URL('/account', origin));
  check('https_certificate_and_app_response', page.status === 200);
  check('hsts', /^max-age=[1-9][0-9]+/.test(page.headers.get('strict-transport-security') ?? ''));
  check('nosniff', page.headers.get('x-content-type-options') === 'nosniff');
  check('no_referrer', page.headers.get('referrer-policy') === 'no-referrer');
  check('frame_denied', page.headers.get('x-frame-options') === 'DENY');
  const start = await get(new URL('/api/oauth/start?returnTo=%2Faccount', origin));
  const location = new URL(start.headers.get('location') ?? '/', origin);
  check('sers_oauth_redirect_contract', start.status === 302 && location.origin === portal.origin && location.pathname.endsWith('/app-auth') && location.searchParams.get('appId') === process.env.VITE_APP_ID && location.searchParams.get('redirectUri') === new URL('/api/oauth/callback', origin).href);
  check('oauth_no_store', /no-store/.test(start.headers.get('cache-control') ?? ''));
  const cookies = start.headers.getSetCookie();
  check('oauth_cookie_policy', cookies.some(cookie => /^oauth_attempt=/.test(cookie) && /;\s*Secure/i.test(cookie) && /;\s*HttpOnly/i.test(cookie) && /;\s*SameSite=Lax/i.test(cookie) && !/;\s*Domain=/i.test(cookie)));
  const denied = await get(new URL('/api/trpc/auth.browserStorageKey', origin));
  check('anonymous_storage_key_denied', denied.status === 401);
  check('anonymous_response_not_cached', /no-store/.test(denied.headers.get('cache-control') ?? ''));
  const http = new URL('/account', origin); http.protocol = 'http:';
  const redirect = await get(http);
  check('http_redirects_to_canonical_https', [301, 302, 307, 308].includes(redirect.status) && redirect.headers.get('location') === new URL('/account', origin).href);
} catch { check('network_or_tls_probe', false); }
console.log(JSON.stringify({ passed: results.every(result => result.passed), externalLoginVerified: false, results }, null, 2));
if (results.some(result => !result.passed)) process.exitCode = 1;
