# Supabase 配置说明

## 1. 创建数据库表

在 Supabase 控制台执行以下步骤：

1. 打开 [Supabase Dashboard](https://supabase.com/dashboard)
2. 选择你的项目
3. 进入 **SQL Editor**
4. 新建查询，复制粘贴 `migrations/20250208000000_create_inventory.sql` 的完整内容
5. 点击 **Run** 执行

执行成功后，将创建 `inventory` 表并插入 5 条测试数据。

## 2. API Key 说明

如果使用提供的 Publishable Key 无法连接，请改用 **anon key**：

1. 在 Supabase Dashboard 进入 **Project Settings** → **API**
2. 复制 **Project API keys** 下的 `anon` `public` 密钥（通常以 `eyJ` 开头）
3. 在项目根目录 `.env` 中更新 `VITE_SUPABASE_ANON_KEY`
