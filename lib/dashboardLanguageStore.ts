import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type Language = 'vi' | 'en'

interface DashboardLanguageState {
  lang: Language
  setLang: (lang: Language) => void
  t: (viText: string, enText: string) => string
}

export const useDashboardLanguageStore = create<DashboardLanguageState>()(
  persist(
    (set, get) => ({
      lang: 'en', // Mặc định tiếng Anh cho Dashboard hội thảo
      setLang: (lang) => set({ lang }),
      t: (viText: string, enText: string) => {
        return get().lang === 'en' ? enText : viText
      },
    }),
    {
      name: 'cafe-dashboard-language-storage',
    }
  )
)