"use client"

import { useCallback, useRef, useEffect } from "react"
import { BarberView } from "@/components/barber-pro/barber-view"
import { useAuth } from "@/hooks/use-auth"
import { useRouter } from "next/navigation"
import { auth } from "@/lib/firebase"
import { signOut } from "firebase/auth"

export default function BarberoPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const toastRef = useRef<HTMLDivElement>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login")
    }
  }, [user, loading, router])

  const handleLogout = async () => {
    try {
      await signOut(auth)
      router.push("/login")
    } catch (error) {
      console.error("Error al cerrar sesión:", error)
    }
  }

  const showToast = useCallback((msg: string) => {
    const el = toastRef.current
    if (!el) return
    el.textContent = msg
    el.classList.add("show")
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => el.classList.remove("show"), 2800)
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-ink flex items-center justify-center">
        <div className="text-gold font-serif italic text-xl animate-pulse">
          Verificando acceso...
        </div>
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="min-h-screen bg-ink">
      <nav className="sticky top-0 z-50 h-14 flex items-center justify-between px-8 border-b border-rule bg-ink/[0.88] backdrop-blur-[24px] backdrop-saturate-[180%]">
        <div className="flex items-center">
          <div className="font-serif text-[17px] font-normal text-white whitespace-nowrap tracking-[0.02em]">
            Alcala Barber<em className="italic text-gold">Drink</em>
          </div>
          <span className="ml-4 text-[10px] tracking-[0.1em] uppercase text-dim font-mono border border-rule rounded-[3px] px-2 py-0.5">
            Panel de Control
          </span>
        </div>
        
        <button 
          onClick={handleLogout}
          className="text-[10px] tracking-[0.1em] uppercase text-dim hover:text-white transition-colors cursor-pointer border-none bg-transparent"
        >
          Cerrar sesión
        </button>
      </nav>

      <main>
        <BarberView showToast={showToast} />
      </main>

      <div ref={toastRef} className="toast-notification" />
    </div>
  )
}
