"use client";

type SpinnerSize = "xs" | "sm" | "md" | "lg";

const sizeMap: Record<SpinnerSize, string> = {
  xs: "w-4 h-4",
  sm: "w-6 h-6",
  md: "w-10 h-10",
  lg: "w-16 h-16",
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
 * Misskey-style circular loading spinner
 */
export function LoadingSpinner({ size = "md", text, className = "", inline = false }: Props) {
  const sizeClass = sizeMap[size];

  const spinner = (
    <div className={`relative ${sizeClass}`}>
      {/* Background circle */}
      <svg
        className={`absolute inset-0 ${sizeClass} text-current opacity-25`}
        viewBox="0 0 168 168"
        xmlns="http://www.w3.org/2000/svg"
      >
        <g transform="matrix(1.125,0,0,1.125,12,12)">
          <circle
            cx="64"
            cy="64"
            r="64"
            style={{
              fill: "none",
              stroke: "currentColor",
              strokeWidth: "21.33px",
            }}
          />
        </g>
      </svg>
      {/* Foreground arc (rotating) */}
      <svg
        className={`absolute inset-0 ${sizeClass} text-primary animate-spin`}
        style={{ animationDuration: "0.5s" }}
        viewBox="0 0 168 168"
        xmlns="http://www.w3.org/2000/svg"
      >
        <g transform="matrix(1.125,0,0,1.125,12,12)">
          <path
            d="M128,64C128,28.654 99.346,0 64,0C99.346,0 128,28.654 128,64Z"
            style={{
              fill: "none",
              stroke: "currentColor",
              strokeWidth: "21.33px",
              strokeLinecap: "round",
            }}
          />
        </g>
      </svg>
    </div>
  );

  if (inline) {
    return <span className={`inline-block ${className}`}>{spinner}</span>;
  }

  return (
    <div className={`flex flex-col items-center justify-center gap-3 ${className}`}>
      {spinner}
      {text && <span className="text-sm text-base-content/60">{text}</span>}
    </div>
  );
}
