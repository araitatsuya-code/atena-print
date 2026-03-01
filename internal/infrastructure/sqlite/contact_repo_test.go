package sqlite_test

import (
	"database/sql"
	"path/filepath"
	"testing"

	_ "github.com/mattn/go-sqlite3"

	"atena-label/internal/entity"
	"atena-label/internal/infrastructure/sqlite"
)

func newTestDB(t *testing.T) *sql.DB {
	t.Helper()
	db, err := sqlite.Open(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatalf("newTestDB: %v", err)
	}
	t.Cleanup(func() { db.Close() })
	return db
}

func makeContact(id, familyName, kana string) entity.Contact {
	return entity.Contact{
		ID:             id,
		FamilyName:     familyName,
		GivenName:      "太郎",
		FamilyNameKana: kana,
		GivenNameKana:  "タロウ",
		Honorific:      "様",
		PostalCode:     "100-0001",
		Prefecture:     "東京都",
		City:           "千代田区",
		Street:         "1-1",
	}
}

func TestContactRepo_Create_FindByID(t *testing.T) {
	repo := sqlite.NewContactRepo(newTestDB(t))

	c := makeContact("test-id-1", "田中", "タナカ")
	if err := repo.Create(&c); err != nil {
		t.Fatalf("Create: %v", err)
	}

	got, err := repo.FindByID("test-id-1")
	if err != nil {
		t.Fatalf("FindByID: %v", err)
	}
	if got == nil {
		t.Fatal("FindByID: got nil, want non-nil")
	}
	if got.FamilyName != "田中" {
		t.Errorf("FamilyName = %q, want 田中", got.FamilyName)
	}
	if got.PostalCode != "100-0001" {
		t.Errorf("PostalCode = %q, want 100-0001", got.PostalCode)
	}
	if got.CreatedAt.IsZero() {
		t.Error("CreatedAt should be set")
	}
}

func TestContactRepo_FindByID_NotFound(t *testing.T) {
	repo := sqlite.NewContactRepo(newTestDB(t))

	got, err := repo.FindByID("nonexistent")
	if err != nil {
		t.Fatalf("FindByID: %v", err)
	}
	if got != nil {
		t.Errorf("FindByID: got %v, want nil", got)
	}
}

func TestContactRepo_FindAll(t *testing.T) {
	db := newTestDB(t)
	repo := sqlite.NewContactRepo(db)

	c1 := makeContact("id-1", "田中", "タナカ")
	c2 := makeContact("id-2", "鈴木", "スズキ")
	for _, c := range []*entity.Contact{&c1, &c2} {
		if err := repo.Create(c); err != nil {
			t.Fatal(err)
		}
	}

	t.Run("グループ指定なし：全件返す", func(t *testing.T) {
		all, err := repo.FindAll("")
		if err != nil {
			t.Fatalf("FindAll: %v", err)
		}
		if len(all) != 2 {
			t.Errorf("len = %d, want 2", len(all))
		}
	})

	t.Run("グループ指定あり：該当連絡先のみ返す", func(t *testing.T) {
		if _, err := db.Exec(`INSERT INTO contact_groups (contact_id, group_id) VALUES (?, ?)`, "id-1", "family"); err != nil {
			t.Fatal(err)
		}
		got, err := repo.FindAll("family")
		if err != nil {
			t.Fatalf("FindAll: %v", err)
		}
		if len(got) != 1 {
			t.Errorf("len = %d, want 1", len(got))
		}
		if got[0].ID != "id-1" {
			t.Errorf("ID = %q, want id-1", got[0].ID)
		}
	})

	t.Run("存在しないグループ：空配列を返す", func(t *testing.T) {
		got, err := repo.FindAll("unknown-group")
		if err != nil {
			t.Fatalf("FindAll: %v", err)
		}
		if len(got) != 0 {
			t.Errorf("len = %d, want 0", len(got))
		}
	})
}

func TestContactRepo_Update(t *testing.T) {
	repo := sqlite.NewContactRepo(newTestDB(t))

	c := makeContact("upd-1", "田中", "タナカ")
	if err := repo.Create(&c); err != nil {
		t.Fatal(err)
	}

	c.FamilyName = "山田"
	c.FamilyNameKana = "ヤマダ"
	if err := repo.Update(&c); err != nil {
		t.Fatalf("Update: %v", err)
	}

	got, err := repo.FindByID("upd-1")
	if err != nil {
		t.Fatal(err)
	}
	if got.FamilyName != "山田" {
		t.Errorf("FamilyName = %q, want 山田", got.FamilyName)
	}
	if got.FamilyNameKana != "ヤマダ" {
		t.Errorf("FamilyNameKana = %q, want ヤマダ", got.FamilyNameKana)
	}
}

func TestContactRepo_Delete(t *testing.T) {
	repo := sqlite.NewContactRepo(newTestDB(t))

	c := makeContact("del-1", "田中", "タナカ")
	if err := repo.Create(&c); err != nil {
		t.Fatal(err)
	}

	if err := repo.Delete("del-1"); err != nil {
		t.Fatalf("Delete: %v", err)
	}

	got, err := repo.FindByID("del-1")
	if err != nil {
		t.Fatal(err)
	}
	if got != nil {
		t.Errorf("FindByID after Delete = %v, want nil", got)
	}
}

func TestContactRepo_Search(t *testing.T) {
	repo := sqlite.NewContactRepo(newTestDB(t))

	c1 := makeContact("s-1", "田中", "タナカ")
	c2 := makeContact("s-2", "鈴木", "スズキ")
	for _, c := range []*entity.Contact{&c1, &c2} {
		if err := repo.Create(c); err != nil {
			t.Fatal(err)
		}
	}

	tests := []struct {
		query   string
		wantLen int
	}{
		{"田中", 1},
		{"タナカ", 1},
		{"スズキ", 1},
		{"太郎", 2}, // GivenName が共通
		{"無名", 0},
	}
	for _, tt := range tests {
		t.Run(tt.query, func(t *testing.T) {
			got, err := repo.Search(tt.query)
			if err != nil {
				t.Fatalf("Search(%q): %v", tt.query, err)
			}
			if len(got) != tt.wantLen {
				t.Errorf("Search(%q) len=%d, want=%d", tt.query, len(got), tt.wantLen)
			}
		})
	}
}
