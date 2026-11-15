# Lab Agent Web

Lab Agent 实验室预约系统的 Web 前端，基于 Vue 3 和 Vite 构建。目前主要完成账号认证、个人资料及安全设置页面，业务管理模块仍在开发中。后端服务需单独运行，本目录不包含后端实现。

## 功能状态

| 模块         | 路径            | 当前状态                                       |
| ------------ | --------------- | ---------------------------------------------- |
| 登录         | `/login`        | 用户名与密码登录、表单校验、登录状态保存       |
| 注册         | `/register`     | 用户名、邮箱和密码校验，注册成功后手动返回登录 |
| 个人资料     | `/profile`      | 获取及修改资料、头像上传、重置未保存修改       |
| 安全与访问   | `/security`     | 校验当前密码与新密码，提交密码修改             |
| 首页工作台   | `/home`         | 已注册路由，页面为空                           |
| AI 智能助手  | `/assistant`    | 已注册路由，页面为空                           |
| 实验室管理   | `/laboratories` | 已注册路由，页面为空                           |
| 设备列表管理 | `/equipment`    | 已注册路由，页面为空                           |
| 预约审核     | `/reviews`      | 已注册路由，页面为空                           |
| 用户管理     | `/users`        | 已注册路由，页面为空                           |

公共能力包括响应式布局、浅色/深色/跟随系统主题、登录路由守卫和账户菜单。账户菜单中的机时账户余额为静态示例数据；当前登出操作清理本地登录状态，不调用后端登出接口。

## 技术栈

- Vue 3、Vue Router、Pinia
- Vite、JavaScript ES Modules，`@` 别名指向 `src/`
- Tailwind CSS 4、Less
- Axios：统一请求、Bearer Token、响应处理和可选缓存
- GSAP、Lucide Vue、NProgress：动效、图标和路由进度提示

## 本地开发

### 环境要求

- Node.js：`^22.18.0 || >=24.12.0`（与 `package.json` 一致）
- npm
- 可访问的 Lab Agent 后端，默认地址为 `http://127.0.0.1:8000`

### 安装与启动

在项目根目录执行：

```sh
npm ci
npm run dev
```

默认访问地址：<http://localhost:3800>。开发服务器监听 `0.0.0.0`，不会自动打开浏览器；端口被占用时以终端实际输出为准。

后端不可用时仍可查看登录、注册页面，但账号认证、资料读取和保存等接口操作无法完成。登录成功后跳转 `/home`，该页面目前为空，可通过账户菜单进入个人资料或安全设置。

### 环境变量与代理

当前 `.env.development` 设置为：

```dotenv
VITE_API_BASE_URL=http://127.0.0.1:8000
```

如需覆盖开发配置，可在根目录创建 `.env.development.local`，修改后重启开发服务器。

| 变量                | 用途                                   | 未设置时         |
| ------------------- | -------------------------------------- | ---------------- |
| `VITE_API_BASE_URL` | API 基础地址，同时用于解析相对头像地址 | 使用当前站点源   |
| `VITE_PUBLIC_PATH`  | Vue Router 的 history 基础路径         | 使用默认基础路径 |

`vite.config.js` 将 `/api`、`/uploads`、`/updates` 代理到 `http://127.0.0.1:8000`。当前 API 基础地址为绝对 URL，请求直接访问后端，需要后端允许前端来源的跨域请求。

若希望开发时通过 Vite 代理访问后端，可在 `.env.development.local` 中设置：

```dotenv
VITE_API_BASE_URL=
```

这样请求会发送到前端同源地址并经代理转发。更换后端地址时，还需按实际情况修改 `vite.config.js` 的代理目标。开发代理不会随生产构建发布。

`VITE_PUBLIC_PATH` 仅用于路由；若部署到子目录，还需配置 Vite 的 `base`，使静态资源路径与路由基础路径一致。

## 后端接口约定

接口定义位于 `src/api/`，统一请求封装位于 `src/utils/request.js`，请求超时为 60 秒。

| 方法 | 路径                    | 用途                                                       |
| ---- | ----------------------- | ---------------------------------------------------------- |
| POST | `/api/v1/auth/register` | 注册，字段为 `username`、`email`、`password`               |
| POST | `/api/v1/auth/login`    | 登录，字段为 `username`、`password`                        |
| POST | `/api/v1/auth/logout`   | 已封装，当前账户菜单未调用                                 |
| GET  | `/api/v1/user/info`     | 获取当前用户资料                                           |
| POST | `/api/v1/user/update`   | 更新 `name`、`username`、`email`、`phone`、`avatar`        |
| POST | `/api/v1/user/password` | 修改密码，字段为 `old_password`、`new_password`            |
| POST | `/api/v1/files/upload`  | 上传头像，使用 FormData，字段为 `file` 和 `purpose=avatar` |

普通 JSON 响应满足 `code === 200`、`code === 0` 或 `msg === 'success'` 中任一条件即视为成功，业务数据从 `data` 读取。登录响应示例：

```json
{
  "code": 200,
  "data": {
    "accessToken": "your-access-token",
    "user": {
      "id": 1,
      "username": "student"
    }
  }
}
```

登录页要求 `data.accessToken` 为非空字符串且 `data.user.id` 有效。资料更新响应需返回含 `id` 的用户对象；头像上传响应需包含 `data.url`。

登录令牌和用户信息分别保存在 localStorage 的 `Access-Token`、`User-Info` 中。请求自动携带 `Authorization: Bearer <token>`；已有令牌时收到 HTTP 或业务状态码 401，会清理登录状态并跳转。前端路由守卫仅检查是否存在非空令牌，目前未按学生/管理员角色划分页面访问权限，接口授权应由后端执行。

注册和修改密码要求 8–20 位，包含大写字母、小写字母和数字，可使用英文符号，不允许空白或中文。头像仅接受 JPG/PNG，大小不超过 5 MB；上传后还需保存资料才能提交头像地址。

## 常用命令

| 命令              | 说明                                    |
| ----------------- | --------------------------------------- |
| `npm run dev`     | 启动开发服务器                          |
| `npm run build`   | 构建生产资源，输出至 `dist/`            |
| `npm run preview` | 本地预览生产构建，需先执行 build        |
| `npm run format`  | 使用 Prettier 格式化 `src/`，会修改源码 |

目前未配置独立的测试或 lint 脚本。

## 项目结构

```text
src/
├── api/                  # 认证、用户、文件上传及登录失效处理
├── assets/               # 图片、Tailwind 入口与全局 Less 样式
├── components/           # 公共组件
├── composables/          # 主题、用户信息等组合式逻辑
├── layout/               # 登录后的布局、导航与账户菜单
├── router/               # 公共路由、动态业务路由与登录守卫
├── stores/               # Pinia store（当前包含计数器示例）
├── utils/                # 请求、缓存、本地存储、密码与头像工具
├── views/                # 登录、注册、账户设置及业务占位页面
├── App.vue               # 根组件
└── main.js               # 应用入口
public/                   # 不经打包处理的静态资源
vite.config.js            # 开发代理、路径别名与构建配置
```

## 生产部署

1. 根据部署环境设置 `.env.production`，例如同源反向代理场景使用 `VITE_API_BASE_URL=`。环境变量在构建时注入，修改后需重新构建。
2. 执行 `npm run build`，将 `dist/` 部署到静态服务器。
3. 使用同源后端时，由服务器反向代理 `/api`、`/uploads` 及实际需要的 `/updates`；使用独立 API 域名时配置对应的跨域许可。
4. 路由使用 HTML5 history 模式，静态服务器需将前端页面路径回退到 `index.html`，避免直接访问或刷新 `/profile` 等路径时返回 404。API 和静态文件请求应单独处理。

`npm run preview` 用于本地检查构建产物，不作为生产服务。
