"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/contexts/UserContext";
import { useTheme } from "@/contexts/ThemeContext";
import { ConfirmModal, Modal } from "@/components/Modal";

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
  const [blockedUsers, setBlockedUsers] = useState<Array<{
    id: string;
    blockedUser: {
      id: string;
      handle: string;
      displayName: string | null;
      avatarUrl: string | null;
    } | null;
  }>>([]);
  const [isLoadingBlocks, setIsLoadingBlocks] = useState(true);

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
    const fetchBlockedUsers = async () => {
      try {
        const res = await fetch("/api/users/block");
        if (res.ok) {
          const data = await res.json();
          setBlockedUsers(data.blocks);
        }
      } catch (error) {
        console.error("Failed to fetch blocked users:", error);
      } finally {
        setIsLoadingBlocks(false);
      }
    };
    fetchBlockedUsers();
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

  const handleUnblock = async (userId: string) => {
    try {
      const res = await fetch(`/api/users/block/${userId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setBlockedUsers(blockedUsers.filter((b) => b.blockedUser?.id !== userId));
      }
    } catch (error) {
      console.error("Failed to unblock user:", error);
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
    <div className="flex-1 overflow-y-auto p-4 pb-20 window:pb-4">
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

        {/* Blocked Users Section */}
        <div className="card bg-base-200">
          <div className="card-body">
            <h2 className="card-title text-lg">ブロックリスト</h2>
            <p className="text-sm text-base-content/60 mb-2">
              ブロックしたユーザーはあなたの公開相談に回答できません。
            </p>
            {isLoadingBlocks ? (
              <div className="flex justify-center py-4">
                <span className="loading loading-spinner loading-sm" />
              </div>
            ) : blockedUsers.length === 0 ? (
              <p className="text-sm text-base-content/40 py-4 text-center">
                ブロックしているユーザーはいません
              </p>
            ) : (
              <div className="space-y-2">
                {blockedUsers.map((block) => (
                  <div
                    key={block.id}
                    className="flex items-center justify-between p-2 bg-base-300 rounded-lg"
                  >
                    <div className="flex items-center gap-2">
                      <div className="avatar">
                        <div className="w-8 h-8 rounded-full bg-base-content/10 flex items-center justify-center">
                          {block.blockedUser?.avatarUrl ? (
                            <img src={block.blockedUser.avatarUrl} alt="" />
                          ) : (
                            <span className="text-sm">👤</span>
                          )}
                        </div>
                      </div>
                      <div>
                        <p className="text-sm font-medium">
                          {block.blockedUser?.displayName || block.blockedUser?.handle || "Unknown"}
                        </p>
                        <p className="text-xs text-base-content/60">
                          @{block.blockedUser?.handle || "unknown"}
                        </p>
                      </div>
                    </div>
                    <button
                      className="btn btn-sm btn-ghost"
                      onClick={() => block.blockedUser && handleUnblock(block.blockedUser.id)}
                    >
                      解除
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Data Management Section */}
        <div className="card bg-base-200">
          <div className="card-body">
            <h2 className="card-title text-lg">データ管理</h2>
            <div className="space-y-3">
              <div>
                <h3 className="text-sm font-medium mb-1">AI学習データ</h3>
                <p className="text-xs text-base-content/60 mb-2">
                  YamiiのAI学習データ（会話履歴、カスタムプロンプトなど）のエクスポートと削除ができます。
                  <br />
                  <span className="text-warning">※ Yamix上の相談・回答は削除されません。</span>
                </p>
                <div className="flex gap-2">
                  <button
                    className={`btn btn-outline btn-sm ${isExporting ? "btn-disabled" : ""}`}
                    onClick={handleExportData}
                    disabled={isExporting}
                  >
                    {isExporting ? (
                      <span className="loading loading-spinner loading-xs" />
                    ) : (
                      "エクスポート"
                    )}
                  </button>
                  <button
                    className="btn btn-error btn-outline btn-sm"
                    onClick={() => deleteModalRef.current?.showModal()}
                  >
                    AI学習データを削除
                  </button>
                </div>
              </div>
              <div className="divider my-2"></div>
              <div>
                <h3 className="text-sm font-medium mb-1">相談・回答の削除</h3>
                <p className="text-xs text-base-content/60">
                  各相談ページから個別に削除できます。他のユーザーへの回答は削除できません。
                </p>
              </div>
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
        title="AI学習データ削除の確認"
        body={`この操作は取り消せません。\nYamii APIのAI学習データ（会話履歴、カスタムプロンプトなど）が削除されます。\n\n※ Yamix上の相談・回答は削除されません。各相談ページから個別に削除してください。\n\n本当に削除しますか？`}
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
