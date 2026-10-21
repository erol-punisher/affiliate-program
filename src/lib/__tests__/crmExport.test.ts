import { describe, expect, it, vi } from "vitest";
import { parseImportCsv } from "@/lib/crmImport";

const lead = (over: Record<string, unknown>) => ({
  name: "Omar, \"the\" Seller",
  email: "omar@example.com",
  firstName: "Omar",
  username: null,
  country: "Egypt",
  whatsapp: "+20 100 123 4567",
  followerCount: 12000,
  websiteUrl: null,
  socialsUrl: "https://instagram.com/omar",
  referralLink: null,
  dateOfReachOut: new Date("2026-10-19T14:40:00Z"),
  closingDate: null,
  affiliateManager: "Erol",
  owner: "Erol Simon",
  notes: "Line one\nline two",
  outreachChannels: ["instagram", "email"],
  stage: { name: "Contacted (2)", order: 2, pipeline: { name: "Arab Influencers - Reach Out", order: 1, pipelineGroup: { name: "Affiliates" } } },
  ...over,
});

vi.mock("@/lib/auth", () => ({ getSessionWithFreshToken: async () => ({ email: "erol@shopcircle.co" }) }));
vi.mock("@/lib/db", () => ({
  prisma: { lead: { findMany: async () => [lead({}), lead({ name: "أحمد", email: null, outreachChannels: [] })] } },
}));

describe("CRM export for Bigin", () => {
  it("produces a CSV the Bigin-format importer reads back field for field", async () => {
    const { GET } = await import("@/app/api/crm/export/route");
    const res = await GET();
    expect(res.headers.get("Content-Disposition")).toMatch(/attachment; filename="releasit-affiliates-bigin-/);
    const text = (await res.text()).replace(/^﻿/, "");
    const { rows, errors } = parseImportCsv(text);
    expect(errors).toEqual([]);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      name: "Omar, \"the\" Seller",
      groupName: "Affiliates",
      pipelineName: "Arab Influencers - Reach Out",
      stageName: "Contacted (2)",
      email: "omar@example.com",
      country: "Egypt",
      whatsapp: "+20 100 123 4567",
      followerCount: 12000,
      dateOfReachOut: "2026-10-19",
      owner: "Erol Simon",
    });
    expect(rows[0].notes).toContain("Line one\nline two");
    expect(text.split("\r\n")[0]).toContain("Outreach Channels");
    expect(text).toContain("\"Email, Instagram\"");
    expect(rows[1].name).toBe("أحمد");
  });
});
