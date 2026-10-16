'use client'

import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'

// Tema disimpan di localStorage; script kecil di <head> (app/layout.tsx) menerapkannya sebelum render agar tidak berkedip.
export function ThemeToggle({ className }: { className?: string }) {
  const [dark, setDark] = useState(false)

  useEffect(() => setDark(document.documentElement.classList.contains('dark')), [])

  const toggle = () => {
    const next = !dark
    document.documentElement.classList.toggle('dark', next)
    try {
      localStorage.setItem('theme', next ? 'dark' : 'light')
    } catch {}
    setDark(next)
  }

  return (
    <Button variant="ghost" size="icon" className={className} onClick={toggle} aria-label="Ganti tema">
      {dark ? <Sun /> : <Moon />}
    </Button>
  )
}
