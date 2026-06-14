'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { ScanLine, X, Check, TableProperties } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useState } from 'react'
import { useCartStore } from '@/lib/store'

interface QRScannerProps {
  isOpen: boolean
  onClose: () => void
}

export function QRScanner({ isOpen, onClose }: QRScannerProps) {
  const [isScanning, setIsScanning] = useState(true)
  const [tableNumber, setTableNumber] = useState('')
  const [isConfirmed, setIsConfirmed] = useState(false)
  const setStoreTableNumber = useCartStore((state) => state.setTableNumber)

  const handleScan = () => {
    // Simulate QR scan
    setTimeout(() => {
      setIsScanning(false)
      setTableNumber('12')
    }, 2000)
  }

  const handleConfirm = () => {
    setStoreTableNumber(tableNumber)
    setIsConfirmed(true)
    setTimeout(() => {
      onClose()
      setIsConfirmed(false)
      setIsScanning(true)
    }, 1500)
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed inset-x-4 top-1/2 z-50 -translate-y-1/2 overflow-hidden rounded-3xl bg-card shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-border p-4">
              <h2 className="font-serif text-lg font-semibold">Scan Table QR</h2>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="h-5 w-5" />
              </Button>
            </div>

            <div className="p-6">
              <AnimatePresence mode="wait">
                {isConfirmed ? (
                  <motion.div
                    key="confirmed"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex flex-col items-center py-8"
                  >
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', delay: 0.2 }}
                      className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-primary/10"
                    >
                      <Check className="h-10 w-10 text-primary" />
                    </motion.div>
                    <h3 className="text-xl font-semibold">Table Confirmed!</h3>
                    <p className="text-muted-foreground">
                      You&apos;re ordering from Table {tableNumber}
                    </p>
                  </motion.div>
                ) : isScanning ? (
                  <motion.div
                    key="scanning"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-col items-center"
                  >
                    {/* QR Scanner Frame */}
                    <div className="relative mb-6 h-64 w-64 overflow-hidden rounded-2xl bg-muted">
                      <div className="absolute inset-4 rounded-lg border-2 border-dashed border-primary/50" />

                      {/* Scanning Animation */}
                      <motion.div
                        animate={{ y: [0, 200, 0] }}
                        transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}
                        className="absolute left-4 right-4 h-0.5 bg-primary shadow-[0_0_10px_rgba(139,90,43,0.5)]"
                      />

                      <div className="absolute inset-0 flex items-center justify-center">
                        <ScanLine className="h-12 w-12 text-primary/30" />
                      </div>

                      {/* Corner Markers */}
                      <div className="absolute left-4 top-4 h-6 w-6 border-l-2 border-t-2 border-primary" />
                      <div className="absolute right-4 top-4 h-6 w-6 border-r-2 border-t-2 border-primary" />
                      <div className="absolute bottom-4 left-4 h-6 w-6 border-b-2 border-l-2 border-primary" />
                      <div className="absolute bottom-4 right-4 h-6 w-6 border-b-2 border-r-2 border-primary" />
                    </div>

                    <p className="mb-4 text-center text-sm text-muted-foreground">
                      Đưa camera vào QR dán trên bàn để tự động nhận diện số bàn.
                    </p>

                    <Button
                      onClick={handleScan}
                      variant="outline"
                      className="w-full rounded-full"
                    >
                      Thử quét QR
                    </Button>
                  </motion.div>
                ) : (
                  <motion.div
                    key="manual"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-col items-center"
                  >
                    <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                      <TableProperties className="h-8 w-8 text-primary" />
                    </div>

                    <h3 className="mb-2 text-lg font-semibold">Số bàn</h3>
                    <p className="mb-4 text-center text-sm text-muted-foreground">
                      QR đã quét! Xác nhận số bàn bên dưới để tiếp tục.
                    </p>

                    <Input
                      type="text"
                      value={tableNumber}
                      onChange={(e) => setTableNumber(e.target.value)}
                      className="mb-4 h-14 rounded-xl text-center text-2xl font-semibold"
                      placeholder="Enter table number"
                    />

                    <Button
                      onClick={handleConfirm}
                      disabled={!tableNumber}
                      className="w-full rounded-full py-6"
                    >
                      Confirm Table {tableNumber}
                    </Button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
