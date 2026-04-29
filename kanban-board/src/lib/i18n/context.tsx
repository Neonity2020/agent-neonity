"use client"

import React, { createContext, useContext, useState, useEffect, useCallback } from "react"
import { dictionaries, type Locale, type Dictionary } from "./dictionaries"

const STORAGE_KEY = "kanban-locale"
const DEFAULT_LOCALE: Locale = "en"

interface LanguageContextValue {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: Dictionary
}

const LanguageContext = createContext<LanguageContextValue>({
  locale: DEFAULT_LOCALE,
  setLocale: () => {},
  t: dictionaries[DEFAULT_LOCALE],
})

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as Locale | null
    if (saved && dictionaries[saved]) {
      setLocaleState(saved)
    }
    setMounted(true)
  }, [])

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale)
    localStorage.setItem(STORAGE_KEY, newLocale)
  }, [])

  const t = dictionaries[locale]

  // Avoid hydration mismatch by rendering with default locale on server
  if (!mounted) {
    return (
      <LanguageContext.Provider value={{ locale: DEFAULT_LOCALE, setLocale, t: dictionaries[DEFAULT_LOCALE] }}>
        {children}
      </LanguageContext.Provider>
    )
  }

  return (
    <LanguageContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useTranslation() {
  return useContext(LanguageContext)
}
