import * as api from "../api/client.js";
import type { Session, ProjectInfo } from "../api/types.js";

const SESSION_PAGE_SIZE = 500;

interface Filters {
  project: string;
  agent: string;
  date: string;
  dateFrom: string;
  dateTo: string;
  minMessages: number;
  maxMessages: number;
}

function defaultFilters(): Filters {
  return {
    project: "",
    agent: "",
    date: "",
    dateFrom: "",
    dateTo: "",
    minMessages: 0,
    maxMessages: 0,
  };
}

class SessionsStore {
  sessions: Session[] = $state([]);
  projects: ProjectInfo[] = $state([]);
  activeSessionId: string | null = $state(null);
  nextCursor: string | null = $state(null);
  total: number = $state(0);
  loading: boolean = $state(false);
  filters: Filters = $state(defaultFilters());

  private loadVersion: number = 0;
  private projectsLoaded: boolean = false;
  private projectsPromise: Promise<void> | null = null;

  get activeSession(): Session | undefined {
    return this.sessions.find(
      (s) => s.id === this.activeSessionId,
    );
  }

  private get apiParams() {
    const f = this.filters;
    return {
      project: f.project || undefined,
      agent: f.agent || undefined,
      date: f.date || undefined,
      date_from: f.dateFrom || undefined,
      date_to: f.dateTo || undefined,
      min_messages:
        f.minMessages > 0 ? f.minMessages : undefined,
      max_messages:
        f.maxMessages > 0 ? f.maxMessages : undefined,
    };
  }

  private resetPagination() {
    this.sessions = [];
    this.nextCursor = null;
    this.total = 0;
  }

  initFromParams(params: Record<string, string>) {
    const minMsgs = parseInt(
      params["min_messages"] ?? "",
      10,
    );
    const maxMsgs = parseInt(
      params["max_messages"] ?? "",
      10,
    );

    this.filters = {
      project: params["project"] ?? "",
      agent: params["agent"] ?? "",
      date: params["date"] ?? "",
      dateFrom: params["date_from"] ?? "",
      dateTo: params["date_to"] ?? "",
      minMessages: Number.isFinite(minMsgs) ? minMsgs : 0,
      maxMessages: Number.isFinite(maxMsgs) ? maxMsgs : 0,
    };
    this.activeSessionId = null;
    this.resetPagination();
  }

  async load() {
    const version = ++this.loadVersion;
    this.loading = true;
    this.resetPagination();
    try {
      let cursor: string | undefined = undefined;
      let loaded: Session[] = [];

      for (;;) {
        if (this.loadVersion !== version) return;
        const page = await api.listSessions({
          ...this.apiParams,
          cursor,
          limit: SESSION_PAGE_SIZE,
        });
        if (this.loadVersion !== version) return;

        if (page.sessions.length === 0) {
          this.sessions = loaded;
          this.nextCursor = null;
          this.total = loaded.length;
          break;
        }

        loaded = [...loaded, ...page.sessions];
        this.sessions = loaded;
        // Keep total aligned with loaded rows to avoid blank
        // virtual space while we fetch remaining pages.
        this.total = loaded.length;

        cursor = page.next_cursor ?? undefined;
        this.nextCursor = cursor ?? null;
        if (!cursor) {
          this.total = loaded.length;
          break;
        }
      }
    } finally {
      if (this.loadVersion === version) {
        this.loading = false;
      }
    }
  }

  async loadMore() {
    if (!this.nextCursor || this.loading) return;
    const version = ++this.loadVersion;
    this.loading = true;
    try {
      const page = await api.listSessions({
        ...this.apiParams,
        cursor: this.nextCursor,
        limit: SESSION_PAGE_SIZE,
      });
      if (this.loadVersion !== version) return;
      this.sessions.push(...page.sessions);
      this.nextCursor = page.next_cursor ?? null;
      this.total = page.total;
    } finally {
      if (this.loadVersion === version) {
        this.loading = false;
      }
    }
  }

  /**
   * Load additional pages until the target index is backed by
   * loaded sessions, or until we hit maxPages / end-of-list.
   * Keeps scrollbar jumps from showing placeholders for too long.
   */
  async loadMoreUntil(
    targetIndex: number,
    maxPages: number = 5,
  ) {
    if (targetIndex < 0) return;
    let pages = 0;
    while (
      this.nextCursor &&
      !this.loading &&
      this.sessions.length <= targetIndex &&
      pages < maxPages
    ) {
      const before = this.sessions.length;
      await this.loadMore();
      pages++;
      if (this.sessions.length <= before) {
        // Defensive: stop if no forward progress.
        break;
      }
    }
  }

  async loadProjects() {
    if (this.projectsLoaded) return;
    if (this.projectsPromise) return this.projectsPromise;
    this.projectsPromise = (async () => {
      try {
        const res = await api.getProjects();
        this.projects = res.projects;
        this.projectsLoaded = true;
      } finally {
        this.projectsPromise = null;
      }
    })();
    return this.projectsPromise;
  }

  selectSession(id: string) {
    this.activeSessionId = id;
  }

  deselectSession() {
    this.activeSessionId = null;
  }

  navigateSession(delta: number) {
    const idx = this.sessions.findIndex(
      (s) => s.id === this.activeSessionId,
    );
    const next = idx + delta;
    if (next >= 0 && next < this.sessions.length) {
      this.activeSessionId = this.sessions[next]!.id;
    }
  }

  setProjectFilter(project: string) {
    this.filters = { ...defaultFilters(), project };
    this.activeSessionId = null;
    this.resetPagination();
    this.load();
  }
}

export function createSessionsStore(): SessionsStore {
  return new SessionsStore();
}

export const sessions = createSessionsStore();
