"use client";

import Image from "next/image";

export default function AboutPage() {
  return (
    <div className="flex-1 overflow-y-auto h-full">
      <div className="max-w-2xl mx-auto p-4 space-y-6">
        {/* Header */}
        <div className="flex flex-col items-center text-center py-6">
          <Image
            src="/icon.svg"
            alt="やみっくす"
            width={80}
            height={80}
            className="rounded-xl mb-4"
          />
          <h1 className="text-2xl font-bold text-base-content">やみっくす</h1>
          <p className="text-base-content/60 mt-1">Yamix v0.1.0</p>
        </div>

        {/* Description */}
        <div className="bg-base-200/50 rounded-2xl p-4">
          <h2 className="text-lg font-semibold text-base-content mb-2">
            サービスについて
          </h2>
          <p className="text-base-content/80 text-sm leading-relaxed">
            やみっくすは、プライバシーファーストのAI相談プラットフォームです。
            Misskeyアカウントでログインして、AIカウンセラー「やみぃ」に相談できます。
          </p>
        </div>

        {/* Features */}
        <div className="bg-base-200/50 rounded-2xl p-4">
          <h2 className="text-lg font-semibold text-base-content mb-3">
            特徴
          </h2>
          <ul className="space-y-2 text-sm text-base-content/80">
            <li className="flex items-start gap-2">
              <span className="text-primary">●</span>
              <span>プライバシー重視 - 相談内容は暗号化して保存</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary">●</span>
              <span>24時間対応 - いつでも相談可能</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary">●</span>
              <span>Misskey連携 - 既存アカウントでログイン</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary">●</span>
              <span>タイムライン機能 - 公開相談を共有可能</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
