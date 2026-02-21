import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
} from "vitest";
import { analytics } from "./analytics.svelte.js";
import * as api from "../api/client.js";
import type {
  AnalyticsSummary,
  ActivityResponse,
  HeatmapResponse,
  ProjectsAnalyticsResponse,
  HourOfWeekResponse,
  SessionShapeResponse,
  VelocityResponse,
  ToolsAnalyticsResponse,
  TopSessionsResponse,
} from "../api/types.js";

vi.mock("../api/client.js", () => ({
  getAnalyticsSummary: vi.fn(),
  getAnalyticsActivity: vi.fn(),
  getAnalyticsHeatmap: vi.fn(),
  getAnalyticsProjects: vi.fn(),
  getAnalyticsHourOfWeek: vi.fn(),
  getAnalyticsSessionShape: vi.fn(),
  getAnalyticsVelocity: vi.fn(),
  getAnalyticsTools: vi.fn(),
  getAnalyticsTopSessions: vi.fn(),
}));


function makeSummary(): AnalyticsSummary {
  return {
    total_sessions: 10,
    total_messages: 100,
    active_projects: 3,
    active_days: 5,
    avg_messages: 10,
    median_messages: 8,
    p90_messages: 20,
    most_active_project: "proj",
    concentration: 0.5,
    agents: {},
  };
}

function makeActivity(): ActivityResponse {
  return { granularity: "day", series: [] };
}

function makeHeatmap(): HeatmapResponse {
  return {
    metric: "messages",
    entries: [],
    levels: { l1: 1, l2: 5, l3: 10, l4: 20 },
  };
}

function makeProjects(): ProjectsAnalyticsResponse {
  return { projects: [] };
}

function makeHourOfWeek(): HourOfWeekResponse {
  return { cells: [] };
}

function makeSessionShape(): SessionShapeResponse {
  return {
    count: 0,
    length_distribution: [],
    duration_distribution: [],
    autonomy_distribution: [],
  };
}

function makeVelocity(): VelocityResponse {
  return {
    overall: {
      turn_cycle_sec: { p50: 0, p90: 0 },
      first_response_sec: { p50: 0, p90: 0 },
      msgs_per_active_min: 0,
      chars_per_active_min: 0,
      tool_calls_per_active_min: 0,
    },
    by_agent: [],
    by_complexity: [],
  };
}

function makeTools(): ToolsAnalyticsResponse {
  return {
    total_calls: 0,
    by_category: [],
    by_agent: [],
    trend: [],
  };
}

function makeTopSessions(): TopSessionsResponse {
  return { metric: "messages", sessions: [] };
}

function mockAllAPIs() {
  vi.mocked(api.getAnalyticsSummary).mockResolvedValue(
    makeSummary(),
  );
  vi.mocked(api.getAnalyticsActivity).mockResolvedValue(
    makeActivity(),
  );
  vi.mocked(api.getAnalyticsHeatmap).mockResolvedValue(
    makeHeatmap(),
  );
  vi.mocked(api.getAnalyticsProjects).mockResolvedValue(
    makeProjects(),
  );
  vi.mocked(api.getAnalyticsHourOfWeek).mockResolvedValue(
    makeHourOfWeek(),
  );
  vi.mocked(api.getAnalyticsSessionShape).mockResolvedValue(
    makeSessionShape(),
  );
  vi.mocked(api.getAnalyticsVelocity).mockResolvedValue(
    makeVelocity(),
  );
  vi.mocked(api.getAnalyticsTools).mockResolvedValue(
    makeTools(),
  );
  vi.mocked(api.getAnalyticsTopSessions).mockResolvedValue(
    makeTopSessions(),
  );
}

function resetStore() {
  analytics.selectedDate = null;
  analytics.project = "";
  analytics.from = "2024-01-01";
  analytics.to = "2024-01-31";
}

// Note: selectDate and setDateRange invoke API mocks
// synchronously (the mock call is recorded before the first
// await inside fetchSummary/etc.), so no async flushing is
// needed for call-count or call-param assertions.

beforeEach(() => {
  resetStore();
  vi.clearAllMocks();
  mockAllAPIs();
});

describe("AnalyticsStore.selectDate", () => {
  it("should set selectedDate on first click", () => {
    analytics.selectDate("2024-01-15");
    expect(analytics.selectedDate).toBe("2024-01-15");
  });

  it("should deselect when clicking the same date", () => {
    analytics.selectDate("2024-01-15");
    analytics.selectDate("2024-01-15");
    expect(analytics.selectedDate).toBeNull();
  });

  it("should switch to a different date", () => {
    analytics.selectDate("2024-01-15");
    analytics.selectDate("2024-01-20");
    expect(analytics.selectedDate).toBe("2024-01-20");
  });

  it("should fetch filtered panels but not heatmap/hourOfWeek", () => {
    analytics.selectDate("2024-01-15");

    expect(api.getAnalyticsSummary).toHaveBeenCalledTimes(1);
    expect(api.getAnalyticsActivity).toHaveBeenCalledTimes(1);
    expect(api.getAnalyticsProjects).toHaveBeenCalledTimes(1);
    expect(api.getAnalyticsSessionShape).toHaveBeenCalledTimes(1);
    expect(api.getAnalyticsVelocity).toHaveBeenCalledTimes(1);
    expect(api.getAnalyticsTools).toHaveBeenCalledTimes(1);
    expect(api.getAnalyticsHeatmap).not.toHaveBeenCalled();
    expect(api.getAnalyticsHourOfWeek).not.toHaveBeenCalled();
  });

  it("should pass selected date as from/to for filtered panels", () => {
    analytics.selectDate("2024-01-15");

    expect(api.getAnalyticsSummary).toHaveBeenLastCalledWith(
      expect.objectContaining({ from: "2024-01-15", to: "2024-01-15" }),
    );
    expect(api.getAnalyticsActivity).toHaveBeenLastCalledWith(
      expect.objectContaining({ from: "2024-01-15", to: "2024-01-15" }),
    );
    expect(api.getAnalyticsProjects).toHaveBeenLastCalledWith(
      expect.objectContaining({ from: "2024-01-15", to: "2024-01-15" }),
    );
  });

  it("should use full range after deselecting", () => {
    analytics.selectDate("2024-01-15");
    vi.clearAllMocks();

    analytics.selectDate("2024-01-15"); // deselect

    expect(api.getAnalyticsSummary).toHaveBeenLastCalledWith(
      expect.objectContaining({ from: "2024-01-01", to: "2024-01-31" }),
    );
    expect(api.getAnalyticsActivity).toHaveBeenLastCalledWith(
      expect.objectContaining({ from: "2024-01-01", to: "2024-01-31" }),
    );
    expect(api.getAnalyticsProjects).toHaveBeenLastCalledWith(
      expect.objectContaining({ from: "2024-01-01", to: "2024-01-31" }),
    );
  });
});

describe("AnalyticsStore.setDateRange", () => {
  it("should clear selectedDate", () => {
    analytics.selectDate("2024-01-15");
    analytics.setDateRange("2024-02-01", "2024-02-28");
    expect(analytics.selectedDate).toBeNull();
  });

  it("should fetch all panels with new range params", () => {
    analytics.setDateRange("2024-02-01", "2024-02-28");

    expect(api.getAnalyticsSummary).toHaveBeenCalledTimes(1);
    expect(api.getAnalyticsActivity).toHaveBeenCalledTimes(1);
    expect(api.getAnalyticsHeatmap).toHaveBeenCalledTimes(1);
    expect(api.getAnalyticsProjects).toHaveBeenCalledTimes(1);
    expect(api.getAnalyticsHourOfWeek).toHaveBeenCalledTimes(1);
    expect(api.getAnalyticsSessionShape).toHaveBeenCalledTimes(1);
    expect(api.getAnalyticsVelocity).toHaveBeenCalledTimes(1);
    expect(api.getAnalyticsTools).toHaveBeenCalledTimes(1);

    const expected = expect.objectContaining({
      from: "2024-02-01", to: "2024-02-28",
    });
    expect(api.getAnalyticsSummary).toHaveBeenLastCalledWith(expected);
    expect(api.getAnalyticsActivity).toHaveBeenLastCalledWith(expected);
    expect(api.getAnalyticsHeatmap).toHaveBeenLastCalledWith(expected);
    expect(api.getAnalyticsProjects).toHaveBeenLastCalledWith(expected);
    expect(api.getAnalyticsHourOfWeek).toHaveBeenLastCalledWith(expected);
    expect(api.getAnalyticsSessionShape).toHaveBeenLastCalledWith(expected);
    expect(api.getAnalyticsVelocity).toHaveBeenLastCalledWith(expected);
    expect(api.getAnalyticsTools).toHaveBeenLastCalledWith(expected);
  });
});

describe("AnalyticsStore heatmap uses full range", () => {
  it("should use base from/to for heatmap even with selectedDate", async () => {
    analytics.selectDate("2024-01-15");
    vi.clearAllMocks();

    await analytics.fetchHeatmap();

    expect(api.getAnalyticsHeatmap).toHaveBeenLastCalledWith(
      expect.objectContaining({ from: "2024-01-01", to: "2024-01-31" }),
    );
  });
});

describe("AnalyticsStore.setProject", () => {
  it("should toggle project on first click", () => {
    analytics.setProject("alpha");
    expect(analytics.project).toBe("alpha");
  });

  it("should clear project when clicking same project", () => {
    analytics.setProject("alpha");
    analytics.setProject("alpha");
    expect(analytics.project).toBe("");
  });

  it("should switch to different project", () => {
    analytics.setProject("alpha");
    analytics.setProject("beta");
    expect(analytics.project).toBe("beta");
  });

  it.each([
    { name: "summary", fn: () => api.getAnalyticsSummary },
    { name: "activity", fn: () => api.getAnalyticsActivity },
    { name: "sessionShape", fn: () => api.getAnalyticsSessionShape },
    { name: "velocity", fn: () => api.getAnalyticsVelocity },
    { name: "tools", fn: () => api.getAnalyticsTools },
    { name: "topSessions", fn: () => api.getAnalyticsTopSessions },
  ])(
    "should include project in $name params",
    ({ fn }) => {
      analytics.setProject("alpha");
      const params = vi.mocked(fn()).mock.lastCall?.[0];
      expect(params?.project).toBe("alpha");
    },
  );

  it.each([
    { name: "heatmap", fn: () => api.getAnalyticsHeatmap },
    { name: "hourOfWeek", fn: () => api.getAnalyticsHourOfWeek },
  ])(
    "should include project in $name base params",
    ({ fn }) => {
      analytics.setProject("alpha");
      const params = vi.mocked(fn()).mock.lastCall?.[0];
      expect(params?.project).toBe("alpha");
    },
  );

  it("should exclude project from fetchProjects params", () => {
    analytics.setProject("alpha");

    const projectsParams =
      vi.mocked(api.getAnalyticsProjects).mock.lastCall?.[0];
    expect(projectsParams?.project).toBeUndefined();
  });

  it("should exclude project from fetchProjects even with selectedDate", () => {
    analytics.selectDate("2024-01-15");
    vi.clearAllMocks();

    analytics.setProject("alpha");

    const projectsParams =
      vi.mocked(api.getAnalyticsProjects).mock.lastCall?.[0];
    expect(projectsParams?.project).toBeUndefined();
    expect(projectsParams?.from).toBe("2024-01-15");
  });

  it.each([
    { name: "summary", fn: () => api.getAnalyticsSummary },
    { name: "activity", fn: () => api.getAnalyticsActivity },
    { name: "sessionShape", fn: () => api.getAnalyticsSessionShape },
    { name: "velocity", fn: () => api.getAnalyticsVelocity },
    { name: "tools", fn: () => api.getAnalyticsTools },
    { name: "topSessions", fn: () => api.getAnalyticsTopSessions },
    { name: "heatmap", fn: () => api.getAnalyticsHeatmap },
    { name: "hourOfWeek", fn: () => api.getAnalyticsHourOfWeek },
  ])(
    "should clear project from $name params after deselecting",
    ({ fn }) => {
      analytics.setProject("alpha");
      vi.clearAllMocks();

      analytics.setProject("alpha"); // deselect

      const mock = vi.mocked(fn());
      expect(mock).toHaveBeenCalled();
      const params = mock.mock.lastCall?.[0];
      expect(params?.project).toBeUndefined();
    },
  );
});
