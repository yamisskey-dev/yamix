/**
 * 危機キーワード検出ユーティリティ
 * AIモデレーション失敗時のフォールバック用
 */

const CRISIS_KEYWORDS = [
  "死にたい", "死のう", "自殺", "殺して", "消えたい",
  "生きていたくない", "もう終わり", "飛び降り", "首を吊",
  "リストカット", "ODした", "薬を大量",
];

export function checkCrisisKeywords(message: string): boolean {
  const lower = message.toLowerCase();
  return CRISIS_KEYWORDS.some((kw) => lower.includes(kw));
}
