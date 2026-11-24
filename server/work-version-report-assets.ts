import { readFileSync } from "node:fs";
import {
  REPORT_MINISTRY_LOGO_ALT, REPORT_SCHOOL_LOGO_ALT, REPORT_SCHOOL_LOGO_MAX_BASE64,
  REPORT_SCHOOL_LOGO_MAX_DIMENSION, type ReportFontFamily,
} from "../shared/report-appearance";
import { sanitizeInlinePng } from "./work-version-inline-image";

// The same relative path works from server/ in development and dist/ after bundling.
const assets = new URL("../shared/report-assets/", import.meta.url);
const ministryLogo = sanitizeInlinePng(readFileSync(new URL("ministry-logo.png", assets)).toString("base64"));
const fontAssets = new Map<ReportFontFamily, { regular: Buffer; bold: Buffer }>();

export function reportFontAssets(family: ReportFontFamily) {
  if (family === "Arial") return undefined;
  const existing = fontAssets.get(family);
  if (existing) return existing;
  const file = family.replaceAll(" ", "");
  const fonts = {
    regular: readFileSync(new URL(`${file}-Regular.ttf`, assets)),
    bold: readFileSync(new URL(`${file}-Bold.ttf`, assets)),
  };
  fontAssets.set(family, fonts);
  return fonts;
}

export function sanitizeReportSchoolLogo(base64: string) {
  if (base64.length > REPORT_SCHOOL_LOGO_MAX_BASE64) throw new Error("School logo exceeds the report limit");
  const image = sanitizeInlinePng(base64, REPORT_SCHOOL_LOGO_MAX_DIMENSION);
  if (image.bytes.length * 4 / 3 > REPORT_SCHOOL_LOGO_MAX_BASE64) throw new Error("School logo exceeds the report limit");
  return image;
}

export function reportInstitutionLogos(institution: { ministryLogo: boolean; schoolLogo: string }) {
  return [
    ...(institution.ministryLogo ? [{ ...ministryLogo, alt: REPORT_MINISTRY_LOGO_ALT }] : []),
    ...(institution.schoolLogo ? [{ ...sanitizeReportSchoolLogo(institution.schoolLogo), alt: REPORT_SCHOOL_LOGO_ALT }] : []),
  ];
}
