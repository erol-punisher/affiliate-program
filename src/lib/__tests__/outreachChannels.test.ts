import { describe, expect, it } from "vitest";
import { mergeChannels, parseChannels, profileHref, socialPlatform, whatsappHref } from "@/lib/outreachChannels";
import { classifyEvent, contactedChannelsByWeek, weeklyOutreachStats } from "@/lib/outreachStats";

describe("parseChannels", () => {
  it("keeps known channels once, in canonical order", () => {
    expect(parseChannels(["LinkedIn", "email", "tiktok", "email", 3])).toEqual(["email", "linkedin"]);
    expect(parseChannels(["other", "WhatsApp", "instagram"])).toEqual(["instagram", "whatsapp", "other"]);
    expect(parseChannels("email")).toEqual([]);
  });
  it("merges lists", () => {
    expect(mergeChannels(["instagram"], ["email", "instagram"])).toEqual(["email", "instagram"]);
  });
});

describe("socialPlatform / profileHref", () => {
  it("recognises Instagram and LinkedIn, with or without a scheme", () => {
    expect(socialPlatform("https://www.instagram.com/someone/")).toBe("instagram");
    expect(socialPlatform("instagram.com/someone")).toBe("instagram");
    expect(socialPlatform("https://uk.linkedin.com/in/someone")).toBe("linkedin");
    expect(socialPlatform("https://www.tiktok.com/@someone")).toBe("other");
    expect(socialPlatform("https://wa.me/971501234567")).toBe("whatsapp");
    expect(socialPlatform("")).toBeNull();
  });
  it("builds a link only for URL-like values", () => {
    expect(profileHref("instagram.com/someone")).toBe("https://instagram.com/someone");
    expect(profileHref("@someone")).toBeNull();
    expect(profileHref("not a url")).toBeNull();
  });
});

describe("whatsappHref", () => {
  it("turns a number in any format into a wa.me link", () => {
    expect(whatsappHref("+971 50 123 4567")).toBe("https://wa.me/971501234567");
    expect(whatsappHref("0044 7700 900123")).toBe("https://wa.me/447700900123");
    expect(whatsappHref("https://wa.me/201001234567")).toBe("https://wa.me/201001234567");
    expect(whatsappHref("ask on IG")).toBeNull();
    expect(whatsappHref("")).toBeNull();
  });
});

describe("logged DMs and channels in weekly stats", () => {
  const at = (iso: string) => new Date(iso);
  const events = [
    { rootLeadId: "a", pipelineName: "P", toStageName: "Contacted", createdAt: at("2026-10-19T10:00:00Z"), channels: ["email"] },
    { rootLeadId: "a", pipelineName: "P", toStageName: "Contacted", createdAt: at("2026-10-20T10:00:00Z"), kind: "touch", channels: ["instagram"] },
    { rootLeadId: "b", pipelineName: "P", toStageName: "Responded", createdAt: at("2026-10-20T11:00:00Z"), kind: "touch", channels: ["linkedin"] },
    { rootLeadId: "c", pipelineName: "P", toStageName: "Contacted (2)", createdAt: at("2026-10-21T10:00:00Z") },
    { rootLeadId: "d", pipelineName: "P", toStageName: "Responded with Interest", createdAt: at("2026-10-21T10:00:00Z") },
  ];

  it("counts a touch as contacted whatever stage the lead is in", () => {
    expect(classifyEvent({ toStageName: "Responded", kind: "touch" })).toEqual(["contacted"]);
    expect(classifyEvent({ toStageName: "Responded with Interest" })).toEqual(["responded"]);
    const [week] = weeklyOutreachStats(events, at("2026-10-19T00:00:00Z"), at("2026-10-22T00:00:00Z"));
    expect(week).toEqual({ weekStart: "2026-10-19", contacted: 3, responded: 1 });
  });

  it("counts each affiliate once per channel, with untagged separately", () => {
    const week = contactedChannelsByWeek(events).get("2026-10-19")!;
    expect(week.counts).toEqual({ email: 1, instagram: 1, linkedin: 1, whatsapp: 0, other: 0, untagged: 1 });
    expect(week.byLead.get("a")).toEqual(["email", "instagram"]);
    expect(week.byLead.get("c")).toEqual([]);
  });
});
