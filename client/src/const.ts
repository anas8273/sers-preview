export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

// The server creates and binds each OAuth attempt to this browser.
export const getLoginUrl = () => "/api/oauth/start";
