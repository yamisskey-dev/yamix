"use client";

interface EmptyStateProps {
  /** Main message to display */
  message: string;
  /** Optional description */
  description?: string;
  /** Show yui image (use for larger empty states) */
  showImage?: boolean;
  /** Custom icon (used when showImage is false) */
  icon?: React.ReactNode;
  /** Optional action button */
  action?: {
    label: string;
    onClick: () => void;
  };
}

/**
 * Unified empty state component with optional yui mascot image
 */
export function EmptyState({
  message,
  description,
  showImage = false,
  icon,
  action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
      {showImage ? (
        <img
          src="/yamii.png"
          alt="空っぽ"
          className="w-32 h-32 mb-4 opacity-80"
        />
      ) : icon ? (
        <div className="mb-3 text-base-content/30">{icon}</div>
      ) : (
        <div className="mb-3 text-base-content/30">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="w-10 h-10"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m6 4.125l2.25 2.25m0 0l2.25 2.25M12 13.875l2.25-2.25M12 13.875l-2.25 2.25M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z"
            />
          </svg>
        </div>
      )}
      <p className="text-base-content/60 text-sm font-medium">{message}</p>
      {description && (
        <p className="text-base-content/40 text-xs mt-1">{description}</p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="btn btn-primary btn-sm mt-4"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
