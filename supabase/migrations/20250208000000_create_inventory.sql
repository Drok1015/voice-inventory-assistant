-- 创建库存表
CREATE TABLE IF NOT EXISTS public.inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit TEXT NOT NULL DEFAULT '个',
  price NUMERIC(10, 2),
  expiry_date DATE,
  category TEXT NOT NULL DEFAULT '其他',
  remark TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 开启 RLS（行级安全）
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;

-- 允许匿名读取和写入（开发/测试用，生产环境建议配置更严格策略）
CREATE POLICY "Allow public read" ON public.inventory FOR SELECT USING (true);
CREATE POLICY "Allow public insert" ON public.inventory FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update" ON public.inventory FOR UPDATE USING (true);
CREATE POLICY "Allow public delete" ON public.inventory FOR DELETE USING (true);

-- 插入测试数据
INSERT INTO public.inventory (name, quantity, unit, price, expiry_date, category, remark) VALUES
  ('矿泉水', 2, '瓶', 3.50, '2025-03-15', '饮料', '常温保存'),
  ('牛奶', 1, '盒', 8.00, '2025-02-20', '食品', '冷藏'),
  ('抽纸', 3, '包', 12.00, NULL, '日用品', '家用'),
  ('苹果', 5, '个', 15.00, '2025-02-12', '食品', '新鲜'),
  ('洗发水', 1, '瓶', 45.00, NULL, '日用品', '');
