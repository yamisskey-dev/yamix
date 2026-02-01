import { yamiiClient } from "@/lib/yamii-client";

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

async function getYamiiVersion(): Promise<string> {
  try {
    const health = await yamiiClient.healthCheck();
    return health.version;
  } catch {
    return "取得失敗";
  }
}

export default async function AboutPage() {
  const yamixVersion = process.env.NEXT_PUBLIC_YAMIX_VERSION || "unknown";
  const yamiiVersion = await getYamiiVersion();
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
            <img
              src="/app-icon.png"
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

        {/* 世界観と理念 */}
        <FormSection label="世界観と理念">
          <div className="text-xs text-base-content/70 space-y-3 leading-relaxed">
            <p>
              Yamixは、<strong className="text-base-content/90">健全な相談関係</strong>を築くためのプラットフォームです。
            </p>
            <p>
              AIと人間が共存し、<strong className="text-base-content/90">支え合いながらも依存しすぎない</strong>コミュニティを目指しています。
            </p>
          </div>
        </FormSection>

        {/* YAMIトークン経済 */}
        <FormSection label="YAMIトークン経済">
          <div className="text-xs text-base-content/70 space-y-3 leading-relaxed">
            <ul className="ml-4 space-y-1.5 list-disc list-outside">
              <li>
                <strong>相談にはYAMIを消費</strong> - 限りある資源として大切に使う仕組み
              </li>
              <li>
                <strong>回答で報酬を獲得</strong> - 助け合いが正当に評価される設計
              </li>
              <li>
                <strong>💜で感謝を伝える</strong> - 良い回答には💜を送って応援
              </li>
              <li>
                <strong>毎日のYAMI支給</strong> - 誰でも参加できるベーシックインカム
              </li>
            </ul>
          </div>
        </FormSection>

        {/* プライバシー・セキュリティ */}
        <FormSection label="プライバシー・セキュリティ">
          <div className="text-xs text-base-content/70 space-y-3 leading-relaxed">
            <ul className="text-base-content/60 space-y-1.5 ml-4 list-disc">
              <li>メッセージは<strong className="text-base-content/80">暗号化</strong>されて安全に保存されます</li>
              <li>非公開の相談は、<strong className="text-base-content/80">あなただけ</strong>が見られます</li>
              <li>IPアドレスは<strong className="text-base-content/80">記録しません</strong></li>
              <li>AI相談はOpenAI APIで処理されます</li>
              <li>危険な内容は自動検出され、非公開化されることがあります</li>
            </ul>
          </div>
        </FormSection>

        {/* オフライン機能 */}
        <FormSection label="オフライン機能">
          <div className="text-xs text-base-content/70 space-y-3 leading-relaxed">
            <ul className="text-base-content/60 space-y-1.5 ml-4 list-disc">
              <li>データは<strong className="text-base-content/80">あなたのデバイスに保存</strong>され、オフラインでも閲覧可能です</li>
              <li>アプリ全体がデバイスにキャッシュされ、<strong className="text-base-content/80">完全オフライン</strong>で動作します（ページリロード時も含む）</li>
              <li>オフライン時もメッセージを送信でき、オンライン復帰時に自動同期されます</li>
            </ul>
          </div>
        </FormSection>

        {/* ソースコード・バージョン */}
        <FormSection label="ソースコード">
          <FormLink
            href="https://github.com/yamisskey-dev/yamix"
            icon={
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
              </svg>
            }
            external
          >
            Yamix (Frontend) v{yamixVersion}
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
            Yamii (Backend) v{yamiiVersion}
          </FormLink>
        </FormSection>

        {/* 管理者・連絡先 */}
        <FormSection>
          <div className="grid grid-cols-2 gap-4">
            <MkKeyValue label="管理者">
              <a href="https://dao.yami.ski/" target="_blank" rel="noopener noreferrer" className="link link-primary">
                YAMI DAO
              </a>
            </MkKeyValue>
            <MkKeyValue label="連絡先">
              <a href="mailto:admin@yami.ski" className="link link-primary">
                admin@yami.ski
              </a>
            </MkKeyValue>
          </div>
        </FormSection>
      </div>
    </div>
  );
}
