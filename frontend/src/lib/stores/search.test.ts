import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { searchStore } from "./search.svelte.js";
import * as api from "../api/client.js";
import type { SearchResponse } from "../api/types.js";

vi.mock("../api/client.js", () => ({
  search: vi.fn(),
}));

function makeSearchResponse(
  query: string,
  count: number,
): SearchResponse {
  return {
    query,
    results: Array.from({ length: count }, (_, i) => ({
      session_id: `s${i}`,
      project: "proj",
      ordinal: i,
      role: "assistant",
      timestamp: new Date().toISOString(),
      snippet: `result ${i}`,
      rank: i,
    })),
    count,
    next: 0,
  };
}

describe("SearchStore", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    searchStore.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should ignore stale in-flight search after version bump", async () => {
    // First search: slow, will be stale by the time it resolves
    let resolveFirst!: (v: SearchResponse) => void;
    const firstPromise = new Promise<SearchResponse>((r) => {
      resolveFirst = r;
    });
    vi.mocked(api.search).mockReturnValueOnce(firstPromise);

    // Second search: fast
    vi.mocked(api.search).mockResolvedValueOnce(
      makeSearchResponse("world", 2),
    );

    // Trigger first search
    searchStore.search("hello");
    vi.advanceTimersByTime(300);

    // Trigger second search (bumps version, invalidating first)
    searchStore.search("world");
    vi.advanceTimersByTime(300);

    // Wait for second search to complete
    await vi.runAllTimersAsync();
    // Flush microtasks
    await Promise.resolve();

    // Now resolve the first (stale) search
    resolveFirst(makeSearchResponse("hello", 5));
    await Promise.resolve();

    // Results should be from the second search, not the first
    expect(searchStore.results.length).toBe(2);
    expect(searchStore.isSearching).toBe(false);
  });

  it("should ignore stale in-flight search after clear()", async () => {
    let resolveSearch!: (v: SearchResponse) => void;
    const searchPromise = new Promise<SearchResponse>((r) => {
      resolveSearch = r;
    });
    vi.mocked(api.search).mockReturnValueOnce(searchPromise);

    // Trigger search
    searchStore.search("hello");
    vi.advanceTimersByTime(300);

    // Clear while search is in-flight
    searchStore.clear();

    // Resolve the stale search
    resolveSearch(makeSearchResponse("hello", 5));
    await Promise.resolve();

    // Results should remain empty after clear
    expect(searchStore.results.length).toBe(0);
    expect(searchStore.query).toBe("");
    expect(searchStore.isSearching).toBe(false);
  });

  it("should not apply old results when query changes during debounce", async () => {
    vi.mocked(api.search).mockResolvedValueOnce(
      makeSearchResponse("final", 3),
    );

    // Type several queries within debounce window
    searchStore.search("f");
    vi.advanceTimersByTime(100);
    searchStore.search("fi");
    vi.advanceTimersByTime(100);
    searchStore.search("final");
    vi.advanceTimersByTime(300);

    await vi.runAllTimersAsync();
    await Promise.resolve();

    // Only one API call should have been made (for "final")
    expect(api.search).toHaveBeenCalledTimes(1);
    expect(api.search).toHaveBeenCalledWith(
      "final",
      expect.objectContaining({ limit: 30 }),
    );
    expect(searchStore.results.length).toBe(3);
  });

  it("should clear results immediately for empty query", () => {
    // Manually set some results first
    searchStore.search("test");
    // Now clear via empty query
    searchStore.search("");

    expect(searchStore.results.length).toBe(0);
    expect(searchStore.isSearching).toBe(false);
    // No API call should be made for empty query
    vi.advanceTimersByTime(300);
    expect(api.search).not.toHaveBeenCalled();
  });

  it("should not set isSearching to false if a newer search is in-flight", async () => {
    // First search: will resolve but be stale
    let resolveFirst!: (v: SearchResponse) => void;
    const firstPromise = new Promise<SearchResponse>((r) => {
      resolveFirst = r;
    });
    vi.mocked(api.search).mockReturnValueOnce(firstPromise);

    // Second search: hangs
    let resolveSecond!: (v: SearchResponse) => void;
    const secondPromise = new Promise<SearchResponse>((r) => {
      resolveSecond = r;
    });
    vi.mocked(api.search).mockReturnValueOnce(secondPromise);

    // Trigger first search
    searchStore.search("first");
    vi.advanceTimersByTime(300);

    // Trigger second search
    searchStore.search("second");
    vi.advanceTimersByTime(300);

    // Resolve first (stale) search
    resolveFirst(makeSearchResponse("first", 1));
    await Promise.resolve();

    // isSearching should still be true (second search is still in-flight)
    expect(searchStore.isSearching).toBe(true);

    // Resolve second search
    resolveSecond(makeSearchResponse("second", 2));
    await Promise.resolve();

    expect(searchStore.isSearching).toBe(false);
    expect(searchStore.results.length).toBe(2);
  });
});
