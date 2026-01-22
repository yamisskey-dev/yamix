"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/contexts/UserContext";
import { useTheme } from "@/contexts/ThemeContext";
import { ConfirmModal, Modal } from "@/components/Modal";
import type { UserStats } from "@/types";

interface WalletData {
  balance: number;
  economy?: {
    equilibriumBalance: number;
    todayGrant?: { granted: boolean; amount: number };
    todayDecay?: { applied: boolean; decayAmount: number };
  };
}

export default function SettingsPage() {
  const router = useRouter();
  const { user } = useUser();
  const { theme, preference, setPreference } = useTheme();
  const [isDeleting, setIsDeleting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportData, setExportData] = useState<string>();
  const deleteModalRef = useRef<HTMLDialogElement>(null);
  const exportModalRef = useRef<HTMLDialogElement>(null);
  const successModalRef = useRef<HTMLDialogElement>(null);
  const [successMessage, setSuccessMessage] = useState("");
  const [customPrompt, setCustomPrompt] = useState("");
  const [isSavingPrompt, setIsSavingPrompt] = useState(false);
  const [promptSaved, setPromptSaved] = useState(false);
  const [promptError, setPromptError] = useState("");
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loadingWallet, setLoadingWallet] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await fetch("/api/yamii/user");
        if (res.ok) {
          const data = await res.json();
          if (data.explicit_profile) {
            setCustomPrompt(data.explicit_profile);
          }
        }
      } catch (error) {
        console.error("Failed to fetch profile:", error);
      }
    };
    fetchProfile();
  }, []);

  useEffect(() => {
    const fetchWalletAndStats = async () => {
      try {
        const [walletRes, statsRes] = await Promise.all([
          fetch("/api/wallets"),
          fetch("/api/stats"),
        ]);
        if (walletRes.ok) {
          setWallet(await walletRes.json());
        }
        if (statsRes.ok) {
          setStats(await statsRes.json());
        }
      } catch (error) {
        console.error("Failed to fetch wallet/stats:", error);
      } finally {
        setLoadingWallet(false);
      }
    };
    fetchWalletAndStats();
  }, []);

  const handleSaveCustomPrompt = async () => {
    setIsSavingPrompt(true);
    setPromptError("");
    try {
      const res = await fetch("/api/yamii/user", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ explicit_profile: customPrompt }),
      });
      if (res.ok) {
        setPromptSaved(true);
        setTimeout(() => setPromptSaved(false), 2000);
      } else {
        const data = await res.json();
        setPromptError(data.error || "保存に失敗しました");
      }
    } catch (error) {
      console.error("Failed to save custom prompt:", error);
      setPromptError("保存に失敗しました");
    } finally {
      setIsSavingPrompt(false);
    }
  };

  const handleExportData = async () => {
    setIsExporting(true);
    try {
      const res = await fetch("/api/yamii/user");
      if (res.ok) {
        const data = await res.json();
        setExportData(JSON.stringify(data, null, 2));
        exportModalRef.current?.showModal();
      }
    } catch (error) {
      console.error("Export error:", error);
    } finally {
      setIsExporting(false);
    }
  };

  const handleDeleteData = async () => {
    setIsDeleting(true);
    try {
      const res = await fetch("/api/yamii/user", { method: "DELETE" });
      if (res.ok) {
        setSuccessMessage("データを削除しました。またいつでも戻ってきてください。");
        successModalRef.current?.showModal();
      }
    } catch (error) {
      console.error("Delete error:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    localStorage.removeItem("yamix_handle");
    localStorage.removeItem("yamix_displayName");
    localStorage.removeItem("yamix_avatarUrl");
    router.replace("/");
  };

  if (!user) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <span className="loading loading-spinner loading-lg" />
      </div>
    );
  }

  return (
    <div className="flex-1 p-4 pb-20 window:pb-4">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Theme Section - Misskey style */}
        <div className="card bg-base-200 overflow-hidden">
          <div className="card-body p-0">
            {/* Dark/Light Toggle - Misskey style */}
            <div className="flex justify-center py-6">
              <div
                onClick={() => setPreference(theme === "dark" ? "light" : "dark")}
                className={`
                  relative w-[90px] h-[40px] rounded-full cursor-pointer
                  transition-colors duration-200 ease-[cubic-bezier(0.445,0.05,0.55,0.95)]
                  ${theme === "dark" ? "bg-[#749DD6]" : "bg-[#83D8FF]"}
                `}
              >
                {/* Light label */}
                <span
                  className={`
                    absolute left-[-70px] top-1/2 -translate-y-1/2
                    text-sm font-medium transition-colors duration-200
                    ${theme === "light" ? "text-primary" : "text-base-content/40"}
                  `}
                >
                  Light
                </span>

                {/* Dark label */}
                <span
                  className={`
                    absolute right-[-60px] top-1/2 -translate-y-1/2
                    text-sm font-medium transition-colors duration-200
                    ${theme === "dark" ? "text-primary" : "text-base-content/40"}
                  `}
                >
                  Dark
                </span>

                {/* Handler (Moon/Sun) */}
                <span
                  className={`
                    absolute top-[3px] left-[3px] w-[34px] h-[34px]
                    bg-[#FFCF96] rounded-full
                    transition-all duration-200 ease-[cubic-bezier(0.445,0.05,0.55,0.95)]
                    ${theme === "dark" ? "translate-x-[50px] rotate-0" : "rotate-[-45deg]"}
                  `}
                >
                  {/* Craters (visible in dark mode) */}
                  <span
                    className={`
                      absolute top-[14px] left-[8px] w-[4px] h-[4px]
                      bg-[#E8CDA5] rounded-full
                      transition-opacity duration-200
                      ${theme === "dark" ? "opacity-100" : "opacity-0"}
                    `}
                  />
                  <span
                    className={`
                      absolute top-[6px] left-[18px] w-[6px] h-[6px]
                      bg-[#E8CDA5] rounded-full
                      transition-opacity duration-200
                      ${theme === "dark" ? "opacity-100" : "opacity-0"}
                    `}
                  />
                  <span
                    className={`
                      absolute top-[21px] left-[18px] w-[3px] h-[3px]
                      bg-[#E8CDA5] rounded-full
                      transition-opacity duration-200
                      ${theme === "dark" ? "opacity-100" : "opacity-0"}
                    `}
                  />
                </span>

                {/* Stars (visible in dark mode) */}
                <span
                  className={`
                    absolute top-[5px] left-[28px] w-[3px] h-[3px]
                    bg-white rounded-full
                    transition-all duration-200
                    ${theme === "dark" ? "opacity-100" : "opacity-0 translate-x-[3px]"}
                  `}
                />
                <span
                  className={`
                    absolute top-[13px] left-[20px] w-[3px] h-[3px]
                    bg-white rounded-full
                    transition-all duration-200
                    ${theme === "dark" ? "opacity-100" : "opacity-0 translate-x-[3px]"}
                  `}
                />
                <span
                  className={`
                    absolute top-[24px] left-[26px] w-[2px] h-[2px]
                    bg-white rounded-full
                    transition-all duration-200
                    ${theme === "dark" ? "opacity-100" : "opacity-0 translate-x-[3px]"}
                  `}
                />
                <span
                  className={`
                    absolute top-[8px] left-[10px] w-[2px] h-[2px]
                    bg-white rounded-full
                    transition-all duration-300 delay-[200ms]
                    ${theme === "dark" ? "opacity-100" : "opacity-0 translate-x-[3px]"}
                  `}
                />
                <span
                  className={`
                    absolute top-[28px] left-[14px] w-[2px] h-[2px]
                    bg-white rounded-full
                    transition-all duration-300 delay-[300ms]
                    ${theme === "dark" ? "opacity-100" : "opacity-0 translate-x-[3px]"}
                  `}
                />
                <span
                  className={`
                    absolute top-[18px] left-[8px] w-[2px] h-[2px]
                    bg-white rounded-full
                    transition-all duration-300 delay-[400ms]
                    ${theme === "dark" ? "opacity-100" : "opacity-0 translate-x-[3px]"}
                  `}
                />
              </div>
            </div>

            {/* System Sync Toggle */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-base-content/10">
              <span className="text-sm">デバイスのダークモードと同期</span>
              <input
                type="checkbox"
                className="toggle toggle-sm toggle-primary"
                checked={preference === "system"}
                onChange={(e) => {
                  if (e.target.checked) {
                    setPreference("system");
                  } else {
                    setPreference(theme);
                  }
                }}
              />
            </div>
          </div>
        </div>

        {/* Token Economy Section */}
        <div className="card bg-base-200">
          <div className="card-body">
            <h2 className="card-title text-lg">トークン経済</h2>
            {loadingWallet ? (
              <div className="flex justify-center py-4">
                <span className="loading loading-spinner loading-md" />
              </div>
            ) : wallet ? (
              <div className="space-y-4">
                {/* Balance Display */}
                <div className="flex items-center justify-between">
                  <span className="text-base-content/70">現在の残高</span>
                  <div className="text-right">
                    <span className="text-2xl font-bold font-mono">{wallet.balance}</span>
                    <span className="text-sm text-base-content/50 ml-1">YAMI</span>
                  </div>
                </div>

                {/* Progress to Equilibrium */}
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-base-content/60">均衡残高まで</span>
                    <span className="text-base-content/60">
                      {wallet.economy?.equilibriumBalance ?? 50} YAMI
                    </span>
                  </div>
                  <progress
                    className="progress progress-primary w-full"
                    value={wallet.balance}
                    max={wallet.economy?.equilibriumBalance ?? 50}
                  />
                </div>

                {/* Today's Economy */}
                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div className="bg-base-300 rounded-lg p-3 text-center">
                    <div className="text-xs text-base-content/60 mb-1">今日の付与</div>
                    <div className="font-mono text-lg">
                      {wallet.economy?.todayGrant?.granted
                        ? `+${wallet.economy.todayGrant.amount}`
                        : "-"}
                    </div>
                  </div>
                  <div className="bg-base-300 rounded-lg p-3 text-center">
                    <div className="text-xs text-base-content/60 mb-1">今日の減衰</div>
                    <div className="font-mono text-lg">
                      {wallet.economy?.todayDecay?.applied
                        ? `-${wallet.economy.todayDecay.decayAmount}`
                        : "-"}
                    </div>
                  </div>
                </div>

                {/* Dependency Level */}
                {stats?.dependency && (
                  <div className="pt-2 border-t border-base-content/10">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-base-content/70">依存度</span>
                      <span
                        className={`badge ${
                          stats.dependency.level === "LOW"
                            ? "badge-success"
                            : stats.dependency.level === "MODERATE"
                              ? "badge-info"
                              : stats.dependency.level === "HIGH"
                                ? "badge-warning"
                                : "badge-error"
                        }`}
                      >
                        {stats.dependency.label}
                      </span>
                    </div>
                    <p className="text-xs text-base-content/50">
                      {stats.dependency.description}
                    </p>
                    <progress
                      className={`progress w-full mt-2 ${
                        stats.dependency.score <= 25
                          ? "progress-success"
                          : stats.dependency.score <= 50
                            ? "progress-info"
                            : stats.dependency.score <= 75
                              ? "progress-warning"
                              : "progress-error"
                      }`}
                      value={stats.dependency.score}
                      max={100}
                    />
                  </div>
                )}

                {/* Usage Stats */}
                {stats && (
                  <div className="pt-2 border-t border-base-content/10">
                    <div className="text-sm text-base-content/60 mb-2">今週の利用状況</div>
                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                      <div>
                        <div className="text-base-content/50">AI相談</div>
                        <div className="font-mono text-lg">{stats.week.aiConsults}</div>
                      </div>
                      <div>
                        <div className="text-base-content/50">消費</div>
                        <div className="font-mono text-lg text-error">-{stats.week.tokensSpent}</div>
                      </div>
                      <div>
                        <div className="text-base-content/50">獲得</div>
                        <div className="font-mono text-lg text-success">+{stats.week.tokensEarned}</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-base-content/60">
                ウォレット情報を取得できませんでした。
              </p>
            )}
          </div>
        </div>

        {/* Custom Prompt Section */}
        <div className="card bg-base-200">
          <div className="card-body">
            <h2 className="card-title text-lg">カスタムプロンプト</h2>
            <textarea
              className="textarea textarea-bordered w-full h-32 text-sm"
              placeholder="例: 敬語で話してください / アドバイスより共感を重視して / 私は20代エンジニアです"
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
            />
            <div className="card-actions justify-end items-center">
              {promptError && (
                <span className="text-error text-sm">{promptError}</span>
              )}
              <button
                className={`btn btn-primary btn-sm ${isSavingPrompt ? "btn-disabled" : ""}`}
                onClick={handleSaveCustomPrompt}
                disabled={isSavingPrompt}
              >
                {isSavingPrompt ? (
                  <span className="loading loading-spinner loading-xs" />
                ) : promptSaved ? (
                  "保存しました"
                ) : (
                  "保存"
                )}
              </button>
            </div>
          </div>
        </div>

        {/* ETH Wallet Section (Coming Soon) */}
        <div className="card bg-base-200">
          <div className="card-body">
            <h2 className="card-title text-lg">
              ETHウォレット連携
              <span className="badge badge-outline badge-sm">Coming Soon</span>
            </h2>
            <p className="text-sm text-base-content/60">
              YAMIが不足したときにOptimism
              ETHで購入できるようになります。
            </p>
            <div className="card-actions justify-end">
              <button className="btn btn-disabled btn-sm">
                ウォレット接続
              </button>
            </div>
          </div>
        </div>

        {/* Data Management Section */}
        <div className="card bg-base-200">
          <div className="card-body">
            <h2 className="card-title text-lg">データ管理</h2>
            <p className="text-sm text-base-content/60">
              GDPRに準拠したデータ管理機能です。
            </p>
            <div className="card-actions justify-end gap-2">
              <button
                className={`btn btn-outline btn-sm ${isExporting ? "btn-disabled" : ""}`}
                onClick={handleExportData}
                disabled={isExporting}
              >
                {isExporting ? (
                  <span className="loading loading-spinner loading-xs" />
                ) : (
                  "データをエクスポート"
                )}
              </button>
              <button
                className="btn btn-error btn-outline btn-sm"
                onClick={() => deleteModalRef.current?.showModal()}
              >
                データを削除
              </button>
            </div>
          </div>
        </div>

        {/* Logout Section */}
        <div className="card bg-base-200">
          <div className="card-body">
            <h2 className="card-title text-lg">アカウント</h2>
            <div className="card-actions justify-end">
              <button className="btn btn-error btn-sm" onClick={handleLogout}>
                ログアウト
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        ref={deleteModalRef}
        title="データ削除の確認"
        body={`この操作は取り消せません。\nYamii上のあなたのデータ（相談履歴、学習データなど）がすべて削除されます。\n\n本当に削除しますか？`}
        confirmText={isDeleting ? "削除中..." : "削除する"}
        cancelText="キャンセル"
        onConfirm={handleDeleteData}
        confirmButtonClass="btn-error"
      />

      {/* Export Data Modal */}
      <dialog ref={exportModalRef} className="modal">
        <div className="modal-box max-w-2xl">
          <h3 className="font-bold text-lg">エクスポートデータ</h3>
          <div className="py-4">
            <pre className="bg-base-300 p-4 rounded-lg text-xs overflow-auto max-h-96">
              {exportData}
            </pre>
          </div>
          <div className="modal-action">
            <button
              className="btn btn-primary btn-sm"
              onClick={() => {
                if (exportData) {
                  navigator.clipboard.writeText(exportData);
                }
              }}
            >
              コピー
            </button>
            <form method="dialog">
              <button className="btn btn-sm">閉じる</button>
            </form>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button>close</button>
        </form>
      </dialog>

      {/* Success Modal */}
      <Modal
        ref={successModalRef}
        title="完了"
        body={successMessage}
        buttonText="OK"
      />
    </div>
  );
}
