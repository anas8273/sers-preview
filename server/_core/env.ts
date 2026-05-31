export const ENV = {
  appId: process.env.VITE_APP_ID || "sers-local-dev",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
};

// Warn on startup if critical secrets are using insecure defaults
if (!process.env.JWT_SECRET || process.env.JWT_SECRET === "dev-secret-change-in-production") {
  if (ENV.isProduction) {
    throw new Error("[ENV] JWT_SECRET must be set to a strong secret in production");
  } else {
    console.warn("[ENV] Warning: JWT_SECRET is using the default dev value. Set a strong secret before deploying.");
  }
}
