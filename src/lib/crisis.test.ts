import { describe, it, expect } from "vitest";
import { checkCrisisKeywords } from "./crisis";

describe("checkCrisisKeywords", () => {
  it("detects 死にたい", () => {
    expect(checkCrisisKeywords("死にたい")).toBe(true);
  });

  it("detects 自殺", () => {
    expect(checkCrisisKeywords("自殺したい")).toBe(true);
  });

  it("detects keyword in longer message", () => {
    expect(checkCrisisKeywords("もう何もかも嫌で消えたいです")).toBe(true);
  });

  it("detects リストカット", () => {
    expect(checkCrisisKeywords("リストカットしてしまった")).toBe(true);
  });

  it("returns false for safe messages", () => {
    expect(checkCrisisKeywords("今日はいい天気ですね")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(checkCrisisKeywords("")).toBe(false);
  });

  it("returns false for unrelated content", () => {
    expect(checkCrisisKeywords("仕事の悩みがあります")).toBe(false);
  });
});
