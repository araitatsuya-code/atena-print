新しい Wails バインディングを追加してください。

1. docs/02-DATA-MODEL-API.md の API 一覧を確認
2. 必要な entity struct が存在するか確認 (なければ作成)
3. usecase メソッドを実装
4. app.go に public メソッドを追加
5. `wails dev` でバインディング生成を確認
6. フロントエンドの型定義が `frontend/wailsjs/` に生成されたことを確認

対象API: $ARGUMENTS