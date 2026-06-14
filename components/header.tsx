'use client'

import { motion } from 'framer-motion'
import { Coffee, Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useState } from 'react'

export function Header() {
  const [hasNotifications, setHasNotifications] = useState(true)

  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="sticky top-0 z-50 glass px-4 py-3"
    >
      <div className="mx-auto flex max-w-lg items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary">
            <Coffee className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-serif text-lg font-semibold tracking-tight text-foreground">
              Bin coffee
            </h1>
            <p className="text-xs text-muted-foreground">
              Gọi giọng nói và đặt món ngay tại bàn
            </p>
          </div>
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="relative"
          onClick={() => setHasNotifications(false)}
        >
          <Bell className="h-5 w-5 text-muted-foreground" />
          {hasNotifications && (
            <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-accent" />
          )}
        </Button>
      </div>
    </motion.header>
  )
}
