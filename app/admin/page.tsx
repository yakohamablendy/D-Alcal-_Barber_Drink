"use client"

import { AdminView } from "@/components/barber-pro/admin-view"

export default function AdminPage() {
  return (
    <div className="min-h-screen bg-ink">
      <nav className="sticky top-0 z-50 h-14 flex items-center px-8 border-b border-rule bg-ink/[0.88] backdrop-blur-[24px] backdrop-saturate-[180%]">
        <div className="font-serif text-[17px] font-normal text-white whitespace-nowrap tracking-[0.02em]">
          Barber<em className="italic text-gold">Pro</em>
        </div>
        <span className="ml-4 text-[10px] tracking-[0.1em] uppercase text-gold font-mono border border-gold/30 bg-gold-06 rounded-[3px] px-2 py-0.5">
          Admin
        </span>
      </nav>

      <main>
        <AdminView />
      </main>
    </div>
  )
}
