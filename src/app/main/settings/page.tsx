"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/contexts/UserContext";
import { useTheme } from "@/contexts/ThemeContext";
import { ConfirmModal, Modal } from "@/components/Modal";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { useToast } from "@/components/Toast";

export default function SettingsPage() {
  const router = useRouter();
  const { user } = useUser();
  const { theme, preference, setPreference } = useTheme();
  const toast = useToast();
  const [isDeleting, setIsDeleting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportData, setExportData] = useState<string>();
  const deleteModalRef = useRef<HTMLDialogElement>(null);
  const deleteSessionsModalRef = useRef<HTMLDialogElement>(null);
  const exportModalRef = useRef<HTMLDialogElement>(null);
  const successModalRef = useRef<HTMLDialogElement>(null);
  const [successMessage, setSuccessMessage] = useState("");
  const [isDeletingSessions, setIsDeletingSessions] = useState(false);
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
  const [allowDirectedConsult, setAllowDirectedConsult] = useState(false);
  const [isSavingDirected, setIsSavingDirected] = useState(false);

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

  // 指名相談設定を取得
  useEffect(() => {
    const fetchDirectedSetting = async () => {
      try {
        const res = await fetch("/api/auth/me");
        if (res.ok) {
          const data = await res.json();
          if (data.allowDirectedConsult !== undefined) {
            setAllowDirectedConsult(data.allowDirectedConsult);
          }
        }
      } catch (error) {
        console.error("Failed to fetch directed setting:", error);
      }
    };
    fetchDirectedSetting();
  }, []);

  const handleToggleDirectedConsult = async (value: boolean) => {
    setIsSavingDirected(true);
    try {
      const res = await fetch("/api/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ allowDirectedConsult: value }),
      });
      if (res.ok) {
        setAllowDirectedConsult(value);
      }
    } catch (error) {
      console.error("Failed to update directed setting:", error);
    } finally {
      setIsSavingDirected(false);
    }
  };

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

  const handleDeletePrivateSessions = async () => {
    setIsDeletingSessions(true);
    try {
      const res = await fetch("/api/chat/sessions?type=private", {
        method: "DELETE",
      });
      if (res.ok) {
        const data = await res.json();
        setSuccessMessage(`${data.deletedCount}件のプライベート相談を削除しました。`);
        successModalRef.current?.showModal();
      } else {
        const data = await res.json();
        toast.error(data.error || "削除に失敗しました");
      }
    } catch (error) {
      console.error("Delete sessions error:", error);
      toast.error("削除に失敗しました");
    } finally {
      setIsDeletingSessions(false);
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
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-3 pb-20 window:pb-4">
      <div className="max-w-2xl mx-auto space-y-4">
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
            <div className="flex items-center justify-between px-5 py-3 border-t border-base-content/10">
              <span className="text-[13px]">デバイスのダークモードと同期</span>
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
          <div className="card-body p-4">
            <h2 className="card-title text-base gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-primary">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
              </svg>
              カスタムプロンプト
            </h2>
            <textarea
              className="textarea textarea-bordered w-full h-28 text-[13px]"
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
                  <LoadingSpinner size="xs" inline />
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
          <div className="card-body p-4">
            <h2 className="card-title text-base gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-warning">
                <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
              ブロックリスト
            </h2>
            <p className="text-sm text-base-content/60 mb-2">
              ブロックしたユーザーはあなたの公開相談に回答できません。
            </p>
            {isLoadingBlocks ? (
              <div className="flex justify-center py-4">
                <LoadingSpinner size="sm" />
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
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-base-content/50">
                              <path fillRule="evenodd" d="M7.5 6a4.5 4.5 0 1 1 9 0 4.5 4.5 0 0 1-9 0ZM3.751 20.105a8.25 8.25 0 0 1 16.498 0 .75.75 0 0 1-.437.695A18.683 18.683 0 0 1 12 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 0 1-.437-.695Z" clipRule="evenodd" />
                            </svg>
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

        {/* Directed Consultation Opt-out */}
        <div className="card bg-base-200">
          <div className="card-body p-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-medium flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-accent">
                    <path d="M3 4a2 2 0 012-2h10a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V4zm2.5 1a.5.5 0 00-.5.5v1.077l4.146 2.907a1.5 1.5 0 001.708 0L15 6.577V5.5a.5.5 0 00-.5-.5h-9zM15 8.077l-3.854 2.7a2.5 2.5 0 01-2.848-.056L4.5 8.077V13.5a.5.5 0 00.5.5h9.5a.5.5 0 00.5-.5V8.077z" />
                  </svg>
                  指名相談を受け付ける
                </h2>
                <p className="text-xs text-base-content/60 mt-1">
                  オフにすると、他のユーザーからの指名相談が届かなくなります
                </p>
              </div>
              <input
                type="checkbox"
                className="toggle toggle-sm toggle-primary"
                checked={allowDirectedConsult}
                disabled={isSavingDirected}
                onChange={(e) => handleToggleDirectedConsult(e.target.checked)}
              />
            </div>
          </div>
        </div>

        {/* Data Management Section */}
        <div className="card bg-base-200 border border-error/20">
          <div className="card-body p-4">
            <h2 className="card-title text-base gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-error">
                <path strokeLinecap="round" strokeLinejoin="round" d="m20.25 7.5-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5m6 4.125 2.25 2.25m0 0 2.25 2.25M12 13.875l2.25-2.25M12 13.875l-2.25 2.25M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" />
              </svg>
              データ管理
            </h2>
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
                      <LoadingSpinner size="xs" inline />
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
                <h3 className="text-sm font-medium mb-1">チャットの削除</h3>
                <p className="text-xs text-base-content/60 mb-2">
                  相談ページから個別に削除できます。一括削除も可能です。
                </p>
                <button
                  className="btn btn-error btn-outline btn-sm"
                  onClick={() => deleteSessionsModalRef.current?.showModal()}
                >
                  全てのプライベート相談を削除
                </button>
                <p className="text-xs text-base-content/40 mt-2">
                  ※ 公開相談は個別に削除してください（他人の回答も削除されるため）
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Logout Section */}
        <div className="card bg-base-200">
          <div className="card-body p-4">
            <h2 className="card-title text-base gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-base-content/70">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
              </svg>
              アカウント
            </h2>
            <div className="card-actions justify-end">
              <button className="btn btn-error btn-sm gap-2" onClick={handleLogout}>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 9V5.25A2.25 2.25 0 0 1 10.5 3h6a2.25 2.25 0 0 1 2.25 2.25v13.5A2.25 2.25 0 0 1 16.5 21h-6a2.25 2.25 0 0 1-2.25-2.25V15m-3 0-3-3m0 0 3-3m-3 3H15" />
                </svg>
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

      {/* Delete All Private Sessions Confirmation Modal */}
      <ConfirmModal
        ref={deleteSessionsModalRef}
        title="プライベート相談を全て削除"
        body={`全てのプライベート相談（AI専用の非公開相談）とそのメッセージが完全に削除されます。\nこの操作は取り消せません。\n\n※ 公開相談は削除されません。\n\n本当に削除しますか？`}
        confirmText={isDeletingSessions ? "削除中..." : "削除する"}
        cancelText="キャンセル"
        onConfirm={handleDeletePrivateSessions}
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
