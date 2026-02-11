import { ref, reactive } from 'vue'

/**
 * Canvas 绘制引擎 composable
 * 管理画布渲染、手势交互、绘图工具、选择/移动/缩放、命中检测
 */
export const useSceneCanvas = () => {
  let ctx = null
  let canvasW = 0
  let canvasH = 0

  // ============ 响应式状态 ============
  const mode = ref('view') // 'view' | 'edit'
  const currentTool = ref(null) // null | 'line' | 'rect' | 'label'
  const elements = ref([])
  const viewport = reactive({ offsetX: 0, offsetY: 0, scale: 1 })
  const pendingLabelPos = ref(null)
  const selectedId = ref(null) // 当前选中元素 ID

  // ============ 常量 ============
  const MIN_SCALE = 0.2
  const MAX_SCALE = 5
  const TAP_THRESHOLD = 10
  const TAP_TIME = 300
  const MOVE_THRESHOLD = 5
  const HANDLE_RADIUS = 8 // 手柄半径（屏幕像素）
  const HANDLE_HIT_RADIUS = 16 // 手柄点击热区

  // ============ 交互状态 ============
  // 'idle' | 'drawing' | 'potential_move' | 'moving' | 'resizing' | 'panning' | 'pinching'
  let interaction = 'idle'
  let drawStartPos = null
  let drawCurrentPos = null
  let lastPinchDist = 0
  let lastPinchCenter = null
  let lastPanPos = null
  let touchStartTime = 0
  let touchStartPos = null
  // 移动/缩放交互
  let interactingEl = null // 正在操作的元素
  let activeHandle = null // 正在拖拽的手柄
  let resizeFixedCorner = null // 矩形缩放时的固定角
  let lastMoveScreenPos = null // 移动时的上一个屏幕位置

  // ============ 初始化 ============
  const init = (context, node, width, height) => {
    ctx = context
    canvasW = width
    canvasH = height
    render()
  }

  // ============ 坐标变换 ============
  const screenToCanvas = (sx, sy) => ({
    x: (sx - viewport.offsetX) / viewport.scale,
    y: (sy - viewport.offsetY) / viewport.scale,
  })

  const generateId = () =>
    `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

  // ============ 渲染 ============
  const render = () => {
    if (!ctx) return
    ctx.clearRect(0, 0, canvasW, canvasH)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvasW, canvasH)

    ctx.save()
    ctx.translate(viewport.offsetX, viewport.offsetY)
    ctx.scale(viewport.scale, viewport.scale)

    drawGrid()
    elements.value.forEach((el) => renderElement(el))

    // 绘制预览
    if (interaction === 'drawing' && drawStartPos && drawCurrentPos) {
      renderPreview()
    }

    // 绘制选中状态（手柄）
    renderSelection()

    ctx.restore()
  }

  const drawGrid = () => {
    const gridSize = 50
    ctx.strokeStyle = '#f0f0f0'
    ctx.lineWidth = 0.5 / viewport.scale
    const topLeft = screenToCanvas(0, 0)
    const bottomRight = screenToCanvas(canvasW, canvasH)
    const startX = Math.floor(topLeft.x / gridSize) * gridSize
    const startY = Math.floor(topLeft.y / gridSize) * gridSize
    const endX = Math.ceil(bottomRight.x / gridSize) * gridSize
    const endY = Math.ceil(bottomRight.y / gridSize) * gridSize
    ctx.beginPath()
    for (let x = startX; x <= endX; x += gridSize) {
      ctx.moveTo(x, startY)
      ctx.lineTo(x, endY)
    }
    for (let y = startY; y <= endY; y += gridSize) {
      ctx.moveTo(startX, y)
      ctx.lineTo(endX, y)
    }
    ctx.stroke()
  }

  const renderElement = (el) => {
    const isSelected = el.id === selectedId.value
    switch (el.type) {
      case 'line': {
        ctx.beginPath()
        ctx.moveTo(el.x1, el.y1)
        ctx.lineTo(el.x2, el.y2)
        ctx.strokeStyle = isSelected ? '#07c160' : (el.color || '#333333')
        ctx.lineWidth = el.lineWidth || 2
        ctx.lineCap = 'round'
        ctx.stroke()
        break
      }
      case 'rect': {
        ctx.beginPath()
        ctx.rect(el.x, el.y, el.width, el.height)
        ctx.strokeStyle = isSelected ? '#07c160' : (el.color || '#333333')
        ctx.lineWidth = el.lineWidth || 2
        ctx.stroke()
        break
      }
      case 'label':
        renderLabel(el)
        break
    }
  }

  const renderLabel = (el) => {
    const fontSize = el.fontSize || 14
    ctx.font = `bold ${fontSize}px sans-serif`
    const text = el.text || ''
    let textWidth
    try { textWidth = ctx.measureText(text).width } catch { textWidth = text.length * fontSize * 0.6 }

    const padding = 8
    const bgH = fontSize + padding * 2
    const bgW = textWidth + padding * 2
    const radius = 4
    const bgX = el.x - padding
    const bgY = el.y - fontSize - padding + 2
    const isSelected = el.id === selectedId.value

    ctx.fillStyle = isSelected
      ? 'rgba(7, 193, 96, 0.25)'
      : mode.value === 'view' ? 'rgba(7, 193, 96, 0.18)' : 'rgba(7, 193, 96, 0.1)'
    roundRect(bgX, bgY, bgW, bgH, radius)
    ctx.fill()

    ctx.strokeStyle = '#07c160'
    ctx.lineWidth = isSelected ? 2 : 1
    roundRect(bgX, bgY, bgW, bgH, radius)
    ctx.stroke()

    ctx.fillStyle = '#07c160'
    ctx.textBaseline = 'alphabetic'
    ctx.fillText(text, el.x, el.y)

    el._hitX = bgX
    el._hitY = bgY
    el._hitW = bgW
    el._hitH = bgH
  }

  const roundRect = (x, y, w, h, r) => {
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.lineTo(x + w - r, y)
    ctx.arcTo(x + w, y, x + w, y + r, r)
    ctx.lineTo(x + w, y + h - r)
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
    ctx.lineTo(x + r, y + h)
    ctx.arcTo(x, y + h, x, y + h - r, r)
    ctx.lineTo(x, y + r)
    ctx.arcTo(x, y, x + r, y, r)
    ctx.closePath()
  }

  const renderPreview = () => {
    ctx.strokeStyle = 'rgba(51, 51, 51, 0.5)'
    ctx.lineWidth = 2
    if (currentTool.value === 'line') {
      ctx.beginPath()
      ctx.moveTo(drawStartPos.x, drawStartPos.y)
      ctx.lineTo(drawCurrentPos.x, drawCurrentPos.y)
      ctx.stroke()
    } else if (currentTool.value === 'rect') {
      const x = Math.min(drawStartPos.x, drawCurrentPos.x)
      const y = Math.min(drawStartPos.y, drawCurrentPos.y)
      ctx.beginPath()
      ctx.rect(x, y, Math.abs(drawCurrentPos.x - drawStartPos.x), Math.abs(drawCurrentPos.y - drawStartPos.y))
      ctx.stroke()
    }
  }

  /** 渲染选中元素的手柄 */
  const renderSelection = () => {
    if (!selectedId.value || mode.value !== 'edit') return
    const el = elements.value.find((e) => e.id === selectedId.value)
    if (!el) return

    const handles = getHandlePositions(el)
    if (handles.length === 0) return

    const r = HANDLE_RADIUS / viewport.scale

    handles.forEach((h) => {
      ctx.beginPath()
      ctx.arc(h.x, h.y, r, 0, Math.PI * 2)
      ctx.fillStyle = '#ffffff'
      ctx.fill()
      ctx.strokeStyle = '#07c160'
      ctx.lineWidth = 2 / viewport.scale
      ctx.stroke()
    })
  }

  // ============ 手柄位置 ============
  const getHandlePositions = (el) => {
    if (el.type === 'rect') {
      return [
        { x: el.x, y: el.y, type: 'nw' },
        { x: el.x + el.width, y: el.y, type: 'ne' },
        { x: el.x, y: el.y + el.height, type: 'sw' },
        { x: el.x + el.width, y: el.y + el.height, type: 'se' },
      ]
    }
    if (el.type === 'line') {
      return [
        { x: el.x1, y: el.y1, type: 'start' },
        { x: el.x2, y: el.y2, type: 'end' },
      ]
    }
    return [] // 标签无手柄，只支持拖动
  }

  // ============ 命中检测 ============
  /** 检测是否点击到选中元素的手柄 */
  const hitTestHandle = (cx, cy) => {
    if (!selectedId.value) return null
    const el = elements.value.find((e) => e.id === selectedId.value)
    if (!el) return null
    const handles = getHandlePositions(el)
    const hitR = HANDLE_HIT_RADIUS / viewport.scale
    for (const h of handles) {
      const dx = cx - h.x
      const dy = cy - h.y
      if (dx * dx + dy * dy <= hitR * hitR) return h
    }
    return null
  }

  /** 检测是否点击到任意元素体（从上到下） */
  const hitTestElement = (cx, cy) => {
    for (let i = elements.value.length - 1; i >= 0; i--) {
      if (isPointInElement(cx, cy, elements.value[i])) return elements.value[i]
    }
    return null
  }

  const isPointInElement = (cx, cy, el) => {
    const threshold = 10 / viewport.scale
    if (el.type === 'rect') {
      // 点击边框附近或内部都可选中
      return (
        cx >= el.x - threshold &&
        cx <= el.x + el.width + threshold &&
        cy >= el.y - threshold &&
        cy <= el.y + el.height + threshold
      )
    }
    if (el.type === 'line') {
      return pointToSegmentDist(cx, cy, el.x1, el.y1, el.x2, el.y2) < threshold
    }
    if (el.type === 'label') {
      if (el._hitX !== undefined) {
        return cx >= el._hitX && cx <= el._hitX + el._hitW && cy >= el._hitY && cy <= el._hitY + el._hitH
      }
      const fs = el.fontSize || 14
      const p = 8
      const ew = el.text.length * fs * 0.7
      return cx >= el.x - p && cx <= el.x + ew + p && cy >= el.y - fs - p && cy <= el.y + p
    }
    return false
  }

  /** 点到线段距离 */
  const pointToSegmentDist = (px, py, x1, y1, x2, y2) => {
    const dx = x2 - x1
    const dy = y2 - y1
    const lenSq = dx * dx + dy * dy
    if (lenSq === 0) return Math.sqrt((px - x1) ** 2 + (py - y1) ** 2)
    let t = ((px - x1) * dx + (py - y1) * dy) / lenSq
    t = Math.max(0, Math.min(1, t))
    return Math.sqrt((px - (x1 + t * dx)) ** 2 + (py - (y1 + t * dy)) ** 2)
  }

  // ============ 元素操作 ============
  const moveElement = (el, dxScreen, dyScreen) => {
    const dx = dxScreen / viewport.scale
    const dy = dyScreen / viewport.scale
    if (el.type === 'rect') { el.x += dx; el.y += dy }
    else if (el.type === 'line') { el.x1 += dx; el.y1 += dy; el.x2 += dx; el.y2 += dy }
    else if (el.type === 'label') { el.x += dx; el.y += dy }
  }

  const resizeElement = (el, handle, cx, cy) => {
    if (el.type === 'rect' && resizeFixedCorner) {
      el.x = Math.min(resizeFixedCorner.x, cx)
      el.y = Math.min(resizeFixedCorner.y, cy)
      el.width = Math.abs(cx - resizeFixedCorner.x)
      el.height = Math.abs(cy - resizeFixedCorner.y)
    } else if (el.type === 'line') {
      if (handle.type === 'start') { el.x1 = cx; el.y1 = cy }
      else { el.x2 = cx; el.y2 = cy }
    }
  }

  // ============ 触摸工具 ============
  const getTouchPos = (touch) => ({
    x: touch.x ?? touch.clientX ?? 0,
    y: touch.y ?? touch.clientY ?? 0,
  })
  const getDistance = (p1, p2) => Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2)
  const getMidpoint = (p1, p2) => ({ x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 })

  // ============ 触摸事件 ============
  const onTouchStart = (e) => {
    const touches = e.touches

    // 双指缩放
    if (touches.length >= 2) {
      abortInteraction()
      const p1 = getTouchPos(touches[0])
      const p2 = getTouchPos(touches[1])
      interaction = 'pinching'
      lastPinchDist = getDistance(p1, p2)
      lastPinchCenter = getMidpoint(p1, p2)
      return
    }

    const pos = getTouchPos(touches[0])
    touchStartTime = Date.now()
    touchStartPos = { ...pos }

    // ---- 编辑模式 ----
    if (mode.value === 'edit') {
      // 有绘图工具选中：开始绘制
      if (currentTool.value === 'line' || currentTool.value === 'rect') {
        interaction = 'drawing'
        drawStartPos = screenToCanvas(pos.x, pos.y)
        drawCurrentPos = { ...drawStartPos }
        return
      }
      // 标签工具：拖拽时平移，轻触时在 touchEnd 放置标签
      if (currentTool.value === 'label') {
        interaction = 'panning'
        lastPanPos = { ...pos }
        return
      }

      // 无工具（选择模式）
      const canvasPos = screenToCanvas(pos.x, pos.y)

      // 1. 检查手柄
      const handle = hitTestHandle(canvasPos.x, canvasPos.y)
      if (handle) {
        const el = elements.value.find((e) => e.id === selectedId.value)
        if (el) {
          interaction = 'resizing'
          interactingEl = el
          activeHandle = handle
          if (el.type === 'rect') {
            // 记录固定角（对角）
            const corners = { nw: { x: el.x + el.width, y: el.y + el.height }, ne: { x: el.x, y: el.y + el.height }, sw: { x: el.x + el.width, y: el.y }, se: { x: el.x, y: el.y } }
            resizeFixedCorner = corners[handle.type] || null
          }
          return
        }
      }

      // 2. 检查元素体
      const hitEl = hitTestElement(canvasPos.x, canvasPos.y)
      if (hitEl) {
        interaction = 'potential_move'
        interactingEl = hitEl
        lastMoveScreenPos = { ...pos }
        return
      }

      // 3. 空白区域：平移
      interaction = 'panning'
      lastPanPos = { ...pos }
      return
    }

    // ---- 查看模式 ----
    interaction = 'panning'
    lastPanPos = { ...pos }
  }

  const onTouchMove = (e) => {
    const touches = e.touches

    // 双指缩放
    if (touches.length >= 2 || interaction === 'pinching') {
      if (interaction !== 'pinching') abortInteraction()
      if (touches.length < 2) return
      const p1 = getTouchPos(touches[0])
      const p2 = getTouchPos(touches[1])
      const dist = getDistance(p1, p2)
      const center = getMidpoint(p1, p2)

      if (interaction === 'pinching' && lastPinchDist > 0) {
        const ratio = dist / lastPinchDist
        const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, viewport.scale * ratio))
        const cc = screenToCanvas(center.x, center.y)
        viewport.scale = newScale
        viewport.offsetX = center.x - cc.x * newScale
        viewport.offsetY = center.y - cc.y * newScale
        if (lastPinchCenter) {
          viewport.offsetX += center.x - lastPinchCenter.x
          viewport.offsetY += center.y - lastPinchCenter.y
        }
      }
      lastPinchDist = dist
      lastPinchCenter = center
      interaction = 'pinching'
      render()
      return
    }

    const pos = getTouchPos(touches[0])

    if (interaction === 'drawing') {
      drawCurrentPos = screenToCanvas(pos.x, pos.y)
      render()
    } else if (interaction === 'potential_move') {
      if (getDistance(pos, touchStartPos) > MOVE_THRESHOLD) {
        interaction = 'moving'
        selectedId.value = interactingEl.id
        lastMoveScreenPos = { ...pos }
        render()
      }
    } else if (interaction === 'moving' && interactingEl && lastMoveScreenPos) {
      const dx = pos.x - lastMoveScreenPos.x
      const dy = pos.y - lastMoveScreenPos.y
      moveElement(interactingEl, dx, dy)
      lastMoveScreenPos = { ...pos }
      render()
    } else if (interaction === 'resizing' && interactingEl && activeHandle) {
      const cp = screenToCanvas(pos.x, pos.y)
      resizeElement(interactingEl, activeHandle, cp.x, cp.y)
      render()
    } else if (interaction === 'panning' && lastPanPos) {
      viewport.offsetX += pos.x - lastPanPos.x
      viewport.offsetY += pos.y - lastPanPos.y
      lastPanPos = { ...pos }
      render()
    }
  }

  const onTouchEnd = (e) => {
    if (interaction === 'pinching') {
      interaction = 'idle'
      lastPinchDist = 0
      lastPinchCenter = null
      return
    }

    const pos = e.changedTouches ? getTouchPos(e.changedTouches[0]) : touchStartPos
    const isTap =
      touchStartPos && pos &&
      Math.abs(pos.x - touchStartPos.x) < TAP_THRESHOLD &&
      Math.abs(pos.y - touchStartPos.y) < TAP_THRESHOLD &&
      Date.now() - touchStartTime < TAP_TIME

    // 完成绘制 -> 自动取消工具
    if (interaction === 'drawing' && drawStartPos && drawCurrentPos) {
      const dist = getDistance(drawStartPos, drawCurrentPos)
      if (dist > 3) {
        if (currentTool.value === 'line') {
          elements.value.push({ type: 'line', id: generateId(), x1: drawStartPos.x, y1: drawStartPos.y, x2: drawCurrentPos.x, y2: drawCurrentPos.y, color: '#333333', lineWidth: 2 })
        } else if (currentTool.value === 'rect') {
          elements.value.push({ type: 'rect', id: generateId(), x: Math.min(drawStartPos.x, drawCurrentPos.x), y: Math.min(drawStartPos.y, drawCurrentPos.y), width: Math.abs(drawCurrentPos.x - drawStartPos.x), height: Math.abs(drawCurrentPos.y - drawStartPos.y), color: '#333333', lineWidth: 2 })
        }
      }
      drawStartPos = null
      drawCurrentPos = null
      currentTool.value = null // 绘制完成自动取消工具
      interaction = 'idle'
      render()
      return
    }

    // 完成缩放
    if (interaction === 'resizing') {
      interaction = 'idle'
      interactingEl = null
      activeHandle = null
      resizeFixedCorner = null
      render()
      return
    }

    // 完成移动
    if (interaction === 'moving') {
      interaction = 'idle'
      interactingEl = null
      lastMoveScreenPos = null
      render()
      return
    }

    // potential_move 未触发移动 -> 视为点击选择
    if (interaction === 'potential_move' && interactingEl) {
      selectedId.value = interactingEl.id
      interaction = 'idle'
      interactingEl = null
      render()
      return
    }

    // 平移中的轻触
    if (interaction === 'panning' && isTap && pos) {
      const canvasPos = screenToCanvas(pos.x, pos.y)

      if (mode.value === 'edit') {
        // 标签工具
        if (currentTool.value === 'label' && !pendingLabelPos.value) {
          pendingLabelPos.value = canvasPos
        } else {
          // 选择模式：点空白取消选中
          selectedId.value = null
          render()
        }
      } else {
        // 查看模式：点标签跳转
        const hitLabel = hitTestLabel(canvasPos.x, canvasPos.y)
        if (hitLabel) {
          uni.navigateTo({
            url: `/pages/scene-label/scene-label?id=${hitLabel.id}&text=${encodeURIComponent(hitLabel.text)}`,
          })
        }
      }
    }

    interaction = 'idle'
    lastPanPos = null
    touchStartPos = null
  }

  /** 中止当前交互 */
  const abortInteraction = () => {
    if (interaction === 'drawing') {
      drawStartPos = null
      drawCurrentPos = null
    }
    interaction = 'idle'
    interactingEl = null
    activeHandle = null
    resizeFixedCorner = null
    lastMoveScreenPos = null
    lastPanPos = null
  }

  /** 检测标签命中（查看模式用） */
  const hitTestLabel = (cx, cy) => {
    for (let i = elements.value.length - 1; i >= 0; i--) {
      const el = elements.value[i]
      if (el.type !== 'label') continue
      if (el._hitX !== undefined &&
        cx >= el._hitX && cx <= el._hitX + el._hitW &&
        cy >= el._hitY && cy <= el._hitY + el._hitH) return el
    }
    return null
  }

  // ============ 标签管理 ============
  const confirmLabel = (text) => {
    if (!text || !pendingLabelPos.value) return
    elements.value.push({
      type: 'label', id: generateId(),
      x: pendingLabelPos.value.x, y: pendingLabelPos.value.y,
      text: text.trim(), fontSize: 14, color: '#07c160',
    })
    pendingLabelPos.value = null
    currentTool.value = null // 自动取消工具
    render()
  }

  const cancelLabel = () => {
    pendingLabelPos.value = null
  }

  // ============ 工具方法 ============
  const setMode = (m) => {
    mode.value = m
    currentTool.value = null
    selectedId.value = null
    abortInteraction()
    pendingLabelPos.value = null
    render()
  }

  const setTool = (tool) => {
    currentTool.value = tool
    selectedId.value = null
    abortInteraction()
  }

  const undo = () => {
    selectedId.value = null
    if (elements.value.length > 0) {
      elements.value.pop()
      render()
    }
  }

  /** 删除当前选中元素 */
  const deleteSelected = () => {
    if (!selectedId.value) return
    const idx = elements.value.findIndex((e) => e.id === selectedId.value)
    if (idx !== -1) {
      elements.value.splice(idx, 1)
      selectedId.value = null
      render()
    }
  }

  // ============ 数据导入导出 ============
  const getDrawingData = () => ({
    version: 1,
    viewport: { offsetX: viewport.offsetX, offsetY: viewport.offsetY, scale: viewport.scale },
    elements: elements.value.map(({ _hitX, _hitY, _hitW, _hitH, ...clean }) => clean),
  })

  const loadDrawingData = (data) => {
    if (!data) return
    if (data.viewport) {
      viewport.offsetX = data.viewport.offsetX ?? 0
      viewport.offsetY = data.viewport.offsetY ?? 0
      viewport.scale = data.viewport.scale ?? 1
    }
    if (data.elements) elements.value = data.elements
    selectedId.value = null
    render()
  }

  return {
    mode, currentTool, elements, viewport, pendingLabelPos, selectedId,
    init, render, setMode, setTool,
    onTouchStart, onTouchMove, onTouchEnd,
    confirmLabel, cancelLabel, undo, deleteSelected,
    getDrawingData, loadDrawingData,
  }
}
