import request from '@/utils/request'

const fromApi = equipment => {
  const { labId, createdAt, updatedAt, ...rest } = equipment
  return { ...rest, lab_id: labId, created_at: createdAt, updated_at: updatedAt }
}

const toApi = equipment => ({
  code: equipment.code,
  name: equipment.name,
  lab_id: equipment.lab_id,
  description: equipment.description,
  img: equipment.img,
  sepc: equipment.sepc,
  quantity: equipment.quantity,
  status: equipment.status
})

export async function queryEquipment(params = {}) {
  const response = await request({ method: 'GET', url: '/api/v1/equipment/page', params })
  const data = response.data
  return {
    ...data,
    items: data.items.map(fromApi),
    stats: {
      total: data.global_total,
      normal: data.normal_count,
      maintenance: data.maintenance_count,
      quantity: data.total_quantity
    }
  }
}

export function createEquipment(equipment) {
  return request({ method: 'POST', url: '/api/v1/equipment/create', data: toApi(equipment) })
}

export function updateEquipment(id, equipment) {
  return request({
    method: 'PUT',
    url: `/api/v1/equipment/${encodeURIComponent(id)}`,
    data: toApi(equipment)
  })
}

export function saveEquipment(equipment) {
  return equipment.id
    ? updateEquipment(equipment.id, equipment)
    : createEquipment(equipment)
}

export function removeEquipment(id) {
  return request({ method: 'DELETE', url: `/api/v1/equipment/${encodeURIComponent(id)}` })
}
