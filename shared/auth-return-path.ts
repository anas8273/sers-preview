/** Only known application paths can be restored after sign-in. No URL, query,
 * fragment, encoding, or callback route is ever accepted. */
export function safeAuthReturnPath(value: unknown): string {
  if (typeof value !== "string" || value.length > 128) return "/";
  if (/^\/(?:work(?:\/[1-9][0-9]*(?:\/report)?)?|account|evidence|reviews|notifications|reports|portfolio|performance-evidence|certificates|grade-analysis|covers|treatment-plans|school-radio|smart-cv|exams|audit-log|admin(?:\/templates)?)$/.test(value)) return value;
  return "/";
}
