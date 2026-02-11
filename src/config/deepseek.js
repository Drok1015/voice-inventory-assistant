/**
 * DeepSeek API 配置
 * 在项目中创建 .env 文件，添加 VITE_DEEPSEEK_API_KEY=sk-xxx
 * 或直接在此处设置（MVP 阶段，注意 API Key 会暴露在前端）
 */
export const DEEPSEEK_CONFIG = {
  baseURL: 'https://api.deepseek.com',
  apiKey: import.meta.env?.VITE_DEEPSEEK_API_KEY || '',
  model: 'deepseek-chat',
}
