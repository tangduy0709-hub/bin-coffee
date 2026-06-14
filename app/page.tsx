'use client'

import { Suspense, useEffect, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { MapPin } from 'lucide-react'
import { Header } from '@/components/header'
import { CategoryTabs } from '@/components/category-tabs'
import { Recommendations } from '@/components/recommendations'
import { MenuGrid } from '@/components/menu-grid'
import { FloatingCart } from '@/components/floating-cart'
import { OrderTracker } from '@/components/order-tracker'
import { ChatAssistant } from '@/components/chat-assistant'
import { useCartStore } from '@/lib/store'

function TableLinkSync() {
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const tableNumber = useCartStore((state) => state.tableNumber)
  const setTableNumber = useCartStore((state) => state.setTableNumber)

  useEffect(() => {
    const queryTable = searchParams.get('table')
    const pathMatch = pathname.match(/\/(?:table|ban)\/(\d+)/i)
    const resolvedTable = queryTable || pathMatch?.[1]

    if (resolvedTable && resolvedTable !== tableNumber) {
      setTableNumber(resolvedTable)
    }
  }, [searchParams, pathname, setTableNumber, tableNumber])

  return null
}

export default function CoffeeShopPage() {
  const [activeCategory, setActiveCategory] = useState('all')
  const tableNumber = useCartStore((state) => state.tableNumber)

  return (
    <main className="min-h-screen bg-background">
      <Header />
      <Suspense fallback={null}>
        <TableLinkSync />
      </Suspense>

      {/* Table Status Banner */}
      {tableNumber && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-4 mt-3"
        >
          <div className="flex items-center justify-between rounded-xl bg-primary/10 px-4 py-3">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-primary">
                Bàn {tableNumber}
              </span>
            </div>
          </div>
        </motion.div>
      )}

      {/* Order Tracker */}
      <div className="mt-4">
        <OrderTracker />
      </div>

      {/* Recommendations */}
      <Recommendations />

      {/* Category Tabs */}
      <div className="sticky top-[72px] z-40 bg-background/80 backdrop-blur-sm">
        <CategoryTabs
          activeCategory={activeCategory}
          onCategoryChange={setActiveCategory}
        />
      </div>

      {/* Menu Section */}
      <section className="mt-2">
        <div className="mb-3 flex items-center justify-between px-4">
          <h2 className="font-serif text-xl font-semibold text-foreground">
            Thực đơn E-Menu
          </h2>
          <span className="text-sm text-muted-foreground">
            {activeCategory === 'all' ? 'Tất cả món' : activeCategory}
          </span>
        </div>

        <MenuGrid category={activeCategory} />
      </section>

      {/* Floating Cart */}
      <FloatingCart />

      {/* AI Chat Assistant */}
      <ChatAssistant />

      {/* Bottom safe area padding */}
      <div className="h-24" />
    </main>
  )
}
