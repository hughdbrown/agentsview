import { describe, it, expect } from "vitest";
import { LRUCache } from "./cache.js";

describe("LRUCache", () => {
  it("stores and retrieves values", () => {
    const c = new LRUCache<string, number>(3);
    c.set("a", 1);
    expect(c.get("a")).toBe(1);
  });

  it("returns undefined for missing keys", () => {
    const c = new LRUCache<string, number>(3);
    expect(c.get("missing")).toBeUndefined();
  });

  it("evicts the least recently used entry on overflow", () => {
    const c = new LRUCache<string, number>(3);
    c.set("a", 1);
    c.set("b", 2);
    c.set("c", 3);
    c.set("d", 4); // evicts "a"
    expect(c.get("a")).toBeUndefined();
    expect(c.get("b")).toBe(2);
    expect(c.get("d")).toBe(4);
  });

  it("promotes accessed entries so they survive eviction", () => {
    const c = new LRUCache<string, number>(3);
    c.set("a", 1);
    c.set("b", 2);
    c.set("c", 3);
    c.get("a"); // promote "a" — now "b" is least recent
    c.set("d", 4); // evicts "b"
    expect(c.get("a")).toBe(1);
    expect(c.get("b")).toBeUndefined();
  });

  it("updates existing keys without growing size", () => {
    const c = new LRUCache<string, number>(2);
    c.set("a", 1);
    c.set("b", 2);
    c.set("a", 10); // update, not insert
    expect(c.size).toBe(2);
    expect(c.get("a")).toBe(10);
  });

  it("reports size correctly", () => {
    const c = new LRUCache<string, number>(5);
    expect(c.size).toBe(0);
    c.set("a", 1);
    c.set("b", 2);
    expect(c.size).toBe(2);
  });
});
