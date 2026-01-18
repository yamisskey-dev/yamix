"use client";

import { Component, ReactNode } from "react";
import { logger } from "@/lib/logger";

// ============================================
// Types
// ============================================

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode | ((error: Error, reset: () => void) => ReactNode);
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

// ============================================
// Error Boundary Class Component
// ============================================

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    logger.error(
      "React Error Boundary caught an error",
      {
        componentStack: errorInfo.componentStack,
      },
      error
    );

    this.props.onError?.(error, errorInfo);
  }

  reset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError && this.state.error) {
      // カスタムfallbackがある場合
      if (this.props.fallback) {
        if (typeof this.props.fallback === "function") {
          return this.props.fallback(this.state.error, this.reset);
        }
        return this.props.fallback;
      }

      // デフォルトのエラー表示
      return (
        <DefaultErrorFallback error={this.state.error} reset={this.reset} />
      );
    }

    return this.props.children;
  }
}

// ============================================
// Default Error Fallback Component
// ============================================

interface DefaultErrorFallbackProps {
  error: Error;
  reset: () => void;
}

function DefaultErrorFallback({ error, reset }: DefaultErrorFallbackProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[200px] p-6 text-center">
      <div className="text-error mb-4">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-12 w-12 mx-auto"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      </div>
      <h2 className="text-lg font-semibold mb-2">エラーが発生しました</h2>
      <p className="text-base-content/60 text-sm mb-4">
        {error.message || "予期しないエラーが発生しました"}
      </p>
      <button onClick={reset} className="btn btn-primary btn-sm">
        再試行
      </button>
    </div>
  );
}

// ============================================
// Minimal Error Fallback (インライン用)
// ============================================

interface MinimalErrorFallbackProps {
  message?: string;
  retry?: () => void;
}

export function MinimalErrorFallback({
  message = "読み込みに失敗しました",
  retry,
}: MinimalErrorFallbackProps) {
  return (
    <div className="flex items-center gap-2 p-3 text-sm text-error bg-error/10 rounded-lg">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-4 w-4 shrink-0"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      <span className="flex-1">{message}</span>
      {retry && (
        <button
          onClick={retry}
          className="btn btn-ghost btn-xs"
          aria-label="再試行"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
        </button>
      )}
    </div>
  );
}

// ============================================
// Full Page Error (ページ全体用)
// ============================================

interface FullPageErrorProps {
  title?: string;
  message?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function FullPageError({
  title = "エラーが発生しました",
  message = "申し訳ありません。予期しないエラーが発生しました。",
  action,
}: FullPageErrorProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center bg-base-100">
      <div className="text-error mb-6">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-20 w-20 mx-auto opacity-80"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </div>
      <h1 className="text-2xl font-bold mb-2">{title}</h1>
      <p className="text-base-content/60 mb-6 max-w-md">{message}</p>
      {action && (
        <button onClick={action.onClick} className="btn btn-primary">
          {action.label}
        </button>
      )}
    </div>
  );
}
