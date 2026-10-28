import { describe, expect, it } from "vitest";
import { AccountValidationError, validateAcademicYearInput } from "./account-db";
const input = () => ({ ownerType: "personal" as const, label: "1448–1449", startsOn: "2026-08-01", endsOn: "2027-07-31", terms: [{ label: "الفصل الأول", startsOn: "2026-08-01", endsOn: "2026-12-31" }, { label: "الفصل الثاني", startsOn: "2027-01-01", endsOn: "2027-07-31" }] });
describe("academic year admission", () => {
  it("preserves explicit dates and labels without inferring an official calendar", () => expect(validateAcademicYearInput(input())).toEqual(input()));
  it.each(["2026-02-30", "2026-13-01", "not-a-date", "2026-8-1"])("rejects impossible date %s", startsOn => expect(() => validateAcademicYearInput({ ...input(), startsOn })).toThrow(AccountValidationError));
  it("rejects reversed years and overlapping or out-of-year terms", () => {
    expect(() => validateAcademicYearInput({ ...input(), startsOn: "2028-01-01" })).toThrow(AccountValidationError);
    expect(() => validateAcademicYearInput({ ...input(), terms: [{ ...input().terms[0], endsOn: "2027-01-01" }, input().terms[1]] })).toThrow(AccountValidationError);
    expect(() => validateAcademicYearInput({ ...input(), terms: [{ ...input().terms[0], startsOn: "2026-07-31" }] })).toThrow(AccountValidationError);
  });
  it("requires one to three uniquely named terms and a matching ownership scope", () => {
    expect(() => validateAcademicYearInput({ ...input(), terms: [] })).toThrow(AccountValidationError);
    expect(() => validateAcademicYearInput({ ...input(), terms: [input().terms[0], { ...input().terms[1], label: input().terms[0].label }] })).toThrow(AccountValidationError);
    expect(() => validateAcademicYearInput({ ...input(), organizationId: 1 })).toThrow(AccountValidationError);
    expect(() => validateAcademicYearInput({ ...input(), ownerType: "organization" })).toThrow(AccountValidationError);
  });
});
