import { describe, it, expect } from "vitest";
import { planSummarization } from "./conversation-memory";

// windowSize=10, batchMin=6 を想定したテスト
const WINDOW = 10;

describe("planSummarization", () => {
  it("メッセージが履歴ウィンドウ内に収まるうちは要約しない", () => {
    expect(planSummarization(0, 0, WINDOW)).toBeNull();
    expect(planSummarization(10, 0, WINDOW)).toBeNull();
    expect(planSummarization(15, 0, WINDOW)).toBeNull();
  });

  it("未要約分がウィンドウ + バッチ最小数を超えたら要約を計画する", () => {
    const plan = planSummarization(16, 0, WINDOW);
    expect(plan).toEqual({
      fromIndex: 0,
      toIndex: 6,
      newSummarizedCount: 6,
    });
  });

  it("既に要約済みの分はスキップして続きから要約する", () => {
    // 30件中 6件要約済み → 未要約 24件 > 16 → [6, 20) を要約
    const plan = planSummarization(30, 6, WINDOW);
    expect(plan).toEqual({
      fromIndex: 6,
      toIndex: 20,
      newSummarizedCount: 20,
    });
  });

  it("要約済み + ウィンドウでカバーされていれば何もしない", () => {
    // 20件中 10件要約済み → 未要約の古いメッセージなし
    expect(planSummarization(20, 10, WINDOW)).toBeNull();
    expect(planSummarization(25, 10, WINDOW)).toBeNull();
  });

  it("常に直近ウィンドウ分は要約対象に含めない", () => {
    const plan = planSummarization(100, 0, WINDOW);
    expect(plan?.toIndex).toBe(90);
  });
});
