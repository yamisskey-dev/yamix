import Link from "next/link";
import Image from "next/image";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center bg-base-100">
      {/* Yui mascot image */}
      <Image
        src="https://raw.githubusercontent.com/yamisskey-dev/yamisskey-assets/main/yui/yui-256x256.webp"
        alt="Yui"
        width={128}
        height={128}
        className="mb-6"
        draggable={false}
        unoptimized
      />

      <div className="mb-4">
        <div className="text-6xl font-bold leading-none bg-gradient-to-br from-primary to-secondary bg-clip-text text-transparent">
          404
        </div>
      </div>

      <h1 className="text-xl font-bold mb-2">ページが見つかりません</h1>
      <p className="text-base-content/60 mb-8 max-w-xs text-sm leading-relaxed">
        お探しのページは存在しないか、移動した可能性があります。
      </p>

      <div className="flex gap-3">
        <Link href="/" className="btn btn-primary btn-sm">
          トップページへ
        </Link>
        <Link href="/main" className="btn btn-ghost btn-sm">
          相談を始める
        </Link>
      </div>

      <div className="mt-10 text-base-content/40 text-sm">
        <p>迷子になっても大丈夫。</p>
        <p>いつでもここに戻ってこれます。</p>
      </div>
    </div>
  );
}
