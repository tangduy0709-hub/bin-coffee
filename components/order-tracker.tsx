'use client'

import { motion, AnimatePresence } from 'framer-motion'
import {
  Clock,
  CheckCircle2,
  Coffee,
  Bell,
  X,
  ChefHat,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useCartStore, type Order } from '@/lib/store'
import { formatVND } from '@/lib/utils'
import { useEffect, useState } from 'react'
import { io } from 'socket.io-client'

const statusSteps = [
  { status: 'pending', label: 'Đã đặt', icon: CheckCircle2 },
  { status: 'preparing', label: 'Đang làm', icon: ChefHat },
  { status: 'ready', label: 'Sẵn sàng', icon: Coffee },
]

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

export function OrderTracker() {
  const { currentOrder, updateOrderStatus } = useCartStore()
  const [showNotification, setShowNotification] = useState(false)
  const [isExpanded, setIsExpanded] = useState(true)

  // Listen for real-time order status updates from backend
  useEffect(() => {
    if (!currentOrder) return

    const socketUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'
    const socket = io(socketUrl, { transports: ['websocket'] })

    socket.on('connect', () => {
      console.log('✅ TRẠNG THÁI: Đã kết nối Socket thành công!')
      console.log('🛒 Đơn hàng đang theo dõi:', currentOrder)
    })

    socket.on('order:updated', (updatedOrder: any) => {
      console.log('🔔 CÓ TÍN HIỆU TỪ BACKEND:', updatedOrder)
      
      const currentOrderId = String(currentOrder.id)
      const updatedOrderId = String(updatedOrder?.id)
      const updatedOrderNum = updatedOrder?.order_number
      const currentOrderNum = (currentOrder as any).order_number

      console.log('🔎 ĐANG SO SÁNH:', { currentOrderId, updatedOrderId, updatedOrderNum })

      const isMatchingOrder =
        updatedOrderId === currentOrderId ||
        updatedOrderNum === currentOrderId ||
        updatedOrderNum === currentOrderNum

      if (isMatchingOrder) {
        console.log('🎉 ĐÚNG ĐƠN RỒI! Đổi trạng thái sang:', updatedOrder.status)
        updateOrderStatus(updatedOrder.status)

        if (updatedOrder.status === 'ready') {
          setShowNotification(true)
        }
      } else {
        console.log('❌ TÍN HIỆU CỦA ĐƠN KHÁC, BỎ QUA.')
      }
    })

    return () => {
      socket.disconnect()
    }
  }, [currentOrder, updateOrderStatus])

  if (!currentOrder) return null

  const currentStepIndex = statusSteps.findIndex(
    (step) => step.status === currentOrder.status
  )

  return (
    <>
      {/* Notification Popup */}
      <AnimatePresence>
        {showNotification && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className="fixed left-4 right-4 top-20 z-50 rounded-2xl bg-accent p-4 shadow-lg"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-foreground/10">
                <Bell className="h-5 w-5 text-accent-foreground" />
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-accent-foreground">
                  Đơn của bạn đã sẵn sàng!
                </h4>
                <p className="text-sm text-accent-foreground/80">
                  Vui lòng đến quầy lấy món
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowNotification(false)}
                className="text-accent-foreground"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Order Tracker Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-4 mb-4 overflow-hidden rounded-2xl bg-card shadow-md"
      >
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex w-full items-center justify-between p-4"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              {currentOrder.status === 'ready' ? (
                <Coffee className="h-5 w-5 text-primary" />
              ) : (
                <Clock className="h-5 w-5 text-primary" />
              )}
            </div>
            <div className="text-left">
              <h3 className="font-semibold text-card-foreground">
                Đơn {currentOrder.id}
              </h3>
              <p className="text-sm text-muted-foreground">
                {currentOrder.status === 'ready'
                  ? 'Đã sẵn sàng!'
                  : `Đang xử lý`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <StatusBadge status={currentOrder.status} />
          </div>
        </button>

        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="border-t border-border px-4 py-4">
                {/* Progress Steps */}
                <div className="mb-4 flex justify-between">
                  {statusSteps.map((step, index) => {
                    const Icon = step.icon
                    const isActive = index <= currentStepIndex
                    const isCurrent = index === currentStepIndex

                    return (
                      <div key={step.status} className="flex flex-col items-center">
                        <div
                          className={`relative flex h-10 w-10 items-center justify-center rounded-full transition-colors ${
                            isActive
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          <Icon className="h-5 w-5" />
                          {isCurrent && (
                                <motion.div
                                  animate={{ scale: [1, 1.2, 1] }}
                                  transition={{ repeat: Infinity, duration: 2 }}
                                  className="absolute inset-0 rounded-full border-2 border-primary"
                                />
                          )}
                        </div>
                        <span
                          className={`mt-2 text-xs ${
                            isActive
                              ? 'font-medium text-foreground'
                              : 'text-muted-foreground'
                          }`}
                        >
                          {step.label}
                        </span>
                      </div>
                    )
                  })}
                </div>

                {/* Order Items Summary */}
                <div className="rounded-xl bg-muted/50 p-3">
                  <h4 className="mb-2 text-sm font-medium text-card-foreground">
                    Order Summary
                  </h4>
                  {currentOrder.items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between py-1 text-sm"
                    >
                      <span className="text-muted-foreground">
                        {item.quantity}x {item.name}
                      </span>
                      <span className="text-card-foreground">
                        {formatVND(item.price * item.quantity)}
                      </span>
                    </div>
                  ))}
                  <div className="mt-2 flex items-center justify-between border-t border-border pt-2 font-medium">
                    <span className="text-card-foreground">Total</span>
                    <span className="text-primary">
                      {formatVND(currentOrder.total)}
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </>
  )
}

function StatusBadge({ status }: { status: Order['status'] }) {
  const styles = {
    pending: 'bg-secondary text-secondary-foreground',
    preparing: 'bg-accent/20 text-accent',
    ready: 'bg-primary/20 text-primary',
    completed: 'bg-muted text-muted-foreground',
  }

  const labels = {
    pending: 'Pending',
    preparing: 'Preparing',
    ready: 'Ready',
    completed: 'Done',
  }

  return (
    <span className={`rounded-full px-3 py-1 text-xs font-medium ${styles[status]}`}>
      {labels[status]}
    </span>
  )
}