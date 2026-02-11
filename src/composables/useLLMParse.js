import { DEEPSEEK_CONFIG } from '../config/deepseek'

/** 获取今天的日期字符串 YYYY-MM-DD */
const getTodayStr = () => {
  const today = new Date()
  const yyyy = today.getFullYear()
  const mm = String(today.getMonth() + 1).padStart(2, '0')
  const dd = String(today.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

/** 动态生成提示词，注入当前日期 */
const buildParsePrompt = () => {
  const dateStr = getTodayStr()

  return `你是一个生活用品库存解析助手。用户会用自然语言描述购买的物品，你需要解析为结构化 JSON。

当前日期：${dateStr}

规则：
1. 只返回 JSON，不要返回其他文字
2. 字段说明：name(物品名), quantity(数量，默认1), unit(单位，如瓶/袋/包/个), price(价格，无则null), expiryDate(保质期YYYY-MM-DD，无则null), purchaseDate(购买日期YYYY-MM-DD，默认今天${dateStr}), storageLocation(储存位置), category(分类，如饮料/食品/日用品), remark(备注，无则空字符串)
3. 若用户未明确数量，quantity 为 1
4. 若无法解析某字段，使用 null 或空字符串
5. 当用户提到相对日期（如"三天后过期""后天到期""保质期一个月"），请基于当前日期 ${dateStr} 计算出具体的 YYYY-MM-DD 日期
6. purchaseDate 若用户未提及购买日期，默认为今天 ${dateStr}
7. storageLocation 储存位置默认规则：食品/饮料/生鲜/零食/日用品→客厅，调味品/厨具→厨房，清洁用品→卫生间，其他→客厅`
}

/**
 * 从用户文本解析为库存物品对象（使用 uni.request 调用 DeepSeek API，兼容小程序）
 * @param {string} userText - 用户输入，如 "今天买了两瓶水帮我记录一下"
 * @returns {Promise<object|null>} 解析后的物品对象，失败返回 null
 */
export const parseUserTextToItem = async (userText) => {
  if (!userText?.trim()) return null

  const apiKey = DEEPSEEK_CONFIG.apiKey
  if (!apiKey) {
    console.error('未配置 VITE_DEEPSEEK_API_KEY，请在 .env 中设置')
    return null
  }

  try {
    const res = await new Promise((resolve, reject) => {
      uni.request({
        url: `${DEEPSEEK_CONFIG.baseURL}/v1/chat/completions`,
        method: 'POST',
        header: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        data: {
          model: DEEPSEEK_CONFIG.model,
          messages: [
            { role: 'system', content: buildParsePrompt() },
            { role: 'user', content: `用户说："${userText.trim()}"` },
          ],
          temperature: 0.1,
        },
        success: (resp) => {
          if (resp.statusCode >= 200 && resp.statusCode < 300) {
            resolve(resp)
          } else {
            console.error('DeepSeek API 错误:', resp.statusCode, resp.data)
            reject(new Error(`HTTP ${resp.statusCode}`))
          }
        },
        fail: reject,
      })
    })

    const data = res.data
    const content = data?.choices?.[0]?.message?.content || ''
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return null

    const parsed = JSON.parse(jsonMatch[0])
    return {
      name: parsed.name || '未命名',
      quantity: parsed.quantity ?? 1,
      unit: parsed.unit || '个',
      price: parsed.price ?? null,
      expiryDate: parsed.expiryDate ?? null,
      purchaseDate: parsed.purchaseDate ?? getTodayStr(),
      storageLocation: parsed.storageLocation || '客厅',
      category: parsed.category || '其他',
      remark: parsed.remark || '',
    }
  } catch (err) {
    console.error('解析失败:', err)
    return null
  }
}
