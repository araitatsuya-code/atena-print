package sqlite

import (
	"database/sql"
	"fmt"

	"atena-label/internal/entity"
)

type GroupRepo struct {
	db *sql.DB
}

func NewGroupRepo(db *sql.DB) *GroupRepo {
	return &GroupRepo{db: db}
}

func (r *GroupRepo) FindAll() ([]entity.Group, error) {
	rows, err := r.db.Query(`SELECT id, name FROM groups ORDER BY name`)
	if err != nil {
		return nil, fmt.Errorf("find all groups: %w", err)
	}
	defer rows.Close()

	var groups []entity.Group
	for rows.Next() {
		g := entity.Group{}
		if err := rows.Scan(&g.ID, &g.Name); err != nil {
			return nil, err
		}
		groups = append(groups, g)
	}
	if groups == nil {
		groups = []entity.Group{}
	}
	return groups, rows.Err()
}

func (r *GroupRepo) FindByID(id string) (*entity.Group, error) {
	row := r.db.QueryRow(`SELECT id, name FROM groups WHERE id = ?`, id)
	g := &entity.Group{}
	err := row.Scan(&g.ID, &g.Name)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return g, nil
}

func (r *GroupRepo) Create(g *entity.Group) error {
	_, err := r.db.Exec(`INSERT INTO groups (id, name) VALUES (?, ?)`, g.ID, g.Name)
	if err != nil {
		return fmt.Errorf("create group: %w", err)
	}
	return nil
}

func (r *GroupRepo) Update(g *entity.Group) error {
	result, err := r.db.Exec(`UPDATE groups SET name=? WHERE id=?`, g.Name, g.ID)
	if err != nil {
		return fmt.Errorf("update group: %w", err)
	}
	n, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("update group rows affected: %w", err)
	}
	if n == 0 {
		return fmt.Errorf("update group: not found id=%s", g.ID)
	}
	return nil
}

func (r *GroupRepo) Delete(id string) error {
	_, err := r.db.Exec(`DELETE FROM groups WHERE id = ?`, id)
	if err != nil {
		return fmt.Errorf("delete group: %w", err)
	}
	return nil
}

func (r *GroupRepo) AddContact(contactID, groupID string) error {
	_, err := r.db.Exec(`INSERT OR IGNORE INTO contact_groups (contact_id, group_id) VALUES (?, ?)`, contactID, groupID)
	if err != nil {
		return fmt.Errorf("add contact to group: %w", err)
	}
	return nil
}

func (r *GroupRepo) RemoveContact(contactID, groupID string) error {
	_, err := r.db.Exec(`DELETE FROM contact_groups WHERE contact_id=? AND group_id=?`, contactID, groupID)
	if err != nil {
		return fmt.Errorf("remove contact from group: %w", err)
	}
	return nil
}
