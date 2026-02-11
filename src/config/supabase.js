import { withPageLoading } from '@/utils/loading'

/**
 * Supabase REST API 配置（小程序通过 uni.request 直接调用 PostgREST）
 */
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || ''
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

export const supabaseConfig = {
  url: SUPABASE_URL,
  key: SUPABASE_ANON_KEY,
  /** 是否已配置（URL 和 Key 都不为空） */
  enabled: !!(SUPABASE_URL && SUPABASE_ANON_KEY),
}

/**
 * 封装 Supabase REST 请求（PostgREST 风格），请求期间显示页面 loading
 * @param {string} path - 路径，如 /rest/v1/inventory
 * @param {object} options - { method, data, header }
 * @returns {Promise<{ data: any, error: any }>}
 */
export const supabaseRequest = (path, options = {}) => {
  const { method = 'GET', data, header = {} } = options

  const promise = new Promise((resolve) => {
    uni.request({
      url: `${SUPABASE_URL}${path}`,
      method,
      header: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        ...header,
      },
      data,
      success: (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ data: res.data, error: null })
        } else {
          console.error('[supabase] request error:', res.statusCode, res.data)
          resolve({
            data: null,
            error: {
              status: res.statusCode,
              message: res.data?.message || `HTTP ${res.statusCode}`,
            },
          })
        }
      },
      fail: (err) => {
        console.error('[supabase] network error:', err)
        resolve({ data: null, error: { message: err.errMsg || '网络请求失败' } })
      },
    })
  })
  return withPageLoading(promise)
}
