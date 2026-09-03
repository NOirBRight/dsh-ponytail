# Changelog
## [0.2.4] - 2026-09-04

### Fixed

- Keep the dynamic system prompt as Ponytail's only automatic policy injection, even when another skill provider installed a global `ponytail` copy.
- Apply pending mode changes and natural-language deactivation before the affected request prompt is assembled.
- Correct the documented port 3082 acceptance profile to `~/.dsh-rc1-canary`.

## [0.2.3] - 2026-09-03

### Changed

- DSH compatibility declarations cover the verified Alpha.4 and rc.1 runtimes.
- Unknown runtimes warn once and use the normal best-effort mount path; only reproduced failures may be blocklisted.


## [0.2.2] - 2026-09-03

### Changed

- 包名由 `dsh-ponytail-skills` 改回 `dsh-ponytail`，与仓库名和插件品牌统一；分发仍只走 GitHub release（`dsh-ponytail` npm 名称被他人占用，不启用 npm 发布）。

## [0.2.0] - 2026-09-01

### Added

- 完整的 Host Ponytail 控制器：`off`、`lite`、`full`、`ultra` 模式、`/ponytail` 命令、自然语言停用、会话事件与投影。
- 子 Agent 模式继承、pending 切换、动态 system-prompt 策略和恢复会话支持。
- Web 与移动端共用的响应式 Plugins 设置卡；默认折叠，启动提示默认隐藏，设置卡不再复制 composer 控件或 matcher 配置。
- alpha.3 Loader、客户端 Loader、assembled transcript、打包和干净安装 smoke 检查。

### Changed

- 包升级为 `dsh-ponytail-skills@0.2.0`，仓库和插件品牌仍为 `dsh-ponytail`。
- Ponytail 技能从固定的 `@dietrichgebert/ponytail@4.9.0` 内容自动发现并注册，运行时不访问网络。

## [0.1.3] - 2026-08-17

### Fixed

- `cordis.patch.yml` 的 `name` 从旧名 `dsh-ponytail` 改为 `dsh-ponytail-skills`，与 `package.json` 一致；此前发布的 0.1.2 安装后会因加载器找不到包而崩溃。

## [0.1.1] - 2026-08-16

### Changed

- 新增完整英文 README（`README.en.md`），随 npm 包分发；中文 README 顶部加语言切换链接。
- README 增加徽章、快速上手和工作原理章节。

## [0.1.0] - 2026-08-16

首个发布版：把 DietrichGebert/ponytail 的 6 个技能移植到 DeepSeek Harness。

### Added

- 6 个标准 `SKILL.md` 技能：`ponytail`、`ponytail-review`、`ponytail-audit`、`ponytail-debt`、`ponytail-gain`、`ponytail-help`。
- Cordis bundle：`cordis.patch.yml` + `lib/index.js`。
- 验证脚本 `scripts/verify-provider.mjs`。

### Adapted

- 技能正文与上游保持一致；DSH 适配器通过本地 Skill Registry 提供发现和调用。

### License

MIT；技能内容 © DietrichGebert（[ponytail](https://github.com/DietrichGebert/ponytail)），DSH 适配 © gongyijie85。
