import { describe, expect, it } from "vitest";
import { addBusinessDays, emailDomain, parseEmailSettings, suggestReplyCategory } from "../emailRules";
import { missingVariables } from "../emailTemplate";

describe("parseEmailSettings", () => {
  it("clamps values and falls back to defaults", () => {
    expect(parseEmailSettings(null)).toEqual({ dailyCap: 50, followUpDays: 4 });
    expect(parseEmailSettings('{"dailyCap": 9999, "followUpDays": 0}')).toEqual({ dailyCap: 500, followUpDays: 1 });
    expect(parseEmailSettings("not json")).toEqual({ dailyCap: 50, followUpDays: 4 });
  });
});

describe("addBusinessDays", () => {
  it("skips weekends", () => {
    // Thu 15 Oct 2026 + 4 business days = Wed 21 Oct
    expect(addBusinessDays(new Date("2026-10-15T10:00:00Z"), 4).toISOString().slice(0, 10)).toBe("2026-10-21");
    // Fri + 1 = Mon
    expect(addBusinessDays(new Date("2026-10-16T10:00:00Z"), 1).toISOString().slice(0, 10)).toBe("2026-10-19");
  });
});

describe("suggestReplyCategory", () => {
  it("spots clear opt-outs and refusals, and stays out of the way otherwise", () => {
    expect(suggestReplyCategory("Please remove me from your list")).toBe("unsubscribe");
    expect(suggestReplyCategory("Thanks but we're not interested right now")).toBe("not_interested");
    expect(suggestReplyCategory("Sounds great, can you send details?")).toBeNull();
  });
});

describe("emailDomain / icebreaker", () => {
  it("extracts the domain and treats a missing icebreaker as blank", () => {
    expect(emailDomain(" Raul@IuropAgency.com ")).toBe("iuropagency.com");
    const lead = { name: "Raul iUROP", country: "Spain", username: null, pipelineName: "EuroAffiliates ReachOut" };
    expect(missingVariables("{{icebreaker}}", lead, { name: "Erol", email: "e@x.co" })).toEqual(["icebreaker"]);
    expect(missingVariables("{{icebreaker}}", { ...lead, icebreaker: "Loved the CRO case study." }, { name: "Erol", email: "e@x.co" })).toEqual([]);
  });
});
