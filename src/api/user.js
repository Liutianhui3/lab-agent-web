import request from '@/utils/request'

export const getUserInfo = () => {
  return request({
    method: 'GET',
    url: '/api/v1/user/info'
  })
}

export const updateUser = payload => {
  return request({
    method: 'POST',
    url: '/api/v1/user/update',
    data: payload
  })
}

export const updatePassword = payload => request({
  method: 'POST',
  url: '/api/v1/user/password',
  data: payload
})
