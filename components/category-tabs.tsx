'use client'

import { motion } from 'framer-motion'
import { Coffee, Leaf, Croissant, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

const categories = [
  { id: 'all', label: 'All', icon: Sparkles },
  { id: 'coffee', label: 'Coffee', icon: Coffee },
  { id: 'tea', label: 'Tea', icon: Leaf },
  { id: 'pastry', label: 'Pastry', icon: Croissant },
  { id: 'specialty', label: 'Specialty', icon: Sparkles },
]

interface CategoryTabsProps {
  activeCategory: string
  onCategoryChange: (category: string) => void
}

export function CategoryTabs({
  activeCategory,
  onCategoryChange,
}: CategoryTabsProps) {
  return (
    <div className="hide-scrollbar flex gap-2 overflow-x-auto px-4 py-3">
      {categories.map((category) => {
        const Icon = category.icon
        const isActive = activeCategory === category.id

        return (
          <motion.button
            key={category.id}
            whileTap={{ scale: 0.95 }}
            onClick={() => onCategoryChange(category.id)}
            className={cn(
              'relative flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors',
              isActive
                ? 'text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            )}
          >
            {isActive && (
              <motion.div
                layoutId="activeCategory"
                className="absolute inset-0 rounded-full bg-primary"
                transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
              />
            )}
            <span className="relative flex items-center gap-2">
              <Icon className="h-4 w-4" />
              {category.label}
            </span>
          </motion.button>
        )
      })}
    </div>
  )
}
