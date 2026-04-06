# Clawhub CLI 技能管理测试报告

> 来源：第三方测试（v2026.3.28）
> 记录时间：2026-04-01
> 工作区：/root/openclaw-test/workspace

---

## 命令测试结果

| 命令 | 状态 | 说明 |
|------|------|------|
| `clawhub search <query>` | ✅ 正常 | 向量搜索，返回带相关性分数 |
| `clawhub list` | ✅ 正常 | 从 lockfile 读取已安装技能 |
| `clawhub explore` | ❌ 异常 | API 返回 "No skills found"，registry 可能有问题 |
| `clawhub inspect <slug>` | ✅ 正常 | 获取技能元数据和文件，404 处理正确 |
| `clawhub install <slug>` | ✅ 正常 | 安装成功，有 rate limit 限流（30次/分钟） |
| `clawhub update [slug]` | ✅ 正常 | 检测本地变更，提示 --force 覆盖 |
| `clawhub uninstall <slug>` | ✅ 正常 | 需配合 --yes 确认，否则报错提示 |
| `clawhub login` | ⚠️ 问题 | 需浏览器交互，headless 环境下无法使用 |
| `clawhub whoami` | ✅ 正常 | 未登录时正确提示 Not logged in |
| `clawhub publish <path>` | ⚠️ 待测 | 需登录后才能测试 |

---

## 详细记录

### 安装测试（e2e-testing）

```bash
clawhub install e2e-testing --workdir /root/openclaw-test/workspace --no-input
✔ OK. Installed e2e-testing -> /root/openclaw-test/workspace/skills/e2e-testing
```

- 技能成功安装到 `skills/e2e-testing/`
- 包含 `SKILL.md` 和 `_meta.json`

### 卸载测试

```bash
clawhub uninstall e2e-testing --workdir ... --yes --no-input
✔ Uninstalled e2e-testing
```

### Rate Limit 测试

安装第二个技能时触发限流：
```
Rate limit exceeded (remaining: 0/30)
```
等待 5 秒后重试成功。

### explore 命令异常

```bash
clawhub explore --no-input
- Fetching latest skills
No skills found.
```

registry API 查不到任何技能，但 search 功能正常，疑似 explore 接口问题。

---

## 问题汇总

| # | 问题 | 严重程度 | 说明 |
|---|------|---------|------|
| 1 | explore 接口返回 "No skills found" | 🟡 中 | registry API 异常，需排查 |
| 2 | login 需浏览器交互 | 🟡 中 | headless 环境下无法使用，建议增加 --token 参数 |
| 3 | uninstall 错误提示不够清晰 | 🟢 低 | 错误信息未明确说明是哪个 flag |
| 4 | Rate limit 较严格 | 🟢 低 | 30 次/分钟，安装大量技能需等待 |

---

## 建议

1. **explore 接口** — 需确认 clawhub.com 的 explore API 是否正常
2. **login 缺少 headless 模式** — 服务器环境无浏览器，建议增加 `--token` 参数支持命令行登录
3. **uninstall 交互提示** — 错误信息应明确说明需要加 `--yes` 参数
4. **Rate limit** — 考虑提高限制或增加优雅的重试机制

---

## 状态

- [x] 已记录
- [ ] 待分析 explore 接口问题
- [ ] 待确认 login --token 可行性
