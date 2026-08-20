import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { YamiiClient } from "./yamii-client";

function okJson(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function errorResponse(status: number): Response {
  return new Response("upstream error", { status });
}

/** signal の abort で reject する、解決しない fetch を作る */
function hangingFetch() {
  return vi.fn((_url: RequestInfo | URL, init?: RequestInit) => {
    return new Promise<Response>((_, reject) => {
      init?.signal?.addEventListener("abort", () => {
        reject(new DOMException("The operation was aborted.", "AbortError"));
      });
    });
  });
}

describe("YamiiClient", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("retry", () => {
    it("GET は 5xx のとき再試行して成功する", async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(errorResponse(503))
        .mockResolvedValueOnce(okJson({ status: "ok" }));
      vi.stubGlobal("fetch", fetchMock);

      const client = new YamiiClient("http://yamii.test", undefined, {
        retryDelaysMs: [1],
      });
      const result = await client.healthCheck();

      expect(result).toEqual({ status: "ok" });
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("GET はネットワークエラーのとき再試行する", async () => {
      const fetchMock = vi
        .fn()
        .mockRejectedValueOnce(new TypeError("fetch failed"))
        .mockResolvedValueOnce(okJson({ status: "ok" }));
      vi.stubGlobal("fetch", fetchMock);

      const client = new YamiiClient("http://yamii.test", undefined, {
        retryDelaysMs: [1],
      });
      const result = await client.healthCheck();

      expect(result).toEqual({ status: "ok" });
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("GET でも 4xx は再試行せず即座に失敗する", async () => {
      const fetchMock = vi.fn().mockResolvedValue(errorResponse(404));
      vi.stubGlobal("fetch", fetchMock);

      const client = new YamiiClient("http://yamii.test", undefined, {
        retryDelaysMs: [1],
      });

      await expect(client.healthCheck()).rejects.toThrow("Yamii API Error: 404");
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("counseling POST は非冪等なので 5xx でも再試行しない", async () => {
      const fetchMock = vi.fn().mockResolvedValue(errorResponse(503));
      vi.stubGlobal("fetch", fetchMock);

      const client = new YamiiClient("http://yamii.test", undefined, {
        retryDelaysMs: [1],
      });

      await expect(
        client.sendCounselingMessage("hello", "user-1")
      ).rejects.toThrow("Yamii API Error: 503");
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("generateTitle は再試行し、全滅したらローカルフォールバックする", async () => {
      const fetchMock = vi.fn().mockResolvedValue(errorResponse(503));
      vi.stubGlobal("fetch", fetchMock);

      const client = new YamiiClient("http://yamii.test", undefined, {
        retryDelaysMs: [1],
      });
      const title = await client.generateTitle("今日は辛いことがありました。詳しく話したいです。");

      expect(title).toBe("今日は辛いことがありました。");
      expect(fetchMock.mock.calls.length).toBeGreaterThan(1);
    });
  });

  describe("timeout", () => {
    it("応答がないリクエストはタイムアウトで中断される", async () => {
      vi.stubGlobal("fetch", hangingFetch());

      const client = new YamiiClient("http://yamii.test", undefined, {
        requestTimeoutMs: 20,
        retryDelaysMs: [],
      });

      await expect(client.healthCheck()).rejects.toThrow();
    });

    it("ストリームは接続確立までタイムアウトで中断される", async () => {
      vi.stubGlobal("fetch", hangingFetch());

      const client = new YamiiClient("http://yamii.test", undefined, {
        streamConnectTimeoutMs: 20,
      });

      await expect(
        client.sendCounselingMessageStream("hello", "user-1")
      ).rejects.toThrow();
    });
  });
});
