# dsh-ponytail

`dsh-ponytail` 是面向 DeepSeek Harness Alpha.4 的独立 bundle，把 Ponytail 的最小实现策略、六个技能、会话模式、命令、子 Agent 继承和 Web GUI 设置接入 DSH。它不修改也不复制 DeepSeek Harness Core。

## 兼容性

已验证运行时是 DeepSeek Harness `0.1.2-alpha.4` 与 `0.1.2-rc.1`（Cordis `4.0.2`）；这份记录只是证据，不是 allowlist。

未知的新版本会先打一条 warning，再按正常挂载路径 best-effort 尝试，不会因为未验证而跳过。

只有复现过的故障才会加入 blocklist；受影响版本、原因和证据见[兼容性记录](package.json)。


## 安装

固定 GitHub release（从源码安装）：

```sh
dsh plugin --profile web add github:NOirBRight/dsh-ponytail#v0.2.3
```

GitHub release 的预构建 tarball：

```sh
dsh plugin --profile web add https://github.com/NOirBRight/dsh-ponytail/releases/download/v0.2.3/dsh-ponytail-0.2.3.tgz
```

本地验收使用 checkout：

```sh
DSH_HOME=~/.dsh-lab dsh plugin --profile web add link:/home/noirbright/Workstation/dsh-ponytail
```

第一阶段只在 `~/.dsh-lab` / 3082 验收。不要修改生产 `~/.dsh` / 3080。

此 bundle 固定兼容 `dsh-v0.1.2-alpha.4` 与 `@dietrichgebert/ponytail@4.9.0`。上游技能内容随 bundle 本地发布，运行时不访问网络。

仓库、发行包与插件品牌统一为 `dsh-ponytail`。仅通过 GitHub release 分发：不带 scope 的 `dsh-ponytail` npm 名称已被其他维护者占用，因此不启用 `npm publish`（不配置 `NPM_TOKEN`）。

## 模式与命令

每个会话记录完整的 `ponytail/mode` 事件，并提供包含 `mode` 与 `pending` 的 `ponytail` 投影。四种模式为 `off`、`lite`、`full`（默认）和 `ultra`。

```text
/ponytail                 查看当前模式
/ponytail status          查看当前与待生效模式
/ponytail lite|full|ultra|off
/ponytail default <mode> 设置新会话默认值
```

模型轮次运行时切换会记录为 pending，在下一次接受的 step 生效。整条用户消息为 `stop ponytail` 或 `normal mode`（忽略大小写和末尾标点）时关闭当前会话。

随包自动发现并注册六个技能：`ponytail`、`ponytail-review`、`ponytail-audit`、`ponytail-debt`、`ponytail-gain`、`ponytail-help`。发现和调用由 DSH Skill Registry 负责，不重复实现上游 MCP。

## 设置与 GUI

Host 设置命名空间为 `ponytail`：

- `defaultMode`：`full`
- `hideStatus`：`false`
- `quietStartup`：`true`（默认隐藏启动提示；高级配置字段，设置卡不显示）
- `subagentMatcher`：空值（全部子 Agent；高级配置字段，设置卡不显示）

配置优先级为：`PONYTAIL_*` 环境变量 → DSH Settings → 可选的上游 `~/.config/ponytail/config.json` → 默认值。子 Agent 默认继承父会话模式；需要按 `agentPreset` 限定范围时，仍可通过 `PONYTAIL_SUBAGENT_MATCHER` 或配置文件中的 `subagentMatcher` 使用大小写不敏感、非锚定匹配。缺少 preset 时允许继承。非法正则在加载插件或保存设置时直接报错。

当 DSH Web 设置包含 Plugins 页面时，会显示默认折叠的响应式 Ponytail 设置卡；点击摘要行后展开，只编辑 `defaultMode`。启动提示默认关闭，子 Agent 继承保持自动生效，匹配器不占用设置卡空间。卡片按自身可用宽度响应：窄屏切为两列模式卡、堆叠操作区，并保持 44px 触控目标，因此可直接放入 dsh-mobile 的设置抽屉。输入区不再注入 Ponytail 控件；会话中切换模式请使用 `/ponytail <mode>`。`hideStatus` 继续读写以兼容旧配置，但不再控制浏览器界面。

启动提示通过 DSH 的 `shell.overlay` 浮层槽位渲染，桌面端与 dsh-mobile 共用；`quietStartup` 默认隐藏这条提示，需要时可通过 `PONYTAIL_QUIET_STARTUP=false` 或配置文件显式开启，不影响模式、命令或系统提示。

## 开发

```sh
pnpm install
pnpm run check
```

`pnpm run check` 会运行单测、类型检查、Host/Web 构建、Alpha.4 Host/客户端加载器 smoke，以及 pack/install 检查。`scripts/sync-upstream.mjs` 从本地上游 checkout 更新 SKILL.md，不在运行时联网。

检查还会比较 `snapshots/ponytail-host.json` 中的无密钥 assembled Host transcript；确认运行时变化符合预期后，可用 `pnpm run snapshot:record` 刷新它。

上游版本记录见 [UPSTREAM.md](UPSTREAM.md)。

架构取舍与同步边界见 [DESIGN.md](DESIGN.md)。
