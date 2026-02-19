package server

import (
	"encoding/json"
	"io"
	"net/http"
	"path/filepath"
	"testing"
	"time"

	"github.com/wesm/agentsview/internal/config"
	"github.com/wesm/agentsview/internal/db"
	"github.com/wesm/agentsview/internal/sync"
)

// testServer creates a Server for internal tests with the given
// write timeout. It registers cleanup of the database via
// t.Cleanup.
func testServer(
	t *testing.T, writeTimeout time.Duration,
) *Server {
	t.Helper()
	dir := t.TempDir()
	dbPath := filepath.Join(dir, "test.db")
	database, err := db.Open(dbPath)
	if err != nil {
		t.Fatalf("opening db: %v", err)
	}
	t.Cleanup(func() { database.Close() })

	cfg := config.Config{
		Host:         "127.0.0.1",
		Port:         0,
		DataDir:      dir,
		DBPath:       dbPath,
		WriteTimeout: writeTimeout,
	}
	engine := sync.NewEngine(database, dir, "", "test")
	return New(cfg, database, engine)
}

// assertTimeoutResponse checks that the response is a 503 with
// a JSON body containing "request timed out" and the correct
// Content-Type header.
func assertTimeoutResponse(
	t *testing.T, resp *http.Response,
) {
	t.Helper()
	if resp.StatusCode != http.StatusServiceUnavailable {
		t.Fatalf(
			"status = %d, want %d",
			resp.StatusCode, http.StatusServiceUnavailable,
		)
	}
	body, _ := io.ReadAll(resp.Body)
	var je jsonError
	if err := json.Unmarshal(body, &je); err != nil {
		t.Fatalf(
			"body is not valid JSON: %v (body=%q)",
			err, string(body),
		)
	}
	if je.Error != "request timed out" {
		t.Errorf(
			"error = %q, want %q",
			je.Error, "request timed out",
		)
	}
	if ct := resp.Header.Get("Content-Type"); ct != "application/json" {
		t.Errorf(
			"Content-Type = %q, want %q",
			ct, "application/json",
		)
	}
}

// isTimeoutResponse returns true when the response is a 503
// JSON timeout. Use this for negative assertions where a route
// should NOT produce a timeout.
func isTimeoutResponse(
	t *testing.T, resp *http.Response,
) bool {
	t.Helper()
	if resp.StatusCode != http.StatusServiceUnavailable {
		return false
	}
	body, _ := io.ReadAll(resp.Body)
	var je jsonError
	if json.Unmarshal(body, &je) != nil {
		return false
	}
	return je.Error == "request timed out"
}
