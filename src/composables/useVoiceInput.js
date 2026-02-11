import { ref, onUnmounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'

const APPID = import.meta.env.VITE_TCLOUD_APPID || ''
const SECRET_ID = import.meta.env.VITE_TCLOUD_SECRET_ID || ''
const SECRET_KEY = import.meta.env.VITE_TCLOUD_SECRET_KEY || ''

/* ================================================================
   小程序兼容工具（无 TextEncoder / btoa / crypto.subtle）
   ================================================================ */

/** 字符串 → UTF-8 Uint8Array */
const utf8Encode = (str) => {
  const bytes = []
  for (let i = 0; i < str.length; i++) {
    let c = str.charCodeAt(i)
    if (c < 0x80) {
      bytes.push(c)
    } else if (c < 0x800) {
      bytes.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f))
    } else if (c >= 0xd800 && c <= 0xdbff) {
      const lo = str.charCodeAt(++i)
      c = 0x10000 + ((c - 0xd800) << 10) + (lo - 0xdc00)
      bytes.push(
        0xf0 | (c >> 18),
        0x80 | ((c >> 12) & 0x3f),
        0x80 | ((c >> 6) & 0x3f),
        0x80 | (c & 0x3f),
      )
    } else {
      bytes.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f))
    }
  }
  return new Uint8Array(bytes)
}

/** Uint8Array → base64 字符串（优先使用 uni API） */
const toBase64 = (data) => {
  const buf =
    data instanceof ArrayBuffer
      ? data
      : data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)
  if (typeof uni !== 'undefined' && uni.arrayBufferToBase64) return uni.arrayBufferToBase64(buf)
  const bytes = new Uint8Array(buf)
  const C = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  let r = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const b1 = bytes[i],
      b2 = bytes[i + 1] || 0,
      b3 = bytes[i + 2] || 0
    r += C[b1 >> 2] + C[((b1 & 3) << 4) | (b2 >> 4)]
    r += i + 1 < bytes.length ? C[((b2 & 15) << 2) | (b3 >> 6)] : '='
    r += i + 2 < bytes.length ? C[b3 & 63] : '='
  }
  return r
}

/* ================================================================
   纯 JS SHA-1 + HMAC-SHA1
   ================================================================ */

const sha1 = (data) => {
  const len = data.length
  const bitLen = len * 8
  const padLen = len % 64 < 56 ? 56 - (len % 64) : 120 - (len % 64)
  const padded = new Uint8Array(len + padLen + 8)
  padded.set(data)
  padded[len] = 0x80
  const dv = new DataView(padded.buffer)
  dv.setUint32(padded.length - 8, Math.floor(bitLen / 0x100000000), false)
  dv.setUint32(padded.length - 4, bitLen >>> 0, false)

  let h0 = 0x67452301,
    h1 = 0xefcdab89,
    h2 = 0x98badcfe,
    h3 = 0x10325476,
    h4 = 0xc3d2e1f0

  for (let blk = 0; blk < padded.length; blk += 64) {
    const W = new Uint32Array(80)
    const bv = new DataView(padded.buffer, blk, 64)
    for (let i = 0; i < 16; i++) W[i] = bv.getUint32(i * 4, false)
    for (let i = 16; i < 80; i++) {
      const n = W[i - 3] ^ W[i - 8] ^ W[i - 14] ^ W[i - 16]
      W[i] = (n << 1) | (n >>> 31)
    }
    let a = h0,
      b = h1,
      c = h2,
      d = h3,
      e = h4
    for (let i = 0; i < 80; i++) {
      let f, k
      if (i < 20) {
        f = (b & c) | (~b & d)
        k = 0x5a827999
      } else if (i < 40) {
        f = b ^ c ^ d
        k = 0x6ed9eba1
      } else if (i < 60) {
        f = (b & c) | (b & d) | (c & d)
        k = 0x8f1bbcdc
      } else {
        f = b ^ c ^ d
        k = 0xca62c1d6
      }
      const t = (((a << 5) | (a >>> 27)) + f + e + k + W[i]) | 0
      e = d
      d = c
      c = (b << 30) | (b >>> 2)
      b = a
      a = t
    }
    h0 = (h0 + a) | 0
    h1 = (h1 + b) | 0
    h2 = (h2 + c) | 0
    h3 = (h3 + d) | 0
    h4 = (h4 + e) | 0
  }
  const out = new Uint8Array(20)
  const ov = new DataView(out.buffer)
  ov.setUint32(0, h0, false)
  ov.setUint32(4, h1, false)
  ov.setUint32(8, h2, false)
  ov.setUint32(12, h3, false)
  ov.setUint32(16, h4, false)
  return out
}

const concatU8 = (a, b) => {
  const r = new Uint8Array(a.length + b.length)
  r.set(a)
  r.set(b, a.length)
  return r
}

const hmacSha1Base64 = (keyStr, msgStr) => {
  let keyBytes = utf8Encode(keyStr)
  const msgBytes = utf8Encode(msgStr)
  const BLOCK = 64
  if (keyBytes.length > BLOCK) keyBytes = sha1(keyBytes)
  const padKey = new Uint8Array(BLOCK)
  padKey.set(keyBytes)
  const ipad = new Uint8Array(BLOCK)
  const opad = new Uint8Array(BLOCK)
  for (let i = 0; i < BLOCK; i++) {
    ipad[i] = padKey[i] ^ 0x36
    opad[i] = padKey[i] ^ 0x5c
  }
  return toBase64(sha1(concatU8(opad, sha1(concatU8(ipad, msgBytes)))))
}

/* ================================================================
   签名 & WebSocket URL
   ================================================================ */

const generateUUID = () =>
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0
    return (ch === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })

const buildWsUrl = () => {
  const timestamp = Math.floor(Date.now() / 1000)
  const expired = timestamp + 86400
  const nonce = Math.floor(Math.random() * 1e9)
  const voiceId = generateUUID()

  const params = {
    secretid: SECRET_ID,
    timestamp: String(timestamp),
    expired: String(expired),
    nonce: String(nonce),
    engine_model_type: '16k_zh',
    voice_id: voiceId,
    voice_format: '1', // PCM
    needvad: '1',
    filter_dirty: '0',
    filter_modal: '0',
    filter_punc: '0',
    convert_num_mode: '1',
    word_info: '0',
  }

  const sortedKeys = Object.keys(params).sort()
  const queryString = sortedKeys.map((k) => `${k}=${params[k]}`).join('&')
  const signStr = `asr.cloud.tencent.com/asr/v2/${APPID}?${queryString}`
  const signature = hmacSha1Base64(SECRET_KEY, signStr)

  console.log('[tcloud] signStr:', signStr)
  return `wss://asr.cloud.tencent.com/asr/v2/${APPID}?${queryString}&signature=${encodeURIComponent(signature)}`
}

/* ================================================================
   Composable
   ================================================================ */

export const useVoiceInput = () => {
  const isRecording = ref(false)
  const isRequestingPermission = ref(false)
  const isSupported = ref(true) // 小程序始终支持录音
  const errorMsg = ref('')

  let recorderManager = null
  let socketTask = null
  let accumulatedText = ''
  let currentSegmentText = ''
  let onResultCb = null
  let onErrorCb = null
  let closeTimer = null
  let hasConnected = false

  // 检查 API Key 是否配置
  if (!APPID || !SECRET_ID || !SECRET_KEY) {
    isSupported.value = false
  }

  /** 初始化 RecorderManager（只创建一次） */
  let frameCount = 0

  const initRecorder = () => {
    if (recorderManager) return
    recorderManager = uni.getRecorderManager()

    recorderManager.onStart(() => {
      console.log('[recorder] started')
      frameCount = 0
    })

    recorderManager.onFrameRecorded((res) => {
      frameCount++
      if (frameCount <= 3 || frameCount % 50 === 0) {
        console.log(
          `[recorder] frame #${frameCount}, size=${res.frameBuffer?.byteLength || 0}, isLast=${res.isLastFrame}`,
        )
      }
      if (!socketTask || !res.frameBuffer || res.frameBuffer.byteLength === 0) {
        console.warn(
          '[recorder] skip frame: socketTask=',
          !!socketTask,
          'bufSize=',
          res.frameBuffer?.byteLength,
        )
        return
      }
      // 发送 PCM 二进制帧
      socketTask.send({
        data: res.frameBuffer,
        fail: (err) => console.error('[tcloud] send frame fail:', err),
      })
    })

    recorderManager.onError((err) => {
      console.error('[recorder] error:', err)
      errorMsg.value = '录音失败: ' + (err.errMsg || '未知错误')
      onErrorCb?.('recorder-error')
      cleanup()
    })

    recorderManager.onStop(() => {
      console.log('[recorder] stopped, total frames sent:', frameCount)
    })
  }

  const fullText = () => accumulatedText + currentSegmentText

  /* -- WebSocket 消息处理 -- */
  const onSocketMessage = (res) => {
    try {
      const msg = JSON.parse(typeof res.data === 'string' ? res.data : '')

      if (msg.code !== 0) {
        console.error('[tcloud] error:', msg.code, msg.message)
        errorMsg.value = `识别错误: ${msg.message} (${msg.code})`
        onErrorCb?.(msg.message)
        return
      }

      // 握手成功
      if (!hasConnected && msg.code === 0) {
        hasConnected = true
      }

      // 识别全部结束
      if (msg.final === 1) {
        console.log('[tcloud] final received')
        onResultCb?.(fullText())
        closeSocket()
        return
      }

      const result = msg.result
      if (!result) return

      const { slice_type, voice_text_str = '' } = result
      if (slice_type === 0 || slice_type === 1) {
        currentSegmentText = voice_text_str
      } else if (slice_type === 2) {
        accumulatedText += voice_text_str
        currentSegmentText = ''
      }

      onResultCb?.(fullText())
    } catch (err) {
      console.error('[tcloud] parse error:', err)
    }
  }

  /* -- 清理 -- */
  const closeSocket = () => {
    if (closeTimer) {
      clearTimeout(closeTimer)
      closeTimer = null
    }
    if (socketTask) {
      try {
        socketTask.close()
      } catch {}
      socketTask = null
    }
  }

  const cleanup = () => {
    if (recorderManager && isRecording.value) {
      try {
        recorderManager.stop()
      } catch {}
    }
    closeSocket()
    isRecording.value = false
    hasConnected = false
  }

  /* ======== 公共 API ======== */

  const start = (resultCb, errorCb) => {
    if (!isSupported.value) {
      errorMsg.value = '腾讯云语音识别未配置'
      errorCb?.('not-configured')
      return
    }
    if (isRecording.value) return

    initRecorder()
    isRequestingPermission.value = true
    errorMsg.value = ''
    onResultCb = resultCb
    onErrorCb = errorCb
    accumulatedText = ''
    currentSegmentText = ''
    hasConnected = false

    // 1. 请求麦克风权限
    uni.authorize({
      scope: 'scope.record',
      success: () => {
        isRequestingPermission.value = false
        connectAndRecord()
      },
      fail: () => {
        isRequestingPermission.value = false
        // 可能是第一次被拒绝，引导用户去设置
        uni.showModal({
          title: '需要录音权限',
          content: '请在设置中允许录音权限',
          confirmText: '去设置',
          success: (res) => {
            if (res.confirm) uni.openSetting()
          },
        })
        errorMsg.value = '请允许录音权限后重试'
        errorCb?.('not-allowed')
      },
    })
  }

  /** 授权成功后：连接 WebSocket → 开始录音 */
  const connectAndRecord = () => {
    const url = buildWsUrl()
    console.log('[tcloud] connecting...')

    // 使用 wx.connectSocket 获取 SocketTask（uni.connectSocket 在小程序中不直接返回 SocketTask）
    socketTask = wx.connectSocket({ url })

    socketTask.onOpen(() => {
      console.log('[tcloud] socket connected, starting recorder...')
      isRecording.value = true
      // 开始录音：PCM 16kHz 单声道，每帧约 3KB（~96ms）
      const recorderOptions = {
        format: 'PCM',
        sampleRate: 16000,
        numberOfChannels: 1,
        frameSize: 3,
      }
      console.log('[recorder] start options:', JSON.stringify(recorderOptions))
      recorderManager.start(recorderOptions)
    })

    socketTask.onMessage(onSocketMessage)

    socketTask.onError((err) => {
      console.error('[tcloud] socket error:', err)
      errorMsg.value = '语音识别连接失败，请检查网络'
      onErrorCb?.('ws-error')
      cleanup()
    })

    socketTask.onClose(() => {
      console.log('[tcloud] socket closed')
      if (isRecording.value) cleanup()
    })
  }

  const stop = () => {
    if (!isRecording.value) {
      isRecording.value = false
      return
    }
    isRecording.value = false

    // 1. 停止录音
    if (recorderManager) recorderManager.stop()

    // 2. 等待 500ms 让剩余帧发送完毕，然后发送结束信号
    setTimeout(() => {
      if (!socketTask) return
      console.log('[tcloud] sending end signal...')
      socketTask.send({
        data: JSON.stringify({ type: 'end' }),
        success: () => console.log('[tcloud] end signal sent'),
        fail: (err) => console.error('[tcloud] send end fail:', err),
      })
      // 3. 等待服务端返回最终识别结果，超时 5s 后关闭
      closeTimer = setTimeout(() => {
        console.log('[tcloud] close timeout, force close')
        closeSocket()
      }, 5000)
    }, 500)
  }

  onUnmounted(() => cleanup())

  const reset = () => {
    cleanup()
    isRequestingPermission.value = false
    errorMsg.value = ''
  }

  return {
    isRecording,
    isRequestingPermission,
    isSupported,
    errorMsg,
    start,
    stop,
    reset,
  }
}
