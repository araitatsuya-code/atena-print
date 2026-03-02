CREATE TABLE contacts (
    id TEXT PRIMARY KEY,
    family_name TEXT NOT NULL DEFAULT '',
    given_name TEXT NOT NULL DEFAULT '',
    family_name_kana TEXT NOT NULL DEFAULT '',
    given_name_kana TEXT NOT NULL DEFAULT '',
    honorific TEXT NOT NULL DEFAULT '様',
    postal_code TEXT NOT NULL DEFAULT '',
    prefecture TEXT NOT NULL DEFAULT '',
    city TEXT NOT NULL DEFAULT '',
    street TEXT NOT NULL DEFAULT '',
    building TEXT NOT NULL DEFAULT '',
    company TEXT NOT NULL DEFAULT '',
    department TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE groups (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE
);

CREATE TABLE contact_groups (
    contact_id TEXT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    PRIMARY KEY (contact_id, group_id)
);

CREATE TABLE senders (
    id TEXT PRIMARY KEY,
    family_name TEXT NOT NULL DEFAULT '',
    given_name TEXT NOT NULL DEFAULT '',
    postal_code TEXT NOT NULL DEFAULT '',
    prefecture TEXT NOT NULL DEFAULT '',
    city TEXT NOT NULL DEFAULT '',
    street TEXT NOT NULL DEFAULT '',
    building TEXT NOT NULL DEFAULT '',
    company TEXT NOT NULL DEFAULT '',
    is_default BOOLEAN NOT NULL DEFAULT 0
);

CREATE TABLE custom_watermarks (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE print_history (
    id TEXT PRIMARY KEY,
    printed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    contact_count INTEGER NOT NULL,
    template_id TEXT,
    watermark_id TEXT,
    qr_enabled BOOLEAN NOT NULL DEFAULT 0
);

-- デフォルトグループ
INSERT INTO groups (id, name) VALUES ('family', '家族');
INSERT INTO groups (id, name) VALUES ('friend', '友人');
INSERT INTO groups (id, name) VALUES ('work', '仕事');
