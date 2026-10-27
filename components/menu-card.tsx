'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Star, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { MenuItem } from '@/lib/store'
import { useCartStore } from '@/lib/store'
import { formatVND } from '@/lib/utils'
import Image from 'next/image'
import { useState, useEffect } from 'react'
import { useLanguageStore } from '@/lib/languageStore'

interface MenuCardProps {
  item: MenuItem
  index: number
}

export function MenuCard({ item, index }: MenuCardProps) {
  const addItem = useCartStore((state) => state.addItem)
  const { lang, t } = useLanguageStore()
  const [showCustomize, setShowCustomize] = useState(false)
  const [ice, setIce] = useState<'none' | 'light' | 'normal' | 'extra'>('normal')
  const [sugar, setSugar] = useState<'none' | 'light' | 'normal' | 'extra'>('normal')

  // Bóc tách chuỗi chữ từ Object song ngữ
  const itemName = typeof item.name === 'object' ? (item.name[lang] || item.name.en) : item.name
  const itemDesc = typeof item.description === 'object' ? (item.description[lang] || item.description.en) : item.description

  useEffect(() => {
    if (showCustomize) {
      document.documentElement.style.scrollBehavior = 'auto'
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth
      document.body.style.overflow = 'hidden'
      if (scrollbarWidth > 0) {
        document.body.style.paddingRight = `${scrollbarWidth}px`
      }
      document.body.classList.add('dialog-open')
    } else {
      document.body.style.overflow = ''
      document.body.style.paddingRight = ''
      document.documentElement.style.scrollBehavior = ''
      document.body.classList.remove('dialog-open')
    }
    return () => {
      document.body.style.overflow = ''
      document.body.style.paddingRight = ''
      document.documentElement.style.scrollBehavior = ''
      document.body.classList.remove('dialog-open')
    }
  }, [showCustomize])

  const handleClose = () => {
    setShowCustomize(false)
    setIce('normal')
    setSugar('normal')
  }

  const isMilkBasedDrink = ['Cà Phê Sữa', 'Bạc Xỉu', 'Vietnamese Milk Coffee', 'Bac Xiu'].includes(itemName)

  const getIceLabel = (option: 'none' | 'light' | 'normal' | 'extra') => {
    return option === 'none'
      ? t('Không đá', 'No Ice')
      : option === 'light'
        ? t('Ít đá', 'Less Ice')
        : option === 'normal'
          ? t('Vừa đá', 'Regular Ice')
          : t('Nhiều đá', 'Extra Ice')
  }

  const getSugarLabel = (option: 'none' | 'light' | 'normal' | 'extra') => {
    if (isMilkBasedDrink) {
      return option === 'none'
        ? t('Không sữa', 'No Milk')
        : option === 'light'
          ? t('Ít sữa', 'Less Milk')
          : option === 'normal'
            ? t('Vừa sữa', 'Regular Milk')
            : t('Nhiều sữa', 'Extra Milk')
    }

    return option === 'none'
      ? t('Không đường', 'No Sugar')
      : option === 'light'
        ? t('Ít đường', 'Less Sugar')
        : option === 'normal'
          ? t('Vừa đường', 'Regular Sugar')
          : t('Nhiều đường', 'Extra Sugar')
  }

  const handleAddItem = () => {
    const customizations =
      ice === 'normal' && sugar === 'normal'
        ? undefined
        : { ice, sugar }

    addItem(item, customizations)
    handleClose()
  }

  return (
    <>
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
            alt={itemName}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
          {item.recommended && (
            <div className="absolute left-2 top-2">
              <Badge className="gap-1 bg-accent text-accent-foreground">
                <Star className="h-3 w-3" fill="currentColor" />
                {t('Gợi ý', 'Recommended')}
              </Badge>
            </div>
          )}
        </div>

        <div className="space-y-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-medium text-card-foreground leading-tight">
              {itemName}
            </h3>
            <span className="shrink-0 font-semibold text-primary">
              {formatVND(item.price)}
            </span>
          </div>

          <p className="line-clamp-2 text-xs text-muted-foreground">
            {itemDesc}
          </p>

          {item.tags && (
            <div className="flex flex-wrap gap-1 pt-1">
              {item.tags.map((tagObj, idx) => {
                const tagLabel = typeof tagObj === 'object' ? (tagObj[lang] || tagObj.en) : tagObj
                return (
                  <span
                    key={idx}
                    className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground"
                  >
                    {tagLabel}
                  </span>
                )
              })}
            </div>
          )}
        </div>

        <Button
          onClick={() => {
            setIce('normal')
            setSugar('normal')
            setShowCustomize(true)
          }}
          size="icon"
          className="absolute bottom-3 right-3 h-9 w-9 rounded-full bg-primary shadow-lg transition-transform hover:scale-105"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </motion.div>

      <AnimatePresence mode="wait">
        {showCustomize && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleClose}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative z-[101] w-full max-w-sm rounded-3xl bg-card p-6 shadow-2xl overflow-y-auto max-h-[90vh]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-semibold text-foreground text-lg">{itemName}</h3>
                <Button variant="ghost" size="icon" onClick={handleClose} className="h-8 w-8 rounded-full">
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="text-sm font-bold text-foreground mb-3 block">{t('Lượng đá', 'Ice Level')}</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['none', 'light', 'normal', 'extra'] as const).map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => setIce(option)}
                        className={`rounded-xl px-3 py-2 text-sm font-medium transition-all ${
                          ice === option ? 'bg-primary text-primary-foreground shadow-md' : 'bg-muted hover:bg-muted/80'
                        }`}
                      >
                        {getIceLabel(option)}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-bold text-foreground mb-3 block">
                    {isMilkBasedDrink ? t('Lượng sữa', 'Milk Level') : t('Lượng đường', 'Sugar Level')}
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['none', 'light', 'normal', 'extra'] as const).map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => setSugar(option)}
                        className={`rounded-xl px-3 py-2 text-sm font-medium transition-all ${
                          sugar === option ? 'bg-primary text-primary-foreground shadow-md' : 'bg-muted hover:bg-muted/80'
                        }`}
                      >
                        {getSugarLabel(option)}
                      </button>
                    ))}
                  </div>
                </div>

                <Button onClick={handleAddItem} className="w-full h-12 rounded-2xl text-base font-bold shadow-lg">
                  <Plus className="h-5 w-5 mr-2" />
                  {t('Thêm vào giỏ', 'Add to Cart')} - {formatVND(item.price)}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  )
}