/**
 * 页面请求 Loading 统一管理（支持并发请求计数，全部结束后再关闭）
 */
let loadingCount = 0

export const showPageLoading = (title = '加载中...') => {
  loadingCount += 1
  if (loadingCount === 1) {
    uni.showLoading({ title, mask: true })
  }
}

export const hidePageLoading = () => {
  loadingCount = Math.max(0, loadingCount - 1)
  if (loadingCount === 0) {
    uni.hideLoading()
  }
}

/**
 * 包装 Promise，在请求期间显示 loading，结束后关闭（并发时只显示一个 loading）
 * @param {Promise} promise
 * @param {string} [title='加载中...']
 * @returns {Promise}
 */
export const withPageLoading = (promise, title = '加载中...') => {
  showPageLoading(title)
  return Promise.resolve(promise).finally(hidePageLoading)
}
