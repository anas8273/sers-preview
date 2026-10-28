export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  oAuthPortalUrl: process.env.OAUTH_PORTAL_URL ?? process.env.VITE_OAUTH_PORTAL_URL ?? "",
  appPublicOrigin: process.env.APP_PUBLIC_ORIGIN ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
};

export const AUTH_SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const OAUTH_ATTEMPT_TTL_MS = 10 * 60 * 1000;

export function getAuthConfig(env = ENV) {
  if (!/^[A-Za-z0-9._:-]{1,64}$/.test(env.appId) || Buffer.byteLength(env.cookieSecret, "utf8") < 32 || new Set(env.cookieSecret).size < 12) {
    throw new Error("Authentication configuration is invalid");
  }
  const parse = (value: string, originOnly: boolean) => {
    let url: URL;
    try { url = new URL(value); } catch { throw new Error("Authentication configuration is invalid"); }
    const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if (url.username || url.password || url.hash || url.search || (url.protocol !== "https:" && !(url.protocol === "http:" && loopback && !env.isProduction)) || (originOnly && url.pathname !== "/")) {
      throw new Error("Authentication configuration is invalid");
    }
    return url;
  };
  const publicOrigin = parse(env.appPublicOrigin, true).origin;
  const provider = parse(env.oAuthServerUrl, false);
  const portal = parse(env.oAuthPortalUrl, false);
  const redirectUri = `${publicOrigin}/api/oauth/callback`;
  if (redirectUri.length > 512) throw new Error("Authentication configuration is invalid");
  return { appId: env.appId, secret: env.cookieSecret, publicOrigin, redirectUri, providerUrl: provider.toString(), portalUrl: portal.toString(), secureCookies: publicOrigin.startsWith("https://") };
}
