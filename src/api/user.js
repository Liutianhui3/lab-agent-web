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

export const updatePassword = payload =>
  request({
    method: 'POST',
    url: '/api/v1/user/password',
    data: payload
  })

// 用户管理分页查询接口
export const getUserList = (params = {}) => {
  return request({
    method: 'GET',
    url: '/api/v1/user/page',
    params
  })
}

export const createUser = data => request({ method: 'POST', url: '/api/v1/user/create', data })
export const updateManagedUser = (id, data) =>
  request({ method: 'PUT', url: `/api/v1/user/${encodeURIComponent(id)}`, data })
export const deleteUser = id =>
  request({ method: 'DELETE', url: `/api/v1/user/${encodeURIComponent(id)}` })
