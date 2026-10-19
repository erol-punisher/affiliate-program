import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ prisma: {} }));

const { cleanSignatureHtml, signatureToText } = await import("../emailSignature");
const { composeEmail } = await import("../emailOutreach");

const gmailSig =
  '<div dir="ltr"><b>Erol Simon</b><div>Affiliate Coordinator</div><img src="https://ci3.googleusercontent.com/sig.png" width="120" onerror="alert(1)"><script>alert(2)</script><a href="javascript:alert(3)">x</a></div>';

describe("signature cleaning", () => {
  it("keeps formatting and https images, drops scripts, handlers and javascript: links", () => {
    const clean = cleanSignatureHtml(gmailSig);
    expect(clean).toContain("<b>Erol Simon</b>");
    expect(clean).toContain('src="https://ci3.googleusercontent.com/sig.png"');
    expect(clean).not.toMatch(/onerror|<script|javascript:/);
  });

  it("has a plain-text version", () => {
    expect(signatureToText("<b>Erol Simon</b><br>Affiliate Coordinator<div>Shop Circle &amp; Co</div>")).toBe("Erol Simon\nAffiliate Coordinator\nShop Circle & Co");
  });
});

describe("composeEmail", () => {
  const lead = { name: "Ahmed Elbhery", firstName: "Ahmed", country: "Egypt", username: null, pipelineName: "Affiliates Standard" };
  const me = { senderName: "Erol Simon", senderEmail: "erol@shopcircle.co" };
  const sig = "<b>Erol Simon</b><br>Affiliate Coordinator";

  it("plain without signature is text only", () => {
    const e = composeEmail({ body: "Hi {{first_name}}", lead, ...me });
    expect(e).toEqual({ text: "Hi Ahmed" });
  });

  it("plain with signature adds an HTML part and a text signature", () => {
    const e = composeEmail({ body: "Hi {{first_name}}", lead, signatureHtml: sig, ...me });
    expect(e.text).toBe("Hi Ahmed\n\n-- \nErol Simon\nAffiliate Coordinator");
    expect(e.html).toContain("gmail_signature");
    expect(e.html).toContain(sig);
  });

  it("branded uses the signature in place of the default footer and attaches the logo", () => {
    const e = composeEmail({ body: "Body", branded: { headline: "Hello" }, lead, signatureHtml: sig, ...me });
    expect(e.html).toContain(sig);
    expect(e.html).not.toContain("Releasit · erol@shopcircle.co");
    expect(e.html).toContain('src="cid:releasit-logo"');
    expect(e.inlineImages?.[0].cid).toBe("releasit-logo");
    expect(e.text).toContain("Affiliate Coordinator");
  });
});
