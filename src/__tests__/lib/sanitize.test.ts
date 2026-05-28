import { describe, it, expect } from "vitest";
import { sanitizeShortText, sanitizeMultilineText } from "@/lib/sanitize";

describe("sanitizeShortText", () => {
  it("returns empty string for empty input", () => {
    expect(sanitizeShortText("")).toBe("");
  });

  it("NFKC-normalizes fullwidth chars so they pass reserved-username checks", () => {
    expect(sanitizeShortText("ａｄｍｉｎ")).toBe("admin");
  });

  it("NFKC-normalizes ligatures", () => {
    expect(sanitizeShortText("ﬁle")).toBe("file");
  });

  it("strips NUL and other C0 control chars", () => {
    expect(sanitizeShortText("hel\x00lo")).toBe("hello");
    expect(sanitizeShortText("hel\x01lo")).toBe("hello");
    expect(sanitizeShortText("hel\x1flo")).toBe("hello");
  });

  it("strips DEL (0x7F)", () => {
    expect(sanitizeShortText("hel\x7flo")).toBe("hello");
  });

  it("strips newlines (single-line mode)", () => {
    expect(sanitizeShortText("line1\nline2")).toBe("line1line2");
  });

  it("strips tabs (single-line mode)", () => {
    expect(sanitizeShortText("col1\tcol2")).toBe("col1col2");
  });

  it("strips zero-width space", () => {
    expect(sanitizeShortText("admin​")).toBe("admin");
  });

  it("strips zero-width non-joiner", () => {
    expect(sanitizeShortText("admin‌")).toBe("admin");
  });

  it("strips zero-width joiner", () => {
    expect(sanitizeShortText("admin‍")).toBe("admin");
  });

  it("strips right-to-left override (bidi attack)", () => {
    expect(sanitizeShortText("hello‮world")).toBe("helloworld");
  });

  it("strips BOM", () => {
    expect(sanitizeShortText("﻿hello")).toBe("hello");
  });

  it("trims leading and trailing whitespace", () => {
    expect(sanitizeShortText("  hello  ")).toBe("hello");
  });

  it("passes normal ASCII text through unchanged", () => {
    expect(sanitizeShortText("Hello, World! 123")).toBe("Hello, World! 123");
  });

  it("passes emoji through unchanged", () => {
    expect(sanitizeShortText("hello 🎮")).toBe("hello 🎮");
  });
});

describe("sanitizeMultilineText", () => {
  it("returns empty string for empty input", () => {
    expect(sanitizeMultilineText("")).toBe("");
  });

  it("preserves newlines", () => {
    expect(sanitizeMultilineText("line1\nline2")).toBe("line1\nline2");
  });

  it("preserves tabs", () => {
    expect(sanitizeMultilineText("col1\tcol2")).toBe("col1\tcol2");
  });

  it("strips NUL but not newline", () => {
    expect(sanitizeMultilineText("hel\x00lo\nworld")).toBe("hello\nworld");
  });

  it("strips zero-width and bidi chars", () => {
    expect(sanitizeMultilineText("admin​\nuser")).toBe("admin\nuser");
  });

  it("does not trim leading/trailing whitespace", () => {
    expect(sanitizeMultilineText("  hello  ")).toBe("  hello  ");
  });

  it("NFKC-normalizes fullwidth chars", () => {
    expect(sanitizeMultilineText("ａｄｍｉｎ")).toBe("admin");
  });
});
