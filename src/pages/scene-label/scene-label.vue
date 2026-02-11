<template>
  <view class="page" @touchmove="handlePageTouchMove" @touchend="handlePageTouchEnd">
    <!-- 顶部标题 + 视图模式切换 + 加入场景按钮 -->
    <view class="label-header">
      <view class="label-header-row">
        <view class="mode-switch">
          <text
            class="mode-tab"
            :class="{ active: displayMode === 'list' }"
            @tap="displayMode = 'list'"
          >
            列表
          </text>
          <text
            class="mode-tab"
            :class="{ active: displayMode === 'tag' }"
            @tap="displayMode = 'tag'"
          >
            标签
          </text>
        </view>
        <view class="add-scene-btn" @tap="openPicker">
          <text class="add-scene-text">加入场景</text>
        </view>
      </view>
      <text v-if="sceneItems.length" class="label-sub">
        已为「{{ labelText }}」加入 {{ sceneItems.length }} 个物品
      </text>
    </view>

    <!-- 内容区域：两种展示模式 -->
    <view class="label-content">
      <view v-if="isLoading" class="empty">
        <text class="empty-text">加载中...</text>
      </view>
      <view v-else-if="!sceneItems.length" class="empty">
        <text class="empty-icon">📦</text>
        <text class="empty-text">暂未为「{{ labelText }}」加入任何物品</text>
        <text class="empty-hint">点击下方「加入场景」从已有物品中选择</text>
      </view>
      <view v-else>
        <!-- 列表模式 -->
        <view v-if="displayMode === 'list'" class="list">
          <view v-for="item in sceneItems" :key="item.id" class="item-card">
            <view class="item-main">
              <view class="item-top">
                <text class="item-name">{{ item.name }}</text>
                <text v-if="item.category" class="item-badge">{{ item.category }}</text>
              </view>
              <view class="item-detail">
                <text class="item-qty">{{ item.quantity }}{{ item.unit }}</text>
                <text v-if="item.price" class="item-price">￥{{ item.price }}</text>
                <text v-if="item.expiryDate" class="item-expiry">📅 {{ item.expiryDate }}</text>
              </view>
              <view class="item-meta">
                <text v-if="item.purchaseDate" class="item-meta-tag"
                  >🛒 {{ item.purchaseDate }}</text
                >
                <text v-if="item.storageLocation" class="item-meta-tag">
                  📍 {{ item.storageLocation }}
                </text>
              </view>
              <text v-if="item.remark" class="item-remark">{{ item.remark }}</text>
            </view>
          </view>
        </view>

        <!-- 标签模式：纵向多个区块，可在区块间拖动标签 -->
        <view v-else>
          <view class="tag-save-bar">
            <view class="tag-save-info">
              <text class="tag-save-text">拖动标签到不同区域完成布局</text>
            </view>
            <view class="tag-save-btn" @tap="handleSaveSceneConfig">
              <text class="tag-save-btn-text">{{ isSavingScene ? '保存中...' : '保存设置' }}</text>
            </view>
          </view>
          <view class="tag-zones">
            <view
              v-for="(zoneItems, zoneIndex) in zoneItemsByZone"
              :key="zoneIndex"
              class="tag-zone"
            >
              <view class="tag-zone-header">
                <view class="tag-zone-title-row">
                  <text class="tag-zone-title">{{
                    zoneNames[zoneIndex] || `区域 ${zoneIndex + 1}`
                  }}</text>
                  <text class="tag-zone-edit" @tap.stop="openEditZoneName(zoneIndex)">✎</text>
                </view>
                <text class="tag-zone-count">{{ zoneItems.length }} 项物品</text>
              </view>
              <view class="tag-zone-body">
                <view
                  v-for="item in zoneItems"
                  :key="item.id"
                  :class="['item-tag', { dragging: draggingItemId === item.id }]"
                  @touchstart.stop="handleTagTouchStart(item.id, $event)"
                  @touchmove.stop="handleTagTouchMove(item.id, $event)"
                  @touchend.stop="handlePageTouchEnd"
                >
                  <text class="item-tag-name">{{ item.name }}</text>
                  <text class="item-tag-qty">{{ item.quantity }}{{ item.unit }}</text>
                </view>
                <view v-if="!zoneItems.length" class="tag-zone-empty">
                  <text class="tag-zone-empty-text">拖动标签到此区域</text>
                </view>
              </view>
            </view>
            <view class="tag-add-zone-wrapper">
              <view class="tag-add-zone-btn" @tap="handleAddZone">
                <text class="tag-add-zone-icon">＋</text>
                <text class="tag-add-zone-text">添加区域</text>
              </view>
            </view>
          </view>
        </view>
      </view>
    </view>

    <!-- 底部加入场景选择器（遮罩 + 底部弹出面板） -->
    <view v-if="showPicker" class="picker-mask" @tap="closePicker">
      <view class="picker-panel" @tap.stop>
        <view class="picker-header">
          <text class="picker-title">加入「{{ labelText }}」的物品</text>
          <text class="picker-close" @tap="closePicker">完成</text>
        </view>
        <view class="picker-search">
          <input
            v-model="searchKeyword"
            class="picker-input"
            placeholder="搜索物品名称"
            confirm-type="search"
          />
        </view>
        <scroll-view scroll-y class="picker-list">
          <view
            v-for="item in pickerItems"
            :key="item.id"
            class="picker-item"
            :class="{ selected: selectedItemIds.includes(item.id) }"
            @tap.stop="toggleSelectItem(item.id)"
          >
            <view class="picker-item-main">
              <text class="picker-item-name">{{ item.name }}</text>
              <text class="picker-item-qty">{{ item.quantity }}{{ item.unit }}</text>
            </view>
            <view class="picker-item-meta">
              <text v-if="item.storageLocation" class="picker-item-loc">
                📍 {{ item.storageLocation }}
              </text>
              <text v-if="item.category" class="picker-item-cat">{{ item.category }}</text>
            </view>
          </view>
          <view v-if="!pickerItems.length && !isLoading" class="picker-empty">
            <text class="picker-empty-text">暂无可选物品</text>
          </view>
        </scroll-view>
      </view>
    </view>

    <!-- 区域名称编辑弹窗 -->
    <view v-if="showZoneNameModal" class="modal-mask" @tap="closeZoneNameModal">
      <view class="modal-box" @tap.stop>
        <text class="modal-title">修改区域名称</text>
        <input
          v-model="zoneNameInput"
          class="modal-input"
          placeholder="请输入区域名称"
          confirm-type="done"
          @confirm="confirmZoneName"
        />
        <view class="modal-btns">
          <view class="modal-btn cancel" @tap="closeZoneNameModal">
            <text>取消</text>
          </view>
          <view class="modal-btn confirm" @tap="confirmZoneName">
            <text>确定</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 拖拽预览标签：在拖动时跟随手指移动 -->
    <view
      v-if="dragPreview.visible"
      class="drag-preview"
      :style="dragPreviewStyle"
    >
      <view class="item-tag">
        <text class="item-tag-name">{{ dragPreview.name }}</text>
        <text v-if="dragPreview.qty" class="item-tag-qty">{{ dragPreview.qty }}</text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { useInventory } from '@/composables/useInventory'
import { useSceneLabel } from '@/composables/useSceneLabel'

const labelText = ref('')
const displayMode = ref('list')

// 当前场景下已选中的物品 id 列表
const selectedItemIds = ref([])

// 底部选择器相关状态
const showPicker = ref(false)
const searchKeyword = ref('')

// 库存数据
const { sortedItems, isLoading } = useInventory()

// 场景标签配置（Supabase）
const { loadSceneLabel, saveSceneLabel, isSaving: isSavingScene } = useSceneLabel()

// 当前场景中的物品（根据 selectedItemIds 计算）
const sceneItems = computed(() =>
  sortedItems.value.filter((item) => selectedItemIds.value.includes(item.id)),
)

// 区域列表与分布（仅在「标签」模式下使用）
// zoneNames：区域名称数组；zoneMap：item.id -> 区域索引（0 开始），未指定的默认在 0 区
const zoneNames = ref(['区域 1', '区域 2', '区域 3', '区域 4'])
const zoneMap = ref({})
const draggingItemId = ref(null)
const currentDragZoneIndex = ref(null)
const zoneRects = ref([])
const dragPreview = ref({
  visible: false,
  name: '',
  qty: '',
  left: 0,
  top: 0,
})

const dragPreviewStyle = computed(() => ({
  top: `${dragPreview.value.top}px`,
  left: `${dragPreview.value.left}px`,
}))

const zoneItemsByZone = computed(() => {
  const zones = Array.from({ length: zoneNames.value.length }, () => [])
  sceneItems.value.forEach((item) => {
    const zoneIndex = zoneMap.value[item.id] ?? 0
    const maxIndex = zoneNames.value.length - 1
    const idx = zoneIndex >= 0 && zoneIndex <= maxIndex ? zoneIndex : 0
    zones[idx].push(item)
  })
  return zones
})

// 场景物品变化时，维护 zoneMap：
// 1. 新增物品 -> 默认放入第 1 区（索引 0）
// 2. 删除物品 -> 从 map 中清理
watch(
  sceneItems,
  (items) => {
    const existIds = items.map((i) => i.id)
    const nextMap = { ...zoneMap.value }
    Object.keys(nextMap).forEach((id) => {
      if (!existIds.includes(Number(id)) && !existIds.includes(id)) {
        delete nextMap[id]
      }
    })
    items.forEach((item) => {
      if (nextMap[item.id] == null) {
        nextMap[item.id] = 0
      }
    })
    zoneMap.value = nextMap
  },
  { immediate: true },
)

// 计算每个区域在屏幕上的位置，用于拖拽时命中判断
const measureZones = () => {
  nextTick(() => {
    const query = uni.createSelectorQuery()
    query.selectAll('.tag-zone').boundingClientRect()
    query.exec((res) => {
      if (Array.isArray(res) && Array.isArray(res[0])) {
        zoneRects.value = res[0]
      } else if (Array.isArray(res)) {
        zoneRects.value = res
      } else {
        zoneRects.value = []
      }
    })
  })
}

onMounted(() => {
  measureZones()
})

watch(
  () => [displayMode.value, sceneItems.value.length],
  ([mode]) => {
    if (mode === 'tag') measureZones()
  },
)

// 选择器中的候选物品列表：
// 1. 支持搜索（名称模糊匹配）
// 2. 名称中包含当前标签名称的排在前面
const pickerItems = computed(() => {
  const keyword = searchKeyword.value.trim().toLowerCase()
  const label = labelText.value.trim().toLowerCase()

  const filtered = sortedItems.value.filter((item) => {
    if (!keyword) return true
    return item.name.toLowerCase().includes(keyword)
  })

  return filtered.slice().sort((a, b) => {
    const aMatch = label && a.name.toLowerCase().includes(label) ? 0 : 1
    const bMatch = label && b.name.toLowerCase().includes(label) ? 0 : 1
    if (aMatch !== bMatch) return aMatch - bMatch
    return a.name.localeCompare(b.name)
  })
})

// 首次进入页面时，如果库存中有存放位置等于当前标签的物品，
// 默认将这些物品加入当前场景，提升使用体验
const initializedFromLocation = ref(false)

watch(
  () => [labelText.value, sortedItems.value],
  () => {
    if (initializedFromLocation.value) return
    if (!labelText.value || !sortedItems.value.length) return
    const matchedIds = sortedItems.value
      .filter((item) => item.storageLocation === labelText.value)
      .map((item) => item.id)
    if (matchedIds.length) {
      selectedItemIds.value = matchedIds
    }
    initializedFromLocation.value = true
  },
  { deep: true },
)

const openPicker = () => {
  showPicker.value = true
  searchKeyword.value = ''
}

// 抽取保存逻辑，供「完成」与「保存设置」共用
const saveSceneConfig = async (showToast = true) => {
  const labelKey = labelText.value.trim()
  if (!labelKey) return false

  const sceneData = {
    selectedItemIds: selectedItemIds.value,
    zoneMap: zoneMap.value,
    zoneNames: zoneNames.value,
  }

  const ok = await saveSceneLabel(labelKey, sceneData)
  if (showToast) {
    uni.showToast({
      title: ok ? '已保存到场景' : '保存场景失败',
      icon: ok ? 'success' : 'none',
    })
  }
  return ok
}

// 点击完成 / 遮罩关闭 -> 保存当前标签页的配置到 Supabase
const closePicker = async () => {
  showPicker.value = false
  await saveSceneConfig(true)
}

// 选中 / 取消选中物品
const toggleSelectItem = (id) => {
  if (selectedItemIds.value.includes(id)) {
    selectedItemIds.value = selectedItemIds.value.filter((x) => x !== id)
  } else {
    selectedItemIds.value = [...selectedItemIds.value, id]
  }
}

// 标签模式下：开始拖动某个标签（记录拖拽项并显示随手指移动的预览）
const handleTagTouchStart = (id, e) => {
  draggingItemId.value = id
  currentDragZoneIndex.value = zoneMap.value[id] ?? 0

  const item = sceneItems.value.find((it) => it.id === id)
  const touch =
    (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0])
  const x = touch ? touch.clientX ?? touch.pageX ?? touch.x : 0
  const y = touch ? touch.clientY ?? touch.pageY ?? touch.y : 0

  dragPreview.value = {
    visible: true,
    name: item?.name || '',
    qty: item ? `${item.quantity}${item.unit}` : '',
    left: x,
    top: y,
  }
}

// 标签标签自身的 touchmove（保证在所有端都能稳定触发拖动逻辑）
const handleTagTouchMove = (id, e) => {
  if (!draggingItemId.value) {
    draggingItemId.value = id
  }
  handlePageTouchMove(e)
}

// 页面级：拖动过程中，根据手指位置判断当前所在区域，并实时更新标签归属区域与预览位置
const handlePageTouchMove = (e) => {
  if (!draggingItemId.value) return
  const touch =
    (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0])
  if (!touch) return
  const x = touch.clientX ?? touch.pageX ?? touch.x
  const y = touch.clientY ?? touch.pageY ?? touch.y

  // 更新预览位置，使其跟随手指
  dragPreview.value = {
    ...dragPreview.value,
    left: x,
    top: y,
  }

  const rects = zoneRects.value || []
  for (let i = 0; i < rects.length; i++) {
    const r = rects[i]
    if (!r) continue
    if (y >= r.top && y <= r.bottom) {
      if (currentDragZoneIndex.value !== i) {
        currentDragZoneIndex.value = i
        const id = draggingItemId.value
        const exist = sceneItems.value.find((item) => item.id === id)
        if (!exist) break
        zoneMap.value = {
          ...zoneMap.value,
          [id]: i,
        }
        console.log('[scene-label] zoneMap updated', { id, zoneIndex: i, zoneMap: zoneMap.value })
      }
      break
    }
  }
}

// 页面级：手指松开后，仅重置拖拽状态（拖动过程中已实时更新 zoneMap）
const handlePageTouchEnd = () => {
  if (!draggingItemId.value && draggingItemId.value !== 0) return
  draggingItemId.value = null
  currentDragZoneIndex.value = null
  dragPreview.value = {
    ...dragPreview.value,
    visible: false,
  }
}

// 标签模式下显式保存设置按钮
const handleSaveSceneConfig = async () => {
  await saveSceneConfig(true)
}

// 添加新区域（名称默认“区域 N”）
const handleAddZone = () => {
  const nextIndex = zoneNames.value.length + 1
  zoneNames.value = [...zoneNames.value, `区域 ${nextIndex}`]
  measureZones()
}

// 区域名称编辑弹窗相关
const showZoneNameModal = ref(false)
const editingZoneIndex = ref(-1)
const zoneNameInput = ref('')

const openEditZoneName = (index) => {
  editingZoneIndex.value = index
  zoneNameInput.value = zoneNames.value[index] || ''
  showZoneNameModal.value = true
}

const closeZoneNameModal = () => {
  showZoneNameModal.value = false
  editingZoneIndex.value = -1
  zoneNameInput.value = ''
}

const confirmZoneName = () => {
  const idx = editingZoneIndex.value
  const name = zoneNameInput.value.trim()
  if (idx < 0 || !name) {
    closeZoneNameModal()
    return
  }
  const next = [...zoneNames.value]
  next[idx] = name
  zoneNames.value = next
  closeZoneNameModal()
}

onLoad((options) => {
  labelText.value = decodeURIComponent(options?.text || '')
  if (labelText.value) {
    uni.setNavigationBarTitle({ title: labelText.value })
  }
  // 根据当前标签名称加载已保存的场景配置
  const labelKey = labelText.value.trim()
  if (!labelKey) return

  loadSceneLabel(labelKey).then((data) => {
    if (!data) return
    if (Array.isArray(data.selectedItemIds)) {
      selectedItemIds.value = data.selectedItemIds
    }
    if (data.zoneMap && typeof data.zoneMap === 'object') {
      zoneMap.value = data.zoneMap
    }
    if (Array.isArray(data.zoneNames) && data.zoneNames.length > 0) {
      zoneNames.value = data.zoneNames
    }
  })
})
</script>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  background: #f5f5f5;
}

.label-header {
  padding: 32rpx 24rpx 24rpx;
  background: #fff;
  border-bottom: 1rpx solid #eee;
}

.label-title {
  font-size: 36rpx;
  font-weight: 600;
  color: #333;
}

.label-header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 24rpx;
}

.label-sub {
  margin-top: 12rpx;
  font-size: 24rpx;
  color: #999;
}

.mode-switch {
  display: inline-flex;
  padding: 4rpx;
  border-radius: 40rpx;
  background: #f5f5f5;
}

.mode-tab {
  min-width: 96rpx;
  padding: 8rpx 20rpx;
  font-size: 24rpx;
  color: #666;
  text-align: center;
  border-radius: 32rpx;

  &.active {
    background: #07c160;
    color: #fff;
    font-weight: 500;
  }
}

.add-scene-btn {
  padding: 10rpx 24rpx;
  border-radius: 32rpx;
  background: #07c160;
}

.add-scene-text {
  font-size: 26rpx;
  color: #fff;
  display: flex;
  align-items: center;
}

.label-content {
  padding: 24rpx;
}

.tag-save-bar {
  margin-bottom: 16rpx;
  padding: 12rpx 16rpx;
  background: #f7f8fa;
  border-radius: 12rpx;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16rpx;
}

.tag-save-text {
  font-size: 22rpx;
  color: #999;
}

.tag-save-btn {
  padding: 8rpx 20rpx;
  border-radius: 28rpx;
  background: #07c160;
}

.tag-save-btn-text {
  font-size: 24rpx;
  color: #fff;
}

/* 空状态 */
.empty {
  padding: 120rpx 0;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12rpx;
}

.empty-icon {
  font-size: 80rpx;
}

.empty-text {
  font-size: 28rpx;
  color: #999;
}

.empty-hint {
  font-size: 24rpx;
  color: #bbb;
}

/* 列表模式样式（与 display 页保持风格一致） */
.list {
  background: #f5f5f5;
}

.item-card {
  padding: 24rpx;
  background: #fff;
  border-radius: 16rpx;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.04);

  & + .item-card {
    margin-top: 16rpx;
  }
}

.item-main {
  flex: 1;
}

.item-top {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-bottom: 8rpx;
}

.item-name {
  font-size: 30rpx;
  font-weight: 600;
  color: #333;
}

.item-badge {
  font-size: 20rpx;
  color: #07c160;
  background: rgba(7, 193, 96, 0.1);
  padding: 4rpx 12rpx;
  border-radius: 6rpx;
}

.item-detail {
  display: flex;
  align-items: center;
  gap: 16rpx;
  flex-wrap: wrap;
}

.item-qty {
  font-size: 26rpx;
  color: #333;
  font-weight: 500;
}

.item-price {
  font-size: 26rpx;
  color: #07c160;
}

.item-expiry {
  font-size: 24rpx;
  color: #f0a020;
}

.item-meta {
  display: flex;
  align-items: center;
  gap: 16rpx;
  margin-top: 6rpx;
  flex-wrap: wrap;
}

.item-meta-tag {
  font-size: 22rpx;
  color: #999;
}

.item-remark {
  font-size: 22rpx;
  color: #bbb;
  margin-top: 8rpx;
  display: block;
}

/* 标签模式样式：多个纵向区块 */
.tag-zones {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.tag-zone {
  background: #fff;
  border-radius: 16rpx;
  padding: 16rpx 16rpx 12rpx;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.03);
}

.tag-zone-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8rpx;
}

.tag-zone-title-row {
  display: flex;
  align-items: center;
  gap: 8rpx;
}

.tag-zone-title {
  font-size: 26rpx;
  font-weight: 500;
  color: #333;
}

.tag-zone-edit {
  font-size: 22rpx;
  color: #999;
}

.tag-zone-count {
  font-size: 22rpx;
  color: #999;
}

.tag-zone-body {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  min-height: 60rpx;
  padding-top: 4rpx;
}

.item-tag {
  padding: 10rpx 18rpx;
  border-radius: 32rpx;
  background: #f7f8fa;
  display: inline-flex;
  align-items: center;
  gap: 8rpx;
}

.item-tag.dragging {
  opacity: 0;
}

.item-tag-name {
  font-size: 26rpx;
  color: #333;
}

.item-tag-qty {
  font-size: 22rpx;
  color: #999;
}

.drag-preview {
  position: fixed;
  z-index: 3000;
  pointer-events: none;
}

.tag-zone-empty {
  display: flex;
  align-items: center;
  height: 40rpx;
}

.tag-zone-empty-text {
  font-size: 22rpx;
  color: #ccc;
}

.tag-add-zone-wrapper {
  margin-top: 8rpx;
  display: flex;
  justify-content: center;
}

.tag-add-zone-btn {
  padding: 10rpx 24rpx;
  border-radius: 24rpx;
  border: 1rpx dashed #dcdcdc;
  display: inline-flex;
  align-items: center;
  gap: 8rpx;
}

.tag-add-zone-icon {
  font-size: 24rpx;
  color: #999;
}

.tag-add-zone-text {
  font-size: 24rpx;
  color: #666;
}

/* 底部选择器 */
.picker-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.45);
  z-index: 1000;
  display: flex;
  justify-content: center;
  align-items: flex-end;
}

.picker-panel {
  width: 100%;
  max-height: 70vh;
  background: #fff;
  border-radius: 24rpx 24rpx 0 0;
  padding: 16rpx 24rpx 24rpx;
  box-sizing: border-box;
}

.picker-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 8rpx;
}

.picker-title {
  font-size: 30rpx;
  font-weight: 600;
  color: #333;
}

.picker-close {
  font-size: 26rpx;
  color: #07c160;
}

.picker-search {
  margin-top: 12rpx;
}

.picker-input {
  width: 100%;
  height: 64rpx;
  line-height: 64rpx;
  padding: 0 20rpx;
  font-size: 26rpx;
  border-radius: 32rpx;
  background: #f5f5f5;
  box-sizing: border-box;
}

.picker-list {
  margin-top: 16rpx;
  max-height: 56vh;
}

.picker-item {
  padding: 16rpx 8rpx;
  border-bottom: 1rpx solid #f0f0f0;
  display: flex;
  flex-direction: column;
  gap: 4rpx;

  &.selected {
    background: rgba(7, 193, 96, 0.06);
  }
}

.picker-item-main {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.picker-item-name {
  font-size: 28rpx;
  color: #333;
}

.picker-item-qty {
  font-size: 24rpx;
  color: #666;
}

.picker-item-meta {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.picker-item-loc {
  font-size: 22rpx;
  color: #999;
}

.picker-item-cat {
  font-size: 22rpx;
  color: #07c160;
}

.picker-empty {
  padding: 80rpx 0;
  text-align: center;
}

.picker-empty-text {
  font-size: 26rpx;
  color: #999;
}

/* 区域名称编辑弹窗样式（复用 detail/scene 页风格） */
.modal-mask {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  background: rgba(0, 0, 0, 0.45);
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-box {
  width: 600rpx;
  background: #fff;
  border-radius: 20rpx;
  padding: 40rpx 36rpx 32rpx;
  box-shadow: 0 8rpx 40rpx rgba(0, 0, 0, 0.15);
}

.modal-title {
  font-size: 32rpx;
  font-weight: 600;
  color: #333;
  display: block;
  text-align: center;
  margin-bottom: 24rpx;
}

.modal-input {
  width: 100%;
  height: 72rpx;
  line-height: 72rpx;
  padding: 0 20rpx;
  font-size: 28rpx;
  border: 1rpx solid #eee;
  border-radius: 12rpx;
  box-sizing: border-box;
  background-color: #fafafa;
}

.modal-btns {
  display: flex;
  gap: 20rpx;
  margin-top: 28rpx;
}

.modal-btn {
  flex: 1;
  height: 72rpx;
  line-height: 72rpx;
  text-align: center;
  font-size: 28rpx;
  border-radius: 12rpx;

  &.cancel {
    background: #f5f5f5;
    color: #666;
  }
  &.confirm {
    background: #07c160;
    color: #fff;
  }
}
</style>
