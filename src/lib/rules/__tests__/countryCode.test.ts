import { describe, expect, it } from "vitest";
import { normalizeCountryCode } from "../countryCode";

describe("normalizeCountryCode", () => {
  it("accepts a valid ISO-3166-1 alpha-2 code", () => {
    const result = normalizeCountryCode("CO");
    expect(result.value).toBe("CO");
    expect(result.inferred).toBe(false);
  });

  it("is case-insensitive", () => {
    expect(normalizeCountryCode("co").value).toBe("CO");
  });

  it("infers the country from the phone number when missing", () => {
    const result = normalizeCountryCode(null, "+573133535776");
    expect(result.value).toBe("CO");
    expect(result.inferred).toBe(true);
    expect(result.issues[0].ruleId).toBe("COUNTRY_CODE_INFER_FROM_PHONE");
  });

  it("flags an invalid code that can't be inferred", () => {
    const result = normalizeCountryCode("ZZ");
    expect(result.value).toBeNull();
    expect(result.issues[0].ruleId).toBe("COUNTRY_CODE_VALIDATE");
  });

  it("infers from phone when the stored code is invalid (e.g. a 3-letter ISO code)", () => {
    const result = normalizeCountryCode("SAU", "+966570773964");
    expect(result.value).toBe("SA");
    expect(result.inferred).toBe(true);
    expect(result.issues[0].ruleId).toBe("COUNTRY_CODE_INFER_FROM_PHONE");
  });

  it("flags missing with no phone to infer from", () => {
    const result = normalizeCountryCode(null, null);
    expect(result.value).toBeNull();
    expect(result.issues[0].ruleId).toBe("COUNTRY_CODE_MISSING");
  });
});
