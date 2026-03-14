# Session Context

## User Prompts

### Prompt 1

https://github.com/araitatsuya-code/atena-print/issues/30
こちらをよろしくお願いします

### Prompt 2

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

ARGUMENTS: https://github.com/araitatsuya-code/atena-print/issues/30

