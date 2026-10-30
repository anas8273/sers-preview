export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { safeAuthReturnPath } from "@shared/auth-return-path";

// The server creates and binds each OAuth attempt to this browser.
export const getLoginUrl = (path = typeof window === "undefined" ? "/" : window.location.pathname) => {
  const returnTo = safeAuthReturnPath(path);
  return returnTo === "/" ? "/api/oauth/start" : `/api/oauth/start?returnTo=${encodeURIComponent(returnTo)}`;
};
