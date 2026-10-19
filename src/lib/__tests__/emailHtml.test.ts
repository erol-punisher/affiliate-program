import { describe, expect, it } from "vitest";
import { bodyToHtml, brandedToPlainText, renderBrandedEmail } from "../emailHtml";

const base = {
  greeting: "Hi Erol",
  headline: "Most COD merchants <run> blind & more",
  body: "Intro",
  senderName: "Erol Simon",
  senderEmail: "erol@shopcircle.co",
};

describe("bodyToHtml", () => {
  it("makes paragraphs, bullets, numbered steps, bold and links", () => {
    const html = bodyToHtml("First para\n\n- one\n- **two**\n\n1. Step title\nStep text https://releas.it/x.");
    expect(html).toContain("<p");
    expect(html.match(/<li/g)?.length).toBe(2);
    expect(html).toContain("<strong");
    expect(html).toContain(">1</td>");
    expect(html).toContain('href="https://releas.it/x"');
    expect(html).not.toContain('href="https://releas.it/x."');
  });

  it("escapes HTML in user text", () => {
    expect(bodyToHtml("<script>alert(1)</script> & co")).toContain("&lt;script&gt;alert(1)&lt;/script&gt; &amp; co");
  });
});

describe("renderBrandedEmail", () => {
  it("includes logo, greeting, escaped headline, and the button only when complete", () => {
    const html = renderBrandedEmail({ ...base, buttonLabel: "Book", buttonUrl: "https://cal.com/x" });
    expect(html).toContain("releasit-logo.png");
    expect(html).toContain("Hi Erol");
    expect(html).toContain("&lt;run&gt; blind &amp; more");
    expect(html).toContain('href="https://cal.com/x"');
    expect(renderBrandedEmail({ ...base, buttonLabel: "Book" })).not.toContain("Book</a>");
  });

  it("has a readable plain-text twin", () => {
    const text = brandedToPlainText({ ...base, highlight: "See what works.", body: "Use **Pixels**.", buttonLabel: "Book", buttonUrl: "https://cal.com/x" });
    expect(text).toContain("Hi Erol,");
    expect(text).toContain("Use Pixels.");
    expect(text).toContain("Book: https://cal.com/x");
  });
});
