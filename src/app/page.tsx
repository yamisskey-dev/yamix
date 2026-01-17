"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useForm, SubmitHandler } from "react-hook-form";
import { Modal } from "@/components/Modal";

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
        <span className="loading loading-spinner loading-lg text-purple-400" />
      </div>
    );
  }

  return (
    <div className="w-screen h-screen absolute flex flex-col items-center justify-center">
      {/* Animated background (down.yami.ski style) */}
      <div className="animated-bg" />

      <main className="w-full h-full flex flex-col justify-center items-center p-6">
        {/* Logo & Title (NeoQuesdon style) */}
        <div className="mb-4 flex flex-col items-center">
          <div className="relative text-7xl font-bold z-10">
            <h1 className="absolute -inset-0 -z-10 bg-gradient-to-r text-transparent from-purple-500 via-pink-500 to-cyan-400 bg-clip-text blur-lg">
              Yamix
            </h1>
            <h1 className="text-7xl font-bold z-10 mb-2 desktop:mb-0 text-white">
              Yamix
            </h1>
          </div>
          <span className="font-thin tracking-wider text-base desktop:text-lg text-white/80">
            AIと人間が寄り添う、Fediverse向け相談プラットフォーム
          </span>
        </div>

        {/* Login Form (NeoQuesdon style - horizontal on desktop) */}
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

      {/* Footer (NeoQuesdon style) */}
      <footer className="w-full row-start-3 flex gap-6 flex-wrap items-center justify-end p-4">
        <a
          href="https://github.com/yamisskey-dev/yamix"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-white/40 hover:text-white/60 transition-colors flex items-center gap-2"
        >
          <svg
            className="w-5 h-5"
            fill="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
              clipRule="evenodd"
            />
          </svg>
          GitHub
        </a>
      </footer>

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
