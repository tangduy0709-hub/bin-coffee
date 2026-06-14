'use client'

import { useEffect, useMemo, useState } from 'react'
import { io } from 'socket.io-client'
import { CheckCircle2, Coffee, ClipboardList, Flame, PackageCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { BACKEND_URL, markOrderComplete } from '@/lib/backend'
import { formatVND } from '@/lib/utils'

interface KitchenOrderItem {
  id: number
  name: string
  quantity: number
  price: number
}

interface KitchenOrder {
  id: number
  order_number: string
  table_number: string
  total: number
  status: string
  created_at: string
  items: KitchenOrderItem[]
}

export default function DashboardPage() {
  const [orders, setOrders] = useState<KitchenOrder[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const sortedOrders = useMemo(
    () => [...orders].sort((a, b) => Number(b.id) - Number(a.id)),
    [orders]
  )

  useEffect(() => {
    const socket = io(BACKEND_URL, { transports: ['websocket'] })

    socket.on('connect', () => {
      console.log('Connected to backend dashboard socket')
    })

    socket.on('order:new', (order: KitchenOrder) => {
      setOrders((prev) => [order, ...prev])
    })

    socket.on('order:updated', (updatedOrder: KitchenOrder) => {
      setOrders((prev) =>
        prev.map((order) =>
          order.id === updatedOrder?.id ? { ...order, ...updatedOrder } : order,
        ),
      )
    })

    return () => {
      socket.disconnect()
    }
  }, [])

  useEffect(() => {
    setIsLoading(true)
    fetch(`${BACKEND_URL}/api/orders`)
      .then((res) => res.json())
      .then((data) => setOrders(data || []))
      .catch(console.error)
      .finally(() => setIsLoading(false))
  }, [])

  return (
    <main className="min-h-screen bg-background px-4 py-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="rounded-3xl bg-card p-6 shadow-lg">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-muted-foreground">
                Quầy pha chế
              </p>
              <h1 className="mt-2 text-3xl font-semibold text-foreground">
                Bảng đơn hàng thời gian thực
              </h1>
            </div>
            <div className="rounded-3xl bg-secondary/10 px-4 py-3 text-sm text-secondary">
              Kết nối với Backend Hub và MQTT để cập nhật đơn ngay lập tức.
            </div>
          </div>
        </div>

        <section className="grid gap-4">
          {isLoading && (
            <div className="rounded-3xl bg-muted/50 p-6 text-center text-muted-foreground">
              Đang tải đơn hàng...
            </div>
          )}

          {!isLoading && sortedOrders.length === 0 && (
            <div className="rounded-3xl bg-muted/50 p-6 text-center text-muted-foreground">
              Chưa có đơn mới.
            </div>
          )}

          {sortedOrders.map((order) => (
            <div key={order.id} className="rounded-3xl border border-border bg-card p-5 shadow-sm">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Đơn {order.order_number} - Bàn {order.table_number}</p>
                  <h2 className="mt-1 text-xl font-semibold text-foreground">{order.items.length} món</h2>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="rounded-full bg-primary/10 px-3 py-1 text-primary">
                    {order.status === 'pending' ? 'Chờ' : order.status === 'preparing' ? 'Đang làm' : order.status === 'ready' ? 'Sẵn sàng' : 'Hoàn thành'}
                  </span>
                  <span className="rounded-full bg-muted px-3 py-1 text-muted-foreground">
                    {formatVND(order.total)}
                  </span>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  {order.items.map((item) => (
                    <div key={item.id} className="flex items-center justify-between rounded-2xl bg-muted/50 p-3">
                      <span>{item.quantity} x {item.name}</span>
                      <span>{formatVND(item.quantity * item.price)}</span>
                    </div>
                  ))}
                </div>
                <div className="rounded-3xl border border-border bg-background/80 p-4">
                  <p className="text-sm text-muted-foreground">Tạo lúc</p>
                  <p className="mt-1 text-sm text-foreground">{new Date(order.created_at).toLocaleString('vi-VN')}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      onClick={() => markOrderComplete(order.id).then(() => {
                        setOrders((prev) =>
                          prev.map((item) =>
                            item.id === order.id ? { ...item, status: 'completed' } : item,
                          ),
                        )
                      })}
                    >
                      Hoàn thành
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </section>
      </div>
    </main>
  )
}
