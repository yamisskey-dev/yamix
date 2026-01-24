"use client";

type SpinnerSize = "xs" | "sm" | "md" | "lg";

const sizeMap: Record<SpinnerSize, string> = {
  xs: "w-4 h-4",
  sm: "w-6 h-6",
  md: "w-10 h-10",
  lg: "w-16 h-16",
};

const pixelSizeMap: Record<SpinnerSize, number> = {
  xs: 16,
  sm: 24,
  md: 40,
  lg: 64,
};

interface Props {
  /** Size of the spinner */
  size?: SpinnerSize;
  /** Optional message to display below the spinner */
  text?: string;
  /** Additional CSS classes */
  className?: string;
  /** Use inline style (no wrapper, no text) */
  inline?: boolean;
}

/**
 * Unified loading spinner component using blobcat gif
 */
export function LoadingSpinner({ size = "md", text, className = "", inline = false }: Props) {
  const sizeClass = sizeMap[size];
  const pixelSize = pixelSizeMap[size];

  if (inline) {
    return (
      <img
        src="/static/loading/1.gif"
        alt="読み込み中"
        width={pixelSize}
        height={pixelSize}
        className={`${sizeClass} inline-block ${className}`}
      />
    );
  }

  return (
    <div className={`flex flex-col items-center justify-center gap-3 ${className}`}>
      <img
        src="/static/loading/1.gif"
        alt="読み込み中"
        width={pixelSize}
        height={pixelSize}
        className={sizeClass}
      />
      {text && <span className="text-sm text-base-content/60">{text}</span>}
    </div>
  );
}
