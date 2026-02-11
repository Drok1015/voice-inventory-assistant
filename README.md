# 语音家庭助手

基于 UniApp + DeepSeek 的家庭库存管理 MVP，支持文字输入智能解析、手动添加、编辑、删除。

## 功能

- **AI 解析**：输入自然语言（如「今天买了两瓶水帮我记录一下」），DeepSeek 大模型解析为结构化数据并入库
- **手动添加**：支持表单手动添加物品
- **库存列表**：按保质期排序，支持按分类筛选
- **编辑 / 删除**：完整的 CRUD 操作
- **本地存储**：数据存储在本地，无需后端

## 技术栈

- UniApp (Vue 3 + Composition API)
- DeepSeek API（OpenAI 兼容格式，直接 fetch 调用）
- uni.storage 本地存储

## 快速开始

### 1. 安装依赖

```bash
pnpm install
```

### 2. 配置 DeepSeek API Key

复制 `.env.example` 为 `.env`，填入你的 DeepSeek API Key：

```bash
cp .env.example .env
# 编辑 .env，设置 VITE_DEEPSEEK_API_KEY=sk-xxx
```

API Key 可在 [DeepSeek 控制台](https://platform.deepseek.com) 获取。

### 3. 启动开发

```bash
# H5 模式（浏览器调试）
pnpm run dev:h5

# 微信小程序
pnpm run dev:mp-weixin

# 其他平台见 package.json scripts
```

### 4. 打包

```bash
# H5 打包
pnpm run build:h5

# Android APK 需使用 HBuilderX 或云打包
```

## 项目结构

```
src/
├── composables/
│   ├── useInventory.js   # 库存 CRUD、本地存储
│   └── useLLMParse.js    # DeepSeek API 解析
├── config/
│   └── deepseek.js       # API 配置
├── pages/
│   ├── index/            # 首页：输入、列表
│   ├── add/              # 手动添加
│   └── edit/             # 编辑物品
└── ...
```

## 注意事项

1. **API Key 暴露**：MVP 阶段 API Key 写在前端，会随 APK 暴露。正式版建议使用后端代理。
2. **跨域**：H5 调用 DeepSeek 需确认 CORS 支持。
3. **数据仅本地**：无云端备份，换机或卸载会丢失数据。
