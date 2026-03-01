package sqlite

import (
	"database/sql"
	"fmt"

	"atena-label/internal/entity"
)

type SenderRepo struct {
	db *sql.DB
}

func NewSenderRepo(db *sql.DB) *SenderRepo {
	return &SenderRepo{db: db}
}

func (r *SenderRepo) FindAll() ([]entity.Sender, error) {
	rows, err := r.db.Query(`SELECT id, family_name, given_name, postal_code, prefecture, city, street, building, company, is_default
		FROM senders ORDER BY is_default DESC, family_name`)
	if err != nil {
		return nil, fmt.Errorf("find all senders: %w", err)
	}
	defer rows.Close()

	var senders []entity.Sender
	for rows.Next() {
		s := entity.Sender{}
		if err := rows.Scan(&s.ID, &s.FamilyName, &s.GivenName, &s.PostalCode, &s.Prefecture,
			&s.City, &s.Street, &s.Building, &s.Company, &s.IsDefault); err != nil {
			return nil, err
		}
		senders = append(senders, s)
	}
	if senders == nil {
		senders = []entity.Sender{}
	}
	return senders, rows.Err()
}

func (r *SenderRepo) FindByID(id string) (*entity.Sender, error) {
	row := r.db.QueryRow(`SELECT id, family_name, given_name, postal_code, prefecture, city, street, building, company, is_default
		FROM senders WHERE id = ?`, id)
	s := &entity.Sender{}
	err := row.Scan(&s.ID, &s.FamilyName, &s.GivenName, &s.PostalCode, &s.Prefecture,
		&s.City, &s.Street, &s.Building, &s.Company, &s.IsDefault)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("find sender by id: %w", err)
	}
	return s, nil
}

func (r *SenderRepo) Create(s *entity.Sender) error {
	tx, err := r.db.Begin()
	if err != nil {
		return fmt.Errorf("create sender begin tx: %w", err)
	}
	defer tx.Rollback()

	if s.IsDefault {
		if _, err := tx.Exec(`UPDATE senders SET is_default = 0`); err != nil {
			return fmt.Errorf("reset default sender: %w", err)
		}
	}
	_, err = tx.Exec(`INSERT INTO senders (id, family_name, given_name, postal_code, prefecture, city, street, building, company, is_default)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		s.ID, s.FamilyName, s.GivenName, s.PostalCode, s.Prefecture, s.City, s.Street, s.Building, s.Company, s.IsDefault)
	if err != nil {
		return fmt.Errorf("create sender: %w", err)
	}
	return tx.Commit()
}

func (r *SenderRepo) Update(s *entity.Sender) error {
	tx, err := r.db.Begin()
	if err != nil {
		return fmt.Errorf("update sender begin tx: %w", err)
	}
	defer tx.Rollback()

	if s.IsDefault {
		if _, err := tx.Exec(`UPDATE senders SET is_default = 0 WHERE id != ?`, s.ID); err != nil {
			return fmt.Errorf("reset default sender: %w", err)
		}
	}
	result, err := tx.Exec(`UPDATE senders SET family_name=?, given_name=?, postal_code=?, prefecture=?, city=?, street=?, building=?, company=?, is_default=?
		WHERE id=?`,
		s.FamilyName, s.GivenName, s.PostalCode, s.Prefecture, s.City, s.Street, s.Building, s.Company, s.IsDefault, s.ID)
	if err != nil {
		return fmt.Errorf("update sender: %w", err)
	}
	n, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("update sender rows affected: %w", err)
	}
	if n == 0 {
		return fmt.Errorf("update sender: not found id=%s", s.ID)
	}
	return tx.Commit()
}

func (r *SenderRepo) Delete(id string) error {
	_, err := r.db.Exec(`DELETE FROM senders WHERE id = ?`, id)
	if err != nil {
		return fmt.Errorf("delete sender: %w", err)
	}
	return nil
}
