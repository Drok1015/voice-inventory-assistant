<template>
  <view class="page">
    <!-- 固定顶部区域 -->
    <view class="fixed-top">
      <!-- 位置标签栏 -->
      <scroll-view class="category-bar" scroll-x>
        <view class="category-list">
          <view
            v-for="loc in locationList"
            :key="loc"
            class="category-tag"
            :class="{ active: currentLocation === loc }"
            @click="currentLocation = loc"
          >
            <text>{{ loc }}</text>
          </view>
        </view>
      </scroll-view>

      <!-- 统计栏 -->
      <view class="stats-bar">
        <text class="stats-text">共 {{ filteredItems.length }} 项</text>
        <text class="action-link" @click="goAdd">+ 手动添加</text>
      </view>
    </view>

    <!-- 占位，防止内容被固定栏遮挡 -->
    <view class="top-placeholder"></view>

    <!-- 库存列表 -->
    <view v-if="isLoading" class="empty">
      <text class="empty-text">加载中...</text>
    </view>
    <view v-else-if="filteredItems.length === 0" class="empty">
      <text class="empty-icon">📦</text>
      <text class="empty-text">{{
        currentLocation === '全部' ? '暂无库存记录' : `「${currentLocation}」暂无记录`
      }}</text>
    </view>

    <view v-else class="list">
      <view v-for="item in filteredItems" :key="item.id" class="item-card">
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
            <text v-if="item.purchaseDate" class="item-meta-tag">🛒 {{ item.purchaseDate }}</text>
            <text v-if="item.storageLocation" class="item-meta-tag">📍 {{ item.storageLocation }}</text>
          </view>
          <text v-if="item.remark" class="item-remark">{{ item.remark }}</text>
        </view>
        <view class="item-actions">
          <text class="action-btn edit" @click="handleEdit(item)">编辑</text>
          <text class="action-btn delete" @click="handleDelete(item.id)">删除</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useInventory } from '@/composables/useInventory'

const { sortedItems, deleteItem, isLoading } = useInventory()

const currentLocation = ref('全部')

const locationList = computed(() => {
  const set = new Set(sortedItems.value.map((i) => i.storageLocation).filter(Boolean))
  return ['全部', ...Array.from(set).sort()]
})

const filteredItems = computed(() => {
  if (currentLocation.value === '全部') return sortedItems.value
  return sortedItems.value.filter((i) => i.storageLocation === currentLocation.value)
})

const goAdd = () => {
  uni.navigateTo({ url: '/pages/detail/detail' })
}

const handleEdit = (item) => {
  uni.navigateTo({ url: `/pages/detail/detail?id=${item.id}` })
}

const handleDelete = (id) => {
  uni.showModal({
    title: '确认删除',
    content: '删除后无法恢复',
    success: async (res) => {
      if (res.confirm) {
        try {
          await deleteItem(id)
          uni.showToast({ title: '已删除' })
        } catch {
          uni.showToast({ title: '删除失败', icon: 'none' })
        }
      }
    },
  })
}
</script>

<style lang="scss" scoped>
.page {
  height: 100vh;
  background: #f5f5f5;
}

/* 固定顶部 */
.fixed-top {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  background: #fff;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.06);
}

/* 占位高度与固定栏一致 */
.top-placeholder {
  height: 160rpx;
}

/* 分类标签栏 */
.category-bar {
  background: #fff;
  box-sizing: border-box;
  padding: 20rpx 0 20rpx 24rpx;
  white-space: nowrap;
}

.category-list {
  display: inline-flex;
  gap: 16rpx;
  padding-right: 24rpx;
}

.category-tag {
  display: inline-flex;
  align-items: center;
  padding: 12rpx 28rpx;
  border-radius: 32rpx;
  font-size: 26rpx;
  color: #666;
  background: #f5f5f5;
  flex-shrink: 0;

  &.active {
    background: #07c160;
    color: #fff;
    font-weight: 500;
  }
}

/* 统计栏 */
.stats-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20rpx 24rpx;
}

.stats-text {
  font-size: 24rpx;
  color: #999;
}

.action-link {
  font-size: 26rpx;
  color: #07c160;
  font-weight: 500;
}

/* 空状态 */
.empty {
  padding: 120rpx 0;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16rpx;
}

.empty-icon {
  font-size: 80rpx;
}

.empty-text {
  font-size: 28rpx;
  color: #999;
}

/* 库存列表 */
.list {
  padding: 24rpx;
  background: #f5f5f5;
}

.item-card {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 24rpx;
  background: #fff;
  border-radius: 16rpx;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.05);
  & + .item-card {
    margin-top: 16rpx;
  }
}

.item-main {
  flex: 1;
  margin-right: 16rpx;
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

.item-actions {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  flex-shrink: 0;
}

.action-btn {
  font-size: 24rpx;
  padding: 8rpx 20rpx;
  border-radius: 8rpx;
  text-align: center;

  &.edit {
    color: #07c160;
    background: rgba(7, 193, 96, 0.1);
  }
  &.delete {
    color: #ee0a24;
    background: rgba(238, 10, 36, 0.08);
  }
}
</style>
