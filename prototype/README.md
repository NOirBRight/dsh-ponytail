# Ponytail 设置页原型（一次性）

这是用于比较 Ponytail 设置页布局的 throwaway prototype，不是生产代码。设计问题是：移除 composer 内控件后，如何让 Ponytail 设置在桌面版和移动版都清晰、可操作。

三个变体位于同一路由，通过 `?variant=a|b|c` 切换；底部的原型切换条也支持 `←` / `→`。页面右上角的 `Mobile preview` 会写入 `?viewport=mobile`，用于检查窄屏布局。所有表单状态只存在内存中，不会写入 DSH 配置。

## 启动

在插件根目录运行：

```sh
pnpm prototype:settings
```

然后打开 <http://127.0.0.1:4178/?variant=a>。

## 变体

- `a` Focus sheet：单列设置表，信息密度低，适合快速扫描。
- `b` Navigator：左侧分区导航，适合设置项继续增长的情况。
- `c` Guided setup：三步引导清单，优先解释行为，再展示高级范围。
