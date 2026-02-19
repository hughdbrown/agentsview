package db

import (
	"testing"
)

func TestPruneFilterZeroValue(t *testing.T) {
	f := PruneFilter{}

	if f.HasFilters() {
		t.Error("HasFilters() returned true for zero value")
	}

	d := testDB(t)

	insertSession(t, d, "s1", "p", func(s *Session) {
		s.MessageCount = 0
	})
	insertSession(t, d, "s2", "p", func(s *Session) {
		s.MessageCount = 5
	})

	_, err := d.FindPruneCandidates(f)
	requireErrContains(t, err, "at least one filter is required")
}

func TestSessionFilterDateFields(t *testing.T) {
	d := testDB(t)
	sessionSet(t, d)

	tests := []struct {
		name   string
		filter SessionFilter
		want   int
	}{
		{
			name: "ExactDate",
			filter: filterWith(func(f *SessionFilter) {
				f.Date = "2024-06-01"
			}),
			want: 1,
		},
		{
			name: "DateRange",
			filter: filterWith(func(f *SessionFilter) {
				f.DateFrom = "2024-06-01"
				f.DateTo = "2024-06-02"
			}),
			want: 2,
		},
		{
			name: "DateFrom",
			filter: filterWith(func(f *SessionFilter) {
				f.DateFrom = "2024-06-02"
			}),
			want: 2,
		},
		{
			name: "DateTo",
			filter: filterWith(func(f *SessionFilter) {
				f.DateTo = "2024-06-01"
			}),
			want: 1,
		},
		{
			name: "MinMessages",
			filter: filterWith(func(f *SessionFilter) {
				f.MinMessages = 10
			}),
			want: 2,
		},
		{
			name: "MaxMessages",
			filter: filterWith(func(f *SessionFilter) {
				f.MaxMessages = 10
			}),
			want: 1,
		},
		{
			name: "CombinedDateAndMessages",
			filter: filterWith(func(f *SessionFilter) {
				f.DateFrom = "2024-06-02"
				f.MinMessages = 20
			}),
			want: 1,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			requireCount(t, d, tt.filter, tt.want)
		})
	}
}
