"use client"

import { useState } from "react"

const barbershops = [
  { name: "El Maestro", city: "Santo Domingo", plan: "Premium", status: "active", mrr: 800, date: "Ene 2025" },
  { name: "The Kings Cut", city: "Santiago", plan: "Premium", status: "active", mrr: 800, date: "Feb 2025" },
  { name: "Fade Factory", city: "San Pedro", plan: "Gratis", status: "active", mrr: 0, date: "Mar 2025" },
  { name: "Gentlemen's Club", city: "La Romana", plan: "Premium", status: "active", mrr: 800, date: "Mar 2025" },
  { name: "Classic Barbers", city: "Puerto Plata", plan: "Gratis", status: "inactive", mrr: 0, date: "Abr 2025" },
  { name: "Blade & Brush", city: "Santo Domingo", plan: "Premium", status: "active", mrr: 800, date: "May 2025" },
  { name: "Urban Edge", city: "Higüey", plan: "Gratis", status: "active", mrr: 0, date: "Jun 2025" },
  { name: "The Royal Shave", city: "Santiago", plan: "Premium", status: "active", mrr: 800, date: "Jul 2025" },
  { name: "Corte & Style", city: "Barahona", plan: "Gratis", status: "inactive", mrr: 0, date: "Ago 2025" },
  { name: "Precision Cuts", city: "Santo Domingo", plan: "Premium", status: "active", mrr: 800, date: "Sep 2025" },
]

export function AdminView() {
  const [search, setSearch] = useState("")

  const filtered = barbershops.filter((b) =>
    Object.values(b).some((v) => String(v).toLowerCase().includes(search.toLowerCase()))
  )

  return (
    <div className="max-w-[960px] mx-auto px-8 py-14 md:py-14">
      {/* Header */}
      <div className="mb-7">
        <div className="text-[11px] tracking-[0.12em] uppercase text-dim font-normal mb-3">Panel global</div>
        <h1 className="font-serif text-[clamp(28px,5vw,42px)] font-normal leading-[1.1] text-white tracking-[-0.02em]">
          Admin <em className="italic text-gold">SaaS</em>
        </h1>
        <p className="text-sm text-dim font-light mt-[10px] leading-relaxed">
          Barber Pro — Vista de propietario del software
        </p>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-4 gap-px bg-rule rounded-[var(--r)] overflow-hidden border border-rule mb-14 max-md:grid-cols-2 max-sm:grid-cols-1">
        <div className="bg-ink-2 p-6">
          <div className="text-[11px] tracking-[0.12em] uppercase text-dim font-normal mb-3.5">Barberías activas</div>
          <div className="font-serif text-[clamp(28px,4vw,38px)] font-normal text-white tracking-[-0.03em] leading-none">47</div>
          <div className="mt-2 text-[11px] font-mono text-green">+5 este mes</div>
        </div>
        <div className="bg-ink-2 p-6">
          <div className="text-[11px] tracking-[0.12em] uppercase text-dim font-normal mb-3.5">MRR suscripciones</div>
          <div className="font-serif text-[clamp(28px,4vw,38px)] font-normal text-gold tracking-[-0.03em] leading-none">$23,400</div>
          <div className="mt-2 text-[11px] font-mono text-green">+18% vs anterior</div>
        </div>
        <div className="bg-ink-2 p-6">
          <div className="text-[11px] tracking-[0.12em] uppercase text-dim font-normal mb-3.5">Plan Premium</div>
          <div className="font-serif text-[clamp(28px,4vw,38px)] font-normal text-white tracking-[-0.03em] leading-none">31</div>
          <div className="mt-2 text-[11px] font-mono text-green">+3 este mes</div>
        </div>
        <div className="bg-ink-2 p-6">
          <div className="text-[11px] tracking-[0.12em] uppercase text-dim font-normal mb-3.5">Churn rate</div>
          <div className="font-serif text-[clamp(28px,4vw,38px)] font-normal text-white tracking-[-0.03em] leading-none">1.4%</div>
          <div className="mt-2 text-[11px] font-mono text-red">−0.3% vs anterior</div>
        </div>
      </div>

      {/* Table */}
      <div className="border border-rule rounded-[var(--r)] overflow-hidden">
        {/* Table header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-rule bg-ink-2 gap-4 flex-wrap">
          <div className="font-serif text-lg font-normal text-white">Barberías registradas</div>
          <input
            type="search"
            placeholder="Buscar…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-ink-3 border border-rule rounded-[var(--r-sm)] px-3.5 py-[9px] text-bright font-sans text-[13px] font-light outline-none w-[220px] transition-colors duration-[180ms] focus:border-rule-2 placeholder:text-white/20 max-sm:w-full"
          />
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {["Nombre", "Ciudad", "Plan", "Estado", "MRR", "Registro"].map((h) => (
                  <th
                    key={h}
                    className="px-6 py-[10px] text-left text-[10px] tracking-[0.1em] uppercase text-dim font-normal bg-white/[0.02] border-b border-rule"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((shop) => (
                <tr
                  key={shop.name}
                  className="border-b border-rule last:border-b-0 transition-colors duration-[120ms] hover:bg-white/[0.025]"
                >
                  <td className="px-6 py-3.5 text-[13px] text-bright font-normal align-middle">{shop.name}</td>
                  <td className="px-6 py-3.5 text-[13px] text-mid font-light align-middle">{shop.city}</td>
                  <td className="px-6 py-3.5 align-middle">
                    <span
                      className={`inline-block text-[10px] font-normal tracking-[0.05em] px-[10px] py-[3px] rounded-[3px] border font-mono ${
                        shop.plan === "Premium"
                          ? "text-gold border-gold/30 bg-gold-06"
                          : "text-dim border-rule bg-transparent"
                      }`}
                    >
                      {shop.plan === "Premium" ? "Premium" : "Gratis"}
                    </span>
                  </td>
                  <td className="px-6 py-3.5 align-middle">
                    <span className={`inline-flex items-center gap-[7px] text-xs font-light ${
                      shop.status === "active" ? "text-mid" : "text-dim"
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                        shop.status === "active"
                          ? "bg-green shadow-[0_0_5px_rgba(90,158,118,0.5)]"
                          : "bg-dim"
                      }`} />
                      {shop.status === "active" ? "Activa" : "Inactiva"}
                    </span>
                  </td>
                  <td className={`px-6 py-3.5 text-[13px] align-middle font-mono ${
                    shop.mrr > 0 ? "text-gold font-medium" : "text-dim font-normal"
                  }`}>
                    {shop.mrr > 0 ? `$${shop.mrr}` : "$0"}
                  </td>
                  <td className="px-6 py-3.5 text-[13px] text-mid font-light align-middle">{shop.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
