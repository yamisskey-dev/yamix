import { describe, it, expect } from "vitest";
import { parseSSEJsonStream } from "./sse-parser";

function streamOf(...chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });
}

async function collect<T>(stream: ReadableStream<Uint8Array>): Promise<T[]> {
  const events: T[] = [];
  for await (const event of parseSSEJsonStream<T>(stream)) {
    events.push(event);
  }
  return events;
}

describe("parseSSEJsonStream", () => {
  it("data: 行の JSON をイベントとして順に返す", async () => {
    const stream = streamOf('data: {"a":1}\n\ndata: {"a":2}\n\n');
    expect(await collect(stream)).toEqual([{ a: 1 }, { a: 2 }]);
  });

  it("チャンク境界で分割された行を正しく組み立てる", async () => {
    const stream = streamOf('data: {"chunk":"こん', 'にちは"}\n\n');
    expect(await collect(stream)).toEqual([{ chunk: "こんにちは" }]);
  });

  it("data: 以外の行と空行は無視する", async () => {
    const stream = streamOf(': comment\n\nevent: ping\ndata: {"ok":true}\n\n');
    expect(await collect(stream)).toEqual([{ ok: true }]);
  });

  it("JSON でない data 行（[DONE] 等）はスキップする", async () => {
    const stream = streamOf('data: [DONE]\ndata: {"ok":true}\n\n');
    expect(await collect(stream)).toEqual([{ ok: true }]);
  });

  it("壊れた JSON の行はスキップして後続を処理する", async () => {
    const stream = streamOf('data: {broken\ndata: {"ok":true}\n\n');
    expect(await collect(stream)).toEqual([{ ok: true }]);
  });

  it("最終行に改行がなくても取りこぼさない", async () => {
    const stream = streamOf('data: {"last":true}');
    expect(await collect(stream)).toEqual([{ last: true }]);
  });
});
