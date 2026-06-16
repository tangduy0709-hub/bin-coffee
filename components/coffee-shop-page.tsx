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
import { BACKEND_URL } from '@/lib/backend'

const entryPathRegex = /\/(?:table|ban|entry)\/([^/]+)/i

async function fetchTableNumberFromToken(token: string) {
  if (!token) return null

  try {
    const res = await fetch(`${BACKEND_URL}/api/table-entry?token=${encodeURIComponent(token)}`, {
      cache: 'no-store',
    })

    if (!res.ok) {
      return null
    }

    const data = await res.json()
    return data.tableNumber ?? null
  } catch {
    return null
  }
}

interface TableLinkSyncProps {
  entryToken?: string
}

function TableLinkSync({ entryToken }: TableLinkSyncProps) {
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const tableNumber = useCartStore((state) => state.tableNumber)
  const setTableNumber = useCartStore((state) => state.setTableNumber)

  useEffect(() => {
    let active = true

    const queryTable = searchParams.get('table')
    const pathMatch = pathname.match(entryPathRegex)
    const routeToken = entryToken || pathMatch?.[1]

    if (queryTable && queryTable !== tableNumber) {
      setTableNumber(queryTable)
      return
    }

    if (!routeToken) {
      return
    }

    if (/^\d+$/.test(routeToken)) {
      if (routeToken !== tableNumber) {
        setTableNumber(routeToken)
      }
      return
    }

    ;(async () => {
      const resolved = await fetchTableNumberFromToken(routeToken)
      if (!active) return
      if (resolved && resolved !== tableNumber) {
        setTableNumber(resolved)
      }
    })()

    return () => {
      active = false
    }
  }, [searchParams, pathname, entryToken, setTableNumber, tableNumber])

  return null
}

interface CoffeeShopPageProps {
  entryToken?: string
}

export default function CoffeeShopPage({ entryToken }: CoffeeShopPageProps) {
  const [activeCategory, setActiveCategory] = useState('all')
  const tableNumber = useCartStore((state) => state.tableNumber)

  return (
    <main className="min-h-screen bg-background">
      <Header />
      <Suspense fallback={null}>
        <TableLinkSync entryToken={entryToken} />
      </Suspense>

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

      <div className="mt-4">
        <OrderTracker />
      </div>

      <Recommendations />

      <div className="sticky top-[72px] z-40 bg-background/80 backdrop-blur-sm">
        <CategoryTabs
          activeCategory={activeCategory}
          onCategoryChange={setActiveCategory}
        />
      </div>

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

      <FloatingCart />
      <ChatAssistant />
      <div className="h-24" />
    </main>
  )
}
