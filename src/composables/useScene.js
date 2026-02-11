import { ref } from 'vue'
import { supabaseConfig, supabaseRequest } from '@/config/supabase'

const TABLE = '/rest/v1/scene_drawings'

const drawingId = ref(null)
const isLoading = ref(false)

export const useScene = () => {
  /** 从 Supabase 加载绘图数据（取最新一条） */
  const loadDrawing = async () => {
    if (!supabaseConfig.enabled) {
      console.warn('[useScene] Supabase 未配置')
      return null
    }

    isLoading.value = true
    try {
      const { data, error } = await supabaseRequest(
        `${TABLE}?order=created_at.desc&limit=1`,
      )
      if (error) throw error
      if (data && data.length > 0) {
        drawingId.value = data[0].id
        return data[0].drawing_data
      }
      return null
    } catch (err) {
      console.error('[useScene] 加载失败:', err)
      return null
    } finally {
      isLoading.value = false
    }
  }

  /** 保存绘图数据到 Supabase（自动判断新增/更新） */
  const saveDrawing = async (drawingData) => {
    if (!supabaseConfig.enabled) {
      console.warn('[useScene] Supabase 未配置')
      return false
    }

    try {
      if (drawingId.value) {
        const { error } = await supabaseRequest(
          `${TABLE}?id=eq.${drawingId.value}`,
          {
            method: 'PATCH',
            data: { drawing_data: drawingData },
            header: { Prefer: 'return=representation' },
          },
        )
        if (error) throw error
      } else {
        const { data, error } = await supabaseRequest(TABLE, {
          method: 'POST',
          data: { drawing_data: drawingData },
          header: { Prefer: 'return=representation' },
        })
        if (error) throw error
        const row = Array.isArray(data) ? data[0] : data
        drawingId.value = row.id
      }
      return true
    } catch (err) {
      console.error('[useScene] 保存失败:', err)
      return false
    }
  }

  return {
    isLoading,
    loadDrawing,
    saveDrawing,
  }
}
