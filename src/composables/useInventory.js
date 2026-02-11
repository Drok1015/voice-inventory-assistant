import { ref, computed } from 'vue'
import { supabaseConfig, supabaseRequest } from '@/config/supabase'

const TABLE = '/rest/v1/inventory'

/** 数据库行 -> 前端格式 */
const rowToItem = (row) => ({
  id: row.id,
  name: row.name,
  quantity: row.quantity ?? 1,
  unit: row.unit || '个',
  price: row.price != null ? Number(row.price) : null,
  expiryDate: row.expiry_date ?? null,
  purchaseDate: row.purchase_date ?? null,
  storageLocation: row.storage_location || '客厅',
  category: row.category || '其他',
  remark: row.remark ?? '',
  createdAt: row.created_at ?? new Date().toISOString(),
})

/** 前端格式 -> 数据库行 */
const itemToRow = (item) => ({
  name: item.name || '未命名',
  quantity: item.quantity ?? 1,
  unit: item.unit || '个',
  price: item.price != null ? Number(item.price) : null,
  expiry_date: item.expiryDate?.trim() || null,
  purchase_date: item.purchaseDate?.trim() || null,
  storage_location: item.storageLocation || '客厅',
  category: item.category || '其他',
  remark: item.remark ?? '',
})

const items = ref([])
const isLoading = ref(false)

/** 从 Supabase 加载数据 */
const fetchItems = async () => {
  if (!supabaseConfig.enabled) {
    console.warn('[useInventory] Supabase 未配置，请检查 .env')
    return
  }

  isLoading.value = true
  try {
    const { data, error } = await supabaseRequest(`${TABLE}?order=created_at.desc`)
    if (error) throw error
    items.value = (data || []).map(rowToItem)
  } catch (err) {
    console.error('[useInventory] 加载失败:', err)
  } finally {
    isLoading.value = false
  }
}

// 初始化时加载
fetchItems()

export const useInventory = () => {
  const sortedItems = computed(() =>
    [...items.value].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
  )

  const addItem = async (item) => {
    const payload = itemToRow(item)
    const { data, error } = await supabaseRequest(TABLE, {
      method: 'POST',
      data: payload,
      header: {
        Prefer: 'return=representation',
      },
    })
    if (error) throw error
    // PostgREST 返回数组
    const row = Array.isArray(data) ? data[0] : data
    const newItem = rowToItem(row)
    items.value = [newItem, ...items.value]
    return newItem
  }

  const updateItem = async (id, updates) => {
    const index = items.value.findIndex((i) => i.id === id)
    if (index === -1) return false

    const row = itemToRow(updates)
    const { data, error } = await supabaseRequest(`${TABLE}?id=eq.${id}`, {
      method: 'PATCH',
      data: row,
      header: {
        Prefer: 'return=representation',
      },
    })
    if (error) throw error
    const updated = Array.isArray(data) ? data[0] : data
    items.value[index] = rowToItem(updated)
    return true
  }

  const deleteItem = async (id) => {
    const { error } = await supabaseRequest(`${TABLE}?id=eq.${id}`, { method: 'DELETE' })
    if (error) throw error
    items.value = items.value.filter((i) => i.id !== id)
  }

  const getCategories = computed(() => {
    const set = new Set(items.value.map((i) => i.category).filter(Boolean))
    return Array.from(set).sort()
  })

  return {
    items,
    sortedItems,
    isLoading,
    fetchItems,
    addItem,
    updateItem,
    deleteItem,
    getCategories,
  }
}
