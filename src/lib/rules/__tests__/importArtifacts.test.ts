import { describe, expect, it } from "vitest";
import { scrubImportArtifact } from "../importArtifacts";

describe("scrubImportArtifact", () => {
  it("clears #N/A", () => {
    const result = scrubImportArtifact("#N/A", "in_init_sheet");
    expect(result.value).toBeNull();
    expect(result.issues[0].ruleId).toBe("IMPORT_ARTIFACT_SCRUB");
  });

  it("clears #ERROR!", () => {
    expect(scrubImportArtifact("#ERROR!", "in_init_sheet").value).toBeNull();
  });

  it("clears the stray 'And' value", () => {
    expect(scrubImportArtifact("And", "community_size").value).toBeNull();
  });

  it("passes through real values untouched", () => {
    const result = scrubImportArtifact("300", "community_size");
    expect(result.value).toBe("300");
    expect(result.issues).toHaveLength(0);
  });

  it("treats blank as null with no issue", () => {
    const result = scrubImportArtifact("", "community_size");
    expect(result.value).toBeNull();
    expect(result.issues).toHaveLength(0);
  });
});
