import request from '@/utils/request'

export function uploadAvatar(file) {
  const data = new FormData()
  data.append('file', file)
  data.append('purpose', 'avatar')
  return request({ method: 'POST', url: '/api/v1/files/upload', data })
}
