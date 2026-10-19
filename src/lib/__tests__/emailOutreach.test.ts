import { describe, expect, it } from "vitest";
import { renderTemplate } from "../emailTemplate";
import { movesOnReply, nextOutreachStage } from "../crmMoves";
import { decryptSecret, encryptSecret } from "../secretBox";

describe("renderTemplate", () => {
  const lead = { name: "Ivan Kapustić", country: "Croatia", username: null, pipelineName: "EuroAffiliates ReachOut" };

  it("fills known placeholders and keeps unknown ones", () => {
    expect(renderTemplate("Hi {{first_name}} from {{ country }} — {{my_name}} ({{discount}})", lead, "Erol")).toBe(
      "Hi Ivan from Croatia — Erol ({{discount}})",
    );
  });

  it("takes the first word of channel-style names", () => {
    expect(renderTemplate("{{first_name}}", { ...lead, name: "Marcos Balmain | Shopify, IA y Ecommerce" }, "")).toBe("Marcos");
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
