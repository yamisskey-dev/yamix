import Link from "next/link";
import Image from "next/image";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center bg-base-100">
      <Image
        src="/yui-empty.png"
        alt="Yui"
        width={120}
        height={120}
        className="mb-6"
        draggable={false}
      />

      <p className="text-base-content/70 mb-8 text-sm">
        迷子になっても大丈夫。
      </p>

      <Link href="/" className="btn btn-primary btn-sm">
        トップページへ戻る
      </Link>
    </div>
  );
}
