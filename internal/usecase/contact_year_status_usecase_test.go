package usecase_test

import (
	"errors"
	"testing"

	"atena-label/internal/entity"
	"atena-label/internal/usecase"
)

type mockContactYearStatusRepo struct {
	findByYearFn func(year int) ([]entity.ContactYearStatus, error)
	upsertFn     func(status *entity.ContactYearStatus) error
	markSentFn   func(contactIDs []string, year int) error
}

func (m *mockContactYearStatusRepo) FindByYear(year int) ([]entity.ContactYearStatus, error) {
	if m.findByYearFn != nil {
		return m.findByYearFn(year)
	}
	return []entity.ContactYearStatus{}, nil
}

func (m *mockContactYearStatusRepo) Upsert(status *entity.ContactYearStatus) error {
	if m.upsertFn != nil {
		return m.upsertFn(status)
	}
	return nil
}

func (m *mockContactYearStatusRepo) MarkSent(contactIDs []string, year int) error {
	if m.markSentFn != nil {
		return m.markSentFn(contactIDs, year)
	}
	return nil
}

func TestContactYearStatusUseCase_ListByYear(t *testing.T) {
	mock := &mockContactYearStatusRepo{
		findByYearFn: func(year int) ([]entity.ContactYearStatus, error) {
			if year != 2026 {
				t.Fatalf("year=%d, want 2026", year)
			}
			return []entity.ContactYearStatus{{ContactID: "c1", Year: 2026, Sent: true}}, nil
		},
	}
	uc := usecase.NewContactYearStatusUseCase(mock)

	list, err := uc.ListByYear(2026)
	if err != nil {
		t.Fatalf("ListByYear: %v", err)
	}
	if len(list) != 1 || !list[0].Sent {
		t.Fatalf("unexpected result: %+v", list)
	}
}

func TestContactYearStatusUseCase_Save(t *testing.T) {
	called := false
	mock := &mockContactYearStatusRepo{
		upsertFn: func(status *entity.ContactYearStatus) error {
			called = true
			if status.ContactID != "c1" || status.Year != 2026 || !status.Received {
				t.Fatalf("unexpected status: %+v", status)
			}
			return nil
		},
	}
	uc := usecase.NewContactYearStatusUseCase(mock)

	_, err := uc.Save(entity.ContactYearStatus{
		ContactID: "c1",
		Year:      2026,
		Received:  true,
	})
	if err != nil {
		t.Fatalf("Save: %v", err)
	}
	if !called {
		t.Fatal("Save should call repo.Upsert")
	}
}

func TestContactYearStatusUseCase_Save_Validation(t *testing.T) {
	uc := usecase.NewContactYearStatusUseCase(&mockContactYearStatusRepo{})

	if _, err := uc.Save(entity.ContactYearStatus{Year: 2026}); err == nil {
		t.Fatal("Save should fail when contactId is empty")
	}
	if _, err := uc.Save(entity.ContactYearStatus{ContactID: "c1", Year: 1200}); err == nil {
		t.Fatal("Save should fail when year is out of range")
	}
}

func TestContactYearStatusUseCase_MarkSent(t *testing.T) {
	called := false
	mock := &mockContactYearStatusRepo{
		markSentFn: func(contactIDs []string, year int) error {
			called = true
			if year != 2026 {
				t.Fatalf("year=%d, want 2026", year)
			}
			if len(contactIDs) != 2 {
				t.Fatalf("len(contactIDs)=%d, want 2", len(contactIDs))
			}
			return nil
		},
	}
	uc := usecase.NewContactYearStatusUseCase(mock)

	if err := uc.MarkSent([]string{"c1", "c2"}, 2026); err != nil {
		t.Fatalf("MarkSent: %v", err)
	}
	if !called {
		t.Fatal("MarkSent should call repo.MarkSent")
	}
}

func TestContactYearStatusUseCase_MarkSent_Error(t *testing.T) {
	mock := &mockContactYearStatusRepo{
		markSentFn: func(contactIDs []string, year int) error {
			return errors.New("db error")
		},
	}
	uc := usecase.NewContactYearStatusUseCase(mock)

	if err := uc.MarkSent([]string{"c1"}, 2026); err == nil {
		t.Fatal("MarkSent should return wrapped error")
	}
}
