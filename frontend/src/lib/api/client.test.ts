import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { triggerSync } from "./client.js";
import type { SyncProgress, SyncStats } from "./types.js";

/**
 * Create a ReadableStream that yields the given chunks as
 * Uint8Array values, then closes.
 */
function makeSSEStream(
  chunks: string[],
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let i = 0;
  return new ReadableStream({
    pull(controller) {
      if (i < chunks.length) {
        controller.enqueue(encoder.encode(chunks[i]!));
        i++;
      } else {
        controller.close();
      }
    },
  });
}

function mockFetchWithStream(
  chunks: string[],
): void {
  const stream = makeSSEStream(chunks);
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
    ok: true,
    body: stream,
  }));
}

describe("triggerSync SSE parsing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("should parse CRLF-terminated SSE frames", async () => {
    const progressData: SyncProgress[] = [];
    const doneData: SyncStats[] = [];

    // SSE frames with CRLF line endings
    mockFetchWithStream([
      "event: progress\r\ndata: {\"phase\":\"scanning\",\"projects_total\":1,\"projects_done\":0,\"sessions_total\":0,\"sessions_done\":0,\"messages_indexed\":0}\r\n\r\n",
      "event: done\r\ndata: {\"total_sessions\":5,\"synced\":3,\"skipped\":2}\r\n\r\n",
    ]);

    const controller = triggerSync({
      onProgress: (p) => progressData.push(p),
      onDone: (s) => doneData.push(s),
    });

    // Wait for stream processing
    await vi.waitFor(() => {
      expect(doneData.length).toBe(1);
    });

    expect(progressData.length).toBe(1);
    expect(progressData[0]!.phase).toBe("scanning");
    expect(doneData[0]!.total_sessions).toBe(5);
    expect(doneData[0]!.synced).toBe(3);

    controller.abort();
  });

  it("should handle multi-line data: payloads", async () => {
    const progressData: SyncProgress[] = [];

    // data split across multiple "data:" lines
    mockFetchWithStream([
      'event: progress\ndata: {"phase":"scanning",\ndata: "projects_total":2,"projects_done":1,\ndata: "sessions_total":10,"sessions_done":5,"messages_indexed":50}\n\n',
      'event: done\ndata: {"total_sessions":10,"synced":5,"skipped":5}\n\n',
    ]);

    const doneData: SyncStats[] = [];
    const controller = triggerSync({
      onProgress: (p) => progressData.push(p),
      onDone: (s) => doneData.push(s),
    });

    await vi.waitFor(() => {
      expect(doneData.length).toBe(1);
    });

    expect(progressData.length).toBe(1);
    expect(progressData[0]!.projects_total).toBe(2);
    expect(progressData[0]!.sessions_done).toBe(5);

    controller.abort();
  });

  it("should process trailing frame on EOF", async () => {
    const doneData: SyncStats[] = [];

    // Frame without trailing \n\n (EOF before double-newline)
    mockFetchWithStream([
      'event: done\ndata: {"total_sessions":1,"synced":1,"skipped":0}',
    ]);

    const controller = triggerSync({
      onDone: (s) => doneData.push(s),
    });

    await vi.waitFor(() => {
      expect(doneData.length).toBe(1);
    });

    expect(doneData[0]!.total_sessions).toBe(1);
    expect(doneData[0]!.synced).toBe(1);

    controller.abort();
  });

  it("should trigger onDone once and stop processing after done", async () => {
    const progressData: SyncProgress[] = [];
    const doneData: SyncStats[] = [];

    // "done" event followed by another progress event that should
    // not be processed
    mockFetchWithStream([
      'event: done\ndata: {"total_sessions":1,"synced":1,"skipped":0}\n\n',
      'event: progress\ndata: {"phase":"extra","projects_total":0,"projects_done":0,"sessions_total":0,"sessions_done":0,"messages_indexed":0}\n\n',
    ]);

    const controller = triggerSync({
      onProgress: (p) => progressData.push(p),
      onDone: (s) => doneData.push(s),
    });

    await vi.waitFor(() => {
      expect(doneData.length).toBe(1);
    });

    // Small delay to ensure no further processing happens
    await new Promise((r) => setTimeout(r, 50));

    expect(doneData.length).toBe(1);
    expect(progressData.length).toBe(0);

    controller.abort();
  });

  it("should handle data: without space after colon", async () => {
    const doneData: SyncStats[] = [];

    // "data:" without space (valid SSE, less common)
    mockFetchWithStream([
      'event: done\ndata:{"total_sessions":3,"synced":2,"skipped":1}\n\n',
    ]);

    const controller = triggerSync({
      onDone: (s) => doneData.push(s),
    });

    await vi.waitFor(() => {
      expect(doneData.length).toBe(1);
    });

    expect(doneData[0]!.total_sessions).toBe(3);

    controller.abort();
  });

  it("should call onError for non-ok responses", async () => {
    const errors: Error[] = [];

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      body: null,
    }));

    const controller = triggerSync({
      onError: (e) => errors.push(e),
    });

    await vi.waitFor(() => {
      expect(errors.length).toBe(1);
    });

    expect(errors[0]!.message).toContain("500");

    controller.abort();
  });

  it("should handle chunks split across frame boundaries", async () => {
    const progressData: SyncProgress[] = [];
    const doneData: SyncStats[] = [];

    // Frame split across two chunks
    mockFetchWithStream([
      'event: progress\ndata: {"phase":"scan',
      'ning","projects_total":1,"projects_done":0,"sessions_total":0,"sessions_done":0,"messages_indexed":0}\n\nevent: done\ndata: {"total_sessions":1,"synced":1,"skipped":0}\n\n',
    ]);

    const controller = triggerSync({
      onProgress: (p) => progressData.push(p),
      onDone: (s) => doneData.push(s),
    });

    await vi.waitFor(() => {
      expect(doneData.length).toBe(1);
    });

    expect(progressData.length).toBe(1);
    expect(progressData[0]!.phase).toBe("scanning");

    controller.abort();
  });
});
