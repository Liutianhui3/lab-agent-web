import request from '@/utils/request'
import { getLocalStorage } from '@/utils/localStorage'
import { ACCESS_TOKEN } from '@/utils/constant'
import { clearLogin } from '@/api/responseHandler'

export const listConversations = (page = 1) =>
  request({ url: '/api/v1/conversations', params: { page, size: 30 } }).then(r => r.data)
export const getMessages = (id, page = 1) =>
  request({
    url: `/api/v1/conversations/${encodeURIComponent(id)}/messages`,
    params: { page, size: 100 }
  }).then(r => r.data)
export const deleteConversation = id =>
  request({ method: 'DELETE', url: `/api/v1/conversations/${encodeURIComponent(id)}` })

export async function streamChat(data, signal, onEvent) {
  const token = getLocalStorage(ACCESS_TOKEN)
  const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || ''}/api/v1/chat/stream`, {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      ...(token ? { Authorization: /^Bearer /i.test(token) ? token : `Bearer ${token}` } : {})
    },
    body: JSON.stringify(data)
  })
  if (response.status === 401) {
    clearLogin('/login')
    throw new Error('登录已过期，请重新登录')
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(
      typeof body.detail === 'string' ? body.detail : body.message || '发送失败，请稍后重试'
    )
  }
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = '',
    completed = false
  function consume(block) {
    const lines = block.split('\n')
    const event = lines
      .find(line => line.startsWith('event:'))
      ?.slice(6)
      .trim()
    const payload = lines
      .filter(line => line.startsWith('data:'))
      .map(line => line.slice(5).trimStart())
      .join('\n')
    if (!payload) return
    const value = JSON.parse(payload)
    if (event === 'error') throw new Error(value.message || '回复失败，请稍后重试')
    if (event === 'done') completed = true
    onEvent(event, value)
  }
  try {
    while (true) {
      const { value, done } = await reader.read()
      buffer = (buffer + decoder.decode(value, { stream: !done })).replace(/\r\n/g, '\n')
      let index
      while ((index = buffer.indexOf('\n\n')) >= 0) {
        consume(buffer.slice(0, index))
        buffer = buffer.slice(index + 2)
      }
      if (done) break
    }
    if (buffer.trim()) consume(buffer)
    if (!completed) throw new Error('连接已中断，本次回复未保存，请重试')
  } finally {
    await reader.cancel().catch(() => {})
    reader.releaseLock()
  }
}

export const setMessageFeedback = (conversationId, messageId, feedback) =>
  request({
    method: 'PUT',
    url: '/api/v1/conversations/' + encodeURIComponent(conversationId) +
      '/messages/' + encodeURIComponent(messageId) + '/feedback',
    data: { feedback }
  }).then(response => response.data)
