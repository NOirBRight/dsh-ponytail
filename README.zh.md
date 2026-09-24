# dsh-ponytail

`dsh-ponytail` 是面向 DeepSeek Harness 的独立 bundle，把 Ponytail 的最小实现策略、六个技能、会话模式、命令、子 Agent 继承和 Web GUI 设置接入 DSH。它不修改也不复制 DeepSeek Harness Core。

## 兼容性

宿主 `@deepseek-ai/dsh-*` peer 范围为 `>=0.1.7-alpha.2 <0.1.8`；`devDependencies` 精确固定 Alpha.2。Cordis peer 范围为 `>=4.0.4 <5.0.0`，开发依赖固定 `4.0.4`。

`package.json#dsh.compatibility.dshReleases` 将 Alpha.2 标记为本构建的兼容目标。未知运行时仍会告警一次并尝试正常挂载；只有复现过的故障才会加入 blocklist。

## 安装

Latest：

```sh
dsh plugin --profile web add --force https://github.com/NOirBRight/dsh-ponytail/releases/latest/download/dsh-ponytail-0.2.10.tgz
```

固定 GitHub release：

```sh
dsh plugin --profile web add --force https://github.com/NOirBRight/dsh-ponytail/releases/download/v0.2.10/dsh-ponytail-0.2.10.tgz
```

本地验收使用 checkout：

```sh
DSH_HOME=~/.dsh-rc1-canary dsh plugin --profile web add link:/home/noirbright/Workstation/.worktrees/alpha2-compat/dsh-ponytail
```

第一阶段只在 `~/.dsh-rc1-canary` / 3082 验收。不要修改生产 `~/.dsh` / 3080。

此 bundle 以官方 DSH `0.1.7-alpha.2` 包的类型编译并以其为兼容目标。上游技能内容随 bundle 本地发布，运行时不访问网络。

仓库、发行包与插件品牌统一为 `dsh-ponytail`。仅通过 GitHub release 分发：不带 scope 的 `dsh-ponytail` npm 名称已被其他维护者占用，因此不启用 `npm publish`（不配置 `NPM_TOKEN`）。

## 模式与命令

模式和 pending 选择保存在活跃会话内存中；重启宿主或重新加载插件后回到配置的默认值。不写自定义会话事件，因此卸载不会阻止历史加载。四种模式为 `off`、`lite`、`full`（默认）和 `ultra`。

```text
/ponytail                 查看当前模式
/ponytail status          查看当前与待生效模式
/ponytail lite|full|ultra|off
/ponytail default <mode> 设置新会话默认值
```

模型轮次运行时切换会记录为 pending，在下一次接受的 step 生效。整条用户消息为 `stop ponytail` 或 `normal mode`（忽略大小写和末尾标点）时关闭当前会话。

随包自动发现并注册六个技能：`ponytail`、`ponytail-review`、`ponytail-audit`、`ponytail-debt`、`ponytail-gain`、`ponytail-help`。基础 `ponytail` 技能仍可由用户调用，但会从模型目录移除，即使其他 Provider 另行安装了全局副本也一样，因为活动模式已通过系统提示注入同一策略。发现和调用由 DSH Skill Registry 负责，不重复实现上游 MCP。

## 设置与 GUI

Loader Config 条目的 id 为 `ponytail`（由 `cordis.patch.yml` 声明）：

- `defaultMode`：`full`
- `hideStatus`：`false`
- `quietStartup`：`true`（默认隐藏启动提示；高级配置字段，设置卡不显示）
- `subagentMatcher`：空值（全部子 Agent；高级配置字段，设置卡不显示）

配置优先级为：`PONYTAIL_*` 环境变量 → profile 持久化的 Loader Config → 可选的上游 `~/.config/ponytail/config.json` → 内置默认值。Config 默认值会纳入上游配置文件内容。子 Agent 默认继承父会话模式；需要按 `agentPreset` 限定范围时，可用 `PONYTAIL_SUBAGENT_MATCHER` 或 `subagentMatcher`。匹配大小写不敏感且不锚定；缺少 preset 时允许继承。非法正则会在插件加载或 Config 表单写入前被拒绝。

DSH Alpha.2 的默认模式卡片位于 Plugins 页的 `plugins.bundle.config` 槽位（key `dsh-ponytail`，仅 `view: 'page'`）。它通过 `ctx.configForms.get('ponytail')` 读取 Loader 条目，提交时携带已读取的 revision，并可清除 Loader 覆盖；`/ponytail default <mode>` 也会持久化到同一字段。不再保留旧 `settings.plugin.item` 路径。本 bundle 不占用官方 host-plane 卡片列表 `plugins.item`。当前运行时未启用实时模式投影，因此启动提示不可用；高级偏好与 matcher 不显示在模式卡片中。

当前未启用实时模式投影，可选启动提示不可用；`quietStartup` 保留为兼容配置。

## 开发

```sh
pnpm install
pnpm run check
```

`pnpm run check` 会运行单测、类型检查、Host/Web 构建、0.1.7-alpha.2 Host/客户端加载器 smoke，以及 pack/install 检查。`scripts/sync-upstream.mjs` 从本地上游 checkout 更新 SKILL.md，不在运行时联网。

检查还会比较 `snapshots/ponytail-host.json` 中的无密钥 assembled Host transcript；确认运行时变化符合预期后，可用 `pnpm run snapshot:record` 刷新它。

上游版本记录见 [UPSTREAM.md](UPSTREAM.md)。

架构取舍与同步边界见 [DESIGN.md](DESIGN.md)。

## 修复旧会话

修复压缩日志需要 PATH 中的 `zstd` 命令。0.2.4 及更早版本写入的 `ponytail/mode` 事件需要单独修复；升级不会自动修改历史。先对副本验收，修改原件前停止对应宿主。默认仅检查；添加 `--apply` 后先保存 `.before-ponytail-repair` 原始备份，再只补充可忽略标记。不要同时写入同一会话；回滚时停止宿主后用备份恢复原文件。

```sh
node scripts/repair-session.mjs /path/to/session.jsonl.zstd
node scripts/repair-session.mjs --apply /path/to/session.jsonl.zstd
```
