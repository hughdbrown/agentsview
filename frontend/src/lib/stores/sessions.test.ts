import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
} from "vitest";
import { sessions } from "./sessions.svelte.js";
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

function resetStore() {
  sessions.projectFilter = "";
  sessions.dateFilter = "";
  sessions.dateFromFilter = "";
  sessions.dateToFilter = "";
  sessions.minMessagesFilter = 0;
  sessions.maxMessagesFilter = 0;
  // Reset private state for loadProjects dedup.
  // Access via any to bypass TS visibility.
  (sessions as any).projectsLoaded = false;
  (sessions as any).projectsPromise = null;
}

function getLastListSessionsParams(): ListSessionsParams {
  const call = vi.mocked(api.listSessions).mock.lastCall;
  expect(call).toBeDefined();
  const params = call?.[0];
  expect(params).toBeDefined();
  return params!;
}

describe("SessionsStore.initFromParams", () => {
  beforeEach(() => {
    resetStore();
    vi.clearAllMocks();
    mockListSessions();
  });

  it("should parse project and date params", () => {
    sessions.initFromParams({
      project: "myproj",
      date: "2024-06-15",
    });
    expect(sessions.projectFilter).toBe("myproj");
    expect(sessions.dateFilter).toBe("2024-06-15");
  });

  it("should parse date_from and date_to", () => {
    sessions.initFromParams({
      date_from: "2024-06-01",
      date_to: "2024-06-30",
    });
    expect(sessions.dateFromFilter).toBe("2024-06-01");
    expect(sessions.dateToFilter).toBe("2024-06-30");
  });

  it("should parse numeric min_messages", () => {
    sessions.initFromParams({ min_messages: "5" });
    expect(sessions.minMessagesFilter).toBe(5);
  });

  it("should parse numeric max_messages", () => {
    sessions.initFromParams({ max_messages: "100" });
    expect(sessions.maxMessagesFilter).toBe(100);
  });

  it("should default non-numeric min/max to 0", () => {
    sessions.initFromParams({
      min_messages: "abc",
      max_messages: "",
    });
    expect(sessions.minMessagesFilter).toBe(0);
    expect(sessions.maxMessagesFilter).toBe(0);
  });

  it("should default missing params to empty/zero", () => {
    sessions.initFromParams({});
    expect(sessions.projectFilter).toBe("");
    expect(sessions.dateFilter).toBe("");
    expect(sessions.minMessagesFilter).toBe(0);
    expect(sessions.maxMessagesFilter).toBe(0);
  });
});

describe("SessionsStore.load serialization", () => {
  beforeEach(() => {
    resetStore();
    vi.clearAllMocks();
    mockListSessions();
  });

  it("should omit min/max_messages when 0", async () => {
    sessions.minMessagesFilter = 0;
    sessions.maxMessagesFilter = 0;
    await sessions.load();

    const params = getLastListSessionsParams();
    expect(params.min_messages).toBeUndefined();
    expect(params.max_messages).toBeUndefined();
  });

  it("should include positive min_messages", async () => {
    sessions.minMessagesFilter = 5;
    await sessions.load();

    const params = getLastListSessionsParams();
    expect(params.min_messages).toBe(5);
  });

  it("should include positive max_messages", async () => {
    sessions.maxMessagesFilter = 100;
    await sessions.load();

    const params = getLastListSessionsParams();
    expect(params.max_messages).toBe(100);
  });

  it("should pass project filter when set", async () => {
    sessions.projectFilter = "myproj";
    await sessions.load();

    const params = getLastListSessionsParams();
    expect(params.project).toBe("myproj");
  });

  it("should omit project when empty", async () => {
    sessions.projectFilter = "";
    await sessions.load();

    const params = getLastListSessionsParams();
    expect(params.project).toBeUndefined();
  });
});

describe("SessionsStore.loadMore serialization", () => {
  beforeEach(() => {
    resetStore();
    vi.clearAllMocks();
  });

  it("should pass filters through loadMore", async () => {
    mockListSessions({ next_cursor: "cur1" });
    sessions.minMessagesFilter = 10;
    sessions.maxMessagesFilter = 50;
    await sessions.load();

    vi.clearAllMocks();
    mockListSessions();
    await sessions.loadMore();

    const params = getLastListSessionsParams();
    expect(params.min_messages).toBe(10);
    expect(params.max_messages).toBe(50);
    expect(params.cursor).toBe("cur1");
  });

  it("should omit min/max when 0 in loadMore", async () => {
    mockListSessions({ next_cursor: "cur2" });
    await sessions.load();

    vi.clearAllMocks();
    mockListSessions();
    await sessions.loadMore();

    const params = getLastListSessionsParams();
    expect(params.min_messages).toBeUndefined();
    expect(params.max_messages).toBeUndefined();
  });
});

describe("SessionsStore.loadProjects dedup", () => {
  beforeEach(() => {
    resetStore();
    vi.clearAllMocks();
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
