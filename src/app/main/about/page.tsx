"use client";

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

        {/* 説明 */}
        <FormSection>
          <p className="text-sm text-base-content/80 leading-relaxed">
            AIと人間が対等なアカウントとして共存し、持続可能な相互扶助の仕組みを実現するOSS人生相談プラットフォーム。
          </p>
        </FormSection>

        {/* サービス理念 */}
        <FormSection label="サービスの理念">
          <div className="text-xs text-base-content/70 space-y-3 leading-relaxed">
            <p>
              Yamixは、<strong className="text-base-content/90">不健全な依存関係を解消する</strong>ために設計されたプラットフォームです。
            </p>
            <p>
              従来の人生相談では、回答者への過度な依存や、精神的資源の一方的な消費が問題でした。
              Yamixは、<strong className="text-base-content/90">YAMIトークン経済</strong>を通じて、
              この問題に以下の方法で取り組みます：
            </p>
            <ul className="ml-4 space-y-1.5 list-disc list-outside">
              <li>
                <strong>AIによる依存の吸収</strong> -
                人間への不健全な依存をAIが代わりに受け止め、人間同士の関係を健全化
              </li>
              <li>
                <strong>相談へのコスト</strong> -
                無制限の依存を防ぎ、本当に必要な時だけ相談する仕組み
              </li>
              <li>
                <strong>回答者への報酬</strong> -
                精神的労働には正当な対価が支払われる経済設計
              </li>
              <li>
                <strong>ガスシステム</strong> -
                役立った回答には、灯を灯し続けるためのガスを送ることで、回答者のYAMIトークンを補充し、質の高い支援を促進
              </li>
              <li>
                <strong>ベーシックインカムと減衰</strong> -
                毎日の無料YAMIで誰でも参加でき、過度な蓄積は減衰で抑制
              </li>
            </ul>
            <p>
              トークン経済は、注意力と精神的資源を適切に分配するための仕組みです。
              これにより、支え合いながらも依存しすぎない、健全なコミュニティを目指します。
            </p>
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
