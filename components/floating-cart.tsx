'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { ShoppingBag, Minus, Plus, X, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useCartStore } from '@/lib/store'
import { formatVND } from '@/lib/utils'
import { useState } from 'react'
import Image from 'next/image'
import { submitOrderToBackend } from '@/lib/backend'

export function FloatingCart() {
  const [isOpen, setIsOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { items, getTotal, getItemCount, updateQuantity, removeItem, placeOrder } =
    useCartStore()
  const itemCount = getItemCount()
  const total = getTotal()

  const handleSubmit = async () => {
    const order = placeOrder()
    if (!order) return

    if (!order.tableNumber) {
      console.warn('Bàn chưa được xác định. Vui lòng chọn bàn.')
      setIsOpen(true)
      return
    }

    setIsSubmitting(true)
    try {
      await submitOrderToBackend({
        tableNumber: order.tableNumber,
        items: order.items.map((item) => ({
          id: item.id,
          name: item.name,
          quantity: item.quantity,
          price: item.price,
        })),
      })
    } catch (error) {
      console.warn('Backend order submission failed', error)
    } finally {
      setIsSubmitting(false)
      setIsOpen(false)
    }
  }

  if (itemCount === 0 && !isOpen) return null

  return (
    <>
      {/* Floating Cart Button */}
      <AnimatePresence>
        {itemCount > 0 && !isOpen && (
          <motion.button
            initial={{ scale: 0, y: 100 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0, y: 100 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsOpen(true)}
            className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full bg-primary px-6 py-3 text-primary-foreground shadow-lg"
          >
            <div className="relative">
              <ShoppingBag className="h-5 w-5" />
              <span className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">
                {itemCount}
              </span>
            </div>
            <span className="font-medium">View Cart</span>
            <span className="font-semibold">{formatVND(total)}</span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Cart Sheet */}
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
            />

            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 z-50 max-h-[85vh] overflow-hidden rounded-t-3xl bg-card shadow-2xl"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-border px-4 py-4">
                <div className="flex items-center gap-2">
                  <ShoppingBag className="h-5 w-5 text-primary" />
                  <h2 className="font-serif text-lg font-semibold">Giỏ hàng của bạn</h2>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    {itemCount} món
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsOpen(false)}
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>

              {/* Cart Items */}
              <div className="max-h-[50vh] overflow-y-auto px-4 py-4">
                <AnimatePresence mode="popLayout">
                  {items.map((item) => (
                    <motion.div
                      key={item.cartItemId}
                      layout
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      className="mb-3 flex gap-3 rounded-xl bg-muted/50 p-3"
                    >
                      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg">
                        <Image
                          src={item.image}
                          alt={item.name}
                          fill
                          className="object-cover"
                        />
                      </div>

                      <div className="flex flex-1 flex-col justify-between">
                        <div>
                          <h4 className="font-medium text-card-foreground">
                            {item.name}
                          </h4>
                          <p className="text-sm text-muted-foreground">
                            {formatVND(item.price)}
                          </p>
                          
                          {/* Customizations Display */}
                          {(item.customizations?.ice || item.customizations?.sugar) && (
                            <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                              {item.customizations?.ice && (
                                <p>Đá: {item.customizations.ice === 'none' ? 'Không' : item.customizations.ice === 'light' ? 'Ít' : item.customizations.ice === 'normal' ? 'Vừa' : 'Nhiều'}</p>
                              )}
                              {item.customizations?.sugar && (
                                <p>Đường: {item.customizations.sugar === 'none' ? 'Không' : item.customizations.sugar === 'light' ? 'Ít' : item.customizations.sugar === 'normal' ? 'Vừa' : 'Nhiều'}</p>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() =>
                                updateQuantity(item.cartItemId, item.quantity - 1)
                              }
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <span className="w-6 text-center font-medium">
                              {item.quantity}
                            </span>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() =>
                                updateQuantity(item.cartItemId, item.quantity + 1)
                              }
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>

                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive"
                            onClick={() => removeItem(item.cartItemId)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>

                {items.length === 0 && (
                  <div className="py-8 text-center text-muted-foreground">
                    Your cart is empty
                  </div>
                )}
              </div>

              {/* Footer */}
              {items.length > 0 && (
                <div className="border-t border-border px-4 py-4">
                  <div className="mb-4 flex items-center justify-between">
                    <span className="text-muted-foreground">Tổng</span>
                    <span className="text-xl font-semibold text-foreground">
                      {formatVND(total)}
                    </span>
                  </div>

                  <Button
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    className="w-full rounded-full py-6 text-base font-semibold"
                  >
                    {isSubmitting ? 'Gửi đơn hàng...' : 'Xác nhận đặt món'}
                  </Button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
