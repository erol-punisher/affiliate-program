import { describe, expect, it } from "vitest";
import { missingVariables, renderTemplate, unknownVariables } from "../emailTemplate";
import { movesOnReply, nextOutreachStage } from "../crmMoves";
import { decryptSecret, encryptSecret } from "../secretBox";

describe("renderTemplate", () => {
  const lead = { name: "Ivan Kapustić", firstName: "Ivan", country: "Croatia", username: null, pipelineName: "EuroAffiliates ReachOut", followerCount: 2470 };
  const me = { name: "Erol Simon", email: "erol@shopcircle.co" };

  it("fills known variables and keeps unknown ones", () => {
    expect(renderTemplate("Hi {{first_name}} from {{ country }}, {{followers}} subs — {{my_first_name}} ({{discount}})", lead, me)).toBe(
      "Hi Ivan from Croatia, 2,470 subs — Erol ({{discount}})",
    );
  });

  it("uses the fallback only when the value is empty", () => {
    expect(renderTemplate("{{username|friend}} / {{first_name|there}}", lead, me)).toBe("friend / Ivan");
    expect(renderTemplate("{{website}}", lead, me)).toBe("");
  });

  it("prefers the lead's first-name field when it's set", () => {
    expect(renderTemplate("Hi {{first_name}}", { ...lead, name: "Strategia eCommerce", firstName: "Luca" }, me)).toBe("Hi Luca");
    expect(renderTemplate("Hi {{first_name|there}}", { ...lead, name: "Strategia eCommerce", firstName: "  " }, me)).toBe("Hi there");
  });

  it("never guesses a first name from a channel name", () => {
    const channel = { ...lead, name: "Money Maker Club", firstName: null };
    expect(renderTemplate("Hi {{first_name|there}},", channel, me)).toBe("Hi there,");
    expect(missingVariables("Hi {{first_name}},", channel, me)).toEqual(["first_name"]);
  });

  it("reports empty variables without a fallback, and unknown keys", () => {
    expect(missingVariables("{{website}} {{username|x}} {{country}}", lead, me)).toEqual(["website"]);
    expect(unknownVariables("{{first_name}} {{firstName}} {{discount|10%}}")).toEqual(["firstName", "discount"]);
  });
});

describe("nextOutreachStage / movesOnReply", () => {
  it("steps through the outreach stages and stops after Contacted (3)", () => {
    expect(nextOutreachStage("Affiliates in the Pipeline for Reach Outs")).toBe("Contacted");
    expect(nextOutreachStage("Contacted")).toBe("Contacted (2)");
    expect(nextOutreachStage("Contacted (2)")).toBe("Contacted (3)");
    expect(nextOutreachStage("Contacted (3)")).toBeNull();
    expect(nextOutreachStage("Negotiation/Review")).toBeNull();
  });

  it("only moves leads that are still in outreach when they reply", () => {
    expect(movesOnReply("Contacted (3)")).toBe(true);
    expect(movesOnReply("Affiliates in the Pipeline")).toBe(true);
    expect(movesOnReply("Negotiation/Review")).toBe(false);
    expect(movesOnReply("Closed Won")).toBe(false);
  });
});

describe("secretBox", () => {
  it("round-trips and produces different ciphertexts", () => {
    process.env.SESSION_SECRET = "test-secret";
    const a = encryptSecret("1//refresh-token");
    expect(decryptSecret(a)).toBe("1//refresh-token");
    expect(encryptSecret("1//refresh-token")).not.toBe(a);
  });
});
