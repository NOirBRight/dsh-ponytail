# dsh-ponytail 设计说明

## 目标

`dsh-ponytail` 是针对 DeepSeek Harness `dsh-v0.1.2-alpha.3` 的独立适配器。插件只依赖公开 DSH 扩展点，不修改、复制或 patch DSH Core；Host 与浏览器两面都由同一个 bundle 发布。

## 运行时分工

- Host 服务 `PonytailController` 注册六个上游 skill、`/ponytail` 命令、动态系统提示段和 Agent 生命周期监听器。
- `ponytail/mode` 事件写入完整的当前模式和 pending 模式；`ponytail` 投影只暴露浏览器需要的 `mode` 与 `pending`。恢复、清理和 compact 都从已有事件前缀继续折叠。
- 命令在 Agent 运行中只写 pending，下一次被接受的 step 才提交；自然语言关闭在当前请求进入模型前提交 `off`。
- 子 Agent 在创建时读取父会话投影。`subagentMatcher` 只限制带 `agentPreset` 的子 Agent；没有 preset 时保持上游的 fail-open 行为。
- 浏览器面通过 `settings.plugin.item` 公开默认折叠、点击展开的 Settings → Plugins 卡片，只编辑默认模式；启动提示默认隐藏，子 Agent 继承保持自动生效，高级 matcher 仍由配置层兼容。浏览器通过 `shell.overlay` 显示一次性的会话启动提示。模式切换由 `/ponytail` 命令完成，浏览器不在 composer 中复制一套会话状态。

## 会话事件兼容

alpha.2/alpha.3 的 `dsh-session` 会拒绝事件目录中没有列出的非 `ignorable` 事件，而目录暂时没有下游插件注册接口。插件在激活时从 `ctx.baseUrl` 解析宿主 profile 实际使用的 `@deepseek-ai/dsh-session`，向其导出的目录加入 `ponytail/mode`，卸载时撤回；这样本地 `link:`、打包安装和宿主依赖不会各自维护一份目录。该解析只发生在 Host 面，浏览器 bundle 不加载 Node 模块。上游提供正式注册接口后，应替换 `src/session-catalog.ts` 的兼容层。

## 配置决策

设置解析顺序固定为 `PONYTAIL_*` 环境变量 → DSH Settings → 上游 `~/.config/ponytail/config.json` → 插件默认值。环境变量在每次读取时覆盖其他层，因此外部部署可以锁定策略；DSH Settings 仍负责 GUI 保存和会话默认值。

`hideStatus` 是保留给旧配置的兼容字段，不再控制浏览器 UI；`quietStartup` 默认隐藏浏览器启动提示，也可由环境变量或配置文件显式关闭。两者不改变模式、命令、skill 或系统提示。

## 上游边界

技能目录来自固定的 Ponytail `4.9.0` commit，并在包内发布；同步脚本只接受本地 checkout，运行时不访问网络。Claude/Codex 专属安装标志、statusline、卸载脚本和 Ponytail MCP 没有在 DSH 内重做：对应能力由 DSH 的 Settings、Commands、session log、projection、dynamic system prompt、Skill Registry 和浏览器 slot 提供。

更新上游时先运行 `PONYTAIL_SOURCE=/path/to/ponytail node scripts/sync-upstream.mjs`，审查六个 `SKILL.md` 的 hash 和行为测试，再提交版本更新。

## 兼容性边界

`package.json` 的 peer 版本精确固定到 alpha.3；不从工作区 `deepseek-harness` checkout 解析依赖。`cordis.patch.yml` 只插入 `dsh-ponytail` bundle 行，用户 profile 负责组合顺序。插件可以在 alpha.3 官方 npm 包的 Loader、客户端模块系统和 CLI/Web 启动路径中独立加载；3082 的 alpha.2 仅作为实验面做了兼容性验收，不改变发布目标。
