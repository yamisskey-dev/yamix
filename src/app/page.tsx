"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useForm, SubmitHandler } from "react-hook-form";
import { Modal } from "@/components/Modal";
import { LoadingSpinner } from "@/components/LoadingSpinner";

interface FormValue {
  address: string;
}

function convertHost(urlOrHostOrHandle: string): string {
  // Handle URL format (https://example.com/)
  const urlRegex = /\/\/([^/@\s]+)(:[0-9]{1,5})?\/?/;
  const matchedHostFromUrl = urlOrHostOrHandle.match(urlRegex)?.[1];

  // Handle handle format (@user@example.com)
  const handleRegex = /@([^@\s]+)$/;
  const matchedHostFromHandle = urlOrHostOrHandle.match(handleRegex)?.[1];

  if (matchedHostFromUrl) {
    return matchedHostFromUrl.toLowerCase();
  } else if (matchedHostFromHandle) {
    return matchedHostFromHandle.toLowerCase();
  }

  return urlOrHostOrHandle.toLowerCase().trim();
}

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>();
  const [checkingAuth, setCheckingAuth] = useState(true);
  const errorModalRef = useRef<HTMLDialogElement>(null);
  const router = useRouter();

  const {
    register,
    formState: { errors },
    handleSubmit,
    setValue,
  } = useForm<FormValue>({ defaultValues: { address: "" } });

  // Check if already logged in
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch("/api/auth/me");
        if (res.ok) {
          router.replace("/main");
          return;
        }
      } catch {
        // Not logged in
      }
      setCheckingAuth(false);
    };

    // Restore last used server
    const lastServer = localStorage.getItem("yamix_server");
    if (lastServer) {
      setValue("address", lastServer);
    }

    checkAuth();
  }, [router, setValue]);

  const onSubmit: SubmitHandler<FormValue> = async (data) => {
    setIsLoading(true);

    const host = convertHost(data.address);
    localStorage.setItem("yamix_server", host);

    try {
      const res = await fetch("/api/auth/misskey-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ host }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Login failed");
      }

      const authSession = await res.json();

      // Redirect to Misskey auth page
      window.location.href = authSession.url;
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Login failed");
      errorModalRef.current?.showModal();
      setIsLoading(false);
    }
  };

  if (checkingAuth) {
    return (
      <div className="w-screen h-screen flex items-center justify-center">
        <div className="animated-bg" />
        <LoadingSpinner size={64} />
      </div>
    );
  }

  return (
    <div className="w-screen h-screen absolute flex flex-col items-center justify-center">
      {/* Animated background */}
      <div className="animated-bg" />

      {/* GitHub Corner */}
      <a
        href="https://github.com/yamisskey-dev/yamix"
        target="_blank"
        rel="noopener noreferrer"
        className="github-corner"
        aria-label="View source on GitHub"
      >
        <svg
          width="80"
          height="80"
          viewBox="0 0 250 250"
          style={{
            fill: "rgba(16, 11, 34, 0.86)",
            color: "#C2CBE0",
            position: "fixed",
            zIndex: 10,
            top: 0,
            border: 0,
            right: 0,
          }}
          aria-hidden="true"
        >
          <path d="M0,0 L115,115 L130,115 L142,142 L250,250 L250,0 Z" />
          <path
            d="M128.3,109.0 C113.8,99.7 119.0,89.6 119.0,89.6 C122.0,82.7 120.5,78.6 120.5,78.6 C119.2,72.0 123.4,76.3 123.4,76.3 C127.3,80.9 125.5,87.3 125.5,87.3 C122.9,97.6 130.6,101.9 134.4,103.2"
            fill="currentColor"
            className="octo-arm"
            style={{ transformOrigin: "130px 106px" }}
          />
          <path
            d="M115.0,115.0 C114.9,115.1 118.7,116.5 119.8,115.4 L133.7,101.6 C136.9,99.2 139.9,98.4 142.2,98.6 C133.8,88.0 127.5,74.4 143.8,58.0 C148.5,53.4 154.0,51.2 159.7,51.0 C160.3,49.4 163.2,43.6 171.4,40.1 C171.4,40.1 176.1,42.5 178.8,56.2 C183.1,58.6 187.2,61.8 190.9,65.4 C194.5,69.0 197.7,73.2 200.1,77.6 C213.8,80.2 216.3,84.9 216.3,84.9 C212.7,93.1 206.9,96.0 205.4,96.6 C205.1,102.4 203.0,107.8 198.3,112.5 C181.9,128.9 168.3,122.5 157.7,114.1 C157.9,116.9 156.7,120.9 152.7,124.9 L141.0,136.5 C139.8,137.7 141.6,141.9 141.8,141.8 Z"
            fill="currentColor"
            className="octo-body"
          />
        </svg>
      </a>

      <main className="w-full h-full flex flex-col justify-center items-center p-6">
        {/* Logo - NeoQuesdon style */}
        <div className="mb-4 flex flex-col items-center">
          <div className="relative text-7xl font-bold z-10">
            <h1 className="absolute -inset-0 -z-10 bg-gradient-to-r text-transparent from-purple-500 via-pink-500 to-cyan-400 bg-clip-text blur-lg">
              Yamix
            </h1>
            <h1 className="text-7xl font-bold z-10 mb-2 desktop:mb-0">Yamix</h1>
          </div>
          <span className="font-thin tracking-wider text-base desktop:text-lg">
            AIと人間が寄り添う、Misskey向け相談プラットフォーム
          </span>
        </div>

        {/* Login Form - NeoQuesdon style horizontal layout */}
        <div className="flex flex-col desktop:flex-row items-center">
          <form
            className="flex flex-col desktop:flex-row"
            onSubmit={handleSubmit(onSubmit)}
            id="urlInputForm"
          >
            {errors.address?.type === "pattern" && (
              <div
                className="tooltip tooltip-open tooltip-error transition-opacity"
                data-tip="有効なサーバーアドレスを入力してください"
              />
            )}
            {errors.address?.message === "required" && (
              <div
                className="tooltip tooltip-open tooltip-error transition-opacity"
                data-tip="サーバーアドレスを入力してください"
              />
            )}
            <input
              id="serverNameInput"
              {...register("address", {
                pattern: /\./,
                required: "required",
              })}
              placeholder="yami.ski"
              className="w-full input input-bordered text-lg desktop:text-3xl mb-4 desktop:mb-0"
              disabled={isLoading}
              autoComplete="url"
            />
          </form>
          <div className="flex flex-row items-center">
            <button
              type="submit"
              className={`btn ml-4 ${isLoading ? "btn-disabled" : "btn-primary"}`}
              form="urlInputForm"
              disabled={isLoading}
            >
              {isLoading ? (
                <span className="loading loading-spinner" />
              ) : (
                <span>ログイン</span>
              )}
            </button>
          </div>
        </div>
      </main>


      {/* Error Modal */}
      <Modal
        ref={errorModalRef}
        title="エラー"
        body={errorMessage || "ログインに失敗しました"}
        buttonText="OK"
      />
    </div>
  );
}
