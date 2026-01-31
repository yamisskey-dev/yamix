import { describe, it, expect } from "vitest";
import {
  AppError,
  ApiError,
  AuthError,
  ValidationError,
  NetworkError,
  normalizeError,
  getErrorMessage,
  getHttpErrorMessage,
} from "./errors";

describe("AppError", () => {
  it("sets properties correctly", () => {
    const err = new AppError("test", "TEST_CODE", 400, { key: "val" });
    expect(err.message).toBe("test");
    expect(err.code).toBe("TEST_CODE");
    expect(err.statusCode).toBe(400);
    expect(err.details).toEqual({ key: "val" });
  });

  it("defaults statusCode to 500", () => {
    const err = new AppError("test", "CODE");
    expect(err.statusCode).toBe(500);
  });

  it("serializes to JSON", () => {
    const err = new AppError("msg", "CODE", 404);
    const json = err.toJSON();
    expect(json).toEqual({
      name: "AppError",
      code: "CODE",
      message: "msg",
      statusCode: 404,
    });
  });

  it("includes details in JSON when present", () => {
    const err = new AppError("msg", "CODE", 400, { field: "x" });
    expect(err.toJSON().details).toEqual({ field: "x" });
  });
});

describe("ApiError", () => {
  it("creates with status code", () => {
    const err = new ApiError("not found", 404);
    expect(err.statusCode).toBe(404);
    expect(err.code).toBe("HTTP_404");
    expect(err.name).toBe("ApiError");
  });

  it("fromResponse extracts error message from body", () => {
    const res = { status: 400, url: "http://test.com/api" } as Response;
    const err = ApiError.fromResponse(res, { error: "bad input" });
    expect(err.message).toBe("bad input");
    expect(err.statusCode).toBe(400);
  });

  it("fromResponse uses fallback message when no body error", () => {
    const res = { status: 500, url: "http://test.com/api" } as Response;
    const err = ApiError.fromResponse(res);
    expect(err.message).toBe("Request failed with status 500");
  });
});

describe("AuthError", () => {
  it("defaults to 401", () => {
    const err = new AuthError();
    expect(err.statusCode).toBe(401);
    expect(err.code).toBe("UNAUTHORIZED");
  });
});

describe("ValidationError", () => {
  it("is 400 with fields", () => {
    const err = new ValidationError("invalid", { name: "required" });
    expect(err.statusCode).toBe(400);
    expect(err.fields).toEqual({ name: "required" });
  });
});

describe("NetworkError", () => {
  it("has status 0", () => {
    const err = new NetworkError();
    expect(err.statusCode).toBe(0);
    expect(err.code).toBe("NETWORK_ERROR");
  });
});

describe("normalizeError", () => {
  it("returns AppError as-is", () => {
    const err = new AppError("test", "CODE");
    expect(normalizeError(err)).toBe(err);
  });

  it("wraps Error", () => {
    const result = normalizeError(new TypeError("oops"));
    expect(result).toBeInstanceOf(AppError);
    expect(result.message).toBe("oops");
  });

  it("wraps string", () => {
    const result = normalizeError("string error");
    expect(result.message).toBe("string error");
  });

  it("wraps unknown", () => {
    const result = normalizeError(42);
    expect(result.message).toBe("不明なエラーが発生しました");
  });
});

describe("getErrorMessage", () => {
  it("extracts from AppError", () => {
    expect(getErrorMessage(new AppError("app err", "C"))).toBe("app err");
  });

  it("extracts from Error", () => {
    expect(getErrorMessage(new Error("err"))).toBe("err");
  });

  it("returns string directly", () => {
    expect(getErrorMessage("hello")).toBe("hello");
  });

  it("returns default for unknown", () => {
    expect(getErrorMessage(null)).toBe("エラーが発生しました");
  });
});

describe("getHttpErrorMessage", () => {
  it("returns correct messages for known codes", () => {
    expect(getHttpErrorMessage(401)).toBe("ログインが必要です");
    expect(getHttpErrorMessage(403)).toBe("アクセス権限がありません");
    expect(getHttpErrorMessage(404)).toBe("見つかりませんでした");
    expect(getHttpErrorMessage(429)).toContain("リクエストが多すぎます");
    expect(getHttpErrorMessage(500)).toBe("サーバーエラーが発生しました");
  });

  it("returns default for unknown code", () => {
    expect(getHttpErrorMessage(418)).toBe("エラーが発生しました");
  });

  it("groups 502/503/504", () => {
    const msg = "サーバーに接続できません";
    expect(getHttpErrorMessage(502)).toBe(msg);
    expect(getHttpErrorMessage(503)).toBe(msg);
    expect(getHttpErrorMessage(504)).toBe(msg);
  });
});
