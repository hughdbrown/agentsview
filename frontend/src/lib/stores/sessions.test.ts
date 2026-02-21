import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
} from "vitest";
import { createSessionsStore } from "./sessions.svelte.js";
import * as api from "../api/client.js";
import type { ListSessionsParams } from "../api/client.js";

vi.mock("../api/client.js", () => ({
  listSessions: vi.fn(),
  getProjects: vi.fn(),
}));

function mockListSessions(
  overrides?: Partial<{ next_cursor: string }>,
) {
  vi.mocked(api.listSessions).mockResolvedValue({
    sessions: [],
    total: 0,
    ...overrides,
  });
}

function mockGetProjects() {
  vi.mocked(api.getProjects).mockResolvedValue({
    projects: [{ name: "proj", session_count: 1 }],
  });
}

function expectListSessionsCalledWith(
  expected: Partial<ListSessionsParams>,
) {
  expect(api.listSessions).toHaveBeenLastCalledWith(
    expect.objectContaining(expected),
  );
}

describe("SessionsStore", () => {
  let sessions: ReturnType<typeof createSessionsStore>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockListSessions();
    sessions = createSessionsStore();
  });

  describe("initFromParams", () => {
    it("should parse project and date params", () => {
      sessions.initFromParams({
        project: "myproj",
        date: "2024-06-15",
      });
      expect(sessions.filters.project).toBe("myproj");
      expect(sessions.filters.date).toBe("2024-06-15");
    });

    it("should parse date_from and date_to", () => {
      sessions.initFromParams({
        date_from: "2024-06-01",
        date_to: "2024-06-30",
      });
      expect(sessions.filters.dateFrom).toBe("2024-06-01");
      expect(sessions.filters.dateTo).toBe("2024-06-30");
    });

    it("should parse numeric min_messages", () => {
      sessions.initFromParams({ min_messages: "5" });
      expect(sessions.filters.minMessages).toBe(5);
    });

    it("should parse numeric max_messages", () => {
      sessions.initFromParams({ max_messages: "100" });
      expect(sessions.filters.maxMessages).toBe(100);
    });

    it("should default non-numeric min/max to 0", () => {
      sessions.initFromParams({
        min_messages: "abc",
        max_messages: "",
      });
      expect(sessions.filters.minMessages).toBe(0);
      expect(sessions.filters.maxMessages).toBe(0);
    });

    it("should default missing params to empty/zero", () => {
      sessions.initFromParams({});
      expect(sessions.filters.project).toBe("");
      expect(sessions.filters.date).toBe("");
      expect(sessions.filters.minMessages).toBe(0);
      expect(sessions.filters.maxMessages).toBe(0);
    });
  });

  describe("load serialization", () => {
    it("should omit min/max_messages when 0", async () => {
      sessions.filters.minMessages = 0;
      sessions.filters.maxMessages = 0;
      await sessions.load();

      expectListSessionsCalledWith({
        min_messages: undefined,
        max_messages: undefined,
      });
    });

    it("should include positive min_messages", async () => {
      sessions.filters.minMessages = 5;
      await sessions.load();

      expectListSessionsCalledWith({ min_messages: 5 });
    });

    it("should include positive max_messages", async () => {
      sessions.filters.maxMessages = 100;
      await sessions.load();

      expectListSessionsCalledWith({ max_messages: 100 });
    });

    it("should pass project filter when set", async () => {
      sessions.filters.project = "myproj";
      await sessions.load();

      expectListSessionsCalledWith({ project: "myproj" });
    });

    it("should omit project when empty", async () => {
      sessions.filters.project = "";
      await sessions.load();

      expectListSessionsCalledWith({
        project: undefined,
      });
    });
  });

  describe("loadMore serialization", () => {
    it("should fetch all pages with consistent filters in load()", async () => {
      vi.mocked(api.listSessions)
        .mockResolvedValueOnce({
          sessions: [
            {
              id: "s1",
              project: "proj",
              machine: "m",
              agent: "a",
              first_message: null,
              started_at: null,
              ended_at: null,
              message_count: 1,
              created_at: "2024-01-01T00:00:00Z",
            },
          ],
          total: 2,
          next_cursor: "cur1",
        })
        .mockResolvedValueOnce({
          sessions: [
            {
              id: "s2",
              project: "proj",
              machine: "m",
              agent: "a",
              first_message: null,
              started_at: null,
              ended_at: null,
              message_count: 1,
              created_at: "2024-01-01T00:00:01Z",
            },
          ],
          total: 2,
        });

      sessions.filters.minMessages = 10;
      sessions.filters.maxMessages = 50;
      await sessions.load();

      expect(api.listSessions).toHaveBeenCalledTimes(2);
      const calls = vi.mocked(api.listSessions).mock.calls;
      const first = calls[0]?.[0];
      const second = calls[1]?.[0];

      expect(first?.min_messages).toBe(10);
      expect(first?.max_messages).toBe(50);
      expect(first?.cursor).toBeUndefined();

      expect(second?.min_messages).toBe(10);
      expect(second?.max_messages).toBe(50);
      expect(second?.cursor).toBe("cur1");

      expect(sessions.sessions).toHaveLength(2);
      expect(sessions.total).toBe(2);
      expect(sessions.nextCursor).toBeNull();
    });

    it("should omit min/max when 0 in loadMore", async () => {
      sessions.nextCursor = "cur2";

      mockListSessions();
      await sessions.loadMore();

      expectListSessionsCalledWith({
        min_messages: undefined,
        max_messages: undefined,
      });
    });
  });

  describe("loadProjects dedup", () => {
    beforeEach(() => {
      mockGetProjects();
    });

    it("should only call API once across multiple loadProjects", async () => {
      await sessions.loadProjects();
      await sessions.loadProjects();
      await sessions.loadProjects();

      expect(api.getProjects).toHaveBeenCalledTimes(1);
    });

    it("should not fire concurrent requests", async () => {
      const p1 = sessions.loadProjects();
      const p2 = sessions.loadProjects();
      await Promise.all([p1, p2]);

      expect(api.getProjects).toHaveBeenCalledTimes(1);
    });

    it("should let concurrent callers await the same result", async () => {
      const p1 = sessions.loadProjects();
      const p2 = sessions.loadProjects();
      await Promise.all([p1, p2]);

      expect(sessions.projects).toHaveLength(1);
      expect(sessions.projects[0]!.name).toBe("proj");
    });

    it("should propagate rejection to all concurrent callers", async () => {
      vi.mocked(api.getProjects).mockRejectedValueOnce(
        new Error("network"),
      );

      const p1 = sessions.loadProjects();
      const p2 = sessions.loadProjects();

      await expect(p1).rejects.toThrow("network");
      await expect(p2).rejects.toThrow("network");
    });
  });
});
