package usecase_test

import (
	"errors"
	"testing"

	"atena-label/internal/entity"
	"atena-label/internal/usecase"
)

// mockContactRepo は repository.ContactRepository のテスト用実装
type mockContactRepo struct {
	findAllFn  func(groupID string) ([]entity.Contact, error)
	findByIDFn func(id string) (*entity.Contact, error)
	createFn   func(c *entity.Contact) error
	updateFn   func(c *entity.Contact) error
	deleteFn   func(id string) error
	searchFn   func(query string) ([]entity.Contact, error)
}

func (m *mockContactRepo) FindAll(groupID string) ([]entity.Contact, error) {
	if m.findAllFn != nil {
		return m.findAllFn(groupID)
	}
	return []entity.Contact{}, nil
}
func (m *mockContactRepo) FindByID(id string) (*entity.Contact, error) {
	if m.findByIDFn != nil {
		return m.findByIDFn(id)
	}
	return nil, nil
}
func (m *mockContactRepo) Create(c *entity.Contact) error {
	if m.createFn != nil {
		return m.createFn(c)
	}
	return nil
}
func (m *mockContactRepo) Update(c *entity.Contact) error {
	if m.updateFn != nil {
		return m.updateFn(c)
	}
	return nil
}
func (m *mockContactRepo) Delete(id string) error {
	if m.deleteFn != nil {
		return m.deleteFn(id)
	}
	return nil
}
func (m *mockContactRepo) Search(query string) ([]entity.Contact, error) {
	if m.searchFn != nil {
		return m.searchFn(query)
	}
	return []entity.Contact{}, nil
}

func TestContactUseCase_List(t *testing.T) {
	all := []entity.Contact{
		{ID: "1", FamilyName: "田中"},
		{ID: "2", FamilyName: "鈴木"},
	}
	tests := []struct {
		name    string
		groupID string
		repoFn  func(string) ([]entity.Contact, error)
		wantLen int
		wantErr bool
	}{
		{
			name:    "グループ指定なし：全件返す",
			groupID: "",
			repoFn:  func(g string) ([]entity.Contact, error) { return all, nil },
			wantLen: 2,
		},
		{
			name:    "グループ指定あり：フィルタ済みを返す",
			groupID: "family",
			repoFn:  func(g string) ([]entity.Contact, error) { return all[:1], nil },
			wantLen: 1,
		},
		{
			name:    "リポジトリエラー",
			groupID: "",
			repoFn:  func(g string) ([]entity.Contact, error) { return nil, errors.New("db error") },
			wantErr: true,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			uc := usecase.NewContactUseCase(&mockContactRepo{findAllFn: tt.repoFn})
			got, err := uc.List(tt.groupID)
			if (err != nil) != tt.wantErr {
				t.Fatalf("List() error=%v, wantErr=%v", err, tt.wantErr)
			}
			if !tt.wantErr && len(got) != tt.wantLen {
				t.Errorf("List() len=%d, want=%d", len(got), tt.wantLen)
			}
		})
	}
}

func TestContactUseCase_Get(t *testing.T) {
	c := &entity.Contact{ID: "abc", FamilyName: "田中"}
	tests := []struct {
		name    string
		id      string
		repoFn  func(string) (*entity.Contact, error)
		wantNil bool
		wantErr bool
	}{
		{
			name:   "正常取得",
			id:     "abc",
			repoFn: func(id string) (*entity.Contact, error) { return c, nil },
		},
		{
			name:    "未存在はnilを返す",
			id:      "notfound",
			repoFn:  func(id string) (*entity.Contact, error) { return nil, nil },
			wantNil: true,
		},
		{
			name:    "リポジトリエラー",
			id:      "abc",
			repoFn:  func(id string) (*entity.Contact, error) { return nil, errors.New("db error") },
			wantErr: true,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			uc := usecase.NewContactUseCase(&mockContactRepo{findByIDFn: tt.repoFn})
			got, err := uc.Get(tt.id)
			if (err != nil) != tt.wantErr {
				t.Fatalf("Get() error=%v, wantErr=%v", err, tt.wantErr)
			}
			if !tt.wantErr && tt.wantNil && got != nil {
				t.Errorf("Get() = %v, want nil", got)
			}
			if !tt.wantErr && !tt.wantNil && got == nil {
				t.Errorf("Get() = nil, want non-nil")
			}
		})
	}
}

func TestContactUseCase_Save(t *testing.T) {
	tests := []struct {
		name       string
		input      entity.Contact
		createErr  error
		updateErr  error
		wantCreate bool
		wantUpdate bool
		wantIDSet  bool
		wantErr    bool
	}{
		{
			name:       "IDなし→新規作成・IDが自動付与される",
			input:      entity.Contact{FamilyName: "新規"},
			wantCreate: true,
			wantIDSet:  true,
		},
		{
			name:       "IDあり→更新",
			input:      entity.Contact{ID: "existing-id", FamilyName: "更新"},
			wantUpdate: true,
		},
		{
			name:      "作成エラーをラップして返す",
			input:     entity.Contact{},
			createErr: errors.New("db error"),
			wantErr:   true,
		},
		{
			name:      "更新エラーをラップして返す",
			input:     entity.Contact{ID: "existing-id"},
			updateErr: errors.New("db error"),
			wantErr:   true,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			created, updated := false, false
			mock := &mockContactRepo{
				createFn: func(c *entity.Contact) error { created = true; return tt.createErr },
				updateFn: func(c *entity.Contact) error { updated = true; return tt.updateErr },
			}
			uc := usecase.NewContactUseCase(mock)
			got, err := uc.Save(tt.input)
			if (err != nil) != tt.wantErr {
				t.Fatalf("Save() error=%v, wantErr=%v", err, tt.wantErr)
			}
			if tt.wantCreate && !created {
				t.Error("Save() should call repo.Create")
			}
			if tt.wantUpdate && !updated {
				t.Error("Save() should call repo.Update")
			}
			if tt.wantIDSet && got.ID == "" {
				t.Error("Save() should assign UUID to new contact")
			}
		})
	}
}

func TestContactUseCase_Delete(t *testing.T) {
	tests := []struct {
		name    string
		repoErr error
		wantErr bool
	}{
		{name: "正常削除"},
		{name: "リポジトリエラーをそのまま返す", repoErr: errors.New("db error"), wantErr: true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			uc := usecase.NewContactUseCase(&mockContactRepo{
				deleteFn: func(id string) error { return tt.repoErr },
			})
			err := uc.Delete("some-id")
			if (err != nil) != tt.wantErr {
				t.Errorf("Delete() error=%v, wantErr=%v", err, tt.wantErr)
			}
		})
	}
}

func TestContactUseCase_Search(t *testing.T) {
	match := []entity.Contact{{ID: "1", FamilyName: "田中"}}
	tests := []struct {
		name    string
		query   string
		repoFn  func(string) ([]entity.Contact, error)
		wantLen int
		wantErr bool
	}{
		{
			name:    "ヒットあり",
			query:   "田中",
			repoFn:  func(q string) ([]entity.Contact, error) { return match, nil },
			wantLen: 1,
		},
		{
			name:    "ヒットなし",
			query:   "無名",
			repoFn:  func(q string) ([]entity.Contact, error) { return []entity.Contact{}, nil },
			wantLen: 0,
		},
		{
			name:    "リポジトリエラー",
			query:   "田中",
			repoFn:  func(q string) ([]entity.Contact, error) { return nil, errors.New("db error") },
			wantErr: true,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			uc := usecase.NewContactUseCase(&mockContactRepo{searchFn: tt.repoFn})
			got, err := uc.Search(tt.query)
			if (err != nil) != tt.wantErr {
				t.Fatalf("Search() error=%v, wantErr=%v", err, tt.wantErr)
			}
			if !tt.wantErr && len(got) != tt.wantLen {
				t.Errorf("Search() len=%d, want=%d", len(got), tt.wantLen)
			}
		})
	}
}
