"use client"

import { useState, useEffect } from "react"
import { db } from "@/lib/firebase"
import { 
  collection, 
  query, 
  onSnapshot, 
  orderBy, 
  updateDoc, 
  doc,
  addDoc,
  deleteDoc,
  setDoc,
  getDocs
} from "firebase/firestore"

// ── Types ──

interface Service {
  id: string
  name: string
  price: number
  duration: number
  description: string
}

interface Appointment {
  id: string
  clientName: string
  clientPhone: string
  clientEmail: string
  serviceName: string
  price: number
  status: "pending" | "attended" | "no-show" | "cancelled"
  date: string
  time: string
  notes?: string
  drinkCharge?: number
  extraHourCharge?: number
  createdAt: any
}

interface DaySchedule {
  enabled: boolean
  start: string
  end: string
  extraStart: string
  extraEnd: string
  extraEnabled: boolean
}

type Tab = "citas" | "horario" | "servicios" | "finanzas" | "config"

const dayLabels = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"]

const timeOptions: string[] = []
for (let h = 6; h <= 23; h++) {
  for (const m of ["00", "30"]) {
    timeOptions.push(`${String(h).padStart(2, "0")}:${m}`)
  }
}

export function BarberView({ showToast }: { showToast: (msg: string) => void }) {
  const [tab, setTab] = useState<Tab>("citas")
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [schedule, setSchedule] = useState<Record<string, DaySchedule>>({})
  const [extraHourPlus, setExtraHourPlus] = useState(0)
  const [logoUrl, setLogoUrl] = useState("")
  const [loading, setLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  
  // Filtros
  const [filterDay, setFilterDay] = useState<string>("Todos")

  // 1. CARGA DE DATOS EN TIEMPO REAL
  useEffect(() => {
    // Cargar Citas
    const qAppts = query(collection(db, "bookings"), orderBy("createdAt", "desc"))
    const unsubAppts = onSnapshot(qAppts, (snap) => {
      setAppointments(snap.docs.map(d => ({ id: d.id, ...d.data() } as Appointment)))
    })

    // Cargar Servicios
    const qServs = query(collection(db, "services"))
    const unsubServs = onSnapshot(qServs, (snap) => {
      setServices(snap.docs.map(d => ({ id: d.id, ...d.data() } as Service)))
    })

    // Cargar Configuración (Horario, Logo, Plus)
    const loadConfig = async () => {
      try {
        const { getDoc, doc: fsDoc } = await import("firebase/firestore")
        const schedSnap = await getDoc(fsDoc(db, "config", "schedule"))
        if (schedSnap.exists()) {
          const data = schedSnap.data()
          setSchedule(data.days || {})
          setExtraHourPlus(data.extraCharge || 0)
        }
        const brandSnap = await getDoc(fsDoc(db, "config", "branding"))
        if (brandSnap.exists()) setLogoUrl(brandSnap.data().logoUrl || "")
        
        setLoading(false)
      } catch (e) {
        console.error("Error cargando config:", e)
        setLoading(false)
      }
    }

    loadConfig()
    return () => { unsubAppts(); unsubServs(); }
  }, [])

  // ── Lógica de Citas ──
  const handleAttendance = async (id: string, status: "attended" | "no-show") => {
    try {
      await updateDoc(doc(db, "bookings", id), { status })
      showToast(status === "attended" ? "Asistencia confirmada" : "Marcado como no vino")
    } catch (e) { showToast("Error al actualizar") }
  }

  const addDrink = async (id: string, currentDrinkCharge: number = 0) => {
    const amount = prompt("¿Cuánto costó la bebida?", "100")
    if (amount) {
      try {
        await updateDoc(doc(db, "bookings", id), { drinkCharge: currentDrinkCharge + parseInt(amount) })
        showToast("Bebida sumada")
      } catch (e) { showToast("Error") }
    }
  }

  // ── Lógica de Servicios ──
  const [newService, setNewService] = useState({ name: "", price: 0, description: "" })
  const handleAddService = async () => {
    if (!newService.name || newService.price <= 0) return showToast("Datos incompletos")
    setIsSaving(true)
    try {
      await addDoc(collection(db, "services"), { ...newService, duration: 30 })
      setNewService({ name: "", price: 0, description: "" })
      showToast("Servicio añadido")
    } catch (e) { showToast("Error") }
    setIsSaving(false)
  }

  const deleteService = async (id: string) => {
    if (confirm("¿Borrar este servicio?")) {
      await deleteDoc(doc(db, "services", id))
      showToast("Servicio eliminado")
    }
  }

  // ── Lógica de Horario y Config ──
  const saveSchedule = async () => {
    setIsSaving(true)
    try {
      await setDoc(doc(db, "config", "schedule"), { days: schedule, extraCharge: extraHourPlus })
      showToast("Horario y recargo guardados")
    } catch (e) { showToast("Error") }
    setIsSaving(false)
  }

  const saveBranding = async () => {
    setIsSaving(true)
    try {
      await setDoc(doc(db, "config", "branding"), { logoUrl })
      showToast("Logo actualizado")
    } catch (e) { showToast("Error") }
    setIsSaving(false)
  }

  // ── Filtrado y Reportes ──
  const filteredAppointments = appointments.filter(a => filterDay === "Todos" || a.date.includes(filterDay))
  
  const dailyAttended = appointments.filter(a => a.status === "attended" && a.date.includes("Hoy")) // simplificado
  const totalDaily = dailyAttended.reduce((sum, a) => sum + (a.price || 0) + (a.drinkCharge || 0) + (a.extraHourCharge || 0), 0)

  if (loading) return <div className="min-h-screen bg-ink flex items-center justify-center text-gold italic">Cargando Alcala...</div>

  return (
    <div className="max-w-[1100px] mx-auto px-8 py-10">
      {/* Header Admin */}
      <div className="flex justify-between items-center mb-12">
        <div className="flex items-center gap-4">
          {logoUrl ? <img src={logoUrl} alt="Logo" className="w-12 h-12 rounded-full border border-gold/30 object-contain bg-ink-2" /> : <div className="w-12 h-12 rounded-full bg-gold/10 border border-gold/20 flex items-center justify-center text-gold italic font-serif">A</div>}
          <h1 className="font-serif text-3xl text-white">Alcala Barber <em className="italic text-gold">Drink</em></h1>
        </div>
        <div className="flex gap-1 bg-ink-2 p-1 rounded-sm border border-rule">
          {(["citas", "horario", "servicios", "finanzas", "config"] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-[10px] uppercase tracking-widest rounded-sm transition-all ${tab === t ? "bg-gold text-ink" : "text-dim hover:text-white"}`}>{t}</button>
          ))}
        </div>
      </div>

      {/* 📅 PESTAÑA: CITAS */}
      {tab === "citas" && (
        <>
          <div className="flex gap-2 overflow-x-auto pb-4 mb-6 custom-scrollbar">
            {["Todos", ...dayLabels].map(day => (
              <button key={day} onClick={() => setFilterDay(day)} className={`px-4 py-2 rounded-full border text-[11px] whitespace-nowrap ${filterDay === day ? "border-gold text-gold bg-gold/5" : "border-rule text-dim"}`}>{day}</button>
            ))}
          </div>

          <div className="flex flex-col gap-3">
            {filteredAppointments.length === 0 && <div className="py-20 text-center border border-dashed border-rule text-dim">No hay citas para mostrar.</div>}
            {filteredAppointments.map(appt => (
              <div key={appt.id} className={`bg-ink-2 border border-rule p-5 rounded-sm grid grid-cols-[100px_1fr_auto] gap-6 items-center ${appt.status === "attended" ? "border-green/30" : appt.status === "no-show" ? "opacity-40" : ""}`}>
                <div className="text-center border-r border-rule pr-6">
                  <div className="text-xl font-mono text-white leading-none">{appt.time?.split(" ")[0]}</div>
                  <div className="text-[10px] text-dim mt-1 uppercase">{appt.time?.split(" ")[1]}</div>
                </div>
                <div>
                  <div className="text-base text-bright flex items-center gap-2">
                    {appt.clientName} 
                    {appt.extraHourCharge ? <span className="text-[9px] bg-gold/20 text-gold px-1.5 py-0.5 rounded-full">+ EXTRA</span> : null}
                  </div>
                  <div className="text-xs text-dim font-mono">{appt.clientPhone} · {appt.date}</div>
                  <div className="text-[11px] text-gold/80 mt-1 italic">{appt.serviceName} (${appt.price}) {appt.drinkCharge ? `+ Bebida ($${appt.drinkCharge})` : ""}</div>
                  {appt.notes && <div className="mt-2 text-[10px] text-dim bg-ink-3 p-2 rounded">Nota: {appt.notes}</div>}
                </div>
                <div className="flex gap-2">
                  {appt.status === "pending" && (
                    <>
                      <button onClick={() => addDrink(appt.id, appt.drinkCharge)} className="p-2 border border-rule text-blue hover:bg-blue/5 rounded-sm">🥃</button>
                      <button onClick={() => handleAttendance(appt.id, "attended")} className="px-4 py-2 bg-white text-ink text-[10px] uppercase font-bold rounded-sm hover:bg-gold hover:text-white">Asistió</button>
                      <button onClick={() => handleAttendance(appt.id, "no-show")} className="px-4 py-2 border border-rule text-dim text-[10px] uppercase rounded-sm">No vino</button>
                    </>
                  )}
                  {appt.status !== "pending" && <div className={`text-[10px] uppercase px-3 py-1 rounded-full border ${appt.status === "attended" ? "border-green text-green" : "border-red text-red"}`}>{appt.status === "attended" ? "Completada" : "Ausente"}</div>}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ✂️ PESTAÑA: SERVICIOS */}
      {tab === "servicios" && (
        <div className="grid grid-cols-1 md:grid-cols-[1fr_350px] gap-10">
          <div className="flex flex-col gap-px bg-rule border border-rule rounded-sm overflow-hidden">
            {services.map(s => (
              <div key={s.id} className="bg-ink-2 p-6 flex justify-between items-center">
                <div><div className="text-white font-medium">{s.name}</div><div className="text-xs text-dim">{s.description}</div></div>
                <div className="flex items-center gap-6">
                  <div className="text-gold font-mono text-xl">${s.price}</div>
                  <button onClick={() => deleteService(s.id)} className="text-dim hover:text-red transition-colors">✕</button>
                </div>
              </div>
            ))}
          </div>
          <div className="bg-ink-2 p-8 border border-rule rounded-sm h-fit">
            <h3 className="text-sm uppercase tracking-widest text-gold mb-6">Nuevo Servicio</h3>
            <div className="flex flex-col gap-4">
              <input type="text" placeholder="Nombre (ej: Corte Fade)" value={newService.name} onChange={e => setNewService({...newService, name: e.target.value})} className="bg-ink-3 border border-rule p-3 text-sm text-white rounded-sm outline-none focus:border-gold/50" />
              <input type="number" placeholder="Precio ($)" value={newService.price || ""} onChange={e => setNewService({...newService, price: parseInt(e.target.value)})} className="bg-ink-3 border border-rule p-3 text-sm text-gold rounded-sm outline-none focus:border-gold/50" />
              <textarea placeholder="Descripción corta" value={newService.description} onChange={e => setNewService({...newService, description: e.target.value})} className="bg-ink-3 border border-rule p-3 text-sm text-white rounded-sm outline-none focus:border-gold/50 min-h-[80px]" />
              <button onClick={handleAddService} disabled={isSaving} className="mt-4 py-3 bg-gold text-ink text-xs uppercase font-bold rounded-sm hover:bg-white transition-all">{isSaving ? "Guardando..." : "Crear Servicio"}</button>
            </div>
          </div>
        </div>
      )}

      {/* 📊 PESTAÑA: FINANZAS */}
      {tab === "finanzas" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-ink-2 p-10 border border-rule rounded-sm text-center">
            <div className="text-[11px] uppercase text-dim tracking-widest mb-4">Total Ganado (Mes)</div>
            <div className="font-serif text-6xl text-gold">${appointments.filter(a => a.status === "attended").reduce((sum, a) => sum + (a.price || 0) + (a.drinkCharge || 0) + (a.extraHourCharge || 0), 0).toLocaleString()}</div>
            <div className="mt-6 text-xs text-dim italic">{appointments.filter(a => a.status === "attended").length} servicios cobrados con éxito.</div>
          </div>
          <div className="bg-ink-2 p-10 border border-rule rounded-sm">
            <h3 className="text-xs uppercase tracking-widest text-white mb-6">Resumen por categoría</h3>
            <div className="flex flex-col gap-4">
              <div className="flex justify-between border-b border-rule pb-2"><span className="text-dim text-sm">Cortes</span><span className="text-white font-mono">${appointments.filter(a => a.status === "attended").reduce((sum, a) => sum + (a.price || 0), 0)}</span></div>
              <div className="flex justify-between border-b border-rule pb-2"><span className="text-dim text-sm">Bebidas (Drinks)</span><span className="text-white font-mono">${appointments.filter(a => a.status === "attended").reduce((sum, a) => sum + (a.drinkCharge || 0), 0)}</span></div>
              <div className="flex justify-between border-b border-rule pb-2"><span className="text-dim text-sm">Horas Extra</span><span className="text-white font-mono">${appointments.filter(a => a.status === "attended").reduce((sum, a) => sum + (a.extraHourCharge || 0), 0)}</span></div>
            </div>
          </div>
        </div>
      )}

      {/* ⚙️ PESTAÑA: HORARIO */}
      {tab === "horario" && (
        <div className="max-w-[700px]">
          <div className="bg-ink-2 border border-rule rounded-sm p-8 mb-6">
            <h3 className="text-sm uppercase tracking-widest text-gold mb-6">Cargo por Hora Extra</h3>
            <div className="flex items-center gap-4">
              <input type="number" value={extraHourPlus} onChange={e => setExtraHourPlus(parseInt(e.target.value))} className="bg-ink-3 border border-rule p-4 text-xl text-gold font-mono rounded-sm w-32 outline-none" />
              <div className="text-xs text-dim leading-relaxed">Este monto se sumará automáticamente al precio del corte si el cliente elige un horario marcado como "Extra".</div>
            </div>
          </div>
          <div className="flex flex-col gap-px bg-rule border border-rule rounded-sm overflow-hidden mb-8">
            {dayLabels.map(day => {
              const d = schedule[day] || { enabled: false, start: "09:00", end: "18:00", extraEnabled: false, extraStart: "18:00", extraEnd: "21:00" }
              const update = (patch: any) => setSchedule({...schedule, [day]: {...d, ...patch}})
              return (
                <div key={day} className="bg-ink-2 p-6 flex items-center justify-between flex-wrap gap-4">
                  <div className="flex items-center gap-4 min-w-[150px]">
                    <button onClick={() => update({enabled: !d.enabled})} className={`px-3 py-1 rounded-sm text-[9px] uppercase font-bold ${d.enabled ? "bg-gold text-ink" : "bg-ink-4 text-dim"}`}>{d.enabled ? "Abierto" : "Cerrado"}</button>
                    <span className="text-sm text-white">{day}</span>
                  </div>
                  {d.enabled && (
                    <div className="flex items-center gap-4">
                      <select value={d.start} onChange={e => update({start: e.target.value})} className="bg-ink-3 border border-rule p-2 text-xs text-white rounded-sm">{timeOptions.map(t => <option key={t} value={t}>{t}</option>)}</select>
                      <span className="text-dim">-</span>
                      <select value={d.end} onChange={e => update({end: e.target.value})} className="bg-ink-3 border border-rule p-2 text-xs text-white rounded-sm">{timeOptions.map(t => <option key={t} value={t}>{t}</option>)}</select>
                      <button onClick={() => update({extraEnabled: !d.extraEnabled})} className={`px-2 py-1 border text-[9px] rounded-sm transition-all ${d.extraEnabled ? "border-gold text-gold bg-gold/10" : "border-rule text-dim"}`}>EXTRA</button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          <button onClick={saveSchedule} disabled={isSaving} className="w-full py-4 bg-white text-ink text-xs uppercase font-black rounded-sm">{isSaving ? "Guardando..." : "Guardar Configuración de Horario"}</button>
        </div>
      )}

      {/* 🖼️ PESTAÑA: AJUSTES (CONFIG) */}
      {tab === "config" && (
        <div className="max-w-[600px] bg-ink-2 border border-rule p-10 rounded-sm">
          <h3 className="text-sm uppercase tracking-widest text-gold mb-8">Imagen de Marca</h3>
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <label className="text-[10px] text-dim uppercase">URL del Logo de la Barbería</label>
              <input type="text" value={logoUrl} onChange={e => setLogoUrl(e.target.value)} placeholder="https://tusitio.com/logo.png" className="bg-ink-3 border border-rule p-4 text-sm text-white rounded-sm outline-none focus:border-gold/50" />
            </div>
            {logoUrl && <div className="p-4 border border-dashed border-rule rounded-sm flex items-center justify-center bg-ink-3"><img src={logoUrl} alt="Preview" className="max-h-20 object-contain" /></div>}
            <button onClick={saveBranding} disabled={isSaving} className="py-4 bg-gold text-ink text-xs uppercase font-bold rounded-sm">{isSaving ? "Actualizar Logo" : "Actualizar Imagen"}</button>
          </div>
        </div>
      )}
    </div>
  )
}
