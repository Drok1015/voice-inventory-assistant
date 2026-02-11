import { ref } from 'vue'
import { supabaseConfig, supabaseRequest } from '@/config/supabase'

// 新表：场景标签配置
// 建议 Supabase 表结构：
// table: scene_labels
// columns:
// - id: bigint, primary key
// - label_key: text, unique  （用来存场景标签的唯一 key，例如标签文案）
// - scene_data: jsonb       （保存该标签页的配置，如选中的物品与区域分布）
// - created_at: timestamptz, default now()

const TABLE = '/rest/v1/scene_labels'

const isSaving = ref(false)
const isLoading = ref(false)

export const useSceneLabel = () => {
  /**
   * 加载某个标签的场景配置
   * @param {string} labelKey - 唯一 key，一般直接用标签名称
   * @returns {Promise<null | { selectedItemIds: (string|number)[], zoneMap: Record<string, number> }>}
   */
  const loadSceneLabel = async (labelKey) => {
    if (!supabaseConfig.enabled) {
      console.warn('[useSceneLabel] Supabase 未配置')
      return null
    }
    if (!labelKey) return null

    isLoading.value = true
    try {
      const { data, error } = await supabaseRequest(
        `${TABLE}?label_key=eq.${encodeURIComponent(labelKey)}&limit=1`,
      )
      if (error) throw error
      if (Array.isArray(data) && data.length > 0) {
        return data[0].scene_data || null
      }
      return null
    } catch (err) {
      console.error('[useSceneLabel] 加载失败:', err)
      return null
    } finally {
      isLoading.value = false
    }
  }

  /**
   * 保存某个标签的场景配置（有则更新，无则插入）
   * @param {string} labelKey
   * @param {{ selectedItemIds: (string|number)[], zoneMap: Record<string, number> }} sceneData
   */
  const saveSceneLabel = async (labelKey, sceneData) => {
    if (!supabaseConfig.enabled) {
      console.warn('[useSceneLabel] Supabase 未配置')
      return false
    }
    if (!labelKey) return false

    isSaving.value = true
    try {
      // 先查是否存在
      const { data: existRows, error: queryError } = await supabaseRequest(
        `${TABLE}?label_key=eq.${encodeURIComponent(labelKey)}&limit=1`,
      )
      if (queryError) throw queryError

      const payload = {
        label_key: labelKey,
        scene_data: sceneData || {},
      }

      if (Array.isArray(existRows) && existRows.length > 0) {
        const id = existRows[0].id
        const { error: updateError } = await supabaseRequest(
          `${TABLE}?id=eq.${id}`,
          {
            method: 'PATCH',
            data: payload,
            header: {
              Prefer: 'return=representation',
            },
          },
        )
        if (updateError) throw updateError
      } else {
        const { error: insertError } = await supabaseRequest(TABLE, {
          method: 'POST',
          data: payload,
          header: {
            Prefer: 'return=representation',
          },
        })
        if (insertError) throw insertError
      }

      return true
    } catch (err) {
      console.error('[useSceneLabel] 保存失败:', err)
      return false
    } finally {
      isSaving.value = false
    }
  }

  return {
    isSaving,
    isLoading,
    loadSceneLabel,
    saveSceneLabel,
  }
}

