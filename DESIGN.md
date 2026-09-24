# dsh-ponytail 设计说明

## 目标

`dsh-ponytail` 是针对 DeepSeek Harness `0.1.7-alpha.2` 的独立适配器（Host/client 开发依赖与 Cordis peer 范围也固定到该兼容目标）。插件只依赖公开 DSH 扩展点，不修改、复制或 patch DSH Core；Host 与浏览器两面都由同一个 bundle 发布。

## 运行时分工

- Host 服务 `PonytailController` 注册六个上游 skill、`/ponytail` 命令、动态系统提示段，并在串行 `agent/created` 上初始化会话模式；Alpha.2 类型直接提供 `source`。listener 不得 `await agent.whenIdle()`。基础 `ponytail` skill 仅允许用户调用，并在 step 边界从模型目录移除其他 Provider 的同名副本，避免与动态系统提示重复。
- 当前模式和 pending 模式仅保存在活跃 Session 对象中；进程重启后使用默认模式。
- 命令在 Agent 运行中只写 pending，下一次提示组装直接使用 pending 模式并在该 step 提交；自然语言关闭在消息进入 inbox 时提交 `off`，早于该请求的提示组装。
- 子 Agent 在创建时读取父会话投影。`subagentMatcher` 只限制带 `agentPreset` 的子 Agent；没有 preset 时保持上游的 fail-open 行为。
- 浏览器面只把默认模式表单挂到 `plugins.bundle.config`（key `dsh-ponytail`），通过 `ctx.configForms.get('ponytail')` 读取并修订写入真实 Loader entry。Alpha.1 `settings.plugin.item` 降级路径已移除。启动提示默认隐藏，子 Agent 继承保持自动生效，高级 matcher 仍由 Loader Config 兼容。实时模式投影不可用时不显示会话启动提示；模式切换也可由 `/ponytail` 命令完成，浏览器不在 composer 中复制一套会话状态。

## 会话事件兼容

官方 Alpha.2 的读取接口支持 `ignorable`，但 `Session.append()` 没有写入该信封标记的公开参数。模式状态因此保存在按 `Session` 对象索引的 WeakMap 中，不写自定义事件，也不修改宿主事件目录。0.1.5-rc.1 的历史 V3 快照里，`request/header` 不携带系统提示正文，组装后的策略文本位于 `system/message`。重启或重新加载插件后使用当前 Loader Config 默认模式；活跃父会话的模式仍可继承。

当前不注册实时模式投影，因此可选启动提示不可用。`src/projection.ts` 保留旧事件的类型与纯解码定义。持久化模式和实时模式投影需要上游公开支持可忽略事件写入后才能恢复；不能通过修改冻结事件、替换 `Session.append` 或修改宿主只读目录实现。

快照 / 修复冒烟里的 `findSessionArtifact` 不是 Host API：`sessionPersistence` 句柄故意隐藏产物路径，冒烟只在临时存储树里按 `session.v*.jsonl` 命名约定定位唯一文件，这是测试侧 seam，不是对外契约。

旧日志需要离线运行 `scripts/repair-session.mjs`，只为 `ponytail/mode` 添加 `ignorable: true`。该事件只携带插件模式，实际历史系统提示已在标准请求头中保存，因此插件缺席时无需解释模式事件即可读取历史。工具默认 dry-run；`--apply` 先创建不覆盖的原始字节备份，再原子替换。操作前停止对应 Host，避免写入竞争。升级插件本身不会修改旧日志。

## 配置决策

设置优先级固定为 `PONYTAIL_*` 环境变量 → Loader Config → 上游 `~/.config/ponytail/config.json` → 插件默认值。环境变量在每次读取时覆盖其他层；四个可编辑偏好属于导出的 `Config` volatile 字段，表单写入由 `ctx.settings` 校验并持久化到当前 profile。`ctx.settings.configure({ auto: false }, ctx.fiber)` 只关闭自动页面，不负责注册这些字段。

`hideStatus` 是保留给旧配置的兼容字段，不再控制浏览器 UI；`quietStartup` 默认隐藏浏览器启动提示，也可由环境变量或配置文件显式关闭。两者不改变模式、命令、skill 或系统提示。

## 上游边界

技能目录来自固定的 Ponytail `4.9.0` commit，并在包内发布；同步脚本只接受本地 checkout，运行时不访问网络。Claude/Codex 专属安装标志、statusline、卸载脚本和 Ponytail MCP 没有在 DSH 内重做：对应能力由 DSH 的配置表单、Commands、session log、projection、dynamic system prompt、Skill Registry 和浏览器 slot 提供。

更新上游时先运行 `PONYTAIL_SOURCE=/path/to/ponytail node scripts/sync-upstream.mjs`，审查六个 `SKILL.md` 的 hash 和行为测试，再提交版本更新。

## 兼容性边界

`package.json` 仅声明 `0.1.7-alpha.2` 为兼容目标；DSH 开发依赖固定该版本，Cordis peer 要求 `>=4.0.4 <5.0.0`。不从工作区 `deepseek-harness` checkout 解析依赖。仓库名、发行包名与插件品牌统一为 `dsh-ponytail`，`cordis.patch.yml` 挂载该发行包。用户 profile 负责组合顺序；插件通过官方 npm 包的 Loader、客户端模块系统和 CLI/Web 启动路径独立加载。
