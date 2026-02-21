type Route = "sessions";

function parseHash(): {
  route: Route;
  params: Record<string, string>;
} {
  const hash = window.location.hash.slice(1);
  if (!hash || hash === "/") {
    return { route: "sessions", params: {} };
  }

  const qIdx = hash.indexOf("?");
  const path = qIdx >= 0 ? hash.slice(0, qIdx) : hash;
  const routeString = path.startsWith("/")
    ? path.slice(1)
    : path;
  const route = (routeString || "sessions") as Route;

  const params =
    qIdx >= 0
      ? Object.fromEntries(
          new URLSearchParams(hash.slice(qIdx + 1)),
        )
      : {};

  return { route, params };
}

class RouterStore {
  route: Route = $state("sessions");
  params: Record<string, string> = $state({});

  constructor() {
    const initial = parseHash();
    this.route = initial.route;
    this.params = initial.params;

    window.addEventListener("hashchange", () => {
      const parsed = parseHash();
      this.route = parsed.route;
      this.params = parsed.params;
    });
  }

  navigate(route: Route, params: Record<string, string> = {}) {
    const qs = new URLSearchParams(params).toString();
    const hash = qs ? `#/${route}?${qs}` : `#/${route}`;
    window.location.hash = hash;
  }
}

export const router = new RouterStore();
