"use client";

export default function HistoryPage() {
  return (
    <div className="flex-1 p-4 pb-20 window:pb-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">相談履歴</h1>

        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="text-6xl mb-4 opacity-30">📝</div>
          <h2 className="text-lg font-medium text-base-content/60 mb-2">
            履歴機能は準備中です
          </h2>
          <p className="text-sm text-base-content/40 max-w-xs">
            現在、相談はセッション内のみで保持されます。
            セッションをまたいだ履歴機能は今後のアップデートで追加予定です。
          </p>
        </div>

        {/* Placeholder for future implementation */}
        <div className="card bg-base-200 mt-8">
          <div className="card-body">
            <h3 className="card-title text-base">
              プライバシーについて
            </h3>
            <p className="text-sm text-base-content/60">
              Yamiiはプライバシーファーストの設計です。
              相談内容はサーバーに保存されず、
              セッション終了後は自動的に削除されます。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
