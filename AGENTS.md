# AGENTS.md

## 目的

本文件用于规范本项目中 Agent 的工作流程，保证后续分析、开发、验证、交付方式一致。

当前项目范围：

- 基于 Tripo3D 的文本生成 3D 模型
- 基于 Tripo3D 的图片生成 3D 模型
- 本地 3D 模型网页预览

## 项目概况

### 技术栈

- 后端：原生 Node.js HTTP Server
- 前端：静态 HTML、CSS、JavaScript
- 3D 预览：本地 Three.js 运行时
- 第三方平台：Tripo3D OpenAPI

### 关键文件

- `server.js`
  - 负责静态资源分发
  - 负责 Tripo3D API 代理
- `public/index.html`
  - 主生成页
- `public/app.js`
  - 主生成页逻辑
- `public/styles.css`
  - 主生成页样式
- `public/model-preview.html`
  - 本地 3D 预览页
- `public/model-preview.js`
  - 本地 3D 预览逻辑
- `public/model-preview.css`
  - 本地 3D 预览样式
- `public/vendor/three`
  - 本地 Three.js 与加载器依赖
- `.env.local`
  - 本地环境变量

## 基本原则

### 默认工作方式

- 先阅读本地上下文，再开始改代码
- 优先做最小必要修改
- 默认直接落地实现，不只停留在建议层面
- 保持现有页面、路由、接口稳定
- 除非能明显解决根因，否则不要扩大改动范围

### 需要先确认用户的情况

以下情况要先和用户确认：

- 引入新框架、新打包工具或数据库
- 修改现有 API 返回结构，可能影响兼容
- 删除现有页面、路由或主要功能
- 暴露新的敏感配置或密钥使用方式

## 安全要求

- Tripo3D API Key 只能放在后端环境变量中
- 禁止把真实密钥写进前端代码
- 禁止把真实密钥写进示例、文档、页面文案
- 如果用户曾泄露真实密钥，应提醒轮换
- 优先通过后端代理调用第三方接口，不直接在浏览器调用密钥接口

## 代码修改规范

### 后端

- 保持 `server.js` 简单、可直接运行
- 除非用户明确要求，不迁移到 Express、Next.js、Vite 等新架构
- 静态资源 MIME 类型要完整，尤其注意：
  - `.js`
  - `.json`
  - `.wasm`
- 能兼容时尽量向后兼容
- Tripo 响应要兼容 `data.xxx` 这种嵌套结构

### 前端

- 简单页面优先使用原生 JavaScript
- 页面必须有明确状态提示和错误提示
- 不允许“静默失败”
- 同一页面的语言和交互风格要一致

### 3D 预览页

- 优先使用本地 Three.js 资源，不默认依赖外部 CDN
- `GLTF/GLB` 需要考虑压缩模型支持
- `Meshopt` 和 `Draco` 支持不能被破坏
- 需要兼容多文件模型场景：
  - `.gltf + .bin + 贴图`
  - `.obj + .mtl + 贴图`
- 加载失败时要把原因反馈给用户

## Tripo3D 接入规则

### 文本生成

- 使用 `POST /v2/openapi/task`
- 至少保证 `type`、`model_version`、`prompt` 正确
- 不要默认附加高风险可选参数

### 图片生成

- 先上传图片，再创建任务
- 必须正确读取上传返回值中的 `image_token`
- 如果上传成功但没有 `image_token`，要立即返回明确错误

### 任务查询

- 兼容 `data.task_id` 这类嵌套结构
- 轮询时处理最终状态：
  - `success`
  - `failed`
  - `banned`
  - `expired`
  - `cancelled`
  - `unknown`

## 标准工作流程

大多数任务按以下顺序执行：

1. 先判断改动落点
   - 主生成页
   - 本地预览页
   - 后端 API
   - 文档或规范

2. 只阅读和当前任务直接相关的文件

3. 明确最小安全改动范围

4. 实施修改，避免破坏现有流程

5. 做本地验证

6. 向用户反馈：
   - 改了什么
   - 验证了什么
   - 还有什么未验证

## 验证清单

### 后端改动后

- 运行 `node --check server.js`
- 按需验证关键路由：
  - `http://localhost:3000/`
  - `http://localhost:3000/model-preview.html`
  - `http://localhost:3000/api/config`

### 主生成页改动后

- 表单提交不应出现明显 JavaScript 报错
- 状态、进度、结果区域仍能正常更新
- 错误提示可被用户理解

### 本地预览页改动后

- 页面能正常打开
- 关键静态资源返回 `200`
- Three.js 依赖链没有缺失
- 至少验证这些资源在需要时可访问：
  - `/model-preview.html`
  - `/model-preview.js`
  - `/vendor/three/build/three.module.js`
  - `/vendor/three/build/three.core.js`
  - Draco 和 Meshopt 相关资源

## 禁止事项

- 不要把真实 API Key 暴露到前端
- 不要无理由更换项目技术栈
- 不要在没有验证的情况下声称“已经完全可用”
- 不要吞掉错误然后让页面空白
- 不要为了修一个小问题重构整个项目
- 不要随意删除 `public/vendor/three` 下的本地依赖

## 交付要求

完成任务后，输出至少包含：

- 改动摘要
- 关键文件路径
- 已完成验证
- 剩余风险或未验证项

如果被阻塞，也要明确说明：

- 卡在哪里
- 已排除哪些原因
- 下一步最合理的处理方式
