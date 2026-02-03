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
    <div className="flex-1 p-4 pb-20 window:pb-4 overflow-y-auto">
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

        {/* Yamixについて */}
        <FormSection label="このアプリについて">
          <div className="text-xs text-base-content/70 space-y-2 leading-relaxed">
            <p>
              AIと人間が共存し、<strong className="text-base-content/90">支え合いながらも依存しない</strong>相談プラットフォーム
            </p>
            <ul className="text-base-content/60 space-y-1 ml-4 list-disc">
              <li>相談にはYAMIトークンを消費、回答で報酬を獲得</li>
              <li>毎日YAMIトークンが支給され、誰でも参加できます</li>
            </ul>
          </div>
        </FormSection>

        {/* 使いかた */}
        <FormSection label="使いかた">
          <div className="text-xs text-base-content/70 space-y-2 leading-relaxed">
            <ol className="text-base-content/60 space-y-1.5 ml-4 list-decimal">
              <li><strong className="text-base-content/80">相談する</strong>：公開か指名で他人に相談するか、非公開でAIに相談</li>
              <li><strong className="text-base-content/80">回答する</strong>：他のユーザーの相談に答えて、YAMIトークンを回復</li>
              <li><strong className="text-base-content/80">💜を送る</strong>：良い回答に応援を送って、回答者にYAMIトークンを付与</li>
            </ol>
          </div>
        </FormSection>

        {/* プライバシー・機能 */}
        <FormSection label="プライバシー・機能">
          <div className="text-xs text-base-content/70 space-y-3 leading-relaxed">
            <ul className="text-base-content/60 space-y-1.5 ml-4 list-disc">
              <li>メッセージは<strong className="text-base-content/80">暗号化</strong>され安全に保存されます</li>
              <li>デバイスに保存され、<strong className="text-base-content/80">オフライン</strong>でも動作します</li>
              <li>IPアドレスは記録しません。ノーログポリシーです</li>
              <li>危険な内容はAIが自動検出し、<strong className="text-base-content/80">5回のフラグ</strong>で非公開化されます</li>
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
