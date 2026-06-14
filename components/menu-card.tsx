'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Star, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { MenuItem } from '@/lib/store'
import { useCartStore } from '@/lib/store'
import { formatVND } from '@/lib/utils'
import Image from 'next/image'
import { useState } from 'react'

interface MenuCardProps {
  item: MenuItem
  index: number
}

export function MenuCard({ item, index }: MenuCardProps) {
  const addItem = useCartStore((state) => state.addItem)
  const [showCustomize, setShowCustomize] = useState(false)
  const [ice, setIce] = useState<'none' | 'light' | 'normal' | 'extra'>('normal')
  const [sugar, setSugar] = useState<'none' | 'light' | 'normal' | 'extra'>('normal')

  const handleAddItem = () => {
    addItem(item, { ice, sugar })
    setShowCustomize(false)
    setIce('normal')
    setSugar('normal')
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      whileTap={{ scale: 0.98 }}
      className="group relative overflow-hidden rounded-2xl bg-card p-3 shadow-sm transition-all hover:shadow-md"
    >
      <div className="relative mb-3 aspect-square overflow-hidden rounded-xl">
        <Image
          src={item.image}
          alt={item.name}
          fill
          className="object-cover transition-transform duration-300 group-hover:scale-105"
        />
        {item.recommended && (
          <div className="absolute left-2 top-2">
            <Badge className="gap-1 bg-accent text-accent-foreground">
              <Star className="h-3 w-3" fill="currentColor" />
              Recommended
            </Badge>
          </div>
        )}
      </div>

      <div className="space-y-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-medium text-card-foreground leading-tight">
            {item.name}
          </h3>
          <span className="shrink-0 font-semibold text-primary">
            {formatVND(item.price)}
          </span>
        </div>

        <p className="line-clamp-2 text-xs text-muted-foreground">
          {item.description}
        </p>

        {item.tags && (
          <div className="flex flex-wrap gap-1 pt-1">
            {item.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      <Button
        onClick={() => setShowCustomize(true)}
        size="icon"
        className="absolute bottom-3 right-3 h-9 w-9 rounded-full bg-primary shadow-lg transition-transform hover:scale-105"
      >
        <Plus className="h-4 w-4" />
      </Button>

      {/* Customization Dialog */}
      <AnimatePresence>
        {showCustomize && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCustomize(false)}
              className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="fixed left-1/2 top-1/2 z-50 w-80 -translate-x-1/2 -translate-y-1/2 rounded-3xl bg-card p-6 shadow-xl"
            >
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-semibold text-foreground">{item.name}</h3>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowCustomize(false)}
                  className="h-8 w-8"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="space-y-4">
                {/* Ice Selection */}
                <div>
                  <label className="text-sm font-medium text-foreground">Đá</label>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {(['none', 'light', 'normal', 'extra'] as const).map((option) => (
                      <button
                        key={option}
                        onClick={() => setIce(option)}
                        className={`rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                          ice === option
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted text-muted-foreground hover:bg-muted/80'
                        }`}
                      >
                        {option === 'none'
                          ? 'Không'
                          : option === 'light'
                            ? 'Ít'
                            : option === 'normal'
                              ? 'Vừa'
                              : 'Nhiều'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Sugar Selection */}
                <div>
                  <label className="text-sm font-medium text-foreground">Đường</label>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {(['none', 'light', 'normal', 'extra'] as const).map((option) => (
                      <button
                        key={option}
                        onClick={() => setSugar(option)}
                        className={`rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                          sugar === option
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted text-muted-foreground hover:bg-muted/80'
                        }`}
                      >
                        {option === 'none'
                          ? 'Không'
                          : option === 'light'
                            ? 'Ít'
                            : option === 'normal'
                              ? 'Vừa'
                              : 'Nhiều'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Add Button */}
                <Button
                  onClick={handleAddItem}
                  className="w-full gap-2 rounded-xl"
                >
                  <Plus className="h-4 w-4" />
                  Thêm vào giỏ - {formatVND(item.price)}
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
