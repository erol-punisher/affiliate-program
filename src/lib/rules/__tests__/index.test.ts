import { describe, expect, it } from "vitest";
import { normalizeAffiliateRow } from "../index";

describe("normalizeAffiliateRow", () => {
  it("normalizes a clean row with no issues", () => {
    const result = normalizeAffiliateRow({
      Affiliate: "Jane Doe",
      Commission: "15%",
      "Affiliate Tier": "3. A (>$100)",
      Status: "ACTIVE",
      Language: "es",
      "Contact Phone": "+573133535776",
      "Country Code": "CO",
      "Contact Email": "jane@example.com",
    });

    expect(result.name).toBe("Jane Doe");
    expect(result.commissionRate).toBe(0.15);
    expect(result.tier).toBe("A");
    expect(result.status).toBe("ACTIVE");
    expect(result.language).toBe("es");
    expect(result.phoneE164).toBe("+573133535776");
    expect(result.countryCode).toBe("CO");
    expect(result.emails).toEqual([{ address: "jane@example.com", isPrimary: true }]);
    expect(result.healthScore).toBe(100);
    expect(result.issues).toHaveLength(0);
  });

  it("handles a genuinely messy row without crashing or losing data", () => {
    const result = normalizeAffiliateRow({
      Affiliate: "Messy Affiliate",
      Commission: "no comission",
      "Affiliate Tier": " 5. C",
      Status: "Fulfillment Centre",
      Language: "bih",
      "Contact Phone": "#N/A",
      "Country Code": "",
      "Contact Email": "Email: a@x.com, b@x.com",
    });

    expect(result.commissionRate).toBe(0);
    expect(result.tier).toBe("C");
    expect(result.status).toBe("UNKNOWN");
    expect(result.statusFlagged).toBe(true);
    expect(result.language).toBe("bs");
    expect(result.phoneE164).toBeNull();
    expect(result.importArtifacts).toContain("phone");
    expect(result.emails).toHaveLength(2);
    expect(result.healthScore).toBeLessThan(100);
    expect(result.issues.length).toBeGreaterThan(0);
  });

  it("infers country code from phone when the country column is blank", () => {
    const result = normalizeAffiliateRow({
      Affiliate: "No Country",
      "Contact Phone": "+573133535776",
      "Country Code": "",
    });
    expect(result.countryCode).toBe("CO");
    expect(result.countryCodeInferred).toBe(true);
  });

  it("never throws on a completely empty row", () => {
    expect(() => normalizeAffiliateRow({})).not.toThrow();
  });
});
