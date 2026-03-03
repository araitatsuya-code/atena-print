package entity

// Address は郵便番号検索結果の住所情報。
type Address struct {
	Prefecture string `json:"prefecture"` // 都道府県
	City       string `json:"city"`       // 市区町村
	Town       string `json:"town"`       // 町域
}
