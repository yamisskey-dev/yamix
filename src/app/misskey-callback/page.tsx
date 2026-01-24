"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, Suspense } from "react";
import { Modal } from "@/components/Modal";
import { LoadingSpinner } from "@/components/LoadingSpinner";

function CallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string>();
  const errorModalRef = useRef<HTMLDialogElement>(null);
  const processedRef = useRef(false);

  useEffect(() => {
    const processCallback = async () => {
      // Prevent double processing
      if (processedRef.current) return;
      processedRef.current = true;

      const token = searchParams.get("token");
      const server = localStorage.getItem("yamix_server");

      if (!token) {
        setError("認証トークンがありません");
        errorModalRef.current?.showModal();
        return;
      }

      if (!server) {
        setError("サーバー情報がありません");
        errorModalRef.current?.showModal();
        return;
      }

      try {
        const res = await fetch("/api/auth/callback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, host: server }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "認証に失敗しました");
        }

        const data = await res.json();

        // Store user info in localStorage for quick access
        localStorage.setItem("yamix_handle", data.handle);
        localStorage.setItem("yamix_displayName", data.displayName || "");
        if (data.avatarUrl) {
          localStorage.setItem("yamix_avatarUrl", data.avatarUrl);
        }

        // Redirect to main page
        router.replace("/main");
      } catch (err) {
        setError(err instanceof Error ? err.message : "認証に失敗しました");
        errorModalRef.current?.showModal();
      }
    };

    processCallback();
  }, [router, searchParams]);

  const handleModalClose = () => {
    router.replace("/");
  };

  return (
    <div className="w-screen h-screen flex flex-col items-center justify-center gap-4">
      <LoadingSpinner size="lg" text="認証中..." />

      <Modal
        ref={errorModalRef}
        title="認証エラー"
        body={error || "認証に失敗しました"}
        buttonText="戻る"
        onClick={handleModalClose}
      />
    </div>
  );
}

export default function MisskeyCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="w-screen h-screen flex items-center justify-center">
          <LoadingSpinner size="lg" />
        </div>
      }
    >
      <CallbackContent />
    </Suspense>
  );
}
