"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useUser } from "@/contexts/UserContext";
import { ConfirmModal, Modal } from "@/components/Modal";

export default function SettingsPage() {
  const router = useRouter();
  const { user } = useUser();
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
