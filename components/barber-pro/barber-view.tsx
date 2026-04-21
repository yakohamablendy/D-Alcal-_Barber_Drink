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
  setDoc
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
  date: any
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

// DATOS DE PRUEBA (Respaldo si Firebase está vacío)
const defaultServicesList: Service[] = [
  { id: "1", name: "Corte Clásico", price: 400, duration: 30, description: "Tijera y máquina." },
  { id: "2", name: "Corte + Barba", price: 600, duration: 45, description: "Perfilado completo." }
]

const defaultSchedule: Record<string, DaySchedule> = {
  Lunes:     { enabled: true,  start: "09:00", end: "18:00", extraEnabled: false, extraStart: "18:00", extraEnd: "21:00" },
  Martes:    { enabled: true,  start: "09:00", end: "18:00", extraEnabled: false, extraStart: "18:00", extraEnd: "21:00" },
  Miércoles: { enabled: true,  start: "09:00", end: "18:00", extraEnabled: false, extraStart: "18:00", extraEnd: "21:00" },
  Jueves:    { enabled: true,  start: "09:00", end: "18:00", extraEnabled: false, extraStart: "18:00", extraEnd: "21:00" },
  Viernes:   { enabled: true,  start: "09:00", end: "19:00", extraEnabled: false, extraStart: "19:00", extraEnd: "22:00" },
  Sábado:    { enabled: true,  start: "09:00", end: "16:00", extraEnabled: false, extraStart: "16:00", extraEnd: "19:00" },
  Domingo:   { enabled: false, start: "10:00", end: "14:00", extraEnabled: false, extraStart: "14:00", extraEnd: "16:00" },
}

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
  const [schedule, setSchedule] = useState<Record<string, DaySchedule>>(defaultSchedule)
  const [extraHourPlus, setExtraHourPlus] = useState(0)
  const [logoUrl, setLogoUrl] = useState("")
  const [loading, setLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [dateTag, setDateTag] = useState("")
  const [filterDay, setFilterDay] = useState<string>("Todos")

  useEffect(() => {
    // Generar fecha segura
    const today = new Date()
    const dNames = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"]
    const mNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]
    setDateTag(`${dNames[today.getDay()]} ${today.getDate()} ${mNames[today.getMonth()]} ${today.getFullYear()}`)

    // Cargar Citas
    const qAppts = query(collection(db, "bookings"), orderBy("createdAt", "desc"))
    const unsubAppts = onSnapshot(qAppts, (snap) => {
      setAppointments(snap.docs.map(d => ({ id: d.id, ...d.data() } as Appointment)))
    }, (err) => console.error("Error citas:", err))

    // Cargar Servicios
    const qServs = query(collection(db, "services"))
    const unsubServs = onSnapshot(qServs, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as Service))
      setServices(list.length > 0 ? list : defaultServicesList)
    }, (err) => console.error("Error servs:", err))

    // Cargar Config
    const loadConfig = async () => {
      try {
        const { getDoc, doc: fsDoc } = await import("firebase/firestore")
        const schedSnap = await getDoc(fsDoc(db, "config", "schedule"))
        if (schedSnap.exists()) {
          const data = schedSnap.data()
          if (data.days) setSchedule(data.days)
          setExtraHourPlus(data.extraCharge || 0)
        }
        const brandSnap = await getDoc(fsDoc(db, "config", "branding"))
        if (brandSnap.exists()) setLogoUrl(brandSnap.data().logoUrl || "")
      } catch (e) {
        console.error("Error config:", e)
      } finally {
        setLoading(false)
      }
    }

    loadConfig()
    return () => { unsubAppts(); unsubServs(); }
  }, [])

  // ── Handlers ──
  const handleAttendance = async (id: string, status: "attended" | "no-show") => {
    try {
      await updateDoc(doc(db, "bookings", id), { status })
      showToast(status === "attended" ? "Confirmado" : "Ausente")
    } catch (e) { showToast("Error") }
  }

  const addDrink = async (id: string, current: number = 0) => {
    const amount = prompt("¿Precio de bebida?", "100")
    if (amount) {
      try {
        await updateDoc(doc(db, "bookings", id), { drinkCharge: (current || 0) + parseInt(amount) })
        showToast("Sumado")
      } catch (e) { showToast("Error") }
    }
  }

  const [newService, setNewService] = useState({ name: "", price: 0, description: "" })
  const handleAddService = async () => {
    if (!newService.name || newService.price <= 0) return showToast("Faltan datos")
    setIsSaving(true)
    try {
      await addDoc(collection(db, "services"), { ...newService, duration: 30 })
      setNewService({ name: "", price: 0, description: "" })
      showToast("Creado")
    } catch (e) { showToast("Error") }
    setIsSaving(false)
  }

  const deleteService = async (id: string) => {
    if (confirm("¿Borrar?")) {
      await deleteDoc(doc(db, "services", id))
      showToast("Borrado")
    }
  }

  const saveSchedule = async () => {
    setIsSaving(true)
    try {
      await setDoc(doc(db, "config", "schedule"), { days: schedule, extraCharge: extraHourPlus })
      showToast("Guardado")
    } catch (e) { showToast("Error") }
    setIsSaving(false)
  }

  const saveBranding = async () => {
    setIsSaving(true)
    try {
      await setDoc(doc(db, "config", "branding"), { logoUrl })
      showToast("Logo guardado")
    } catch (e) { showToast("Error") }
    setIsSaving(false)
  }

  // ── Filtros ──
  const filteredAppointments = appointments.filter(a => {
    const dStr = typeof a.date === 'object' && a.date !== null ? a.date.fullLabel : a.date
    return filterDay === "Todos" || (dStr && dStr.includes(filterDay))
  })

  if (loading) return <div className="min-h-screen bg-ink flex items-center justify-center text-gold italic">Cargando Alcala...</div>

  return (
    <div className="max-w-[1100px] mx-auto px-8 py-10">
      {/* Header */}
      <div className="flex justify-between items-center mb-12 flex-wrap gap-6">
        <div className="flex items-center gap-4">
          {logoUrl ? <img src={logoUrl} alt="Logo" className="w-12 h-12 rounded-full object-contain bg-ink-2 border border-rule" /> : <div className="w-12 h-12 rounded-full bg-gold/10 border border-gold/20 flex items-center justify-center text-gold italic font-serif">A</div>}
          <h1 className="font-serif text-3xl text-white">Alcala Barber <em className="italic text-gold">Drink</em></h1>
        </div>
        <div className="flex gap-1 bg-ink-2 p-1 rounded-sm border border-rule overflow-x-auto">
          {(["citas", "horario", "servicios", "finanzas", "config"] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-[10px] uppercase tracking-widest rounded-sm transition-all whitespace-nowrap ${tab === t ? "bg-gold text-ink" : "text-dim hover:text-white"}`}>{t}</button>
          ))}
        </div>
      </div>

      {/* 📅 CITAS */}
      {tab === "citas" && (
        <>
          <div className="flex gap-2 overflow-x-auto pb-4 mb-6 custom-scrollbar">
            {["Todos", ...dayLabels].map(day => (
              <button key={day} onClick={() => setFilterDay(day)} className={`px-4 py-2 rounded-full border text-[11px] whitespace-nowrap ${filterDay === day ? "border-gold text-gold bg-gold/5" : "border-rule text-dim"}`}>{day}</button>
            ))}
          </div>

          <div className="flex flex-col gap-3">
            {filteredAppointments.length === 0 && <div className="py-20 text-center border border-dashed border-rule text-dim rounded-sm">No hay citas registradas.</div>}
            {filteredAppointments.map(appt => {
              const dStr = typeof appt.date === 'object' && appt.date !== null ? appt.date.fullLabel : appt.date
              return (
                <div key={appt.id} className={`bg-ink-2 border border-rule p-5 rounded-sm grid grid-cols-[80px_1fr_auto] gap-6 items-center ${appt.status === "attended" ? "border-green/20" : appt.status === "no-show" ? "opacity-30" : ""}`}>
                  <div className="text-center border-r border-rule pr-6">
                    <div className="text-lg font-mono text-white leading-none">{appt.time?.split(" ")[0]}</div>
                    <div className="text-[9px] text-dim mt-1 uppercase">{appt.time?.split(" ")[1]}</div>
                  </div>
                  <div>
                    <div className="text-base text-bright flex items-center gap-2">
                      {appt.clientName} 
                      {(appt.extraHourCharge ?? 0) > 0 && <span className="text-[8px] bg-gold/20 text-gold px-1.5 py-0.5 rounded-sm">★ PLUS</span>}
                    </div>
                    <div className="text-xs text-dim font-mono">{appt.clientPhone} · {dStr}</div>
                    <div className="text-[10px] text-gold/80 mt-1 italic">{appt.serviceName} (${appt.price}) {appt.drinkCharge ? `+ Drink ($${appt.drinkCharge})` : ""}</div>
                    {appt.notes && <div className="mt-2 text-[10px] text-dim bg-ink-3 p-2 rounded max-w-md italic">"{appt.notes}"</div>}
                  </div>
                  <div className="flex gap-2">
                    {appt.status === "pending" ? (
                      <>
                        <button onClick={() => addDrink(appt.id, appt.drinkCharge)} className="p-2 border border-rule text-gold hover:bg-gold/5 rounded-sm" title="Añadir Bebida">🥃</button>
                        <button onClick={() => handleAttendance(appt.id, "attended")} className="px-4 py-2 bg-white text-ink text-[10px] uppercase font-bold rounded-sm">Vino</button>
                        <button onClick={() => handleAttendance(appt.id, "no-show")} className="px-4 py-2 border border-rule text-dim text-[10px] uppercase rounded-sm">No vino</button>
                      </>
                    ) : (
                      <div className={`text-[9px] uppercase px-3 py-1 rounded-sm border ${appt.status === "attended" ? "border-green text-green" : "border-red text-red"}`}>{appt.status === "attended" ? "Completada" : "Ausente"}</div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* ✂️ SERVICIOS */}
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
            <h3 className="text-xs uppercase tracking-widest text-gold mb-6">Añadir Servicio</h3>
            <div className="flex flex-col gap-4">
              <input type="text" placeholder="Nombre" value={newService.name} onChange={e => setNewService({...newService, name: e.target.value})} className="bg-ink-3 border border-rule p-3 text-sm text-white rounded-sm outline-none" />
              <input type="number" placeholder="Precio ($)" value={newService.price || ""} onChange={e => setNewService({...newService, price: parseInt(e.target.value)})} className="bg-ink-3 border border-rule p-3 text-sm text-gold rounded-sm outline-none" />
              <textarea placeholder="Descripción" value={newService.description} onChange={e => setNewService({...newService, description: e.target.value})} className="bg-ink-3 border border-rule p-3 text-sm text-white rounded-sm outline-none min-h-[80px]" />
              <button onClick={handleAddService} disabled={isSaving} className="mt-4 py-3 bg-gold text-ink text-xs uppercase font-bold rounded-sm">{isSaving ? "Guardando..." : "Crear Servicio"}</button>
            </div>
          </div>
        </div>
      )}

      {/* 📊 FINANZAS */}
      {tab === "finanzas" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-ink-2 p-10 border border-rule rounded-sm text-center">
            <div className="text-[10px] uppercase text-dim tracking-widest mb-4">Ingresos Reales (Asistidos)</div>
            <div className="font-serif text-6xl text-gold">${appointments.filter(a => a.status === "attended").reduce((sum, a) => sum + (a.price || 0) + (a.drinkCharge || 0) + (a.extraHourCharge || 0), 0).toLocaleString()}</div>
            <div className="mt-6 text-xs text-dim italic">{appointments.filter(a => a.status === "attended").length} clientes atendidos en total.</div>
          </div>
          <div className="bg-ink-2 p-10 border border-rule rounded-sm flex flex-col justify-center">
            <div className="flex justify-between border-b border-rule pb-3 mb-3"><span className="text-dim text-sm">Cortes</span><span className="text-white font-mono">${appointments.filter(a => a.status === "attended").reduce((sum, a) => sum + (a.price || 0), 0).toLocaleString()}</span></div>
            <div className="flex justify-between border-b border-rule pb-3 mb-3"><span className="text-dim text-sm">Bebidas</span><span className="text-white font-mono">${appointments.filter(a => a.status === "attended").reduce((sum, a) => sum + (a.drinkCharge || 0), 0).toLocaleString()}</span></div>
            <div className="flex justify-between border-b border-rule pb-3"><span className="text-dim text-sm">Plus Horario</span><span className="text-white font-mono">${appointments.filter(a => a.status === "attended").reduce((sum, a) => sum + (a.extraHourCharge || 0), 0).toLocaleString()}</span></div>
          </div>
        </div>
      )}

      {/* ⚙️ HORARIO */}
      {tab === "horario" && (
        <div className="max-w-[750px]">
          <div className="bg-ink-2 border border-rule rounded-sm p-8 mb-6 grid grid-cols-1 sm:grid-cols-2 gap-8 items-center">
            <div>
              <h3 className="text-xs uppercase tracking-widest text-gold mb-2">Plus por Hora Extra</h3>
              <p className="text-[10px] text-dim leading-relaxed">Monto adicional por citas en horarios especiales.</p>
            </div>
            <input type="number" value={extraHourPlus} onChange={e => setExtraHourPlus(parseInt(e.target.value))} className="bg-ink-3 border border-rule p-4 text-2xl text-gold font-mono rounded-sm outline-none text-right" />
          </div>
          <div className="flex flex-col gap-px bg-rule border border-rule rounded-sm overflow-hidden mb-8">
            {dayLabels.map(day => {
              const d = schedule[day] || { enabled: false, start: "09:00", end: "18:00", extraEnabled: false, extraStart: "18:00", extraEnd: "21:00" }
              const update = (patch: any) => setSchedule({...schedule, [day]: {...d, ...patch}})
              return (
                <div key={day} className="bg-ink-2 p-6 flex items-center justify-between flex-wrap gap-4">
                  <div className="flex items-center gap-4 min-w-[140px]">
                    <button onClick={() => update({enabled: !d.enabled})} className={`px-3 py-1 rounded-sm text-[9px] uppercase font-bold transition-all ${d.enabled ? "bg-gold text-ink" : "bg-ink-4 text-dim"}`}>{d.enabled ? "Abierto" : "Cerrado"}</button>
                    <span className="text-sm text-white">{day}</span>
                  </div>
                  {d.enabled && (
                    <div className="flex items-center gap-4">
                      <select value={d.start} onChange={e => update({start: e.target.value})} className="bg-ink-3 border border-rule p-2 text-xs text-white rounded-sm">{timeOptions.map(t => <option key={t} value={t}>{t}</option>)}</select>
                      <span className="text-dim">a</span>
                      <select value={d.end} onChange={e => update({end: e.target.value})} className="bg-ink-3 border border-rule p-2 text-xs text-white rounded-sm">{timeOptions.map(t => <option key={t} value={t}>{t}</option>)}</select>
                      <button onClick={() => update({extraEnabled: !d.extraEnabled})} className={`px-2 py-1 border text-[9px] rounded-sm font-bold ${d.extraEnabled ? "border-gold text-gold bg-gold/5" : "border-rule text-dim"}`}>EXTRA</button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          <button onClick={saveSchedule} disabled={isSaving} className="w-full py-4 bg-white text-ink text-xs uppercase font-black rounded-sm">{isSaving ? "Guardando..." : "Guardar Todo el Horario"}</button>
        </div>
      )}

      {/* 🖼️ CONFIG */}
      {tab === "config" && (
        <div className="max-w-[600px] bg-ink-2 border border-rule p-10 rounded-sm">
          <h3 className="text-xs uppercase tracking-widest text-gold mb-8">Personalización</h3>
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <label className="text-[10px] text-dim uppercase">URL de tu Logo</label>
              <input type="text" value={logoUrl} onChange={e => setLogoUrl(e.target.value)} placeholder="Ej: https://imgur.com/tu-logo.png" className="bg-ink-3 border border-rule p-4 text-sm text-white rounded-sm outline-none" />
            </div>
            {logoUrl && <div className="p-6 border border-dashed border-rule rounded-sm flex items-center justify-center bg-ink-3"><img src={logoUrl} alt="Logo Preview" className="max-h-24 object-contain" /></div>}
            <button onClick={saveBranding} disabled={isSaving} className="py-4 bg-gold text-ink text-xs uppercase font-bold rounded-sm">Actualizar Marca</button>
          </div>
        </div>
      )}
    </div>
  )
}
