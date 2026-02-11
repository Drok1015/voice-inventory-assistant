<template>
  <view class="page">
    <view class="form">
      <!-- 物品名称 -->
      <view class="form-item">
        <text class="label">物品名称</text>
        <input v-model="form.name" class="input" placeholder="请输入名称" />
      </view>

      <!-- 数量 / 单位 -->
      <view class="form-row">
        <view class="form-item half">
          <text class="label">数量</text>
          <input v-model.number="form.quantity" type="number" class="input" placeholder="1" />
        </view>
        <view class="form-item half">
          <text class="label">单位</text>
          <input v-model="form.unit" class="input" placeholder="个/瓶/袋" />
        </view>
      </view>

      <!-- 价格 / 保质期 -->
      <view class="form-row">
        <view class="form-item half">
          <text class="label">价格</text>
          <input v-model="form.price" type="digit" class="input" placeholder="选填" />
        </view>
        <view class="form-item half">
          <text class="label">保质期</text>
          <picker mode="date" :value="form.expiryDate" :start="today" @change="onExpiryChange">
            <view class="input picker-display">
              <text :class="{ placeholder: !form.expiryDate }">
                {{ form.expiryDate || '选择日期' }}
              </text>
              <text v-if="form.expiryDate" class="clear-icon" @click.stop="form.expiryDate = ''">✕</text>
            </view>
          </picker>
        </view>
      </view>

      <!-- 购买日期 / 储存位置 -->
      <view class="form-row">
        <view class="form-item half">
          <text class="label">购买日期</text>
          <picker mode="date" :value="form.purchaseDate" :end="today" @change="onPurchaseDateChange">
            <view class="input picker-display">
              <text :class="{ placeholder: !form.purchaseDate }">
                {{ form.purchaseDate || '选择日期' }}
              </text>
            </view>
          </picker>
        </view>
        <view class="form-item half">
          <text class="label">储存位置</text>
          <view class="input picker-display" @click="showLocationPicker = true">
            <text>{{ form.storageLocation || '选择位置' }}</text>
            <text class="arrow-icon">▾</text>
          </view>
        </view>
      </view>

      <!-- 分类 -->
      <view class="form-item">
        <text class="label">分类</text>
        <view class="input picker-display" @click="showCategoryPicker = true">
          <text>{{ form.category || '选择分类' }}</text>
          <text class="arrow-icon">▾</text>
        </view>
      </view>

      <!-- 备注 -->
      <view class="form-item">
        <text class="label">备注</text>
        <textarea v-model="form.remark" class="textarea" placeholder="选填" />
      </view>
    </view>

    <view class="btn-row">
      <button class="btn btn-primary" @click="handleSubmit">{{ isEdit ? '保存' : '添加' }}</button>
    </view>

    <!-- 分类选择弹窗 -->
    <view v-if="showCategoryPicker" class="modal-mask" @click="showCategoryPicker = false">
      <view class="modal-box" @click.stop>
        <text class="modal-title">选择分类</text>
        <scroll-view class="option-list" scroll-y>
          <view
            v-for="cat in allCategories"
            :key="cat"
            class="option-item"
            :class="{ active: form.category === cat }"
            @click="selectCategory(cat)"
          >
            <text>{{ cat }}</text>
            <text v-if="form.category === cat" class="check-icon">✓</text>
          </view>
        </scroll-view>
        <view class="new-item-row">
          <input
            v-model="newCategoryName"
            class="input new-item-input"
            placeholder="输入新分类名称"
            @confirm="addNewCategory"
          />
          <view class="new-item-btn" @click="addNewCategory">
            <text>添加</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 储存位置选择弹窗 -->
    <view v-if="showLocationPicker" class="modal-mask" @click="showLocationPicker = false">
      <view class="modal-box" @click.stop>
        <text class="modal-title">选择储存位置</text>
        <scroll-view class="option-list" scroll-y>
          <view
            v-for="loc in allLocations"
            :key="loc"
            class="option-item"
            :class="{ active: form.storageLocation === loc }"
            @click="selectLocation(loc)"
          >
            <text>{{ loc }}</text>
            <text v-if="form.storageLocation === loc" class="check-icon">✓</text>
          </view>
        </scroll-view>
        <view class="new-item-row">
          <input
            v-model="newLocationName"
            class="input new-item-input"
            placeholder="输入新位置名称"
            @confirm="addNewLocation"
          />
          <view class="new-item-btn" @click="addNewLocation">
            <text>添加</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { useInventory } from '@/composables/useInventory'

const { items, addItem, updateItem, getCategories } = useInventory()

const editId = ref('')
const isEdit = ref(false)
const showCategoryPicker = ref(false)
const showLocationPicker = ref(false)
const newCategoryName = ref('')
const newLocationName = ref('')

/** 分类 -> 默认储存位置映射 */
const categoryLocationMap = {
  食品: '客厅',
  饮料: '客厅',
  生鲜: '客厅',
  零食: '客厅',
  日用品: '客厅',
  调味品: '厨房',
  厨具: '厨房',
  清洁用品: '卫生间',
  其他: '客厅',
}

/** 今天的日期 */
const today = computed(() => {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
})

const form = ref({
  name: '',
  quantity: 1,
  unit: '个',
  price: '',
  expiryDate: '',
  purchaseDate: today.value,
  storageLocation: '客厅',
  category: '其他',
  remark: '',
})

/** 预设分类 + 已有分类去重合并 */
const defaultCategories = ['食品', '饮料', '日用品', '生鲜', '零食', '调味品', '厨具', '清洁用品', '其他']
const allCategories = computed(() => {
  const set = new Set([...defaultCategories, ...getCategories.value])
  return Array.from(set)
})

/** 预设位置 + 已有位置去重合并 */
const defaultLocations = ['客厅', '厨房', '冰箱', '卫生间', '卧室', '阳台', '储物间']
const allLocations = computed(() => {
  const existingLocations = items.value.map((i) => i.storageLocation).filter(Boolean)
  const set = new Set([...defaultLocations, ...existingLocations])
  return Array.from(set)
})

const onExpiryChange = (e) => {
  form.value.expiryDate = e.detail.value
}

const onPurchaseDateChange = (e) => {
  form.value.purchaseDate = e.detail.value
}

const selectCategory = (cat) => {
  const prevCategory = form.value.category
  form.value.category = cat
  showCategoryPicker.value = false
  // 仅在非编辑模式下，且位置还是上一个分类的默认值时，自动联动更新位置
  if (!isEdit.value) {
    const prevDefault = categoryLocationMap[prevCategory] || '客厅'
    if (form.value.storageLocation === prevDefault) {
      form.value.storageLocation = categoryLocationMap[cat] || '客厅'
    }
  }
}

const addNewCategory = () => {
  const name = newCategoryName.value.trim()
  if (!name) return
  form.value.category = name
  newCategoryName.value = ''
  showCategoryPicker.value = false
}

const selectLocation = (loc) => {
  form.value.storageLocation = loc
  showLocationPicker.value = false
}

const addNewLocation = () => {
  const name = newLocationName.value.trim()
  if (!name) return
  form.value.storageLocation = name
  newLocationName.value = ''
  showLocationPicker.value = false
}

/** 用 item 数据填充表单 */
const fillForm = (item) => {
  form.value = {
    name: item.name ?? '',
    quantity: item.quantity ?? 1,
    unit: item.unit ?? '个',
    price: item.price != null ? String(item.price) : '',
    expiryDate: item.expiryDate ?? '',
    purchaseDate: item.purchaseDate ?? today.value,
    storageLocation: item.storageLocation || '客厅',
    category: item.category ?? '其他',
    remark: item.remark ?? '',
  }
}

/** 尝试从 items 中查找并回填 */
const tryFillFromItems = () => {
  if (!editId.value) return false
  const item = items.value.find((i) => String(i.id) === String(editId.value))
  if (item) {
    fillForm(item)
    return true
  }
  return false
}

onLoad((options) => {
  const id = options?.id ?? ''
  if (id) {
    editId.value = id
    isEdit.value = true
    uni.setNavigationBarTitle({ title: '编辑物品' })
    tryFillFromItems()
  }
})

// 当 items 数据加载完成后，再次尝试回填（解决异步竞态问题）
watch(
  () => items.value,
  () => {
    if (isEdit.value && editId.value) {
      tryFillFromItems()
    }
  },
  { immediate: false },
)

const handleSubmit = async () => {
  if (!form.value.name?.trim()) {
    uni.showToast({ title: '请输入名称', icon: 'none' })
    return
  }

  const payload = {
    name: form.value.name.trim(),
    quantity: Number(form.value.quantity) || 1,
    unit: form.value.unit || '个',
    price: form.value.price ? Number(form.value.price) : null,
    expiryDate: form.value.expiryDate?.trim() || null,
    purchaseDate: form.value.purchaseDate?.trim() || today.value,
    storageLocation: form.value.storageLocation || '客厅',
    category: form.value.category || '其他',
    remark: form.value.remark?.trim() || '',
  }

  try {
    if (isEdit.value) {
      await updateItem(editId.value, payload)
      uni.showToast({ title: '已保存' })
    } else {
      await addItem(payload)
      uni.showToast({ title: '已添加' })
    }
    setTimeout(() => uni.navigateBack(), 500)
  } catch {
    uni.showToast({ title: isEdit.value ? '保存失败，请检查网络' : '添加失败，请检查网络', icon: 'none' })
  }
}
</script>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  background: #f5f5f5;
  padding: 24rpx;
}

.form {
  background: #fff;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 24rpx;
}

.form-item {
  margin-bottom: 24rpx;
  &.half {
    flex: 1;
  }
}

.form-row {
  display: flex;
  gap: 24rpx;
}

.label {
  font-size: 26rpx;
  color: #666;
  display: block;
  margin-bottom: 8rpx;
}

.input {
  width: 100%;
  height: 72rpx;
  line-height: 72rpx;
  padding: 0 20rpx;
  font-size: 28rpx;
  border: 1rpx solid #eee;
  border-radius: 12rpx;
  box-sizing: border-box;
}

.picker-display {
  display: flex;
  align-items: center;
  justify-content: space-between;

  .placeholder {
    color: #999;
  }
}

.clear-icon {
  font-size: 24rpx;
  color: #ccc;
  padding: 0 8rpx;
}

.arrow-icon {
  font-size: 24rpx;
  color: #ccc;
}

.textarea {
  width: 100%;
  padding: 20rpx;
  font-size: 28rpx;
  border: 1rpx solid #eee;
  border-radius: 12rpx;
  box-sizing: border-box;
  min-height: 200rpx;
}

.btn-row {
  padding: 24rpx 0;
}

.btn {
  width: 100%;
  height: 88rpx;
  line-height: 88rpx;
  text-align: center;
  font-size: 30rpx;
  border-radius: 12rpx;
  border: none;
  background: #07c160;
  color: #fff;
}

/* 弹窗通用 */
.modal-mask {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  background: rgba(0, 0, 0, 0.45);
  z-index: 1000;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.modal-box {
  width: 100%;
  background: #fff;
  border-radius: 24rpx 24rpx 0 0;
  padding: 32rpx 24rpx;
  padding-bottom: calc(32rpx + env(safe-area-inset-bottom));
}

.modal-title {
  font-size: 32rpx;
  font-weight: 600;
  color: #333;
  display: block;
  text-align: center;
  margin-bottom: 24rpx;
}

.option-list {
  max-height: 500rpx;
}

.option-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24rpx 20rpx;
  font-size: 28rpx;
  color: #333;
  border-bottom: 1rpx solid #f5f5f5;

  &.active {
    color: #07c160;
    font-weight: 500;
  }

  &:last-child {
    border-bottom: none;
  }
}

.check-icon {
  color: #07c160;
  font-weight: 600;
}

.new-item-row {
  display: flex;
  align-items: center;
  gap: 16rpx;
  margin-top: 24rpx;
  padding-top: 24rpx;
  border-top: 1rpx solid #eee;
}

.new-item-input {
  flex: 1;
}

.new-item-btn {
  height: 72rpx;
  line-height: 72rpx;
  padding: 0 32rpx;
  background: #07c160;
  color: #fff;
  font-size: 28rpx;
  border-radius: 12rpx;
  flex-shrink: 0;
  text-align: center;
}
</style>
