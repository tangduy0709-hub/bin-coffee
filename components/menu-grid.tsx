'use client'

import { menuItems } from '@/lib/store'
import { MenuCard } from './menu-card'

interface MenuGridProps {
  category: string
}

export function MenuGrid({ category }: MenuGridProps) {
  const filteredItems =
    category === 'all'
      ? menuItems
      : menuItems.filter((item) => item.category === category)

  return (
    <div className="grid grid-cols-2 gap-3 px-4 pb-32">
      {filteredItems.map((item, index) => (
        <MenuCard key={item.id} item={item} index={index} />
      ))}
    </div>
  )
}
