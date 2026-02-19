package server

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/wesm/agentsview/internal/db"
)

// assertContentType checks that the recorder has the expected Content-Type.
func assertContentType(
	t *testing.T, w *httptest.ResponseRecorder, expected string,
) {
	t.Helper()
	if got := w.Header().Get("Content-Type"); got != expected {
		t.Errorf(
			"Content-Type = %q, want %q", got, expected,
		)
	}
}

// expiredCtx returns a context with a deadline in the past.
func expiredCtx(
	t *testing.T,
) (context.Context, context.CancelFunc) {
	t.Helper()
	return context.WithDeadline(
		context.Background(), time.Now().Add(-1*time.Hour),
	)
}

func TestHandlers_Internal_DeadlineExceeded(t *testing.T) {
	s := testServer(t, 30*time.Second)

	// Seed a session just in case handlers check for existence before context.
	// We'll use the public methods on db to seed.
	started := "2025-01-15T10:00:00Z"
	sess := db.Session{
		ID:        "s1",
		Project:   "test-proj",
		StartedAt: &started,
	}
	if err := s.db.UpsertSession(sess); err != nil {
		t.Fatalf("seeding session: %v", err)
	}

	tests := []struct {
		name    string
		handler func(http.ResponseWriter, *http.Request)
	}{
		{"ListSessions", s.handleListSessions},
		{"GetSession", s.handleGetSession},
		{"GetMessages", s.handleGetMessages},
		{"GetMinimap", s.handleGetMinimap},
		{"GetStats", s.handleGetStats},
		{"ListProjects", s.handleListProjects},
		{"ListMachines", s.handleListMachines},
		{"Search", s.handleSearch},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.name == "Search" && !s.db.HasFTS() {
				t.Skip("skipping search test: no FTS support")
			}
			ctx, cancel := expiredCtx(t)
			defer cancel()

			req := httptest.NewRequest("GET", "/?q=test", nil)
			req.SetPathValue("id", "s1")
			req = req.WithContext(ctx)

			w := httptest.NewRecorder()

			// Call handler directly, bypassing middleware
			tt.handler(w, req)

			// Expect 504 Gateway Timeout
			if w.Code != http.StatusGatewayTimeout {
				t.Errorf("expected status 504, got %d. Body: %s", w.Code, w.Body.String())
			}

			assertContentType(t, w, "application/json")
		})
	}
}
