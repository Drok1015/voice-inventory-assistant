<template>
  <view class="page">
    <view class="label-header">
      <text class="label-title">{{ labelText }}</text>
    </view>
    <view class="label-content">
      <!-- 暂留空白，后续扩展 -->
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'

const labelText = ref('')

onLoad((options) => {
  labelText.value = decodeURIComponent(options?.text || '')
  if (labelText.value) {
    uni.setNavigationBarTitle({ title: labelText.value })
  }
})
</script>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  background: #f5f5f5;
}

.label-header {
  padding: 40rpx 24rpx;
  background: #fff;
  border-bottom: 1rpx solid #eee;
}

.label-title {
  font-size: 36rpx;
  font-weight: 600;
  color: #333;
}

.label-content {
  padding: 24rpx;
}
</style>
