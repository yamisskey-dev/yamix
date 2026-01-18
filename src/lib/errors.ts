/**
 * Custom Error Types
 * 型安全なエラーハンドリング
 */

/**
 * アプリケーションエラーの基底クラス
 */
export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "AppError";
    // V8スタックトレース対応
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
      ...(this.details && { details: this.details }),
    };
  }
}

/**
 * API関連エラー
 */
export class ApiError extends AppError {
  constructor(
    message: string,
    public readonly statusCode: number,
    code?: string,
    details?: Record<string, unknown>
  ) {
    super(message, code || `HTTP_${statusCode}`, statusCode, details);
    this.name = "ApiError";
  }

  static fromResponse(response: Response, body?: unknown): ApiError {
    const message =
      typeof body === "object" && body && "error" in body
        ? String((body as { error: string }).error)
        : `Request failed with status ${response.status}`;

    return new ApiError(message, response.status, undefined, {
      url: response.url,
      body,
    });
  }
}

/**
 * 認証エラー
 */
export class AuthError extends AppError {
  constructor(message = "認証が必要です", code = "UNAUTHORIZED") {
    super(message, code, 401);
    this.name = "AuthError";
  }
}

/**
 * バリデーションエラー
 */
export class ValidationError extends AppError {
  constructor(
    message: string,
    public readonly fields?: Record<string, string>
  ) {
    super(message, "VALIDATION_ERROR", 400, { fields });
    this.name = "ValidationError";
  }
}

/**
 * ネットワークエラー
 */
export class NetworkError extends AppError {
  constructor(message = "ネットワークエラーが発生しました") {
    super(message, "NETWORK_ERROR", 0);
    this.name = "NetworkError";
  }
}

/**
 * 不明なエラーをAppErrorに変換
 */
export function normalizeError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }

  if (error instanceof Error) {
    return new AppError(error.message, "UNKNOWN_ERROR", 500, {
      originalName: error.name,
    });
  }

  return new AppError(
    typeof error === "string" ? error : "不明なエラーが発生しました",
    "UNKNOWN_ERROR",
    500
  );
}

/**
 * エラーメッセージの取得（ユーザー表示用）
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof AppError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "エラーが発生しました";
}

/**
 * HTTPステータスに応じたユーザー向けメッセージ
 */
export function getHttpErrorMessage(status: number): string {
  switch (status) {
    case 400:
      return "リクエストが不正です";
    case 401:
      return "ログインが必要です";
    case 403:
      return "アクセス権限がありません";
    case 404:
      return "見つかりませんでした";
    case 429:
      return "リクエストが多すぎます。しばらくお待ちください";
    case 500:
      return "サーバーエラーが発生しました";
    case 502:
    case 503:
    case 504:
      return "サーバーに接続できません";
    default:
      return "エラーが発生しました";
  }
}
