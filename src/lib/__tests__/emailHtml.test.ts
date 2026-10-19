import { describe, expect, it } from "vitest";
import { bodyToHtml, brandedToPlainText, buttonsToPlainText, moveBlock, renderBrandedEmail, sanitizeColors } from "../emailHtml";

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
    expect(html).toContain("data:image/png;base64,");
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

describe("colours, button position and logo", () => {
  const withButton = { ...base, body: "One\n\nTwo", buttonLabel: "Book", buttonUrl: "https://cal.com/x" };

  it("only accepts #rrggbb colours", () => {
    expect(sanitizeColors({ accent: "#123abc", secondary: "red;x:y", button: 5 })).toEqual({ accent: "#123abc", secondary: "#2458D4", button: "#EE8B4F" });
  });

  it("uses the chosen colours", () => {
    const html = renderBrandedEmail({ ...withButton, colors: { accent: "#111222", secondary: "#333444", button: "#555666" } });
    expect(html).toContain("color:#111222");
    expect(html).toContain("background:#333444");
    expect(html).toContain("background:#555666");
  });

  it("places the button before the given block, defaulting to the end", () => {
    const at = (p: number | null) => {
      const html = renderBrandedEmail({ ...withButton, buttonPosition: p });
      return [html.indexOf(">One<"), html.indexOf("Book</a>"), html.indexOf(">Two<")];
    };
    const [one0, btn0] = at(0);
    expect(btn0).toBeLessThan(one0);
    const [one1, btn1, two1] = at(1);
    expect(one1).toBeLessThan(btn1);
    expect(btn1).toBeLessThan(two1);
    const [, btnEnd, twoEnd] = at(null);
    expect(twoEnd).toBeLessThan(btnEnd);
    expect(brandedToPlainText({ ...withButton, buttonPosition: 1 })).toMatch(/One\n\nBook: https:\/\/cal.com\/x\n\nTwo/);
  });

  it("uses the given logo src and only adds drag code in editable previews", () => {
    expect(renderBrandedEmail(withButton, { logoSrc: "cid:releasit-logo" })).toContain('src="cid:releasit-logo"');
    expect(renderBrandedEmail(withButton)).not.toContain("<script");
    const editable = renderBrandedEmail(withButton, { editable: true });
    expect(editable).toContain('draggable="true"');
    expect(editable.match(/data-pos=/g)?.length).toBe(4);
  });
});

describe("inline [button: …](…) blocks", () => {
  const body = "Intro\n\n[button: Book a call](https://cal.com/x)\n\nOutro";

  it("renders a button where it sits in the message", () => {
    const html = renderBrandedEmail({ ...base, body, colors: { accent: "#111111", secondary: "#222222", button: "#333333" } });
    const [intro, btn, outro] = [html.indexOf(">Intro<"), html.indexOf("Book a call</a>"), html.indexOf(">Outro<")];
    expect(intro).toBeLessThan(btn);
    expect(btn).toBeLessThan(outro);
    expect(html).toContain('href="https://cal.com/x"');
    expect(html).toContain("background:#333333");
  });

  it("leaves non-http links as text", () => {
    expect(bodyToHtml("[button: Bad](javascript:alert(1))")).not.toContain("<a href");
  });

  it("makes only buttons draggable in the editable preview", () => {
    const html = renderBrandedEmail({ ...base, body }, { editable: true });
    expect(html.match(/draggable="true"/g)?.length).toBe(1);
    expect(html).toContain('data-block="1"');
  });

  it("moves blocks and turns buttons into text for plain emails", () => {
    expect(moveBlock(body, 1, 0)).toBe("[button: Book a call](https://cal.com/x)\n\nIntro\n\nOutro");
    expect(moveBlock(body, 1, 3)).toBe("Intro\n\nOutro\n\n[button: Book a call](https://cal.com/x)");
    expect(moveBlock(body, 1, 2)).toBe(body);
    expect(buttonsToPlainText(body)).toBe("Intro\n\nBook a call: https://cal.com/x\n\nOutro");
    expect(brandedToPlainText({ ...base, body })).toContain("Book a call: https://cal.com/x");
  });
});

describe("greeting", () => {
  it("is left out when empty", () => {
    const html = renderBrandedEmail({ ...base, greeting: "" });
    expect(html).not.toContain("letter-spacing:4px");
    expect(brandedToPlainText({ ...base, greeting: "" }).startsWith("Most COD")).toBe(true);
  });
});
