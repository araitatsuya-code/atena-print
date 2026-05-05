package usecase_test

import (
	"fmt"
	"testing"

	"atena-label/internal/entity"
	"atena-label/internal/usecase"
)

type mockPostalRepo struct {
	lookupFn func(postalCode string) (*entity.Address, error)
}

func (m *mockPostalRepo) Lookup(postalCode string) (*entity.Address, error) {
	if m.lookupFn != nil {
		return m.lookupFn(postalCode)
	}
	return nil, fmt.Errorf("not found")
}

func TestAddressNormalizationUseCase_BuildPreview(t *testing.T) {
	repo := &mockPostalRepo{
		lookupFn: func(postalCode string) (*entity.Address, error) {
			switch postalCode {
			case "1000001":
				return &entity.Address{Prefecture: "東京都", City: "千代田区", Town: "千代田"}, nil
			case "0600000":
				return &entity.Address{Prefecture: "北海道", City: "札幌市中央区", Town: ""}, nil
			default:
				return nil, fmt.Errorf("not found")
			}
		},
	}
	uc := usecase.NewAddressNormalizationUseCase(repo)

	preview := uc.BuildPreview([]entity.Contact{
		{
			ID:         "c1",
			FamilyName: "山田",
			GivenName:  "太郎",
			PostalCode: "1000001",
			Prefecture: "東京都",
			City:       "千代田市",
			Street:     "1-1-1",
		},
		{
			ID:         "c2",
			FamilyName: "佐藤",
			GivenName:  "花子",
			PostalCode: "1000001",
			Prefecture: "東京都",
			City:       "千代田区",
			Street:     "1-2-3",
		},
		{
			ID:         "c3",
			FamilyName: "鈴木",
			GivenName:  "次郎",
			PostalCode: "0000000",
			Prefecture: "旧県",
			City:       "旧市",
		},
		{
			ID:         "c4",
			FamilyName: "高橋",
			GivenName:  "三郎",
			PostalCode: "0600000",
			Prefecture: "道央県",
			City:       "中央区",
		},
	})

	if preview.TotalContacts != 4 {
		t.Fatalf("TotalContacts=%d, want 4", preview.TotalContacts)
	}
	if preview.ConvertibleCount != 2 {
		t.Fatalf("ConvertibleCount=%d, want 2", preview.ConvertibleCount)
	}
	if len(preview.Candidates) != 2 {
		t.Fatalf("len(Candidates)=%d, want 2", len(preview.Candidates))
	}

	first := preview.Candidates[0]
	if first.ContactID != "c1" {
		t.Fatalf("first.ContactID=%q, want c1", first.ContactID)
	}
	if first.After.City != "千代田区" {
		t.Fatalf("first.After.City=%q, want 千代田区", first.After.City)
	}
	if len(first.Diffs) != 1 || first.Diffs[0].Field != "city" {
		t.Fatalf("first.Diffs=%v, want one city diff", first.Diffs)
	}

	second := preview.Candidates[1]
	if second.ContactID != "c4" {
		t.Fatalf("second.ContactID=%q, want c4", second.ContactID)
	}
	if len(second.Diffs) != 2 {
		t.Fatalf("len(second.Diffs)=%d, want 2", len(second.Diffs))
	}
}
