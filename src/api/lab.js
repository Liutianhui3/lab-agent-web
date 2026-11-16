import request from '@/utils/request'

const timeFromApi = value => (value ? value.slice(0, 5) : value)

const fromApi = lab => {
  const { labCode, openTime, closeTime, createdAt, updatedAt, ...rest } = lab
  return {
    ...rest,
    lab_code: labCode,
    open_time: timeFromApi(openTime),
    close_time: timeFromApi(closeTime),
    created_at: createdAt,
    updated_at: updatedAt
  }
}

const toApi = lab => ({
  lab_code: lab.lab_code,
  name: lab.name,
  location: lab.location,
  capacity: lab.capacity,
  description: lab.description,
  img: lab.img,
  open_time: lab.open_time,
  close_time: lab.close_time,
  status: lab.status
})

export async function queryLabs(params = {}) {
  const response = await request({ method: 'GET', url: '/api/v1/lab/page', params })
  const pageData = response.data
  return {
    ...pageData,
    items: pageData.items.map(fromApi),
    stats: {
      total: pageData.global_total,
      open: pageData.open_count,
      closed: pageData.closed_count,
      capacity: pageData.total_capacity
    }
  }
}

export function createLab(lab) {
  return request({ method: 'POST', url: '/api/v1/lab/create', data: toApi(lab) })
}

export function updateLab(id, lab) {
  return request({ method: 'PUT', url: `/api/v1/lab/${encodeURIComponent(id)}`, data: toApi(lab) })
}

export function saveLab(lab) {
  return lab.id ? updateLab(lab.id, lab) : createLab(lab)
}

export function removeLab(id) {
  return request({ method: 'DELETE', url: `/api/v1/lab/${encodeURIComponent(id)}` })
}
