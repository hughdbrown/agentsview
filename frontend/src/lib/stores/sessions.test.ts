import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
} from "vitest";
import { sessions } from "./sessions.svelte.js";
import * as api from "../api/client.js";

vi.mock("../api/client.js", () => ({
  listSessions: vi.fn(),
  getProjects: vi.fn(),
}));

function mockListSessions() {
  vi.mocked(api.listSessions).mockResolvedValue({
    sessions: [],
    total: 0,
  });
}

function resetStore() {
  sessions.projectFilter = "";
  sessions.dateFilter = "";
  sessions.dateFromFilter = "";
  sessions.dateToFilter = "";
  sessions.minMessagesFilter = 0;
  sessions.maxMessagesFilter = 0;
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

    const call = vi.mocked(api.listSessions).mock.lastCall;
    expect(call).toBeDefined();
    expect(call![0].min_messages).toBeUndefined();
    expect(call![0].max_messages).toBeUndefined();
  });

  it("should include positive min_messages", async () => {
    sessions.minMessagesFilter = 5;
    await sessions.load();

    const call = vi.mocked(api.listSessions).mock.lastCall;
    expect(call![0].min_messages).toBe(5);
  });

  it("should include positive max_messages", async () => {
    sessions.maxMessagesFilter = 100;
    await sessions.load();

    const call = vi.mocked(api.listSessions).mock.lastCall;
    expect(call![0].max_messages).toBe(100);
  });

  it("should pass project filter when set", async () => {
    sessions.projectFilter = "myproj";
    await sessions.load();

    const call = vi.mocked(api.listSessions).mock.lastCall;
    expect(call![0].project).toBe("myproj");
  });

  it("should omit project when empty", async () => {
    sessions.projectFilter = "";
    await sessions.load();

    const call = vi.mocked(api.listSessions).mock.lastCall;
    expect(call![0].project).toBeUndefined();
  });
});
