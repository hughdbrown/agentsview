package server_test

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"testing"
	"time"
)

// TestServerTimeouts starts a real HTTP server and verifies that
// streaming connections (SSE) are not closed prematurely by WriteTimeout.
func TestServerTimeouts(t *testing.T) {
	// Set a very short WriteTimeout to verify SSE is exempt.
	// If SSE were subject to this timeout, the connection would close
	// well before our 500ms wait below.
	te := setup(t, withWriteTimeout(100*time.Millisecond))

	sessionPath := te.writeProjectFile(
		t, "test-project", "watch-test.jsonl", `{"type":"user"}`,
	)

	baseURL := te.listenAndServe(t)

	// Connect to the SSE endpoint.
	url := fmt.Sprintf(
		"%s/api/v1/sessions/%s/watch", baseURL, "watch-test",
	)
	ctx, cancel := context.WithTimeout(
		context.Background(), 5*time.Second,
	)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		t.Fatalf("creating request: %v", err)
	}

	resp, err := (&http.Client{}).Do(req)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d", resp.StatusCode)
	}

	// Trigger an update after 500ms (> WriteTimeout of 100ms).
	// If the handler had a timeout, the body would be closed by now.
	errCh := make(chan error, 1)
	go func() {
		time.Sleep(500 * time.Millisecond)
		if err := os.WriteFile(
			sessionPath,
			[]byte(`{"type":"user","content":"update"}`),
			0o644,
		); err != nil {
			errCh <- fmt.Errorf("writing update: %w", err)
			return
		}
		close(errCh)
	}()

	// Read from the stream to verify it's open and receives data.
	buf := make([]byte, 1024)
	n, err := resp.Body.Read(buf)

	if writeErr := <-errCh; writeErr != nil {
		t.Fatalf("update writer failed: %v", writeErr)
	}

	if n == 0 && err != nil {
		t.Fatalf(
			"failed to read bytes (timeout or closed?): %v", err,
		)
	}
	t.Logf("Received %d bytes from SSE stream", n)
}
