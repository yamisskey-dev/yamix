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
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="flex items-center gap-1">
        {[...Array(maxStrikes)].map((_, index) => {
          const isActive = index < crisisCount;
          return (
            <div
              key={index}
              className={`w-2 h-2 rounded-full transition-colors ${
                isActive
                  ? isMaxStrikes
                    ? "bg-error animate-pulse"
                    : "bg-warning"
                  : "bg-base-300"
              }`}
              title={`フラグ ${index + 1}${isActive ? " (検出済み)" : ""}`}
            />
          );
        })}
      </div>
      <span
        className={`text-xs font-medium ${
          isMaxStrikes ? "text-error" : "text-warning"
        }`}
      >
        {isMaxStrikes ? "非公開化" : `フラグ ${crisisCount}/5`}
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
      {[...Array(maxStrikes)].map((_, index) => {
        const isActive = index < crisisCount;
        return (
          <div
            key={index}
            className={`w-1.5 h-1.5 rounded-full ${
              isActive
                ? isMaxStrikes
                  ? "bg-error"
                  : "bg-warning"
                : "bg-base-300"
            }`}
          />
        );
      })}
    </div>
  );
}
