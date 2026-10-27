import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type Language = 'vi' | 'en'

interface LanguageState {
  lang: Language
  setLang: (lang: Language) => void
  t: (viText: string, enText: string) => string
}

// Từ điển nhanh hỗ trợ chuyển đổi giao diện lập tức
export const useLanguageStore = create<LanguageState>()(
  persist(
    (set, get) => ({
      lang: 'en', // Mặc định là Tiếng Anh cho hội thảo quốc tế
      setLang: (lang) => set({ lang }),
      t: (viText: string, enText: string) => {
        return get().lang === 'en' ? enText : viText
      },
    }),
    {
      name: 'cafe-language-storage',
    }
  )
)