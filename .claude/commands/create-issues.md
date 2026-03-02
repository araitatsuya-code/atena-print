# GitHub Issue 作成コマンド

docs/04-TASK-LIST.md を読み、指定された Phase のタスクを GitHub Issue として作成してください。

手順:

1. docs/04-TASK-LIST.md から該当 Phase のタスクを抽出
2. 各タスクを1つの Issue として `gh issue create` で作成
3. ラベル: phase に応じたラベル (phase-1, phase-2, ...) を付与
4. 関連するタスクが複数ある場合はまとめて1 Issue にしてよい（粒度は「1PR = 1Issue」が目安）

フォーマット:
- タイトル: 簡潔に何をするか
- 本文: タスクの詳細、受け入れ条件、参照ドキュメント

ラベルが未作成なら先に作成:
gh label create phase-1 --color 0E8A16 --description "Phase 1: 基盤構築"
gh label create phase-2 --color 1D76DB --description "Phase 2: 住所録 CRUD"
...

対象: $ARGUMENTS (例: "Phase 1", "all")