package pdf

import "testing"

func almostEqualFont(a, b float64) bool {
	const eps = 1e-9
	d := a - b
	if d < 0 {
		d = -d
	}
	return d < eps
}

func TestFitHorizontalNameFontPt(t *testing.T) {
	t.Run("fits in width keeps base size", func(t *testing.T) {
		got := fitHorizontalNameFontPt(12, 40, 50)
		if got != 12 {
			t.Fatalf("got %v, want 12", got)
		}
	})

	t.Run("overflow shrinks font", func(t *testing.T) {
		got := fitHorizontalNameFontPt(12, 60, 45)
		if !(got < 12) {
			t.Fatalf("got %v, want < 12", got)
		}
	})

	t.Run("clamps to minimum scale", func(t *testing.T) {
		got := fitHorizontalNameFontPt(12, 200, 30)
		want := 12 * nameAutoMinScale
		if !almostEqualFont(got, want) {
			t.Fatalf("got %v, want %v", got, want)
		}
	})
}

func TestFitVerticalNameFontPt(t *testing.T) {
	t.Run("fits in height keeps base size", func(t *testing.T) {
		got := fitVerticalNameFontPt(12, 4, 30)
		if got != 12 {
			t.Fatalf("got %v, want 12", got)
		}
	})

	t.Run("overflow shrinks font", func(t *testing.T) {
		got := fitVerticalNameFontPt(12, 12, 30)
		if !(got < 12) {
			t.Fatalf("got %v, want < 12", got)
		}
	})

	t.Run("clamps to minimum scale", func(t *testing.T) {
		got := fitVerticalNameFontPt(12, 100, 10)
		want := 12 * nameAutoMinScale
		if !almostEqualFont(got, want) {
			t.Fatalf("got %v, want %v", got, want)
		}
	})
}
