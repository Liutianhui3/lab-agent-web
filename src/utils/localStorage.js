import { USER_INFO } from './constant'

/**
 * 获取 localStorage
 * 自动处理 JSON 解析，若为普通字符串或解析失败则平稳回退
 */
export const getLocalStorage = key => {
  try {
    const value = localStorage.getItem(key)
    if (value === null) return null
    return JSON.parse(value)
  } catch (error) {
    console.error(`Error reading localStorage key "${key}":`, error)
    return localStorage.getItem(key)
  }
}

/**
 * 设置 localStorage
 * 自动将对象、数组等序列化为 JSON 字符串
 */
export const setLocalStorage = (key, value) => {
  try {
    const serializedValue = JSON.stringify(value)
    localStorage.setItem(key, serializedValue)
    if (key === USER_INFO) window.dispatchEvent(new Event('user-info-change'))
  } catch (error) {
    console.error(`Error setting localStorage key "${key}":`, error)
  }
}

/**
 * 删除指定的 localStorage
 */
export const delLocalStorage = key => {
  try {
    localStorage.removeItem(key)
    if (key === USER_INFO) window.dispatchEvent(new Event('user-info-change'))
  } catch (error) {
    console.error(`Error removing localStorage key "${key}":`, error)
  }
}

/**
 * 清空所有的 localStorage
 */
export const clearLocalStorage = () => {
  try {
    localStorage.clear()
    window.dispatchEvent(new Event('user-info-change'))
  } catch (error) {
    console.error('Error clearing localStorage:', error)
  }
}
