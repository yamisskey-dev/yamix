/**
 * 5フラグ制の表示UIコンポーネント
 * 危機検出回数を視覚的に表示
 */

interface CrisisStrikeIndicatorProps {
  crisisCount: number;
  consultType?: "PRIVATE" | "PUBLIC" | "DIRECTED";
  className?: string;
}

export function CrisisStrikeIndicator({
  crisisCount,
  consultType,
  className = ""
}: CrisisStrikeIndicatorProps) {
  // PRIVATE相談はフラグ制の対象外
  if (consultType === "PRIVATE") {
    return null;
  }

  // フラグがない場合は表示しない
  if (crisisCount === 0) {
    return null;
  }

  const maxStrikes = 5;
  const isMaxStrikes = crisisCount >= maxStrikes;

  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      <span className="text-base">🚩</span>
      <span
        className={`text-xs font-medium ${
          isMaxStrikes ? "text-error" : "text-info"
        }`}
      >
        {isMaxStrikes ? "非公開化" : `${crisisCount}/5`}
      </span>
    </div>
  );
}

/**
 * コンパクト版（セッション一覧用）
 */
export function CrisisStrikeIndicatorCompact({
  crisisCount,
  consultType,
  className = ""
}: CrisisStrikeIndicatorProps) {
  // PRIVATE相談はフラグ制の対象外
  if (consultType === "PRIVATE") {
    return null;
  }

  // フラグがない場合は表示しない
  if (crisisCount === 0) {
    return null;
  }

  const maxStrikes = 5;
  const isMaxStrikes = crisisCount >= maxStrikes;

  return (
    <div className={`flex items-center gap-1 ${className}`} title={`危機検出: ${crisisCount}/5`}>
      <span className="text-sm">🚩</span>
      <span
        className={`text-xs ${
          isMaxStrikes ? "text-error" : "text-info"
        }`}
      >
        {crisisCount}/5
      </span>
    </div>
  );
}
