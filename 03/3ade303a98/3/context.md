# Session Context

## User Prompts

### Prompt 1

# 次の Issue を取得して実装開始

次に取り組むべき Issue を見つけて実装を開始してください。

手順:

1. `gh issue list --state open --label <現在のPhase> --limit 1` で次の Issue を取得
2. Issue がなければ次の Phase のラベルで探す
3. 見つかったら /project:work-issue と同じフローで実装開始

もし open な Issue がなければ「全 Issue 完了」と報告してください。

### Prompt 2

# 次の Issue を取得して実装開始

次に取り組むべき Issue を見つけて実装を開始してください。

手順:

1. `gh issue list --state open --label <現在のPhase> --limit 1` で次の Issue を取得
2. Issue がなければ次の Phase のラベルで探す
3. 見つかったら /project:work-issue と同じフローで実装開始

もし open な Issue がなければ「全 Issue 完了」と報告してください。

### Prompt 3

# Issue を実装

指定された GitHub Issue を実装してください。

## 手順

1. `gh issue view <番号>` で Issue の内容を確認
2. ブランチを作成: `git checkout -b issue-<番号>-<slug>`
3. 必要な仕様を docs/ から参照して実装
4. テスト実行:
   - Go: `go test ./internal/...`
   - Frontend: `cd frontend && npx vitest --run`
5. 変更をコミット (コミットメッセージに `refs #<番号>` を含める)
6. Push して PR 作成:

ARGUMENTS: 4

### Prompt 4

Verify each finding against the current code and only fix it if needed.

Inline comments:
In `@frontend/src/components/address/ContactList.tsx`:
- Around line 85-105: Wrap the Wails binding calls in handleImport and
handleExport with try-catch (and a finally where appropriate) to surface errors
to the user: in handleImport, surround OpenCSVFileDialog, ImportCSV and
refreshContacts so that ImportCSV errors are caught and an alert is shown (and
ensure refreshContacts runs in finally or only aft...

