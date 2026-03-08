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

[Request interrupted by user for tool use]

### Prompt 3

YES

