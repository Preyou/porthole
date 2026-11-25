# Icon Usage

业务层负责决定启用哪些 Iconify 图标集，并优先使用已注册图标集。

## 规则

- `lucide` 是默认可用图标集，所有 app 都可以使用。
- 业务端可以按需注册更多图标集，并通过对应前缀使用。
- app 自定义图标集统一使用 `app` 前缀；自定义 SVG 资源放在 `src/assets/icons`，文件名经 Iconify 清理后作为图标名。
- 新增业务图标时，优先使用已注册图标集的 `prefix--name` 形式，例如 `lucide--settings`。
- 使用 app 自定义图标时，优先通过 `@ngt/ui/icon` 的 `Icon` 加载，例如 `app--brand-mark`；其中第二段来自 `src/assets/icons/brand-mark.svg`。
- 自定义图标如果包含固定颜色、渐变或多色品牌资产，使用 `Icon` 的 `as-bg` 渲染以保留 SVG 原始颜色；单色语义图标使用默认 `currentColor` 方式，并通过 `text-*` 控制颜色。
- 允许使用 `icon-[prefix--name]` 形式，但只有在直接写 Tailwind 动态工具类更合适时使用。
- 页面、feature、route meta、菜单配置等业务层动态图标，优先使用 `@ngt/ui/icon` 的 `Icon`。
- 使用 `Icon` 时，`icon` prop 优先传入 `prefix--name`，默认推荐 `lucide--xxx`。
- 不新增 `@lucide/vue`、`lucide-vue-next` 等 Vue 图标组件 import。
- 不手写 SVG 图标，除非是产品专属资产且已确认不属于通用图标。
- `Icon` 和原生 Iconify `<i>` 以 `1em` 作为宽高，图标尺寸必须使用字体大小类 `text-*` 控制，例如 `text-base`、`text-xl`。
- 禁止对 `Icon` 或原生 Iconify `<i>` 使用 `size-*`、`w-*` 或 `h-*` 控制尺寸；Iconify 生成的 `width: 1em` 和 `height: 1em` 会覆盖这些宽高工具类。
- 图标颜色和状态继续使用主题 token 类，例如 `text-muted-foreground`。
- 不为截图还原复制截图中的图标风格、颜色或线宽；只映射语义相近的已注册图标。

## 示例

```vue
<Icon icon="lucide--settings" class="text-base text-muted-foreground" />
```

```vue
<Icon as-bg icon="app--brand-mark" class="text-2xl" aria-hidden="true" />
```

```css
@plugin "@iconify/tailwind4" {
  prefixes: app;
  icon-sets: from-folder(app, './src/assets/icons');
}
```

```ts
const route = {
  meta: {
    icon: 'lucide--layout-dashboard',
  },
}
```

## Checks

- 是否优先使用已注册图标集的 `prefix--name`。
- 默认场景是否优先使用 `lucide--xxx`。
- app 自定义图标是否统一使用 `app` 前缀，并从 `src/assets/icons` 注册。
- 多色或固定颜色的品牌图标是否使用 `Icon as-bg` 保留原始颜色。
- 是否避免新增 Vue 图标组件依赖或 import。
- 动态图标是否优先交给 `@ngt/ui` 的 `Icon`。
- `Icon` 或原生 Iconify `<i>` 是否只使用字体大小类 `text-*` 控制尺寸，并避免 `size-*`、`w-*` 和 `h-*`。
- 图标样式是否服从主题系统。
