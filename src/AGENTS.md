# AGENTS.md — Vue 3 前端工程规范（JavaScript）

## 1. 技术栈与核心原则

- 框架：Vue 3（严格使用 `<script setup>`）+ JavaScript（ES Modules），统一使用 Options API 以外的组合式写法；注意参数校验与边界判空，避免因缺少类型检查导致运行时报错。
- 样式：优先使用项目既定样式方案（Tailwind CSS / UnoCSS / CSS 变量 / Scoped CSS），避免无意义的全局样式污染与 `!important` 滥用。
- 工程化优先级：**高内聚、低耦合、可维护**。优先复用现有工具与组件，不重复造轮子；修改已有模块时保持风格一致，不顺手无关重构。

## 2. 目录结构与模块归属

采用“**全局共享 + 页面/功能模块就近拆分**”的目录约定（具体以实际仓库目录为准，新建模块遵循同构原则）：

```text
src/
├── api/            # 接口请求封装（按业务域拆分 .js）
├── assets/         # 静态资源（图片、图标、全局样式/主题变量）
├── components/     # 全局跨页面复用的通用 UI 组件
├── composables/    # 全局跨页面复用的组合式函数（命名统一为 useXxx.js）
├── layouts/        # 页面布局容器
├── pages/          # 页面/路由模块（支持按功能进一步就近拆分）
│   └── <feature>/  # 例如 home/、dashboard/、detail/
│       ├── index.vue        # 页面入口：负责布局编排、状态串联、子组件组装
│       ├── components/      # 仅当前页面/模块使用的局部子组件
│       ├── composables/     # 仅当前页面/模块使用的状态与交互逻辑
│       └── utils/           # 仅当前页面/模块使用的纯函数与数据转换
├── router/         # 路由配置与路由守卫
├── stores/         # 全局状态管理（如 Pinia，按领域拆分 .js）
└── utils/          # 全局纯函数工具（格式化、校验、存储、通用计算等 .js）
```
