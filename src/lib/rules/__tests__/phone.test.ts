import { describe, expect, it } from "vitest";
import { normalizePhone } from "../phone";

describe("normalizePhone", () => {
  it("parses a number that already includes a country code", () => {
    const result = normalizePhone("+57 313 353 5776");
    expect(result.value).toBe("+573133535776");
    expect(result.issues).toHaveLength(0);
  });

  it("uses the default country to parse a local-format number", () => {
    const result = normalizePhone("313 353 5776", "CO");
    expect(result.value).toBe("+573133535776");
  });

  it("flags an unparseable number", () => {
    const result = normalizePhone("not a phone number");
    expect(result.value).toBeNull();
    expect(result.issues[0].ruleId).toBe("PHONE_INVALID");
  });

  it("treats blank as null with no issue", () => {
    const result = normalizePhone("");
    expect(result.value).toBeNull();
    expect(result.issues).toHaveLength(0);
  });

  // Real examples pulled from the sheet that were misfiring before the fix:
  // a calling code is present but the leading "+" was never typed.
  it("recovers a calling-code-prefixed number with no leading +", () => {
    expect(normalizePhone("393474736045").value).toBe("+393474736045"); // Italy
    expect(normalizePhone("5531996621645").value).toBe("+5531996621645"); // Brazil
    expect(normalizePhone("917014226336").value).toBe("+917014226336"); // India
  });

  it("recovers the same pattern even with spaces in the number", () => {
    expect(normalizePhone("92 323 9225253").value).toBe("+923239225253"); // Pakistan
    expect(normalizePhone("40 728 706 080").value).toBe("+40728706080"); // Romania
  });

  it("strips invisible bidi/directional control characters before parsing", () => {
    expect(normalizePhone("‪393459102264‬").value).toBe("+393459102264");
  });

  it("strips a stray leading mark before parsing", () => {
    expect(normalizePhone("´+573133535776").value).toBe("+573133535776");
  });

  it("still flags genuinely corrupted values", () => {
    const result = normalizePhone("K42=917012671101");
    expect(result.value).toBeNull();
    expect(result.issues[0].ruleId).toBe("PHONE_INVALID");
  });

  it("still flags non-phone text", () => {
    const result = normalizePhone("NO CONTACT INFO");
    expect(result.value).toBeNull();
  });
});
