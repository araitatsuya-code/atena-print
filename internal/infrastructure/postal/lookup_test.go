package postal_test

import (
	"testing"

	"atena-label/internal/infrastructure/postal"
)

func TestLookup_found(t *testing.T) {
	addr, err := postal.NewRepo().Lookup("1000001")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if addr.Prefecture != "東京都" {
		t.Errorf("prefecture: got %q, want %q", addr.Prefecture, "東京都")
	}
	if addr.City != "千代田区" {
		t.Errorf("city: got %q, want %q", addr.City, "千代田区")
	}
}

func TestLookup_hyphen(t *testing.T) {
	addr, err := postal.NewRepo().Lookup("100-0001")
	if err != nil {
		t.Fatalf("unexpected error with hyphen: %v", err)
	}
	if addr.Prefecture != "東京都" {
		t.Errorf("prefecture: got %q, want %q", addr.Prefecture, "東京都")
	}
}

func TestLookup_notFound(t *testing.T) {
	_, err := postal.NewRepo().Lookup("0000000")
	if err == nil {
		t.Fatal("expected error for unknown code, got nil")
	}
}

func TestLookup_invalidLength(t *testing.T) {
	_, err := postal.NewRepo().Lookup("123")
	if err == nil {
		t.Fatal("expected error for short code, got nil")
	}
}
