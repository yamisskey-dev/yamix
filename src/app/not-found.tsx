import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center bg-base-100">
      <div className="mb-8">
        <div className="text-[120px] font-bold leading-none bg-gradient-to-br from-primary to-secondary bg-clip-text text-transparent">
          404
        </div>
      </div>

      <h1 className="text-2xl font-bold mb-3">ページが見つかりません</h1>
      <p className="text-base-content/60 mb-8 max-w-md">
        お探しのページは存在しないか、移動した可能性があります。
      </p>

      <div className="flex gap-3">
        <Link href="/" className="btn btn-primary">
          トップページへ
        </Link>
        <Link href="/main" className="btn btn-ghost">
          相談を始める
        </Link>
      </div>

      <div className="mt-12 text-base-content/40 text-sm">
        <p>迷子になっても大丈夫。</p>
        <p>いつでもここに戻ってこれます。</p>
      </div>
    </div>
  );
}
