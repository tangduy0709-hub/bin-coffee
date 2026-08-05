'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { ShoppingBag, Minus, Plus, X, Trash2, QrCode } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useCartStore } from '@/lib/store'
import { formatVND } from '@/lib/utils'
import { useState } from 'react'
import Image from 'next/image'
import { submitOrderToBackend } from '@/lib/backend'
import client from '@/lib/mqttClient'

export function FloatingCart() {
  const [isOpen, setIsOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  // Trạng thái điều khiển Popup QR
  const [showQR, setShowQR] = useState(false)
  const [qrUrl, setQrUrl] = useState('')
  const [qrAmount, setQrAmount] = useState(0)

  const { items, getTotal, getItemCount, updateQuantity, removeItem, placeOrder } =
    useCartStore()
  const itemCount = getItemCount()
  const total = getTotal()

  const handleSubmit = async () => {
    const { placeOrder, setRealOrder } = useCartStore.getState();
    const order = placeOrder();
    if (!order) return;

    if (!order.tableNumber) {
      console.warn('Bàn chưa được xác định.');
      setIsOpen(true);
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tableNumber: order.tableNumber,
          items: order.items,
          note: ''
        }),
      });

      if (response.ok) {
        const realOrder = await response.json();
        setRealOrder(realOrder); 

        try {
          const mqttPayload = {
            id: realOrder?.id ?? order.id,
            order_number: realOrder?.order_number ?? order.id,
            table: String(order.tableNumber),
            total: order.total,
            items: order.items.map((item) => ({
              id: item.id,
              name: item.name,
              quantity: item.quantity,
              price: item.price,
              customizations: item.customizations,
            })),
            status: 'pending',
          };

          client.publish('cafe/dashboard/new_order', JSON.stringify(mqttPayload));
          console.log('✅ Đã gửi đơn mới qua MQTT:', mqttPayload);
        } catch (error) {
          console.warn('❌ MQTT publish failed:', error);
        }

        // ================= CẤU HÌNH VIETQR CỦA BẠN Ở ĐÂY =================
        const BANK_ID = "MB"; // VD: mb, techcombank, acb, momo, vtp...
        const ACCOUNT_NO = "00428939279999"; // Số tài khoản ngân hàng của bạn
        const ACCOUNT_NAME = "TANG NGUYEN ANH DUY"; // Tên chủ tài khoản (In hoa không dấu)
        // =================================================================

        // Tạo nội dung chuyển khoản tự động
        const amount = total;
        setQrAmount(amount);
        const description = `Thanh toan ban ${order.tableNumber}`;
        
        // Gọi API của VietQR để đúc ảnh QR
        const generatedQrUrl = `https://img.vietqr.io/image/${BANK_ID}-${ACCOUNT_NO}-compact2.png?amount=${amount}&addInfo=${encodeURIComponent(description)}&accountName=${encodeURIComponent(ACCOUNT_NAME)}`;
        
        setQrUrl(generatedQrUrl);
        setShowQR(true); // Mở bảng QR
      }
    } catch (error) {
      console.warn('Backend order submission failed', error);
    } finally {
      setIsSubmitting(false);
      // Không đóng giỏ hàng ngay lập tức để giữ popup QR nằm phía trên
    }
  };

  const handleCloseAll = () => {
    setShowQR(false);
    setIsOpen(false);
    // Nếu bạn có hàm clearCart() trong store, bạn có thể gọi ở đây để dọn giỏ hàng sau khi khách đã thanh toán
  }

  if (itemCount === 0 && !isOpen && !showQR) return null

  return (
    <>
      {/* Nút bấm giỏ hàng nổi */}
      <AnimatePresence>
        {itemCount > 0 && !isOpen && !showQR && (
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
            <span className="font-medium">Xem giỏ hàng</span>
            <span className="font-semibold">{formatVND(total)}</span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Bảng Giỏ hàng */}
      <AnimatePresence>
        {isOpen && !showQR && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm"
            />

            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 z-[61] max-h-[85vh] overflow-hidden rounded-t-3xl bg-card shadow-2xl"
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
                <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)}>
                  <X className="h-5 w-5" />
                </Button>
              </div>

              {/* Danh sách món */}
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
                        <Image src={item.image} alt={item.name} fill className="object-cover" />
                      </div>

                      <div className="flex flex-1 flex-col justify-between">
                        <div>
                          <h4 className="font-medium text-card-foreground">{item.name}</h4>
                          <p className="text-sm text-muted-foreground">{formatVND(item.price)}</p>
                          
                          {item.customizations &&
                            (item.customizations.ice !== 'normal' || item.customizations.sugar !== 'normal') && (
                              <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                                {item.customizations.ice !== 'normal' && (
                                  <p>Đá: {item.customizations.ice === 'none' ? 'Không' : item.customizations.ice === 'light' ? 'Ít' : item.customizations.ice === 'extra' ? 'Nhiều' : 'Vừa'}</p>
                                )}
                                {item.customizations.sugar !== 'normal' && (
                                  <p>Đường: {item.customizations.sugar === 'none' ? 'Không' : item.customizations.sugar === 'light' ? 'Ít' : item.customizations.sugar === 'extra' ? 'Nhiều' : 'Vừa'}</p>
                                )}
                              </div>
                          )}
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateQuantity(item.cartItemId, item.quantity - 1)}>
                              <Minus className="h-3 w-3" />
                            </Button>
                            <span className="w-6 text-center font-medium">{item.quantity}</span>
                            <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateQuantity(item.cartItemId, item.quantity + 1)}>
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeItem(item.cartItemId)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>

                {items.length === 0 && (
                  <div className="py-8 text-center text-muted-foreground">Giỏ hàng trống</div>
                )}
              </div>

              {/* Footer */}
              {items.length > 0 && (
                <div className="border-t border-border px-4 py-4">
                  <div className="mb-4 flex items-center justify-between">
                    <span className="text-muted-foreground">Tổng thanh toán</span>
                    <span className="text-xl font-semibold text-foreground">{formatVND(total)}</span>
                  </div>
                  <Button onClick={handleSubmit} disabled={isSubmitting} className="w-full rounded-full py-6 text-base font-semibold">
                    {isSubmitting ? 'Đang gửi đơn...' : 'Xác nhận đặt món'}
                  </Button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* POPUP MÃ QR THANH TOÁN (Hiển thị sau khi đặt món thành công) */}
      <AnimatePresence mode="wait">
        {showQR && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleCloseAll}
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative z-[101] w-full max-w-sm rounded-3xl bg-card p-6 shadow-2xl flex flex-col items-center text-center"
            >
              <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center mb-4 text-green-600">
                <QrCode className="h-8 w-8" />
              </div>
              
              <h2 className="text-xl font-bold text-foreground mb-1">Đơn hàng đã gửi tới quầy!</h2>
              <p className="text-sm text-muted-foreground mb-6">
                Vui lòng quét mã QR dưới đây bằng ứng dụng ngân hàng để thanh toán.
              </p>

              {/* Khung chứa mã QR */}
              <div className="bg-white p-3 rounded-2xl shadow-sm border border-border w-full aspect-square relative mb-6">
                {qrUrl ? (
                  <img src={qrUrl} alt="Mã QR Thanh Toán" className="w-full h-full object-contain rounded-xl" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-muted rounded-xl animate-pulse">
                    Đang tạo mã...
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between w-full bg-muted/50 p-4 rounded-2xl mb-6">
                <span className="text-sm font-medium text-muted-foreground">Cần thanh toán</span>
                <span className="text-xl font-bold text-primary">{formatVND(qrAmount)}</span>
              </div>

              <Button onClick={handleCloseAll} className="w-full rounded-full py-6 text-base font-semibold">
                Đóng & Hoàn tất
              </Button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  )
}