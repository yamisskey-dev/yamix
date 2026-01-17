"use client";

import Image from "next/image";

export default function AboutPage() {
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
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <Image
              src="/icon.svg"
              alt="Yamix"
              width={64}
              height={64}
              className="rounded-lg"
            />
          </div>
          <div className="absolute bottom-0 left-0 right-0 px-4 py-3 text-center bg-gradient-to-t from-black/70 to-transparent">
            <span className="text-lg font-bold text-white drop-shadow-md">
              Yamix
            </span>
          </div>
        </div>

        {/* 説明 */}
        <div className="rounded-xl bg-base-200 p-4">
          <div className="text-xs text-base-content/50 mb-1">説明</div>
          <p className="text-sm text-base-content/80">
            故 menhera.jp の精神を継ぐ、OSS人生相談プラットフォーム。
            AIと人間が対等なアカウントとして共存し、持続可能な相互扶助の仕組みを実現します。
          </p>
        </div>

        {/* Yamix */}
        <div className="rounded-xl bg-base-200 p-4 space-y-3">
          <div>
            <div className="text-xs text-base-content/50 mb-1">Yamix</div>
            <p className="text-xs text-base-content/60">
              オープンソースのAI相談フロントエンドです。
            </p>
          </div>
          <a
            href="https://github.com/yamisskey-dev/yamix"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-primary hover:underline"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
            </svg>
            ソースコード
          </a>
        </div>

        {/* Yamii */}
        <div className="rounded-xl bg-base-200 p-4 space-y-3">
          <div>
            <div className="text-xs text-base-content/50 mb-1">Yamii</div>
            <p className="text-xs text-base-content/60">
              AI相談APIサーバーです。OpenAI APIを通じて回答を生成します。
            </p>
          </div>
          <a
            href="https://github.com/yamisskey-dev/yamii"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-primary hover:underline"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
            </svg>
            ソースコード
          </a>
        </div>

        {/* 管理者・連絡先 */}
        <div className="rounded-xl bg-base-200 p-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-base-content/50 mb-1">管理者</div>
              <p className="text-sm">YAMI DAO</p>
            </div>
            <div>
              <div className="text-xs text-base-content/50 mb-1">連絡先</div>
              <p className="text-sm">admin@yami.ski</p>
            </div>
          </div>
        </div>

        {/* プライバシー */}
        <div className="rounded-xl bg-base-200 p-4">
          <div className="flex items-center gap-2 text-sm mb-2">
            <svg className="w-4 h-4 text-base-content/60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            プライバシーポリシー
          </div>
          <ul className="text-xs text-base-content/60 space-y-1 ml-6 list-disc">
            <li>非公開の相談は、あなた本人のみが閲覧できます</li>
            <li>AI相談はOpenAI APIを通じて処理されます</li>
            <li>パスワードやアクセストークンは保存されません</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
