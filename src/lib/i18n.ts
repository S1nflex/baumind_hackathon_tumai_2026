'use client'

import { useSyncExternalStore } from 'react'
import translations from './i18n-dictionary.json'

export type Language = 'de' | 'en' | 'ru'
let currentLanguage: Language = 'de'
const listeners = new Set<() => void>()
// Fresh, explicit user preference. Do not import the previous buggy EN default.
const STORAGE_KEY = 'baumind-language-v2'

function subscribe(callback: () => void) {
  listeners.add(callback)
  return () => { listeners.delete(callback) }
}
function snapshot() { return currentLanguage }
function serverSnapshot(): Language { return 'de' }

export function initializeLanguage() {
  if (typeof window === 'undefined') return
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored === 'de' || stored === 'en' || stored === 'ru') setLanguage(stored)
  } catch { /* private browsing can disallow storage */ }
}

export function setLanguage(value: Language) {
  currentLanguage = value
  if (typeof document !== 'undefined') document.documentElement.lang = value
  if (typeof window !== 'undefined') {
    try { window.localStorage.setItem(STORAGE_KEY, value) } catch { /* storage optional */ }
  }
  listeners.forEach(listener => listener())
}

export function translate(input: string, language = currentLanguage) {
  if (language === 'de') return input
  const entry = (translations as Record<string, {en: string; ru: string}>)[input]
  return entry?.[language] ?? input
}

export function useI18n() {
  const language = useSyncExternalStore(subscribe, snapshot, serverSnapshot)
  return { language, setLanguage, t: (key: string) => translate(key, language) }
}
