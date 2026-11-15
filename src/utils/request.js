import axios from 'axios'
import { getLocalStorage } from './localStorage'
import { ACCESS_TOKEN } from './constant.js'
import { getCacheData, getCacheKey, setCacheData } from './cache'
import { clearLogin } from '@/api/responseHandler'

// 1. 基础 baseURL 配置项
const commonBase = import.meta.env.VITE_API_BASE_URL || ''

// 2. 创建 Axios 实例
const service = axios.create({
  baseURL: commonBase,
  timeout: 60000 // 请求超时时间 (默认 60 秒)
})

/**
 * 统一错误提示
 */
const errorMsg = (msg, title = '请求出现错误') => {
  console.log(msg, title)
  if (msg) {
    // notification.error({
    //   message: title,
    //   description: msg
    // })
  }
}

/**
 * 异常拦截处理器 (处理网络层错误、HTTP 状态码错误、Cancel)
 */
const errorHandler = error => {
  if (axios.isCancel(error) || error.name === 'CanceledError') {
    return Promise.resolve(error.message)
  }

  if (error.response) {
    const { data = {}, status, statusText } = error.response
    const token = getLocalStorage(ACCESS_TOKEN)

    if (status === 401 && token) {
      errorMsg(data.message || '未授权或登录已过期，请重新登录', '认证失败')
      clearLogin(data.data || '/login')
    } else {
      errorMsg(data.message || `请求错误: ${status} ${statusText}`, `错误码: ${status}`)
    }
  } else {
    // 发生在设置请求时触发的错误或超时
    if (error.message) {
      errorMsg(error.message, '网络异常')
    }
  }
  return Promise.reject(error)
}

/**
 * 业务请求失败处理器 (处理后端返回 code 非成功的场景)
 */
const failHandler = resp => {
  if (!resp) return Promise.reject()

  const token = getLocalStorage(ACCESS_TOKEN)
  if (resp.code === 401 && token) {
    clearLogin(resp.data || '/login')
  }

  // 处理 Blob 类型返回的错误信息（如文件下载报错了，后端实际返回的是 JSON 格式的错误 Blob）
  if (resp instanceof Blob && resp.type === 'application/json') {
    const reader = new FileReader()
    reader.readAsText(resp, 'utf-8')
    reader.onload = function () {
      try {
        const parseObj = JSON.parse(reader.result || '{}')
        errorMsg(parseObj.message || parseObj.msg || '未知错误')
      } catch (e) {
        errorMsg('解析错误文件失败')
      }
    }
    return Promise.reject(resp)
  } else {
    const errorMsgText = resp.message || resp.msg || '系统异常'
    errorMsg(errorMsgText)
    return Promise.reject(errorMsgText)
  }
}

// 3. 请求拦截器
service.interceptors.request.use(config => {
  const token = getLocalStorage(ACCESS_TOKEN)
  if (token) {
    config.headers.Authorization = /^Bearer /i.test(token) ? token : `Bearer ${token}`
  }

  // 是否启用自定义缓存配置
  if (config.cache) {
    const cacheKey = getCacheKey(config)
    const cacheData = getCacheData(cacheKey)
    if (cacheData) {
      const controller = new AbortController()
      config.signal = controller.signal
      controller.abort(cacheData)
    }
  }

  return config
}, errorHandler)

// 4. 响应拦截器
service.interceptors.response.use(response => {
  const resData = response.data

  // 兼容处理：流文件信息返回值
  if (resData && resData.type === 'application/json') {
    return resData
  }

  // 文件二进制流下载处理 (octet-stream)
  if (
    response.headers['content-type'] === 'application/octet-stream' ||
    response.headers['content-disposition']
  ) {
    const disposition = response.headers['content-disposition']
    let fileName = 'download_file'
    if (disposition && disposition.includes('=')) {
      try {
        const rawFileName = disposition.split(';')[1].split('=')[1]
        fileName = window.decodeURI(rawFileName.replace(/['"]/g, ''))
      } catch (e) {
        console.warn('解析下载文件名失败', e)
      }
    }
    return {
      data: resData,
      fileName: fileName
    }
  }

  // 业务状态码校验 (以标准的 200 或 0 为成功标志)
  const isSuccess = resData.code === 200 || resData.code === 0 || resData.msg === 'success'

  if (!isSuccess) {
    return failHandler(resData)
  } else {
    // 满足条件则写入缓存
    if (response.config.cache && (resData.code === 200 || resData.code === 0)) {
      const cacheKey = getCacheKey(response.config)
      setCacheData(cacheKey, resData)
    }
    return resData // 直接返回核心数据层
  }
}, errorHandler)

/**
 * 5. 核心暴露的通用 request 方法
 * @param {import('axios').AxiosRequestConfig} config
 */
const request = config => {
  return service(config)
}

export default request
