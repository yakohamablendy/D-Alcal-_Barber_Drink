"use client"

import { useCallback, useRef } from "react"
import { ClientView } from "@/components/barber-pro/client-view"

export default function ClientPage() {
  const toastRef = useRef<HTMLDivElement>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  const showToast = useCallback((msg: string) => {
    const el = toastRef.current
    if (!el) return
    el.textContent = msg
    el.classList.add("show")
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => el.classList.remove("show"), 2800)
  }, [])

  return (
    <div className="min-h-screen bg-ink">
      {/* Nav — solo branding, sin tabs */}
      <nav className="sticky top-0 z-50 h-14 flex items-center px-8 border-b border-rule bg-ink/[0.88] backdrop-blur-[24px] backdrop-saturate-[180%]">
        <div className="font-serif text-[17px] font-normal text-white whitespace-nowrap tracking-[0.02em]">
          Barber<em className="italic text-gold">Pro</em>
        </div>
      </nav>

      <main>
        <ClientView showToast={showToast} />
      </main>

      <div ref={toastRef} className="toast-notification" />
    </div>
  )
}
