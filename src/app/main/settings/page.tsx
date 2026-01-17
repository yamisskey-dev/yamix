"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useUser } from "@/contexts/UserContext";
import { useTheme } from "@/contexts/ThemeContext";
import { ConfirmModal, Modal } from "@/components/Modal";

export default function SettingsPage() {
  const router = useRouter();
  const { user } = useUser();
  const { preference, setPreference } = useTheme();
  const [isDeleting, setIsDeleting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportData, setExportData] = useState<string>();
  const deleteModalRef = useRef<HTMLDialogElement>(null);
  const exportModalRef = useRef<HTMLDialogElement>(null);
  const successModalRef = useRef<HTMLDialogElement>(null);
  const [successMessage, setSuccessMessage] = useState("");

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
        <h1 className="text-2xl font-bold">設定</h1>

        {/* Theme Section */}
        <div className="card bg-base-200">
          <div className="card-body">
            <h2 className="card-title text-lg">テーマ</h2>
            <p className="text-sm text-base-content/60">
              アプリの外観を切り替えます
            </p>
            <div className="flex gap-2 mt-2 flex-wrap">
              <button
                onClick={() => setPreference("system")}
                className={`flex-1 btn btn-sm min-w-fit ${
                  preference === "system" ? "btn-primary" : "btn-ghost"
                }`}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
                自動
              </button>
              <button
                onClick={() => setPreference("dark")}
                className={`flex-1 btn btn-sm min-w-fit ${
                  preference === "dark" ? "btn-primary" : "btn-ghost"
                }`}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
                  />
                </svg>
                DXM
              </button>
              <button
                onClick={() => setPreference("light")}
                className={`flex-1 btn btn-sm min-w-fit ${
                  preference === "light" ? "btn-primary" : "btn-ghost"
                }`}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
                  />
                </svg>
                NGO
              </button>
            </div>
          </div>
        </div>

        {/* Profile Section */}
        <div className="card bg-base-200">
          <div className="card-body">
            <h2 className="card-title text-lg">プロフィール</h2>
            <div className="flex items-center gap-4">
              <div className="avatar">
                <div className="w-16 rounded-full ring ring-primary ring-offset-base-100 ring-offset-2">
                  {user.avatarUrl ? (
                    <Image
                      src={user.avatarUrl}
                      alt={user.displayName || user.account}
                      width={64}
                      height={64}
                    />
                  ) : (
                    <div className="bg-primary text-primary-content flex items-center justify-center w-full h-full text-2xl font-bold">
                      {(user.displayName || user.account).charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
              </div>
              <div>
                <p className="font-bold">{user.displayName || user.account}</p>
                <p className="text-sm text-base-content/60">{user.handle}</p>
              </div>
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
              将来的にETHアドレスとMisskeyアカウントを紐づけて、
              YAMI DAOのガバナンスに参加できるようになります。
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
