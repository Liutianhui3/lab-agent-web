import request from '@/utils/request'

export function createReservation(payload) {
  return request({ method: 'POST', url: '/api/v1/reservation/create', data: payload })
}

export async function queryReservations(params = {}) {
  const response = await request({ method: 'GET', url: '/api/v1/reservation/page', params })
  return response.data
}

export function updateReservationStatus(id, status) {
  return request({
    method: 'PATCH',
    url: `/api/v1/reservation/${encodeURIComponent(id)}/status`,
    data: { status }
  })
}
