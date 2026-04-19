# Atena ラベル印刷 — データモデル・API仕様

## Entity 定義 (Go structs)

### Contact (連絡先)

```go
// internal/entity/contact.go
package entity

import "time"

type Contact struct {
    ID             string    `json:"id"`
    FamilyName     string    `json:"familyName"`
    GivenName      string    `json:"givenName"`
    FamilyNameKana string    `json:"familyNameKana"`
    GivenNameKana  string    `json:"givenNameKana"`
    IsPrintTarget  bool      `json:"isPrintTarget"`  // 印刷対象フラグ (true=印刷する)
    Honorific      string    `json:"honorific"`      // 様, 殿, 御中 etc.
    PostalCode     string    `json:"postalCode"`     // 7桁 (ハイフンなし)
    Prefecture     string    `json:"prefecture"`
    City           string    `json:"city"`
    Street         string    `json:"street"`
    Building       string    `json:"building"`
    Company        string    `json:"company"`
    Department     string    `json:"department"`
    Notes          string    `json:"notes"`
    CreatedAt      time.Time `json:"createdAt"`
    UpdatedAt      time.Time `json:"updatedAt"`
}
```

### Sender (差出人)

```go
// internal/entity/sender.go
type Sender struct {
    ID         string `json:"id"`
    FamilyName string `json:"familyName"`
    GivenName  string `json:"givenName"`
    PostalCode string `json:"postalCode"`
    Prefecture string `json:"prefecture"`
    City       string `json:"city"`
    Street     string `json:"street"`
    Building   string `json:"building"`
    Company    string `json:"company"`
    IsDefault  bool   `json:"isDefault"`
}
```

### Group (グループ)

```go
// internal/entity/group.go
type Group struct {
    ID   string `json:"id"`
    Name string `json:"name"`
}
```

### Watermark (透かし画像)

```go
// internal/entity/watermark.go
type Watermark struct {
    ID       string  `json:"id"`
    Name     string  `json:"name"`
    Type     string  `json:"type"`      // "preset" | "custom"
    FilePath string  `json:"filePath"`
    Opacity  float64 `json:"opacity"`   // 0.0 - 1.0
}
```

プリセット一覧:

| ID | 名前 | ファイル |
|----|------|---------|
| none | なし | - |
| sakura | 桜 | sakura.png |
| wave | 波 | wave.png |
| bamboo | 竹 | bamboo.png |
| fuji | 富士山 | fuji.png |
| crane | 鶴 | crane.png |

### QRConfig (QRコード設定)

```go
// internal/entity/qr_config.go
type QRConfig struct {
    Enabled  bool   `json:"enabled"`
    Content  string `json:"content"`     // URL or text
    Size     int    `json:"size"`        // px (20-80)
    Position string `json:"position"`    // "top-left", "top-right", "bottom-left", "bottom-right"
}
```

### LabelLayout (ラベル面付け)

```go
// internal/entity/label_layout.go
type LabelLayout struct {
    PaperWidth   float64 `json:"paperWidth"`   // mm (A4: 210)
    PaperHeight  float64 `json:"paperHeight"`  // mm (A4: 297)
    LabelWidth   float64 `json:"labelWidth"`   // mm
    LabelHeight  float64 `json:"labelHeight"`  // mm
    Columns      int     `json:"columns"`
    Rows         int     `json:"rows"`
    MarginTop    float64 `json:"marginTop"`    // mm
    MarginLeft   float64 `json:"marginLeft"`   // mm
    GapX         float64 `json:"gapX"`         // mm
    GapY         float64 `json:"gapY"`         // mm
}
```

対応用紙プリセット:

| 用紙タイプ | 面数 | ラベルサイズ | Columns | Rows |
|-----------|------|------------|---------|------|
| A4 12面 | 12 | 86.4×42.3mm | 2 | 6 |
| A4 10面 | 10 | 86.4×50.8mm | 2 | 5 |
| A4 8面 | 8 | 96.5×67.7mm | 2 | 4 |
| はがき | 1 | 100×148mm | 1 | 1 |
| カスタム | - | 任意 | 任意 | 任意 |

### Template (宛名テンプレート)

```go
// internal/entity/template.go
type Template struct {
    ID          string        `json:"id"`
    Name        string        `json:"name"`
    Orientation string        `json:"orientation"` // "vertical" | "horizontal"
    LabelWidth  float64       `json:"labelWidth"`  // mm
    LabelHeight float64       `json:"labelHeight"` // mm
    PostalCode  *PostalConfig `json:"postalCode,omitempty"`
    Recipient   TextConfig    `json:"recipient"`
    Sender      TextConfig    `json:"sender"`
}

type PostalConfig struct {
    X            float64 `json:"x"`            // mm
    Y            float64 `json:"y"`            // mm
    DigitSpacing float64 `json:"digitSpacing"` // mm
    FontSize     float64 `json:"fontSize"`     // pt
}

type TextConfig struct {
    NameX       float64 `json:"nameX"`       // mm
    NameY       float64 `json:"nameY"`       // mm
    NameFont    float64 `json:"nameFont"`    // pt
    AddressX    float64 `json:"addressX"`    // mm
    AddressY    float64 `json:"addressY"`    // mm
    AddressFont float64 `json:"addressFont"` // pt
}
```

### PrintJob (印刷ジョブ)

```go
// internal/entity/print_job.go
type PrintJob struct {
    ContactIDs  []string     `json:"contactIds"`
    TemplateID  string       `json:"templateId"`
    SenderID    string       `json:"senderId"`
    LabelLayout LabelLayout  `json:"labelLayout"`
    Watermark   *Watermark   `json:"watermark,omitempty"`
    QRConfig    *QRConfig    `json:"qrConfig,omitempty"`
}
```

## DB スキーマ (SQLite)

### 000001_create_contacts.up.sql

```sql
CREATE TABLE contacts (
    id TEXT PRIMARY KEY,
    family_name TEXT NOT NULL DEFAULT '',
    given_name TEXT NOT NULL DEFAULT '',
    family_name_kana TEXT NOT NULL DEFAULT '',
    given_name_kana TEXT NOT NULL DEFAULT '',
    print_target BOOLEAN NOT NULL DEFAULT 1,
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
```

## CSVの印刷対象列方針

- 列名: `印刷対象` (末尾列)
- インポート時:
  - 列が存在しない/空欄は `true` (印刷する)
  - `1`, `true`, `on` は `true`
  - `0`, `false`, `off` は `false`
- エクスポート時:
  - `true` は `1`
  - `false` は `0`

## Wails バインディング (API) 一覧

### 住所録

| メソッド | 引数 | 戻り値 | 説明 |
|---------|------|--------|------|
| `GetContacts(groupID string)` | groupID (空文字で全件) | `[]Contact` | 住所録取得 |
| `GetContact(id string)` | id | `*Contact` | 1件取得 |
| `SaveContact(c Contact)` | Contact | `Contact` | 新規作成/更新 |
| `DeleteContacts(ids []string)` | ids | - | 複数削除 |
| `SearchContacts(query string)` | query | `[]Contact` | 検索 |
| `ImportCSV(filePath string)` | filePath | `ImportResult` | CSVインポート |
| `ExportCSV(ids []string, path string)` | ids, path | - | CSVエクスポート |

### グループ

| メソッド | 引数 | 戻り値 | 説明 |
|---------|------|--------|------|
| `GetGroups()` | - | `[]Group` | グループ一覧 |
| `SaveGroup(g Group)` | Group | `Group` | グループ保存 |
| `DeleteGroup(id string)` | id | - | グループ削除 |
| `AddContactToGroup(contactID, groupID string)` | - | - | 割り当て |
| `RemoveContactFromGroup(contactID, groupID string)` | - | - | 解除 |

### 差出人

| メソッド | 引数 | 戻り値 | 説明 |
|---------|------|--------|------|
| `GetSenders()` | - | `[]Sender` | 差出人一覧 |
| `SaveSender(s Sender)` | Sender | `Sender` | 差出人保存 |
| `DeleteSender(id string)` | id | - | 差出人削除 |

### テンプレート

| メソッド | 引数 | 戻り値 | 説明 |
|---------|------|--------|------|
| `GetTemplates()` | - | `[]Template` | テンプレート一覧 |

### 透かし・QR

| メソッド | 引数 | 戻り値 | 説明 |
|---------|------|--------|------|
| `GetWatermarkPresets()` | - | `[]Watermark` | プリセット一覧 |
| `UploadWatermark(filePath string)` | filePath | `Watermark` | カスタム透かしアップロード |
| `DeleteWatermark(id string)` | id | - | カスタム透かし削除 |
| `GenerateQRPreview(config QRConfig)` | QRConfig | `[]byte` (PNG) | QRプレビュー生成 |

### 印刷

| メソッド | 引数 | 戻り値 | 説明 |
|---------|------|--------|------|
| `GenerateLabelPDF(job PrintJob)` | PrintJob | `string` (filePath) | ラベルPDF生成 |
| `PrintPDF(pdfPath string)` | pdfPath | `PrintResult` | OS印刷実行 |

### ユーティリティ

| メソッド | 引数 | 戻り値 | 説明 |
|---------|------|--------|------|
| `LookupPostal(postalCode string)` | postalCode | `*Address` | 郵便番号検索 |
| `BackupDB(path string)` | path | - | DBバックアップ |
| `OpenFileDialog(filters string)` | filters | `string` | ファイル選択ダイアログ |
