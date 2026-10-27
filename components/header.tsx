'use client'

import { motion } from 'framer-motion'
import { Coffee, Bell, Globe } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useState } from 'react'
import { useLanguageStore } from '@/lib/languageStore'

export function Header() {
  const [hasNotifications, setHasNotifications] = useState(true)
  const { lang, setLang, t } = useLanguageStore()

  const toggleLanguage = () => {
    setLang(lang === 'vi' ? 'en' : 'vi')
  }

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
              {t('Gọi giọng nói và đặt món ngay tại bàn', 'Voice ordering & smart table ordering')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Nút chuyển đổi ngôn ngữ VN / EN */}
          <Button
            variant="outline"
            size="sm"
            onClick={toggleLanguage}
            className="rounded-full gap-1 text-xs font-semibold px-3 h-9"
          >
            <Globe className="h-3.5 w-3.5" />
            {lang === 'vi' ? '🇻🇳 VN' : '🇬🇧 EN'}
          </Button>

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
      </div>
    </motion.header>
  )
}