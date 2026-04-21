"use client"

import { useState, useEffect, useRef } from "react"
import { db, storage } from "@/lib/firebase"
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
import { ref, uploadBytes, getDownloadURL } from "firebase/storage"

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

const timeOptions: string[] = []
for (let h = 6; h <= 23; h++) {
  for (const m of ["00", "30"]) {
    timeOptions.push(`${String(h).padStart(2, "0")}:${m}`)
  }
}

const defaultSchedule: Record<string, DaySchedule> = {
  Lunes:     { enabled: true,  start: "09:00", end: "18:00", extraEnabled: false, extraStart: "18:00", extraEnd: "21:00" },
  Martes:    { enabled: true,  start: "09:00", end: "18:00", extraEnabled: false, extraStart: "18:00", extraEnd: "21:00" },
  Miércoles: { enabled: true,  start: "09:00", end: "18:00", extraEnabled: false, extraStart: "18:00", extraEnd: "21:00" },
  Jueves:    { enabled: true,  start: "09:00", end: "18:00", extraEnabled: false, extraStart: "18:00", extraEnd: "21:00" },
  Viernes:   { enabled: true,  start: "09:00", end: "19:00", extraEnabled: false, extraStart: "19:00", extraEnd: "22:00" },
  Sábado:    { enabled: true,  start: "09:00", end: "16:00", extraEnabled: false, extraStart: "16:00", extraEnd: "19:00" },
  Domingo:   { enabled: false, start: "10:00", end: "14:00", extraEnabled: false, extraStart: "14:00", extraEnd: "16:00" },
}

const getSafeDateString = (date: any): string => {
  if (!date) return "";
  if (typeof date === 'string') return date;
  if (typeof date === 'object' && date.fullLabel) return date.fullLabel;
  if (typeof date === 'object' && date.label) return date.label;
  return "Fecha no válida";
}

export function BarberView({ showToast }: { showToast: (msg: string) => void }) {
  const [tab, setTab] = useState<Tab>("citas")
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [schedule, setSchedule] = useState<Record<string, DaySchedule>>(defaultSchedule)
  const [extraHourPlus, setExtraHourPlus] = useState(0)
  const [logoUrl, setLogoUrl] = useState("")
  const [reminderMessage, setReminderMessage] = useState("¡Hola [Cliente]! Te recordamos tu cita en Alcala Barber Drink para el [Fecha] a las [Hora]. ¡Te esperamos! 💈🥃")
  const [loading, setLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [dateTag, setDateTag] = useState("")
  const [filterDay, setFilterDay] = useState<string>("Todos")
  
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const today = new Date()
    const dNames = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"]
    const mNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]
    setDateTag(`${dNames[today.getDay()]} ${today.getDate()} ${mNames[today.getMonth()]} ${today.getFullYear()}`)

    const unsubAppts = onSnapshot(query(collection(db, "bookings"), orderBy("createdAt", "desc")), (snap) => {
      setAppointments(snap.docs.map(d => ({ id: d.id, ...d.data() } as Appointment)))
    }, (err) => console.error(err))

    const unsubServs = onSnapshot(collection(db, "services"), (snap) => {
      setServices(snap.docs.map(d => ({ id: d.id, ...d.data() } as Service)))
    }, (err) => console.error(err))

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
        if (brandSnap.exists()) {
          const data = brandSnap.data()
          setLogoUrl(data.logoUrl || "")
          if (data.reminderMessage) setReminderMessage(data.reminderMessage)
        }
      } catch (e) { console.error(e) } finally { setLoading(false) }
    }

    loadConfig()
    return () => { unsubAppts(); unsubServs(); }
  }, [])

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
        showToast("Drink sumado")
      } catch (e) { showToast("Error") }
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    setIsUploading(true)
    try {
      const storageRef = ref(storage, `branding/logo_${Date.now()}`)
      await uploadBytes(storageRef, file)
      const url = await getDownloadURL(storageRef)
      setLogoUrl(url)
      showToast("Imagen subida")
    } catch (error) {
      console.error("Error subiendo:", error)
      showToast("Error al subir")
    } finally {
      setIsUploading(false)
    }
  }

  const deleteService = async (id: string) => {
    if (confirm("¿Borrar servicio?")) {
      try { await deleteDoc(doc(db, "services", id)); showToast("Borrado") } catch (e) { showToast("Error") }
    }
  }

  const sendWhatsAppReminder = (appt: Appointment) => {
    const dStr = getSafeDateString(appt.date)
    let msg = reminderMessage.replace("[Cliente]", appt.clientName || "Cliente").replace("[Fecha]", dStr).replace("[Hora]", appt.time || "")
    const cleanPhone = (appt.clientPhone || "").replace(/\D/g, "")
    const finalPhone = cleanPhone.startsWith("1") ? cleanPhone : `1${cleanPhone}`
    window.open(`https://wa.me/${finalPhone}?text=${encodeURIComponent(msg)}`, "_blank")
  }

  const generateDayReport = () => {
    const today = new Date()
    const dNames = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"]
    const dayName = dNames[today.getDay()]
    const dSched = schedule[dayName]
    if (!dSched?.enabled) return alert("Cerrado hoy")
    const todayAppts = appointments.filter(a => getSafeDateString(a.date).includes("Hoy") || getSafeDateString(a.date).includes(dayName))
    let report = `💈 *AGENDA: ALCALA BARBER DRINK* 🥃\n📅 ${dateTag}\n\n`
    const [hS, mS] = dSched.start.split(":").map(Number)
    const [hE, mE] = dSched.end.split(":").map(Number)
    let curH = hS, curM = mS
    while (curH * 60 + curM < curH * 60 + mE) {
      const tStr = `${String(curH % 12 || 12).padStart(2, "0")}:${String(curM).padStart(2, "0")} ${curH >= 12 ? 'PM' : 'AM'}`
      const isOcc = todayAppts.some(a => a.time === tStr && a.status !== "cancelled")
      report += `${isOcc ? "❌" : "🟢"} ${tStr} ${isOcc ? "-(Ocupado)-" : "*DISPONIBLE*"}\n`
      curM += 30; if (curM >= 60) { curH++; curM = 0; }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(report)}`, "_blank")
  }

  const [newService, setNewService] = useState({ name: "", price: 0, description: "" })
  const handleAddService = async () => {
    if (!newService.name || newService.price <= 0) return showToast("Faltan datos")
    setIsSaving(true)
    try { await addDoc(collection(db, "services"), { ...newService, duration: 30 }); setNewService({ name: "", price: 0, description: "" }); showToast("Creado") } catch (e) { showToast("Error") }
    setIsSaving(false)
  }

  const saveAllConfig = async () => {
    setIsSaving(true)
    try {
      await setDoc(doc(db, "config", "schedule"), { days: schedule, extraCharge: extraHourPlus })
      await setDoc(doc(db, "config", "branding"), { logoUrl, reminderMessage })
      showToast("Guardado")
    } catch (e) { showToast("Error") }
    setIsSaving(false)
  }

  const filteredAppointments = appointments.filter(a => {
    const dStr = getSafeDateString(a.date);
    return filterDay === "Todos" || dStr.includes(filterDay);
  })

  if (loading) return <div className="min-h-screen bg-ink flex items-center justify-center text-gold italic">Cargando Alcala...</div>

  return (
    <div className="max-w-[1100px] mx-auto px-4 sm:px-8 py-6 sm:py-10">
      <div className="flex justify-between items-center mb-8 sm:mb-12 flex-wrap gap-4">
        <div className="flex items-center gap-3">
          {logoUrl ? <img src={logoUrl} alt="Logo" className="w-10 h-10 sm:w-14 sm:h-14 rounded-full object-contain border border-gold/30 bg-ink-2" /> : <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-full bg-gold/10 border border-gold/20 flex items-center justify-center text-gold font-serif text-xl sm:text-2xl">A</div>}
          <h1 className="font-serif text-2xl sm:text-3xl text-white">Admin</h1>
        </div>
        <div className="flex gap-1 bg-ink-2 p-1 rounded-sm border border-rule overflow-x-auto max-w-full">
          {(["citas", "horario", "servicios", "finanzas", "config"] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)} className={`px-3 sm:px-4 py-2 text-[9px] sm:text-[10px] uppercase tracking-widest rounded-sm transition-all whitespace-nowrap ${tab === t ? "bg-gold text-ink" : "text-dim hover:text-white"}`}>{t}</button>
          ))}
        </div>
      </div>

      {tab === "citas" && (
        <>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
            <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar w-full sm:w-auto">
              {["Todos", ...dayLabels].map(day => (
                <button key={day} onClick={() => setFilterDay(day)} className={`px-4 py-2 rounded-full border text-[10px] sm:text-[11px] whitespace-nowrap ${filterDay === day ? "border-gold text-gold bg-gold/5" : "border-rule text-dim"}`}>{day}</button>
              ))}
            </div>
            <button onClick={generateDayReport} className="w-full sm:w-auto px-5 py-3 bg-green/10 text-green border border-green/20 rounded-full text-[10px] uppercase font-bold hover:bg-green hover:text-ink transition-all">Estado WhatsApp 📱</button>
          </div>
          <div className="flex flex-col gap-3">
            {filteredAppointments.length === 0 && <div className="py-20 text-center border border-dashed border-rule text-dim rounded-sm italic text-sm">No hay citas registradas.</div>}
            {filteredAppointments.map(appt => {
              const dStr = getSafeDateString(appt.date)
              return (
                <div key={appt.id} className={`bg-ink-2 border border-rule p-4 sm:p-5 rounded-sm flex flex-col sm:grid sm:grid-cols-[80px_1fr_auto] gap-4 sm:gap-6 items-start sm:items-center ${appt.status === "attended" ? "border-green/20" : appt.status === "no-show" ? "opacity-30" : ""}`}>
                  <div className="flex sm:flex-col items-center sm:text-center border-b sm:border-b-0 sm:border-r border-rule pb-2 sm:pb-0 sm:pr-6 w-full sm:w-auto gap-3 sm:gap-0">
                    <div className="text-lg sm:text-xl font-mono text-white leading-none">{appt.time?.split(" ")[0]}</div>
                    <div className="text-[9px] text-dim sm:mt-1 uppercase">{appt.time?.split(" ")[1]}</div>
                  </div>
                  <div className="w-full">
                    <div className="text-base text-bright flex items-center gap-2 flex-wrap">{appt.clientName} {(appt.extraHourCharge ?? 0) > 0 && <span className="text-[8px] bg-gold/20 text-gold px-1.5 py-0.5 rounded-sm">★ PLUS</span>}</div>
                    <div className="text-xs text-dim font-mono mt-1">{appt.clientPhone} · {dStr}</div>
                    <div className="text-[10px] text-gold/80 mt-1 italic">{appt.serviceName} (${appt.price}) {appt.drinkCharge ? `+ Drink ($${appt.drinkCharge})` : ""}</div>
                    {appt.notes && <div className="mt-2 text-[10px] text-dim bg-ink-3 p-2 rounded italic">"{appt.notes}"</div>}
                  </div>
                  <div className="flex gap-2 items-center w-full sm:w-auto justify-end sm:justify-start pt-3 sm:pt-0 border-t sm:border-t-0 border-rule/30">
                    {appt.status === "pending" ? (
                      <>
                        <button onClick={() => sendWhatsAppReminder(appt)} className="p-3 sm:p-2 border border-rule text-gold hover:bg-gold/10 rounded-sm">🔔</button>
                        <button onClick={() => addDrink(appt.id, appt.drinkCharge)} className="p-3 sm:p-2 border border-rule text-gold hover:bg-gold/10 rounded-sm">🥃</button>
                        <button onClick={() => handleAttendance(appt.id, "attended")} className="flex-1 sm:flex-none px-4 py-3 sm:py-2 bg-white text-ink text-[10px] uppercase font-bold rounded-sm">Vino</button>
                        <button onClick={() => handleAttendance(appt.id, "no-show")} className="px-4 py-3 sm:py-2 border border-rule text-dim text-[10px] uppercase rounded-sm">No vino</button>
                      </>
                    ) : (
                      <div className={`w-full sm:w-auto text-center text-[9px] uppercase px-3 py-2 rounded-sm border ${appt.status === "attended" ? "border-green text-green" : "border-red text-red"}`}>{appt.status === "attended" ? "Completada" : "Ausente"}</div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {tab === "horario" && (
        <div className="max-w-full">
          <div className="bg-ink-2 border border-rule rounded-sm p-6 sm:p-8 mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div><h3 className="text-xs uppercase tracking-widest text-gold mb-1">Precio Hora Extra</h3><p className="text-[10px] text-dim">Monto adicional por horarios especiales.</p></div>
            <input type="number" value={extraHourPlus} onChange={e => setExtraHourPlus(parseInt(e.target.value))} className="bg-ink-3 border border-rule p-3 text-xl text-gold font-mono rounded-sm w-full sm:w-32 text-right" />
          </div>
          <div className="flex flex-col gap-px bg-rule border border-rule rounded-sm overflow-hidden mb-8">
            {dayLabels.map(day => {
              const d = schedule[day] || defaultSchedule[day]
              const update = (patch: any) => setSchedule({...schedule, [day]: {...d, ...patch}})
              return (
                <div key={day} className="bg-ink-2 p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-rule/30">
                  <div className="flex items-center justify-between sm:justify-start gap-4 min-w-[140px]">
                    <span className="text-sm text-white font-medium">{day}</span>
                    <button onClick={() => update({enabled: !d.enabled})} className={`px-3 py-1.5 rounded-sm text-[9px] uppercase font-bold transition-all ${d.enabled ? "bg-gold text-ink" : "bg-ink-4 text-dim"}`}>{d.enabled ? "Abierto" : "Cerrado"}</button>
                  </div>
                  {d.enabled && (
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                      <div className="flex items-center gap-2 w-full sm:w-auto">
                        <select value={d.start} onChange={e => update({start: e.target.value})} className="flex-1 sm:flex-none bg-ink-3 border border-rule p-2.5 text-xs text-white rounded-sm">{timeOptions.map(t => <option key={t} value={t}>{t}</option>)}</select>
                        <span className="text-dim">a</span>
                        <select value={d.end} onChange={e => update({end: e.target.value})} className="flex-1 sm:flex-none bg-ink-3 border border-rule p-2.5 text-xs text-white rounded-sm">{timeOptions.map(t => <option key={t} value={t}>{t}</option>)}</select>
                      </div>
                      <div className="flex items-center gap-2 w-full sm:w-auto sm:border-l sm:border-rule sm:pl-6">
                        <button onClick={() => update({extraEnabled: !d.extraEnabled})} className={`px-3 py-2 border text-[9px] rounded-sm font-bold ${d.extraEnabled ? "border-gold text-gold bg-gold/5" : "border-rule text-dim"}`}>EXTRA</button>
                        {d.extraEnabled && (
                          <div className="flex items-center gap-2 flex-1 sm:flex-none">
                            <select value={d.extraStart} onChange={e => update({extraStart: e.target.value})} className="flex-1 sm:flex-none bg-ink-3 border border-gold/30 p-2.5 text-xs text-gold rounded-sm">{timeOptions.map(t => <option key={t} value={t}>{t}</option>)}</select>
                            <select value={d.extraEnd} onChange={e => update({extraEnd: e.target.value})} className="flex-1 sm:flex-none bg-ink-3 border border-gold/30 p-2.5 text-xs text-gold rounded-sm">{timeOptions.map(t => <option key={t} value={t}>{t}</option>)}</select>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          <button onClick={saveAllConfig} disabled={isSaving} className="w-full py-5 bg-white text-ink text-[11px] uppercase font-black rounded-sm tracking-widest shadow-xl">Guardar Cambios</button>
        </div>
      )}

      {tab === "servicios" && (
        <div className="grid grid-cols-1 md:grid-cols-[1fr_350px] gap-8 sm:gap-10">
          <div className="flex flex-col gap-px bg-rule border border-rule rounded-sm overflow-hidden">
            {services.map(s => (
              <div key={s.id} className="bg-ink-2 p-5 sm:p-7 flex justify-between items-center border-b border-rule/30">
                <div><div className="text-white text-sm sm:text-base font-medium">{s.name}</div><div className="text-[10px] sm:text-[11px] text-dim mt-1">{s.description}</div></div>
                <div className="flex items-center gap-4 sm:gap-8">
                  <div className="text-gold font-mono text-lg sm:text-xl">${s.price}</div>
                  <button onClick={() => deleteService(s.id)} className="p-2 text-dim hover:text-red transition-all text-lg">✕</button>
                </div>
              </div>
            ))}
            {services.length === 0 && <div className="p-10 text-center bg-ink-2 text-dim italic text-sm">No hay servicios.</div>}
          </div>
          <div className="bg-ink-2 p-6 sm:p-8 border border-rule rounded-sm h-fit shadow-xl">
            <h3 className="text-xs uppercase tracking-widest text-gold mb-6 text-center">Nuevo Servicio</h3>
            <div className="space-y-4">
              <input type="text" placeholder="Nombre" value={newService.name} onChange={e => setNewService({...newService, name: e.target.value})} className="w-full bg-ink-3 border border-rule p-4 text-sm text-white rounded-sm outline-none" />
              <input type="number" placeholder="Precio ($)" value={newService.price || ""} onChange={e => setNewService({...newService, price: parseInt(e.target.value)})} className="w-full bg-ink-3 border border-rule p-4 text-sm text-gold font-mono rounded-sm outline-none" />
              <textarea placeholder="Descripción" value={newService.description} onChange={e => setNewService({...newService, description: e.target.value})} className="w-full bg-ink-3 border border-rule p-4 text-sm text-white rounded-sm outline-none min-h-[100px]" />
              <button onClick={handleAddService} disabled={isSaving} className="w-full py-4 bg-gold text-ink text-[10px] uppercase font-black rounded-sm hover:bg-white transition-all shadow-lg">Crear Servicio</button>
            </div>
          </div>
        </div>
      )}

      {tab === "finanzas" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
          <div className="bg-ink-2 p-8 sm:p-10 border border-rule rounded-sm text-center shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gold" />
            <div className="text-[10px] uppercase text-dim tracking-[0.3em] mb-4 sm:mb-6">Ganancia Total</div>
            <div className="font-serif text-5xl sm:text-7xl text-gold tracking-tighter mb-4">${appointments.filter(a => a.status === "attended").reduce((sum, a) => sum + (a.price || 0) + (a.drinkCharge || 0) + (a.extraHourCharge || 0), 0).toLocaleString()}</div>
            <div className="text-[10px] text-dim italic">Contabilizando {appointments.filter(a => a.status === "attended").length} servicios finalizados.</div>
          </div>
          <div className="bg-ink-2 p-8 sm:p-10 border border-rule rounded-sm space-y-6">
            <h3 className="text-xs uppercase tracking-widest text-white border-b border-rule pb-4">Detalle</h3>
            <div className="flex justify-between items-center"><span className="text-dim text-sm">Cortes</span><span className="text-white font-mono text-lg">${appointments.filter(a => a.status === "attended").reduce((sum, a) => sum + (a.price || 0), 0).toLocaleString()}</span></div>
            <div className="flex justify-between items-center"><span className="text-dim text-sm">Drinks</span><span className="text-white font-mono text-lg">${appointments.filter(a => a.status === "attended").reduce((sum, a) => sum + (a.drinkCharge || 0), 0).toLocaleString()}</span></div>
            <div className="flex justify-between items-center"><span className="text-dim text-sm">Plus</span><span className="text-white font-mono text-lg">${appointments.filter(a => a.status === "attended").reduce((sum, a) => sum + (a.extraHourCharge || 0), 0).toLocaleString()}</span></div>
          </div>
        </div>
      )}

      {tab === "config" && (
        <div className="max-w-full sm:max-w-[700px] bg-ink-2 border border-rule p-6 sm:p-10 rounded-sm space-y-10">
          <div className="space-y-6 text-center sm:text-left">
            <h3 className="text-xs uppercase tracking-widest text-gold border-b border-rule pb-4">Identidad Visual</h3>
            <div className="flex flex-col items-center sm:items-start gap-6">
              <div className="relative">
                {logoUrl ? <img src={logoUrl} alt="Logo" className="w-32 h-32 rounded-full object-contain bg-ink-3 border border-rule shadow-2xl" /> : <div className="w-32 h-32 rounded-full bg-gold/5 border-2 border-dashed border-gold/30 flex items-center justify-center text-gold italic font-serif text-4xl">A</div>}
                {isUploading && <div className="absolute inset-0 bg-ink/60 rounded-full flex items-center justify-center text-[10px] text-gold animate-pulse uppercase font-bold">Subiendo...</div>}
              </div>
              <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*" className="hidden" />
              <button onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="px-6 py-3 bg-white text-ink text-[10px] uppercase font-black rounded-sm hover:bg-gold hover:text-white transition-all shadow-lg disabled:opacity-50">{isUploading ? "Cargando..." : "Cambiar Logo"}</button>
            </div>
          </div>
          <div className="space-y-6">
            <h3 className="text-xs uppercase tracking-widest text-gold border-b border-rule pb-4">Avisos WhatsApp</h3>
            <div className="flex flex-col gap-2">
              <label className="text-[9px] text-dim uppercase">Mensaje de recordatorio</label>
              <textarea value={reminderMessage} onChange={e => setReminderMessage(e.target.value)} className="w-full bg-ink-3 border border-rule p-4 sm:p-5 text-xs sm:text-sm text-bright rounded-sm min-h-[120px] outline-none" />
              <div className="text-[8px] text-dim font-mono uppercase tracking-tighter">Variables: [Cliente] [Fecha] [Hora]</div>
            </div>
          </div>
          <button onClick={saveAllConfig} disabled={isSaving} className="w-full py-5 bg-gold text-ink text-[10px] uppercase font-black rounded-sm tracking-widest shadow-xl">Guardar Todo</button>
        </div>
      )}
    </div>
  )
}
