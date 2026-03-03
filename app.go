package main

import (
	"context"
	"fmt"

	"github.com/wailsapp/wails/v2/pkg/runtime"

	"atena-label/internal/entity"
	"atena-label/internal/repository"
	"atena-label/internal/usecase"
)

// App struct
type App struct {
	ctx            context.Context
	contactUseCase *usecase.ContactUseCase
	csvUseCase     *usecase.CSVUseCase
	groupRepo      repository.GroupRepository
	postalRepo     repository.PostalRepository
}

// NewApp creates a new App application struct
func NewApp(contactUC *usecase.ContactUseCase, csvUC *usecase.CSVUseCase, groupRepo repository.GroupRepository, postalRepo repository.PostalRepository) *App {
	return &App{contactUseCase: contactUC, csvUseCase: csvUC, groupRepo: groupRepo, postalRepo: postalRepo}
}

// startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
}

// GetContacts returns all contacts, optionally filtered by groupID.
func (a *App) GetContacts(groupID string) ([]entity.Contact, error) {
	contacts, err := a.contactUseCase.List(groupID)
	if err != nil {
		return nil, fmt.Errorf("GetContacts: %w", err)
	}
	return contacts, nil
}

// GetContact returns a single contact by ID.
func (a *App) GetContact(id string) (*entity.Contact, error) {
	c, err := a.contactUseCase.Get(id)
	if err != nil {
		return nil, fmt.Errorf("GetContact: %w", err)
	}
	return c, nil
}

// SaveContact creates or updates a contact.
func (a *App) SaveContact(c entity.Contact) (entity.Contact, error) {
	saved, err := a.contactUseCase.Save(c)
	if err != nil {
		return entity.Contact{}, fmt.Errorf("SaveContact: %w", err)
	}
	return saved, nil
}

// DeleteContacts deletes multiple contacts by IDs.
func (a *App) DeleteContacts(ids []string) error {
	for _, id := range ids {
		if err := a.contactUseCase.Delete(id); err != nil {
			return fmt.Errorf("DeleteContacts: %w", err)
		}
	}
	return nil
}

// SearchContacts searches contacts by keyword.
func (a *App) SearchContacts(query string) ([]entity.Contact, error) {
	contacts, err := a.contactUseCase.Search(query)
	if err != nil {
		return nil, fmt.Errorf("SearchContacts: %w", err)
	}
	return contacts, nil
}

// LookupPostal returns address information for the given postal code (7 digits, hyphens allowed).
func (a *App) LookupPostal(postalCode string) (*entity.Address, error) {
	addr, err := a.postalRepo.Lookup(postalCode)
	if err != nil {
		return nil, fmt.Errorf("LookupPostal: %w", err)
	}
	return addr, nil
}

// ImportCSV imports contacts from the given CSV file path.
func (a *App) ImportCSV(filePath string) (entity.ImportResult, error) {
	result, err := a.csvUseCase.Import(filePath)
	if err != nil {
		return result, fmt.Errorf("ImportCSV: %w", err)
	}
	return result, nil
}

// ExportCSV exports the given contacts (or all if ids is empty) to a CSV file.
func (a *App) ExportCSV(ids []string, filePath string) error {
	if err := a.csvUseCase.Export(ids, filePath); err != nil {
		return fmt.Errorf("ExportCSV: %w", err)
	}
	return nil
}

// OpenCSVFileDialog opens a native file picker filtered to CSV files.
func (a *App) OpenCSVFileDialog() (string, error) {
	path, err := runtime.OpenFileDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "CSVファイルを選択",
		Filters: []runtime.FileFilter{
			{DisplayName: "CSVファイル (*.csv)", Pattern: "*.csv"},
		},
	})
	if err != nil {
		return "", fmt.Errorf("OpenCSVFileDialog: %w", err)
	}
	return path, nil
}

// SaveCSVFileDialog opens a native save dialog for CSV output.
func (a *App) SaveCSVFileDialog(defaultFilename string) (string, error) {
	path, err := runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{
		Title:           "CSVファイルを保存",
		DefaultFilename: defaultFilename,
		Filters: []runtime.FileFilter{
			{DisplayName: "CSVファイル (*.csv)", Pattern: "*.csv"},
		},
	})
	if err != nil {
		return "", fmt.Errorf("SaveCSVFileDialog: %w", err)
	}
	return path, nil
}

// GetGroups returns all groups.
func (a *App) GetGroups() ([]entity.Group, error) {
	groups, err := a.groupRepo.FindAll()
	if err != nil {
		return nil, fmt.Errorf("GetGroups: %w", err)
	}
	return groups, nil
}
