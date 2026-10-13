import { describe, expect, it } from "vitest";
import { describeStepChanges, generateUniqueStepKey } from "../onboardingSteps";

const BASE = {
  status: "not_started" as const,
  owner: null,
  notes: null,
  startedAt: null,
  completedAt: null,
  targetDays: 5,
  label: "Qualification review",
};

describe("describeStepChanges", () => {
  it("describes a status change", () => {
    expect(describeStepChanges(BASE, { status: "done" })).toEqual(["Status changed to Done"]);
  });

  it("describes setting and clearing the owner", () => {
    expect(describeStepChanges(BASE, { owner: "Sara Haddad" })).toEqual(["Owner set to Sara Haddad"]);
    expect(describeStepChanges({ ...BASE, owner: "Sara Haddad" }, { owner: null })).toEqual(["Owner cleared"]);
  });

  it("describes a notes update without echoing the note's content", () => {
    expect(describeStepChanges(BASE, { notes: "Waiting on install attribution" })).toEqual(["Notes updated"]);
  });

  it("describes completedAt being set and cleared", () => {
    const completedAt = new Date("2026-09-25T00:00:00.000Z");
    expect(describeStepChanges(BASE, { completedAt })).toEqual(["Completed date set to 2026-09-25"]);
    expect(describeStepChanges({ ...BASE, completedAt }, { completedAt: null })).toEqual(["Completed date cleared"]);
  });

  it("combines multiple field changes from a single patch into multiple messages", () => {
    const messages = describeStepChanges(BASE, { status: "done", completedAt: new Date("2026-09-25T00:00:00.000Z") });
    expect(messages).toEqual(["Status changed to Done", "Completed date set to 2026-09-25"]);
  });

  it("produces no messages when nothing actually changed", () => {
    expect(describeStepChanges(BASE, { status: "not_started", owner: null })).toEqual([]);
  });

  it("produces no messages for fields the patch didn't touch, even if they differ from a hypothetical default", () => {
    // Only `status` is present in the patch, so owner/notes/dates must be ignored even though
    // they're absent (undefined) rather than explicitly unchanged.
    expect(describeStepChanges({ ...BASE, owner: "Sara Haddad" }, { status: "in_progress" })).toEqual([
      "Status changed to In progress",
    ]);
  });

  it("describes a label rename", () => {
    expect(describeStepChanges(BASE, { label: "Qualification review (rush)" })).toEqual([
      'Renamed to "Qualification review (rush)"',
    ]);
  });
});

describe("generateUniqueStepKey", () => {
  it("slugifies a label into a key", () => {
    expect(generateUniqueStepKey("Send W-9 form", [])).toBe("send_w_9_form");
  });

  it("appends a numeric suffix when the base key is already taken", () => {
    expect(generateUniqueStepKey("Contacted", ["contacted"])).toBe("contacted_2");
    expect(generateUniqueStepKey("Contacted", ["contacted", "contacted_2"])).toBe("contacted_3");
  });

  it("falls back to a generic key for a label with no alphanumeric characters", () => {
    expect(generateUniqueStepKey("!!!", [])).toBe("step");
  });
});
