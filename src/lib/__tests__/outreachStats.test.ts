import { describe, expect, it } from "vitest";
import { averagePerWeek, classifyStage, parseTargets, weekStart, weeklyOutreachStats } from "../outreachStats";

const ev = (rootLeadId: string, toStageName: string, iso: string, pipelineName = "EuroAffiliates ReachOut") => ({
  rootLeadId,
  pipelineName,
  toStageName,
  createdAt: new Date(iso),
});

describe("classifyStage", () => {
  it("counts first contacts and follow-ups as contacted, only Responded with Interest stages as responded", () => {
    expect(classifyStage("Contacted")).toEqual(["contacted"]);
    expect(classifyStage("Contacted (2)")).toEqual(["contacted"]);
    expect(classifyStage("Contacted (3)")).toEqual(["contacted"]);
    expect(classifyStage("Responded with Interest")).toEqual(["responded"]);
    expect(classifyStage("Responded with Interest - For a Fee")).toEqual(["responded"]);
    expect(classifyStage("Responded with disinterest")).toEqual([]);
    expect(classifyStage("Responded with Disinterest")).toEqual([]);
    expect(classifyStage("Closed Won")).toEqual([]);
    expect(classifyStage("Affiliates in the Pipeline")).toEqual([]);
  });
});

describe("weekStart", () => {
  it("returns the Monday of the week", () => {
    expect(weekStart(new Date("2026-10-15T12:00:00Z")).toISOString().slice(0, 10)).toBe("2026-10-12");
    expect(weekStart(new Date("2026-10-18T23:00:00Z")).toISOString().slice(0, 10)).toBe("2026-10-12");
    expect(weekStart(new Date("2026-10-12T00:00:00Z")).toISOString().slice(0, 10)).toBe("2026-10-12");
  });
});

describe("weeklyOutreachStats", () => {
  const events = [
    ev("a", "Contacted", "2026-10-13T10:00:00Z"),
    ev("a", "Contacted", "2026-10-13T10:00:00Z", "Affiliates Standard"), // mirrored copy, same root
    ev("b", "Contacted", "2026-10-14T10:00:00Z"),
    ev("c", "Contacted (2)", "2026-10-14T10:00:00Z"),
    ev("a", "Responded with Interest - For a Fee", "2026-10-15T10:00:00Z"),
    ev("d", "Responded with disinterest", "2026-10-06T10:00:00Z"),
  ];

  it("counts each affiliate once per week and orders weeks newest first", () => {
    const weeks = weeklyOutreachStats(events, new Date("2026-10-06T00:00:00Z"), new Date("2026-10-16T00:00:00Z"));
    expect(weeks).toEqual([
      { weekStart: "2026-10-12", contacted: 3, responded: 1 },
      { weekStart: "2026-10-05", contacted: 0, responded: 0 },
    ]);
  });

  it("filters by pipeline", () => {
    const weeks = weeklyOutreachStats(events, new Date("2026-10-12T00:00:00Z"), new Date("2026-10-16T00:00:00Z"), "Affiliates Standard");
    expect(weeks[0]).toMatchObject({ contacted: 1, responded: 0 });
  });

  it("includes empty weeks in the range", () => {
    const weeks = weeklyOutreachStats([], new Date("2026-09-28T00:00:00Z"), new Date("2026-10-16T00:00:00Z"));
    expect(weeks.map((w) => w.weekStart)).toEqual(["2026-10-12", "2026-10-05", "2026-09-28"]);
  });
});

describe("averagePerWeek / parseTargets", () => {
  it("averages and falls back to defaults for bad targets", () => {
    const weeks = [
      { weekStart: "x", contacted: 20, responded: 3 },
      { weekStart: "y", contacted: 25, responded: 2 },
    ];
    expect(averagePerWeek(weeks, "contacted")).toBe(22.5);
    expect(averagePerWeek([], "contacted")).toBeNull();
    expect(parseTargets('{"contacted":30,"responded":-1}')).toEqual({ contacted: 30, responded: 2 });
    expect(parseTargets("not json")).toEqual({ contacted: 20, responded: 2 });
  });
});
