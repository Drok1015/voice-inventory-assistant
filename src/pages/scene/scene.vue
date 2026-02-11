<template>
  <view class="page">
    <!-- Canvas 画布（原生组件，放在最底层） -->
    <canvas
      type="2d"
      id="sceneCanvas"
      class="canvas"
      :style="{ width: canvasWidth + 'px', height: canvasHeight + 'px' }"
      @touchstart="engine.onTouchStart"
      @touchmove="engine.onTouchMove"
      @touchend="engine.onTouchEnd"
    />

    <!-- 顶部操作栏（cover-view 覆盖原生 canvas） -->
    <cover-view class="header-bar">
      <cover-view
        class="mode-toggle"
        :class="{ editing: engine.mode.value === 'edit' }"
        @click="toggleMode"
      >
        <cover-view class="mode-text">
          {{ engine.mode.value === 'view' ? '进入编辑' : '退出编辑' }}
        </cover-view>
      </cover-view>
    </cover-view>

    <!-- 提示文字 -->
    <cover-view v-if="showHint" class="hint">
      <cover-view class="hint-text">{{ hintText }}</cover-view>
    </cover-view>

    <!-- 底部工具栏（仅编辑模式） -->
    <cover-view v-if="engine.mode.value === 'edit'" class="toolbar">
      <cover-view
        class="tool-item"
        :class="{ active: engine.currentTool.value === 'line' }"
        @click="toggleTool('line')"
      >
        <cover-view class="tool-icon">╱</cover-view>
        <cover-view class="tool-label">直线</cover-view>
      </cover-view>
      <cover-view
        class="tool-item"
        :class="{ active: engine.currentTool.value === 'rect' }"
        @click="toggleTool('rect')"
      >
        <cover-view class="tool-icon">▢</cover-view>
        <cover-view class="tool-label">矩形</cover-view>
      </cover-view>
      <cover-view
        class="tool-item"
        :class="{ active: engine.currentTool.value === 'label' }"
        @click="toggleTool('label')"
      >
        <cover-view class="tool-icon">T</cover-view>
        <cover-view class="tool-label">标签</cover-view>
      </cover-view>
      <cover-view class="tool-divider" />
      <cover-view
        v-if="engine.selectedId.value"
        class="tool-item delete"
        @click="handleDelete"
      >
        <cover-view class="tool-icon">✕</cover-view>
        <cover-view class="tool-label">删除</cover-view>
      </cover-view>
      <cover-view class="tool-item" @click="handleUndo">
        <cover-view class="tool-icon">↩</cover-view>
        <cover-view class="tool-label">撤销</cover-view>
      </cover-view>
      <cover-view class="tool-item save" @click="handleSave">
        <cover-view class="tool-icon">✓</cover-view>
        <cover-view class="tool-label">保存</cover-view>
      </cover-view>
    </cover-view>

    <!-- 标签输入弹窗（需要 input 组件，保持 view 并用最高 z-index） -->
    <view v-if="showLabelInput" class="modal-mask" @click="cancelLabelInput">
      <view class="modal-box" @click.stop>
        <text class="modal-title">添加标签</text>
        <input
          v-model="labelText"
          class="modal-input"
          placeholder="输入标签名称（如：客厅、卧室）"
          :focus="showLabelInput"
          @confirm="confirmLabelInput"
        />
        <view class="modal-btns">
          <view class="modal-btn cancel" @click="cancelLabelInput">
            <text>取消</text>
          </view>
          <view class="modal-btn confirm" @click="confirmLabelInput">
            <text>确定</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted, getCurrentInstance } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useSceneCanvas } from '@/composables/useSceneCanvas'
import { useScene } from '@/composables/useScene'

const engine = useSceneCanvas()
const { loadDrawing, saveDrawing } = useScene()
const instance = getCurrentInstance()

const canvasWidth = ref(375)
const canvasHeight = ref(600)
const labelText = ref('')
const isCanvasReady = ref(false)

const showLabelInput = computed(() => !!engine.pendingLabelPos.value)

const showHint = computed(
  () => engine.mode.value === 'view' && engine.elements.value.length === 0,
)

const hintText = computed(() => {
  if (engine.mode.value === 'view' && engine.elements.value.length === 0)
    return '点击右上角「进入编辑」开始绘制户型图'
  return ''
})

onMounted(() => {
  const sysInfo = uni.getSystemInfoSync()
  canvasWidth.value = sysInfo.windowWidth
  canvasHeight.value = sysInfo.windowHeight
  // 等待 canvas 渲染完成
  setTimeout(() => initCanvas(), 150)
})

onShow(() => {
  // Tab 切回时重新渲染
  if (isCanvasReady.value) {
    engine.render()
  }
})

const initCanvas = () => {
  const query = uni.createSelectorQuery().in(instance.proxy)
  query
    .select('#sceneCanvas')
    .fields({ node: true, size: true })
    .exec(async (res) => {
      if (!res[0]) {
        console.error('[scene] 获取 canvas 节点失败')
        return
      }
      const canvas = res[0].node
      const ctx = canvas.getContext('2d')
      const dpr = uni.getSystemInfoSync().pixelRatio

      canvas.width = res[0].width * dpr
      canvas.height = res[0].height * dpr
      ctx.scale(dpr, dpr)

      engine.init(ctx, canvas, res[0].width, res[0].height)
      isCanvasReady.value = true

      // 加载已保存的绘图
      const data = await loadDrawing()
      if (data) {
        engine.loadDrawingData(data)
      }
    })
}

const toggleMode = () => {
  engine.setMode(engine.mode.value === 'view' ? 'edit' : 'view')
}

/** 点击工具按钮：再次点击同一工具取消选中 */
const toggleTool = (tool) => {
  if (engine.currentTool.value === tool) {
    engine.setTool(null)
  } else {
    engine.setTool(tool)
  }
}

const handleDelete = () => {
  engine.deleteSelected()
}

const handleUndo = () => {
  engine.undo()
}

const handleSave = async () => {
  engine.selectedId.value = null
  engine.render()
  const data = engine.getDrawingData()
  const ok = await saveDrawing(data)
  uni.showToast({
    title: ok ? '已保存' : '保存失败',
    icon: ok ? 'success' : 'none',
  })
}

const confirmLabelInput = () => {
  if (labelText.value.trim()) {
    engine.confirmLabel(labelText.value.trim())
  } else {
    engine.cancelLabel()
  }
  labelText.value = ''
}

const cancelLabelInput = () => {
  engine.cancelLabel()
  labelText.value = ''
}
</script>

<style lang="scss" scoped>
.page {
  position: relative;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background: #fff;
}

.canvas {
  display: block;
}

/* 顶部操作栏 */
.header-bar {
  position: fixed;
  top: 12rpx;
  right: 24rpx;
  z-index: 100;
}

.mode-toggle {
  padding: 12rpx 28rpx;
  background-color: rgba(255, 255, 255, 0.92);
  border-radius: 32rpx;
  border: 1rpx solid rgba(0, 0, 0, 0.08);

  &.editing {
    background-color: rgba(7, 193, 96, 0.92);
    border-color: rgba(7, 193, 96, 0.5);
    .mode-text {
      color: #fff;
    }
  }
}

.mode-text {
  font-size: 26rpx;
  color: #333;
  font-weight: 500;
}

/* 提示文字（cover-view 不支持 transform，用定宽居中） */
.hint {
  position: fixed;
  top: 45%;
  left: 0;
  right: 0;
  text-align: center;
  z-index: 50;
}

.hint-text {
  font-size: 28rpx;
  color: #bbb;
}

/* 底部工具栏 */
.toolbar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16rpx 24rpx;
  padding-bottom: calc(16rpx + env(safe-area-inset-bottom));
  background-color: rgba(255, 255, 255, 0.95);
  border-top: 1rpx solid rgba(0, 0, 0, 0.06);
  z-index: 100;
}

.tool-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12rpx 24rpx;
  border-radius: 12rpx;
  min-width: 88rpx;

  &.active {
    background: rgba(7, 193, 96, 0.1);
    .tool-icon,
    .tool-label {
      color: #07c160;
    }
  }

  &.delete {
    .tool-icon,
    .tool-label {
      color: #ee4d2d;
    }
  }

  &.save {
    .tool-icon,
    .tool-label {
      color: #07c160;
    }
  }
}

.tool-icon {
  font-size: 36rpx;
  color: #666;
  line-height: 1;
}

.tool-label {
  font-size: 20rpx;
  color: #999;
  margin-top: 4rpx;
}

.tool-divider {
  width: 1rpx;
  height: 48rpx;
  background: #eee;
  margin: 0 12rpx;
}

/* 标签输入弹窗 */
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
