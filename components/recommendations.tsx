'use client'

import { motion } from 'framer-motion'
import { Sparkles, Star, Plus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useCartStore, menuItems } from '@/lib/store'
import { formatVND } from '@/lib/utils'
import Image from 'next/image'
import { useLanguageStore } from '@/lib/languageStore'

export function Recommendations() {
  const addItem = useCartStore((state) => state.addItem)
  const { lang, t } = useLanguageStore()

  // Lọc ra các món được gắn cờ recommended
  const recommendedItems = menuItems.filter((item) => item.recommended)

  return (
    <section className="mx-4 mt-6">
      <div className="mb-3 flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-accent" />
        <div>
          <h2 className="font-serif text-lg font-semibold text-foreground">
            {t('Lựa chọn hôm nay', "Today's Selection")}
          </h2>
          <p className="text-xs text-muted-foreground">
            {t('Được tuyển chọn dành cho bạn', 'Curated especially for you')}
          </p>
        </div>
      </div>

      <div className="hide-scrollbar flex gap-3 overflow-x-auto pb-2">
        {recommendedItems.map((item, index) => {
          // Bóc tách tên, mô tả và tag theo ngôn ngữ hiện tại (vi hoặc en)
          const itemName = typeof item.name === 'object' ? (item.name[lang] || item.name.en) : item.name
          const itemDesc = typeof item.description === 'object' ? (item.description[lang] || item.description.en) : item.description

          return (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className="relative min-w-[280px] sm:min-w-[320px] overflow-hidden rounded-3xl bg-card p-4 shadow-sm border border-border"
            >
              <div className="flex gap-3">
                <div className="relative aspect-square h-24 w-24 shrink-0 overflow-hidden rounded-2xl">
                  <Image
                    src={item.image}
                    alt={itemName}
                    fill
                    className="object-cover"
                  />
                  <div className="absolute left-1.5 top-1.5">
                    <Badge className="gap-1 bg-accent/90 text-accent-foreground text-[10px] px-1.5 py-0.5">
                      <Star className="h-2.5 w-2.5 fill-current" />
                      {t('Gợi ý', 'Must Try')}
                    </Badge>
                  </div>
                </div>

                <div className="flex flex-1 flex-col justify-between">
                  <div>
                    <h3 className="font-semibold text-sm text-foreground line-clamp-1">
                      {itemName}
                    </h3>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                      {itemDesc}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <span className="font-bold text-sm text-primary">
                      {formatVND(item.price)}
                    </span>

                    <Button
                      size="sm"
                      onClick={() => addItem(item)}
                      className="rounded-full px-3 h-8 text-xs font-semibold"
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" /> {t('Thêm', 'Add')}
                    </Button>
                  </div>
                </div>
              </div>
            </motion.div>
          )
        })}
      </div>
    </section>
  )
}