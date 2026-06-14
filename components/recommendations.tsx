'use client'

import { motion } from 'framer-motion'
import { Sparkles, ArrowRight } from 'lucide-react'
import { menuItems, useCartStore, type MenuItem } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { formatVND } from '@/lib/utils'
import Image from 'next/image'

const recommendedItems = menuItems.filter((item) => item.recommended)

export function Recommendations() {
  const addItem = useCartStore((state) => state.addItem)

  return (
    <section className="px-4 py-4">
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/20">
          <Sparkles className="h-4 w-4 text-accent" />
        </div>
        <div>
          <h2 className="font-serif text-lg font-semibold text-foreground">
            {"Today's Picks"}
          </h2>
          <p className="text-xs text-muted-foreground">Curated just for you</p>
        </div>
      </div>

      <div className="hide-scrollbar flex gap-3 overflow-x-auto pb-2">
        {recommendedItems.map((item, index) => (
          <RecommendationCard key={item.id} item={item} index={index} onAdd={() => addItem(item)} />
        ))}
      </div>
    </section>
  )
}

function RecommendationCard({
  item,
  index,
  onAdd,
}: {
  item: MenuItem
  index: number
  onAdd: () => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.1 }}
      className="relative min-w-[200px] overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 to-secondary/10"
    >
      <div className="relative h-28 w-full">
        <Image
          src={item.image}
          alt={item.name}
          fill
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
      </div>

      <div className="p-3">
        <h3 className="font-medium text-card-foreground">{item.name}</h3>
        <p className="text-xs text-muted-foreground line-clamp-1">
          {item.description}
        </p>

        <div className="mt-2 flex items-center justify-between">
          <span className="font-semibold text-primary">
            {formatVND(item.price)}
          </span>
          <Button
            onClick={onAdd}
            size="sm"
            variant="secondary"
            className="h-8 gap-1 rounded-full text-xs"
          >
            Add
            <ArrowRight className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </motion.div>
  )
}
