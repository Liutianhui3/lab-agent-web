# ChatComposer

通用 Vue 3 消息输入组件。组件只管理输入交互，不发送请求、不清空消息、不持久化状态，也不依赖路由或用户信息。

依赖：Vue 3.5+、lucide-vue-next。复制 ChatComposer.vue 到其他 Vue 项目并安装这两个依赖即可；样式为 scoped CSS，不依赖 Tailwind、项目别名或全局样式重置。

## 示例

```vue
<script setup>
  import { ref } from 'vue'
  import ChatComposer from './ChatComposer.vue'

  const text = ref('')
  const thinking = ref(false)
  const expanded = ref(false)
  const busy = ref(false)
  const composer = ref()

  async function send(content) {
    busy.value = true
    try {
      // 在此调用业务接口，thinking.value 为思考开关状态。
      console.log(content, thinking.value)
      text.value = ''
    } finally {
      busy.value = false
      composer.value?.focus()
    }
  }
</script>

<template>
  <ChatComposer
    ref="composer"
    v-model="text"
    v-model:thinking="thinking"
    v-model:expanded="expanded"
    placeholder="输入消息"
    :busy="busy"
    @send="send"
    @stop="busy = false"
  />
</template>
```

## 接口

| 属性 | 默认值 | 说明 |
| --- | --- | --- |
| v-model | 空字符串 | 消息文本 |
| v-model:thinking | false | 思考开关 |
| v-model:expanded | false | 展开状态 |
| placeholder | 输入消息 | 输入提示 |
| ariaLabel | 消息输入框 | 输入框无障碍名称 |
| disabled | false | 禁用输入和发送 |
| busy | false | 显示停止按钮，阻止重复发送 |
| showThinking | true | 是否显示思考开关；隐藏时释放其占位 |
| maxLength | 20000 | 超出时禁止发送；0 表示不限 |
| availableHeight | 0 | 展开高度的可用空间，单位 px；0 时使用视口高度 |

事件：send(content)、stop。组件不直接调用接口。停止按钮发出 stop，父组件负责中止实际请求。

公开方法：focus(options)，默认防止聚焦时页面跳动。

Enter 发送，Shift+Enter 换行；中文输入法确认不触发发送；Escape 收起展开输入框。实例的提示 ID 独立，可同时放置多个组件。

## 主题

在组件根节点或其父容器定义以下 CSS 变量；无需依赖项目内的 dark 类。明暗切换由使用方控制。

- --composer-background：输入框底色
- --composer-border：边框
- --composer-accent：强调色
- --composer-text：文字
- --composer-surface：基础底色
- --composer-muted：提示文字
- --composer-hover：悬停底色
- --composer-scrollbar：滚动条颜色

组件默认使用浅色紫色主题，并遵循 prefers-reduced-motion。示例中的 stop 仅演示事件绑定，实际项目应调用 AbortController 等中止业务请求。
