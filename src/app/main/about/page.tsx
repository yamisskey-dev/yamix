"use client";

import Image from "next/image";
import { useState, useEffect } from "react";
import { useUser } from "@/contexts/UserContext";

// Misskey風のFormLinkコンポーネント
function FormLink({
  href,
  icon,
  children,
  external = false,
}: {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  external?: boolean;
}) {
  return (
    <a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      className="flex items-center w-full px-3.5 py-2.5 bg-base-300/50 hover:bg-base-300 rounded-md text-sm transition-colors"
    >
      <span className="mr-3 text-base-content/75">{icon}</span>
      <span className="flex-1">{children}</span>
      <span className="text-base-content/50">
        {external ? (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        ) : (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        )}
      </span>
    </a>
  );
}

// Misskey風のFormSectionコンポーネント
function FormSection({
  label,
  children,
}: {
  label?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl bg-base-200 p-4">
      {label && (
        <div className="text-xs text-base-content/50 font-medium mb-3">{label}</div>
      )}
      <div className="space-y-2">{children}</div>
    </div>
  );
}

// Misskey風のMkKeyValueコンポーネント
function MkKeyValue({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-xs text-base-content/50 mb-1">{label}</div>
      <div className="text-sm">{children}</div>
    </div>
  );
}

export default function AboutPage() {
  const { user } = useUser();
  const [prompt, setPrompt] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [promptSaved, setPromptSaved] = useState(false);
  const [promptError, setPromptError] = useState("");

  // デフォルトプロンプトを取得
  useEffect(() => {
    async function fetchPrompt() {
      try {
        const res = await fetch("/api/system/prompt");
        if (res.ok) {
          const data = await res.json();
          setPrompt(data.prompt);
        }
      } catch (err) {
        console.error("Failed to fetch prompt:", err);
      }
    }
    fetchPrompt();
  }, []);

  // プロンプトを保存
  async function handleSave() {
    setIsSaving(true);
    setPromptError("");
    try {
      const res = await fetch("/api/system/prompt", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save");
      }

      setPromptSaved(true);
      setTimeout(() => setPromptSaved(false), 2000);
    } catch (err) {
      setPromptError(err instanceof Error ? err.message : "保存に失敗しました");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="flex-1 p-4 pb-20 window:pb-4 overflow-y-auto flex flex-col justify-center">
      <div className="max-w-xl mx-auto space-y-4 my-8">
        {/* バナー */}
        <div
          className="relative rounded-xl overflow-hidden h-36 bg-cover bg-center bg-base-200"
          style={{
            backgroundImage:
              "url(https://raw.githubusercontent.com/yamisskey-dev/yamisskey-assets/main/yami.ski/yami-banner.gif)",
          }}
        >
          <div className="absolute inset-0 bottom-10 flex flex-col items-center justify-center">
            <Image
              src="/icon.svg"
              alt="Yamix"
              width={64}
              height={64}
              className="rounded-lg"
            />
          </div>
          <div className="absolute bottom-0 left-0 right-0 px-4 py-3 text-center bg-gradient-to-t from-black/70 to-transparent">
            <span className="text-sm font-bold text-white drop-shadow-md">
              やみっくす
            </span>
          </div>
        </div>

        {/* 説明 */}
        <FormSection>
          <p className="text-sm text-base-content/80">
            AIと人間が対等なアカウントとして共存し、持続可能な相互扶助の仕組みを実現するOSS人生相談プラットフォーム。
          </p>
        </FormSection>

        {/* デフォルトプロンプト編集 */}
        <FormSection label="デフォルトプロンプト">
          <textarea
            className="textarea textarea-bordered w-full h-32 text-sm"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="読み込み中..."
            disabled={!user}
          />
          <div className="flex justify-end items-center mt-2 gap-2">
            {promptError && (
              <span className="text-error text-sm">{promptError}</span>
            )}
            {user ? (
              <button
                className={`btn btn-primary btn-sm ${isSaving ? "btn-disabled" : ""}`}
                onClick={handleSave}
                disabled={isSaving}
              >
                {isSaving ? (
                  <span className="loading loading-spinner loading-xs" />
                ) : promptSaved ? (
                  "保存しました"
                ) : (
                  "保存"
                )}
              </button>
            ) : (
              <span className="text-xs text-base-content/50">
                編集するにはログインしてください
              </span>
            )}
          </div>
        </FormSection>

        {/* ソースコード */}
        <FormSection>
          <FormLink
            href="https://github.com/yamisskey-dev/yamix"
            icon={
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
              </svg>
            }
            external
          >
            ソースコード (Yamix)
          </FormLink>
          <FormLink
            href="https://github.com/yamisskey-dev/yamii"
            icon={
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
              </svg>
            }
            external
          >
            ソースコード (Yamii)
          </FormLink>
        </FormSection>

        {/* 管理者・連絡先 */}
        <FormSection>
          <div className="grid grid-cols-2 gap-4">
            <MkKeyValue label="管理者">YAMI DAO</MkKeyValue>
            <MkKeyValue label="連絡先">admin@yami.ski</MkKeyValue>
          </div>
        </FormSection>

        {/* プライバシー */}
        <FormSection label="プライバシーポリシー">
          <ul className="text-xs text-base-content/60 space-y-1 ml-4 list-disc">
            <li>非公開の相談は、あなた本人のみが閲覧できます</li>
            <li>AI相談はOpenAI APIを通じて処理されます</li>
            <li>パスワードやアクセストークンは保存されません</li>
          </ul>
        </FormSection>
      </div>
    </div>
  );
}
