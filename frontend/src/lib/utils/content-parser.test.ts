import { describe, it, expect } from "vitest";
import { parseContent } from "./content-parser.js";

describe("parseContent", () => {
  it("preserves leading whitespace in plain text (no blocks)", () => {
    const segments = parseContent("  - Indented list item");
    expect(segments).toEqual([
      { type: "text", content: "  - Indented list item" },
    ]);
  });

  it("removes trailing whitespace in plain text", () => {
    const segments = parseContent("Text with trailing space   \n");
    expect(segments).toEqual([
      { type: "text", content: "Text with trailing space" },
    ]);
  });

  it("preserves leading whitespace in text segments before blocks", () => {
    const segments = parseContent("  Indented text\n[Thinking]\n...");
    expect(segments[0]).toEqual({
      type: "text",
      content: "  Indented text",
    });
    expect(segments[1]).toMatchObject({ type: "thinking" });
  });

  it("handles whitespace correctly in gaps between blocks", () => {
    const text = "[Thinking]\nfoo\n[Bash]\necho hi";
    const segments = parseContent(text);
    expect(segments.map(s => s.type)).toEqual(["thinking", "tool"]);
  });

  it("preserves leading whitespace in tail text", () => {
    const segments = parseContent("```code\ncontent```\n  Trailing text");
    expect(segments).toHaveLength(2);
    expect(segments[0]).toMatchObject({ type: "code" });
    expect(segments[1]).toEqual({
      type: "text",
      content: "\n  Trailing text",
    });
  });
});
