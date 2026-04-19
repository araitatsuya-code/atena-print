package sqlite_test

import (
	"testing"

	"atena-label/internal/entity"
	"atena-label/internal/infrastructure/sqlite"
)

func TestContactYearStatusRepo_Upsert_FindByYear(t *testing.T) {
	db := newTestDB(t)
	contactRepo := sqlite.NewContactRepo(db)
	statusRepo := sqlite.NewContactYearStatusRepo(db)

	c := makeContact("status-id-1", "田中", "タナカ")
	if err := contactRepo.Create(&c); err != nil {
		t.Fatalf("Create contact: %v", err)
	}

	item := entity.ContactYearStatus{
		ContactID: c.ID,
		Year:      2026,
		Sent:      true,
		Received:  false,
		Mourning:  false,
	}
	if err := statusRepo.Upsert(&item); err != nil {
		t.Fatalf("Upsert: %v", err)
	}

	list, err := statusRepo.FindByYear(2026)
	if err != nil {
		t.Fatalf("FindByYear: %v", err)
	}
	if len(list) != 1 {
		t.Fatalf("FindByYear len=%d, want 1", len(list))
	}
	if !list[0].Sent {
		t.Errorf("Sent=%v, want true", list[0].Sent)
	}
	if list[0].CreatedAt.IsZero() || list[0].UpdatedAt.IsZero() {
		t.Errorf("timestamps should be set: %+v", list[0])
	}
}

func TestContactYearStatusRepo_Upsert_Update(t *testing.T) {
	db := newTestDB(t)
	contactRepo := sqlite.NewContactRepo(db)
	statusRepo := sqlite.NewContactYearStatusRepo(db)

	c := makeContact("status-id-2", "鈴木", "スズキ")
	if err := contactRepo.Create(&c); err != nil {
		t.Fatalf("Create contact: %v", err)
	}

	item := entity.ContactYearStatus{
		ContactID: c.ID,
		Year:      2026,
		Sent:      false,
		Received:  false,
		Mourning:  false,
	}
	if err := statusRepo.Upsert(&item); err != nil {
		t.Fatalf("Upsert(1): %v", err)
	}

	item.Sent = true
	item.Received = true
	if err := statusRepo.Upsert(&item); err != nil {
		t.Fatalf("Upsert(2): %v", err)
	}

	list, err := statusRepo.FindByYear(2026)
	if err != nil {
		t.Fatalf("FindByYear: %v", err)
	}
	if len(list) != 1 {
		t.Fatalf("FindByYear len=%d, want 1", len(list))
	}
	if !list[0].Sent || !list[0].Received {
		t.Errorf("updated flags are not reflected: %+v", list[0])
	}
}

func TestContactYearStatusRepo_MarkSent(t *testing.T) {
	db := newTestDB(t)
	contactRepo := sqlite.NewContactRepo(db)
	statusRepo := sqlite.NewContactYearStatusRepo(db)

	c1 := makeContact("status-id-3", "山田", "ヤマダ")
	c2 := makeContact("status-id-4", "佐藤", "サトウ")
	for _, c := range []*entity.Contact{&c1, &c2} {
		if err := contactRepo.Create(c); err != nil {
			t.Fatalf("Create contact: %v", err)
		}
	}

	existing := entity.ContactYearStatus{
		ContactID: c1.ID,
		Year:      2026,
		Sent:      false,
		Received:  true,
		Mourning:  true,
	}
	if err := statusRepo.Upsert(&existing); err != nil {
		t.Fatalf("Upsert existing: %v", err)
	}

	if err := statusRepo.MarkSent([]string{c1.ID, c2.ID}, 2026); err != nil {
		t.Fatalf("MarkSent: %v", err)
	}

	list, err := statusRepo.FindByYear(2026)
	if err != nil {
		t.Fatalf("FindByYear: %v", err)
	}
	if len(list) != 2 {
		t.Fatalf("FindByYear len=%d, want 2", len(list))
	}

	byID := map[string]entity.ContactYearStatus{}
	for _, item := range list {
		byID[item.ContactID] = item
	}

	if !byID[c1.ID].Sent || !byID[c1.ID].Received || !byID[c1.ID].Mourning {
		t.Errorf("existing status should keep received/mourning: %+v", byID[c1.ID])
	}
	if !byID[c2.ID].Sent || byID[c2.ID].Received || byID[c2.ID].Mourning {
		t.Errorf("new status should be sent only: %+v", byID[c2.ID])
	}
}
