export const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000'

export async function submitOrderToBackend(order: unknown) {
  return fetch(`${BACKEND_URL}/api/order`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(order),
  })
}

export async function sendVoiceOrder(order: {
  tableNumber: string
  itemName: string
  quantity: number
  note?: string
}) {
  return fetch(`${BACKEND_URL}/api/voice-order`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(order),
  })
}

export async function markOrderComplete(orderId: number) {
  return fetch(`${BACKEND_URL}/api/order/${orderId}/complete`, {
    method: 'POST',
  })
}
