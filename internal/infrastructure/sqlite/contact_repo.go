package sqlite

import (
	"database/sql"
	"fmt"
	"time"

	"atena-label/internal/entity"
)

type ContactRepo struct {
	db *sql.DB
}

func NewContactRepo(db *sql.DB) *ContactRepo {
	return &ContactRepo{db: db}
}

func (r *ContactRepo) FindAll(groupID string) ([]entity.Contact, error) {
	var (
		rows *sql.Rows
		err  error
	)
	if groupID == "" {
		rows, err = r.db.Query(`SELECT id, family_name, given_name, family_name_kana, given_name_kana,
			print_target, honorific, postal_code, prefecture, city, street, building, company, department, notes,
			created_at, updated_at FROM contacts ORDER BY family_name_kana, given_name_kana`)
	} else {
		rows, err = r.db.Query(`SELECT c.id, c.family_name, c.given_name, c.family_name_kana, c.given_name_kana,
			c.print_target, c.honorific, c.postal_code, c.prefecture, c.city, c.street, c.building, c.company, c.department, c.notes,
			c.created_at, c.updated_at
			FROM contacts c
			JOIN contact_groups cg ON c.id = cg.contact_id
			WHERE cg.group_id = ?
			ORDER BY c.family_name_kana, c.given_name_kana`, groupID)
	}
	if err != nil {
		return nil, fmt.Errorf("find all contacts: %w", err)
	}
	defer rows.Close()
	return scanContacts(rows)
}

func (r *ContactRepo) FindByID(id string) (*entity.Contact, error) {
	row := r.db.QueryRow(`SELECT id, family_name, given_name, family_name_kana, given_name_kana,
		print_target, honorific, postal_code, prefecture, city, street, building, company, department, notes,
		created_at, updated_at FROM contacts WHERE id = ?`, id)
	c, err := scanContact(row)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return c, err
}

func (r *ContactRepo) Create(c *entity.Contact) error {
	now := time.Now()
	c.CreatedAt = now
	c.UpdatedAt = now
	_, err := r.db.Exec(`INSERT INTO contacts
		(id, family_name, given_name, family_name_kana, given_name_kana, print_target, honorific,
		postal_code, prefecture, city, street, building, company, department, notes, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		c.ID, c.FamilyName, c.GivenName, c.FamilyNameKana, c.GivenNameKana, c.IsPrintTarget, c.Honorific,
		c.PostalCode, c.Prefecture, c.City, c.Street, c.Building, c.Company, c.Department, c.Notes,
		c.CreatedAt, c.UpdatedAt)
	if err != nil {
		return fmt.Errorf("create contact: %w", err)
	}
	return nil
}

func (r *ContactRepo) Update(c *entity.Contact) error {
	c.UpdatedAt = time.Now()
	result, err := r.db.Exec(`UPDATE contacts SET
		family_name=?, given_name=?, family_name_kana=?, given_name_kana=?, print_target=?, honorific=?,
		postal_code=?, prefecture=?, city=?, street=?, building=?, company=?, department=?, notes=?, updated_at=?
		WHERE id=?`,
		c.FamilyName, c.GivenName, c.FamilyNameKana, c.GivenNameKana, c.IsPrintTarget, c.Honorific,
		c.PostalCode, c.Prefecture, c.City, c.Street, c.Building, c.Company, c.Department, c.Notes,
		c.UpdatedAt, c.ID)
	if err != nil {
		return fmt.Errorf("update contact: %w", err)
	}
	n, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("update contact rows affected: %w", err)
	}
	if n == 0 {
		return fmt.Errorf("update contact: not found id=%s", c.ID)
	}
	return nil
}

func (r *ContactRepo) Delete(id string) error {
	_, err := r.db.Exec(`DELETE FROM contacts WHERE id = ?`, id)
	if err != nil {
		return fmt.Errorf("delete contact: %w", err)
	}
	return nil
}

func (r *ContactRepo) Search(query string) ([]entity.Contact, error) {
	like := "%" + query + "%"
	rows, err := r.db.Query(`SELECT id, family_name, given_name, family_name_kana, given_name_kana,
		print_target, honorific, postal_code, prefecture, city, street, building, company, department, notes,
		created_at, updated_at FROM contacts
		WHERE family_name LIKE ? OR given_name LIKE ? OR family_name_kana LIKE ? OR given_name_kana LIKE ?
		OR company LIKE ? OR postal_code LIKE ? OR city LIKE ?
		ORDER BY family_name_kana, given_name_kana`,
		like, like, like, like, like, like, like)
	if err != nil {
		return nil, fmt.Errorf("search contacts: %w", err)
	}
	defer rows.Close()
	return scanContacts(rows)
}

func scanContacts(rows *sql.Rows) ([]entity.Contact, error) {
	var contacts []entity.Contact
	for rows.Next() {
		c := entity.Contact{}
		if err := rows.Scan(&c.ID, &c.FamilyName, &c.GivenName, &c.FamilyNameKana, &c.GivenNameKana,
			&c.IsPrintTarget, &c.Honorific, &c.PostalCode, &c.Prefecture, &c.City, &c.Street, &c.Building,
			&c.Company, &c.Department, &c.Notes, &c.CreatedAt, &c.UpdatedAt); err != nil {
			return nil, err
		}
		contacts = append(contacts, c)
	}
	if contacts == nil {
		contacts = []entity.Contact{}
	}
	return contacts, rows.Err()
}

func scanContact(row *sql.Row) (*entity.Contact, error) {
	c := &entity.Contact{}
	err := row.Scan(&c.ID, &c.FamilyName, &c.GivenName, &c.FamilyNameKana, &c.GivenNameKana,
		&c.IsPrintTarget, &c.Honorific, &c.PostalCode, &c.Prefecture, &c.City, &c.Street, &c.Building,
		&c.Company, &c.Department, &c.Notes, &c.CreatedAt, &c.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return c, nil
}
