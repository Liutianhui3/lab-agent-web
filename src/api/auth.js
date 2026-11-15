import request from '@/utils/request'

export const register = payload => {
  return request({
    method: 'POST',
    url: '/api/v1/auth/register',
    data: payload
  })
}

export const login = payload => {
  return request({
    method: 'POST',
    url: '/api/v1/auth/login',
    data: payload
  })
}

export const logout = () => {
  return request({
    method: 'POST',
    url: '/api/v1/auth/logout'
  })
}
