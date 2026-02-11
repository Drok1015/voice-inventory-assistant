<template>
  <view class="page">
    <view class="input-section">
      <view class="section-title">
        <text class="title-text">语音 / 文字录入</text>
      </view>
      <textarea
        v-model="inputText"
        class="input-textarea"
        placeholder="例如：今天买了两瓶矿泉水，3块5一瓶，保质期到4月"
        :disabled="isParsing"
      />
      <view v-if="voiceInput.isSupported" class="voice-row">
        <view
          class="voice-btn"
          :class="{
            recording: voiceInput.isRecording,
            disabled: hasClickedVoice && voiceInput.isRequestingPermission,
          }"
          @click.stop="toggleVoiceInput"
        >
          <text class="voice-icon">{{ voiceInput.isRecording ? '■' : '🎤' }}</text>
          <text class="voice-label">{{
            hasClickedVoice && voiceInput.isRequestingPermission
              ? '请求麦克风权限...'
              : voiceInput.isRecording
                ? '停止录音'
                : '点击语音录入'
          }}</text>
        </view>
      </view>
      <view v-if="voiceInput.errorMsg" class="voice-error">{{ voiceInput.errorMsg }}</view>
      <view class="btn-row">
        <button
          class="btn btn-primary"
          :disabled="!inputText.trim() || isParsing"
          @click="handleParse"
        >
          {{ isParsing ? '解析中...' : '解析并添加' }}
        </button>
        <button class="btn btn-secondary" @click="goAdd">模板添加</button>
      </view>
    </view>

    <!-- 最近录入 -->
    <view v-if="recentItems.length" class="recent-section">
      <view class="section-title">
        <text class="title-text">最近录入</text>
        <text class="title-count">{{ recentItems.length }} 条</text>
      </view>
      <view v-for="item in recentItems" :key="item.id" class="recent-item">
        <view class="recent-left">
          <text class="recent-name">{{ item.name }}</text>
          <text class="recent-meta"
            >{{ item.quantity }}{{ item.unit }}
            <text v-if="item.category" class="recent-cat">· {{ item.category }}</text>
          </text>
        </view>
        <text v-if="item.price" class="recent-price">￥{{ item.price }}</text>
      </view>
    </view>

    <!-- 重复商品冲突弹窗 -->
    <view v-if="conflictInfo" class="modal-mask" @click.stop="conflictInfo = null">
      <view class="modal-box" @click.stop>
        <text class="modal-title">发现同名库存</text>
        <text class="modal-desc">
          「{{ conflictInfo.existing.name }}」已有
          <text class="modal-highlight"
            >{{ conflictInfo.existing.quantity }}{{ conflictInfo.existing.unit }}</text
          >， 新录入
          <text class="modal-highlight"
            >{{ conflictInfo.newItem.quantity }}{{ conflictInfo.newItem.unit }}</text
          >
        </text>
        <view class="modal-actions">
          <button class="modal-btn accent" @click="handleConflict('accumulate')">
            累加为 {{ conflictInfo.existing.quantity + conflictInfo.newItem.quantity
            }}{{ conflictInfo.newItem.unit }}
          </button>
          <button class="modal-btn warn" @click="handleConflict('replace')">
            覆盖为 {{ conflictInfo.newItem.quantity }}{{ conflictInfo.newItem.unit }}
          </button>
          <button class="modal-btn" @click="handleConflict('add')">另存一条新记录</button>
          <button class="modal-btn muted" @click="conflictInfo = null">取消</button>
        </view>
      </view>
    </view>

    <view v-if="errorMsg" class="toast error">{{ errorMsg }}</view>
    <view v-if="successMsg" class="toast success">{{ successMsg }}</view>
  </view>
</template>

<script setup>
import { ref, computed, reactive } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useInventory } from '@/composables/useInventory'
import { parseUserTextToItem } from '@/composables/useLLMParse'
import { useVoiceInput } from '@/composables/useVoiceInput'

const { sortedItems, addItem, updateItem, isLoading } = useInventory()
const voiceInput = reactive(useVoiceInput())

const hasClickedVoice = ref(false)

onShow(() => {
  voiceInput.reset()
  hasClickedVoice.value = false
})

const inputText = ref('')
const isParsing = ref(false)
const errorMsg = ref('')
const successMsg = ref('')

/** 最近录入的 3 条（按创建时间倒序） */
const recentItems = computed(() =>
  [...sortedItems.value].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 3),
)

const goAdd = () => {
  uni.navigateTo({ url: '/pages/detail/detail' })
}

const toggleVoiceInput = () => {
  if (voiceInput.isRequestingPermission) return
  hasClickedVoice.value = true
  if (voiceInput.isRecording) {
    voiceInput.stop()
  } else {
    const baseText = inputText.value
    voiceInput.start(
      (recognizedText) => {
        inputText.value = baseText + recognizedText
      },
      () => {
        showToast(voiceInput.errorMsg || '语音识别失败', 'error')
      },
    )
  }
}

const showToast = (msg, type = 'success') => {
  if (type === 'error') {
    errorMsg.value = msg
    setTimeout(() => {
      errorMsg.value = ''
    }, 3000)
  } else {
    successMsg.value = msg
    setTimeout(() => {
      successMsg.value = ''
    }, 2000)
  }
}

const conflictInfo = ref(null)

const findExistingItem = (name) => {
  const normalized = name.replace(/\s+/g, '').toLowerCase()
  return sortedItems.value.find((i) => i.name.replace(/\s+/g, '').toLowerCase() === normalized)
}

const handleParse = async () => {
  const text = inputText.value.trim()
  if (!text) return

  isParsing.value = true
  errorMsg.value = ''
  successMsg.value = ''

  const item = await parseUserTextToItem(text)
  isParsing.value = false

  if (!item) {
    showToast('解析失败，请检查网络或 API Key 配置', 'error')
    return
  }

  const existing = findExistingItem(item.name)
  if (existing) {
    conflictInfo.value = { existing, newItem: item }
    return
  }

  try {
    await addItem(item)
    inputText.value = ''
    showToast(`已添加：${item.name} ${item.quantity}${item.unit}`)
  } catch {
    showToast('添加失败，请检查网络', 'error')
  }
}

const handleConflict = async (action) => {
  if (!conflictInfo.value) return
  const { existing, newItem } = conflictInfo.value
  conflictInfo.value = null

  try {
    if (action === 'accumulate') {
      const totalQty = existing.quantity + newItem.quantity
      await updateItem(existing.id, { ...existing, quantity: totalQty })
      inputText.value = ''
      showToast(`已累加：${existing.name} → ${totalQty}${existing.unit}`)
    } else if (action === 'replace') {
      await updateItem(existing.id, { ...existing, ...newItem, id: existing.id })
      inputText.value = ''
      showToast(`已覆盖：${existing.name} → ${newItem.quantity}${newItem.unit}`)
    } else if (action === 'add') {
      await addItem(newItem)
      inputText.value = ''
      showToast(`已新增：${newItem.name} ${newItem.quantity}${newItem.unit}`)
    }
  } catch {
    showToast('操作失败，请检查网络', 'error')
  }
}
</script>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  background: #f5f5f5;
  padding: 24rpx;
}

.section-title {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20rpx;
  .title-text {
    font-size: 30rpx;
    font-weight: 600;
    color: #333;
  }
  .title-count {
    font-size: 24rpx;
    color: #999;
  }
}

.input-section {
  background: #fff;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 24rpx;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.06);

  .input-textarea {
    width: 100%;
    min-height: 120rpx;
    padding: 16rpx;
    font-size: 28rpx;
    border: 1rpx solid #eee;
    border-radius: 12rpx;
    box-sizing: border-box;
  }

  .voice-row {
    margin-top: 20rpx;
  }

  .voice-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12rpx;
    padding: 20rpx 32rpx;
    background: #f0f0f0;
    border-radius: 12rpx;

    .voice-icon {
      font-size: 40rpx;
    }
    .voice-label {
      font-size: 28rpx;
      color: #666;
    }

    &.recording {
      background: #ffebe6;
      .voice-icon {
        color: #ee0a24;
      }
      .voice-label {
        color: #ee0a24;
      }
    }
    &.disabled {
      opacity: 0.7;
      pointer-events: none;
    }
  }

  .voice-error {
    font-size: 24rpx;
    color: #ee0a24;
    margin-top: 12rpx;
  }

  .btn-row {
    margin-top: 20rpx;
    display: flex;
    gap: 16rpx;
  }

  .btn {
    flex: 1;
    height: 80rpx;
    line-height: 80rpx;
    text-align: center;
    font-size: 28rpx;
    border-radius: 12rpx;
    border: none;

    &.btn-primary {
      background: #07c160;
      color: #fff;
      &[disabled] {
        background: #ccc;
        color: #999;
      }
    }
    &.btn-secondary {
      background: #f5f5f5;
      color: #666;
    }
  }
}

/* 最近录入 */
.recent-section {
  background: #fff;
  border-radius: 16rpx;
  padding: 24rpx;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.06);
}

.recent-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20rpx 0;
  border-bottom: 1rpx solid #f5f5f5;
  &:last-child {
    border-bottom: none;
  }
}

.recent-left {
  flex: 1;
}

.recent-name {
  font-size: 28rpx;
  font-weight: 500;
  color: #333;
  display: block;
}

.recent-meta {
  font-size: 24rpx;
  color: #999;
  margin-top: 4rpx;
  display: block;
}

.recent-cat {
  color: #bbb;
}

.recent-price {
  font-size: 28rpx;
  color: #07c160;
  font-weight: 500;
}

/* 重复商品冲突弹窗 */
.modal-mask {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  background: rgba(0, 0, 0, 0.45);
  z-index: 1000;
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
  font-size: 34rpx;
  font-weight: 600;
  color: #333;
  display: block;
  text-align: center;
  margin-bottom: 20rpx;
}

.modal-desc {
  font-size: 28rpx;
  color: #666;
  line-height: 1.6;
  display: block;
  text-align: center;
  margin-bottom: 32rpx;
}

.modal-highlight {
  color: #07c160;
  font-weight: 600;
}

.modal-actions {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.modal-btn {
  width: 100%;
  height: 80rpx;
  line-height: 80rpx;
  text-align: center;
  font-size: 28rpx;
  border-radius: 12rpx;
  border: none;
  background: #f5f5f5;
  color: #333;
  &.accent {
    background: #07c160;
    color: #fff;
  }
  &.warn {
    background: #ff976a;
    color: #fff;
  }
  &.muted {
    background: transparent;
    color: #999;
    height: 60rpx;
    line-height: 60rpx;
    font-size: 26rpx;
  }
}

.toast {
  position: fixed;
  left: 50%;
  transform: translateX(-50%);
  bottom: 200rpx;
  padding: 16rpx 32rpx;
  font-size: 28rpx;
  border-radius: 12rpx;
  z-index: 999;
  &.success {
    background: rgba(0, 0, 0, 0.7);
    color: #fff;
  }
  &.error {
    background: #ee0a24;
    color: #fff;
  }
}
</style>
