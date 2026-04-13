package csv

import (
	"os"
	"path/filepath"
	"testing"

	"atena-label/internal/entity"
)

func TestImport(t *testing.T) {
	t.Run("ヘッダー付きCSVをインポートできる", func(t *testing.T) {
		content := "姓,名,姓（カナ）,名（カナ）,敬称,郵便番号,都道府県,市区町村,番地,建物名,会社名,部署名,メモ\n" +
			"山田,太郎,ヤマダ,タロウ,様,1234567,東京都,渋谷区,1-1,渋谷ビル,株式会社テスト,開発部,メモ1\n"
		f := writeTempCSV(t, content)
		contacts, errs := Import(f)
		if len(errs) != 0 {
			t.Fatalf("unexpected errors: %v", errs)
		}
		if len(contacts) != 1 {
			t.Fatalf("expected 1 contact, got %d", len(contacts))
		}
		c := contacts[0]
		if c.FamilyName != "山田" {
			t.Errorf("FamilyName: got %q", c.FamilyName)
		}
		if c.PostalCode != "1234567" {
			t.Errorf("PostalCode: got %q", c.PostalCode)
		}
		if c.Honorific != "様" {
			t.Errorf("Honorific: got %q", c.Honorific)
		}
		if c.ID == "" {
			t.Error("ID should not be empty")
		}
	})

	t.Run("ヘッダーなしCSVをインポートできる", func(t *testing.T) {
		content := "佐藤,花子,サトウ,ハナコ,御中,9876543,大阪府,大阪市,2-2,,会社A,,\n"
		f := writeTempCSV(t, content)
		contacts, errs := Import(f)
		if len(errs) != 0 {
			t.Fatalf("unexpected errors: %v", errs)
		}
		if len(contacts) != 1 {
			t.Fatalf("expected 1 contact, got %d", len(contacts))
		}
		if contacts[0].FamilyName != "佐藤" {
			t.Errorf("FamilyName: got %q", contacts[0].FamilyName)
		}
	})

	t.Run("任意の敬称をインポート時に保持する", func(t *testing.T) {
		content := "近藤,一樹,,,各位,1500001,東京都,渋谷区,1-2-3,,,,\n"
		f := writeTempCSV(t, content)
		contacts, errs := Import(f)
		if len(errs) != 0 {
			t.Fatalf("unexpected errors: %v", errs)
		}
		if len(contacts) != 1 {
			t.Fatalf("expected 1 contact, got %d", len(contacts))
		}
		if contacts[0].Honorific != "各位" {
			t.Errorf("Honorific: got %q, want 各位", contacts[0].Honorific)
		}
	})

	t.Run("敬称が空の場合は「様」になる", func(t *testing.T) {
		content := "田中,次郎,,,,,,,,,,,\n"
		f := writeTempCSV(t, content)
		contacts, _ := Import(f)
		if len(contacts) != 1 {
			t.Fatalf("expected 1 contact, got %d", len(contacts))
		}
		if contacts[0].Honorific != "様" {
			t.Errorf("Honorific: got %q, want 様", contacts[0].Honorific)
		}
	})

	t.Run("空行はスキップされる", func(t *testing.T) {
		content := "姓,名,姓（カナ）,名（カナ）,敬称,郵便番号,都道府県,市区町村,番地,建物名,会社名,部署名,メモ\n" +
			"\n" +
			"鈴木,一郎,,,様,,,,,,,,\n"
		f := writeTempCSV(t, content)
		contacts, errs := Import(f)
		if len(errs) != 0 {
			t.Fatalf("unexpected errors: %v", errs)
		}
		if len(contacts) != 1 {
			t.Fatalf("expected 1 contact, got %d", len(contacts))
		}
	})

	t.Run("存在しないファイルはエラーを返す", func(t *testing.T) {
		contacts, errs := Import("/nonexistent/file.csv")
		if len(contacts) != 0 {
			t.Error("expected no contacts")
		}
		if len(errs) == 0 {
			t.Error("expected an error")
		}
	})
}

func TestExport(t *testing.T) {
	t.Run("CSVにエクスポートできる", func(t *testing.T) {
		contacts := []entity.Contact{
			{
				ID:         "1",
				FamilyName: "山田",
				GivenName:  "太郎",
				Honorific:  "御侍史",
				PostalCode: "1234567",
				Prefecture: "東京都",
				City:       "渋谷区",
			},
		}
		dir := t.TempDir()
		outPath := filepath.Join(dir, "out.csv")

		if err := Export(contacts, outPath); err != nil {
			t.Fatalf("Export error: %v", err)
		}

		// Re-import to verify round-trip.
		imported, errs := Import(outPath)
		if len(errs) != 0 {
			t.Fatalf("re-import errors: %v", errs)
		}
		if len(imported) != 1 {
			t.Fatalf("expected 1 contact after re-import, got %d", len(imported))
		}
		if imported[0].FamilyName != "山田" {
			t.Errorf("FamilyName: got %q", imported[0].FamilyName)
		}
		if imported[0].Honorific != "御侍史" {
			t.Errorf("Honorific: got %q, want 御侍史", imported[0].Honorific)
		}
	})

	t.Run("書き込み不可パスはエラーを返す", func(t *testing.T) {
		err := Export(nil, "/nonexistent/dir/out.csv")
		if err == nil {
			t.Error("expected an error")
		}
	})
}

func writeTempCSV(t *testing.T, content string) string {
	t.Helper()
	f, err := os.CreateTemp(t.TempDir(), "*.csv")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := f.WriteString(content); err != nil {
		t.Fatal(err)
	}
	f.Close()
	return f.Name()
}
