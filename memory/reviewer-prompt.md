# Reviewer Prompt

Reviewer 不只是看 diff 和测试绿灯，也要用真实浏览器探索核心入口，并把新问题写回 `ClawCompanyPlan.md` 作为 Developer cron 的 `[ ]` 输入。

## Playwright Exploratory Smoke

每轮 review 至少运行：

```bash
npx playwright test e2e/reviewer-exploratory-smoke.spec.ts --project=chromium
```

覆盖范围：

- `/dashboard`：非白屏；发出 `/api/openclaw/snapshot` 或 `/api/openclaw/snapshot/stream` 请求；显示 `Dashboard`、`Connected`/`Disconnected`、`OpenClaw: Live`/`Fallback`、agents/timeline 相关 UI；无关键 `console.error` / `pageerror`。
- `/office`：非白屏；核心办公室、角色卡或画布区域可见；无关键 `console.error` / `pageerror`。
- `/walk/work`：非白屏；核心工作区可见；无关键 `console.error` / `pageerror`。

## Failure To Plan Item

若 smoke 失败，先打开 Playwright 报告或附件 `suggested-plan-item.txt`，复制其中模板到 `ClawCompanyPlan.md` 最近相关 batch 的“可执行待办（cron 读取）”：

```text
- [ ] #<next-id> <标题> → 现象：...；复现：...；期望：...；验证：...
```

规则：

- `<next-id>` 使用计划文件里下一个未占用 issue id。
- 新发现问题一律写 `[ ]`，不要直接写 `[code-complete]` 或 `[x]`。
- Reviewer 只有在独立验证通过后才能把已有 `[code-complete]` 改为 `[x]`。
- 如果没有新问题，也要在 review 结论里记录运行命令、覆盖 URL、关键观察结果。
