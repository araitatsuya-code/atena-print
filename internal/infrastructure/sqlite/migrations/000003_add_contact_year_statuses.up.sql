CREATE TABLE contact_year_statuses (
    contact_id TEXT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    year INTEGER NOT NULL,
    sent BOOLEAN NOT NULL DEFAULT 0,
    received BOOLEAN NOT NULL DEFAULT 0,
    mourning BOOLEAN NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (contact_id, year)
);

CREATE INDEX idx_contact_year_statuses_year ON contact_year_statuses(year);
