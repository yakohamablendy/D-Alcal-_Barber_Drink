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
  Timestamp 
} from "firebase/firestore"

// ── Types ──

interface Appointment {
  id: string
  clientName: string
  clientPhone: string
  clientEmail: string
  serviceName: string
  price: number
  status: "pending" | "completed" | "cancelled"
  date: string
  time: string
  notes?: string
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

type Tab = "citas" | "horario" | "config"

const dayLabels = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"]

const defaultSchedule: Record<string, DaySchedule> = {
  Lunes:     { enabled: true,  start: "09:00", end: "18:00", extraEnabled: false, extraStart: "18:00", extraEnd: "20:00" },
  Martes:    { enabled: true,  start: "09:00", end: "18:00", extraEnabled: false, extraStart: "18:00", extraEnd: "20:00" },
  Miércoles: { enabled: true,  start: "09:00", end: "18:00", extraEnabled: false, extraStart: "18:00", extraEnd: "20:00" },
  Jueves:    { enabled: true,  start: "09:00", end: "18:00", extraEnabled: false, extraStart: "18:00", extraEnd: "20:00" },
  Viernes:   { enabled: true,  start: "09:00", end: "19:00", extraEnabled: false, extraStart: "19:00", extraEnd: "21:00" },
  Sábado:    { enabled: true,  start: "09:00", end: "14:00", extraEnabled: false, extraStart: "14:00", extraEnd: "17:00" },
  Domingo:   { enabled: false, start: "10:00", end: "14:00", extraEnabled: false, extraStart: "14:00", extraEnd: "16:00" },
}

const timeOptions: string[] = []
for (let h = 6; h <= 23; h++) {
  for (const m of ["00", "30"]) {
    timeOptions.push(`${String(h).padStart(2, "0")}:${m}`)
  }
}

interface Props {
  showToast: (msg: string) => void
}

export function BarberView({ showToast }: Props) {
  const [tab, setTab] = useState<Tab>("citas")
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [schedule, setSchedule] = useState<Record<string, DaySchedule>>(defaultSchedule)
  const [loading, setLoading] = useState(true)
  const [isSavingSchedule, setIsSavingSchedule] = useState(false)

  // Configuración de recordatorios
  const [remindersEnabled, setRemindersEnabled] = useState(true)
  const [reminderHours, setReminderHours] = useState(2)
  const [reminderMessage, setReminderMessage] = useState("¡Hola [Cliente]! Te recordamos tu cita en Alcala Barber Drink para el [Fecha] a las [Hora]. ¡Te esperamos! 💈🥃")
  const [isSavingConfig, setIsSavingConfig] = useState(false)

  useEffect(() => {
    const q = query(collection(db, "bookings"), orderBy("createdAt", "desc"))
    const unsubscribeAppts = onSnapshot(q, (snapshot) => {
      const appts: Appointment[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Appointment))
      setAppointments(appts)
    })

    const loadData = async () => {
      try {
        const { getDoc, doc: fsDoc } = await import("firebase/firestore")
        const schedSnap = await getDoc(fsDoc(db, "config", "schedule"))
        if (schedSnap.exists()) setSchedule(schedSnap.data() as Record<string, DaySchedule>)
        
        const configSnap = await getDoc(fsDoc(db, "config", "notifications"))
        if (configSnap.exists()) {
          const data = configSnap.data()
          setRemindersEnabled(data.enabled ?? true)
          setReminderHours(data.hours ?? 2)
          setReminderMessage(data.message ?? "")
        }
      } catch (error) {
        console.error("Error cargando datos:", error)
      } finally {
        setLoading(false)
      }
    }

    loadData()
    return () => unsubscribeAppts()
  }, [])

  const pendingCount = appointments.filter((a) => a.status === "pending").length
  const completedAppts = appointments.filter((a) => a.status === "completed")
  const totalEarnings = completedAppts.reduce((sum, a) => sum + (a.price || 0), 0)

  const handleComplete = async (id: string) => {
    try {
      const docRef = doc(db, "bookings", id)
      await updateDoc(docRef, { status: "completed" })
      showToast("Cita completada")
    } catch (error) {
      console.error("Error al completar cita:", error)
      showToast("Error al actualizar la cita")
    }
  }

  const sendWhatsAppReminder = (appt: Appointment) => {
    let msg = reminderMessage
      .replace("[Cliente]", appt.clientName)
      .replace("[Fecha]", appt.date)
      .replace("[Hora]", appt.time)

    const cleanPhone = appt.clientPhone.replace(/\D/g, "")
    const finalPhone = cleanPhone.startsWith("1") ? cleanPhone : `1${cleanPhone}`
    const url = `https://wa.me/${finalPhone}?text=${encodeURIComponent(msg)}`
    window.open(url, "_blank")
  }

  const updateDay = (day: string, patch: Partial<DaySchedule>) => {
    setSchedule((prev) => ({ ...prev, [day]: { ...prev[day], ...patch } }))
  }

  const saveSchedule = async () => {
    setIsSavingSchedule(true)
    try {
      const { setDoc, doc: fsDoc } = await import("firebase/firestore")
      await setDoc(fsDoc(db, "config", "schedule"), schedule)
      showToast("Horario actualizado correctamente")
    } catch (error) {
      console.error("Error guardando horario:", error)
      showToast("Error al guardar el horario")
    } finally {
      setIsSavingSchedule(false)
    }
  }

  const saveConfig = async () => {
    setIsSavingConfig(true)
    try {
      const { setDoc, doc: fsDoc } = await import("firebase/firestore")
      await setDoc(fsDoc(db, "config", "notifications"), {
        enabled: remindersEnabled,
        hours: reminderHours,
        message: reminderMessage,
        updatedAt: new Date()
      })
      showToast("Configuración de avisos guardada")
    } catch (error) {
      console.error("Error guardando config:", error)
      showToast("Error al guardar")
    } finally {
      setIsSavingConfig(false)
    }
  }

  const today = new Date()
  const dayNames = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"]
  const monthNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]
  const dateTag = `${dayNames[today.getDay()]} ${today.getDate()} ${monthNames[today.getMonth()]} ${today.getFullYear()}`

  const tabs: { id: Tab; label: string }[] = [
    { id: "citas", label: "Citas" },
    { id: "horario", label: "Horario" },
    { id: "config", label: "Avisos" },
  ]

  return (
    <div className="max-w-[960px] mx-auto px-8 py-14 md:py-14">
      {/* Top line */}
      <div className="flex justify-between items-end mb-8 flex-wrap gap-4">
        <div>
          <div className="text-[11px] tracking-[0.12em] uppercase text-dim font-normal mb-3">Bienvenido</div>
          <h1 className="font-serif text-[clamp(28px,5vw,42px)] font-normal text-white tracking-[-0.02em]">
            Admin <em className="italic text-gold">Alcala</em>
          </h1>
        </div>
        <div className="text-xs text-dim font-mono px-3 py-1.5 border border-rule rounded-[var(--r-sm)] bg-ink-2">
          {dateTag}
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-0 border-b border-rule mb-10">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-5 pb-3 pt-1 text-[13px] font-normal tracking-[0.02em] border-b-2 transition-colors duration-[180ms] bg-transparent cursor-pointer ${
              tab === t.id ? "text-white border-b-gold" : "text-dim border-b-transparent hover:text-mid"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ═══════ TAB: CITAS ═══════ */}
      {tab === "citas" && (
        <>
          <div className="grid grid-cols-[2fr_1fr_1fr] gap-px bg-rule rounded-[var(--r)] overflow-hidden border border-rule mb-14 max-sm:grid-cols-2">
            <div className="bg-ink-2 p-7 max-sm:col-span-2">
              <div className="text-[11px] tracking-[0.12em] uppercase text-dim font-normal mb-4">Ganancias del día</div>
              <div className="font-serif text-[clamp(36px,6vw,52px)] font-normal text-gold leading-none tracking-[-0.03em]">
                ${totalEarnings.toLocaleString()}
              </div>
              <div className="mt-[10px] text-xs text-dim font-light">{completedAppts.length} servicios completados hoy</div>
            </div>
            <div className="bg-ink-2 p-7">
              <div className="text-[11px] tracking-[0.12em] uppercase text-dim font-normal mb-4">Citas pendientes</div>
              <div className="font-serif text-[clamp(36px,6vw,52px)] font-normal text-white leading-none tracking-[-0.03em]">
                {pendingCount}
              </div>
            </div>
            <div className="bg-ink-2 p-7">
              <div className="text-[11px] tracking-[0.12em] uppercase text-dim font-normal mb-4">Calificación</div>
              <div className="font-serif text-[clamp(36px,6vw,52px)] font-normal text-white leading-none tracking-[-0.03em]">
                5.0
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between mb-4">
            <span className="text-[11px] tracking-[0.08em] uppercase text-dim">Registro de citas</span>
          </div>

          {loading ? (
            <div className="py-20 text-center text-dim animate-pulse italic">Cargando base de datos...</div>
          ) : appointments.length === 0 ? (
            <div className="py-20 text-center border border-dashed border-rule rounded-[var(--r)] text-dim italic">
              No hay citas registradas todavía.
            </div>
          ) : (
            <div className="flex flex-col gap-px bg-rule rounded-[var(--r)] overflow-hidden border border-rule">
              {appointments.map((appt) => (
                <div
                  key={appt.id}
                  className={`grid grid-cols-[72px_1fr_auto] items-center gap-6 px-6 py-[18px] bg-ink-2 transition-colors duration-150 hover:bg-ink-3 max-sm:grid-cols-[56px_1fr] max-sm:gap-3.5 ${
                    appt.status === "completed" ? "opacity-35" : ""
                  }`}
                >
                  <div className="font-mono text-sm text-gold font-medium leading-none text-center">
                    {appt.time ? appt.time.split(" ")[0] : "--:--"}
                    <span className="block text-[10px] text-dim mt-[3px] font-normal">
                      {appt.time ? appt.time.split(" ")[1] : "PM"}
                    </span>
                  </div>
                  <div>
                    <div className="text-sm font-normal text-bright mb-[3px]">{appt.clientName}</div>
                    <div className="text-xs text-dim font-mono font-normal mb-[5px]">{appt.clientPhone}</div>
                    <div className="flex flex-wrap gap-2 items-center mb-2">
                      <span className="inline-block text-[11px] text-dim border border-rule px-[9px] py-[2px] rounded-[3px] font-light">
                        {appt.serviceName} — ${appt.price}
                      </span>
                      <span className="text-[10px] text-dim/60 italic">{appt.date}</span>
                    </div>
                    {/* NOTAS DEL CLIENTE */}
                    {appt.notes && (
                      <div className="text-[11px] text-gold/70 italic bg-gold/5 p-2 rounded border border-gold/10 inline-block">
                        Nota: {appt.notes}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 items-center shrink-0 max-sm:col-start-2 max-sm:pt-1">
                    {appt.status !== "completed" && remindersEnabled && (
                      <button
                        onClick={() => sendWhatsAppReminder(appt)}
                        className="p-2 text-gold border border-gold/20 rounded-[var(--r-sm)] hover:bg-gold/10 transition-all"
                        title="Enviar recordatorio WhatsApp"
                      >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 1 1-7.6-11.7 8.38 8.38 0 0 1 3.8.9L21 3z"/></svg>
                      </button>
                    )}
                    {appt.status === "completed" ? (
                      <button disabled className="px-4 py-2 text-xs bg-transparent text-dim border border-rule rounded-sm cursor-default">Completado</button>
                    ) : (
                      <button onClick={() => handleComplete(appt.id)} className="px-4 py-2 text-xs bg-white text-ink border-none rounded-sm hover:bg-white/[0.88] whitespace-nowrap">Completar</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ═══════ TAB: HORARIO ═══════ */}
      {tab === "horario" && (
        <>
          <div className="mb-7">
            <h2 className="font-serif text-xl font-normal text-white mb-1">Gestión de horario</h2>
            <p className="text-sm text-dim font-light">Configura tu disponibilidad semanal y horas extra.</p>
          </div>

          <div className="flex flex-col gap-px bg-rule rounded-[var(--r)] overflow-hidden border border-rule mb-8">
            {dayLabels.map((day) => {
              const d = schedule[day]
              return (
                <div key={day} className="bg-ink-2 px-6 py-5">
                  <div className="flex items-center gap-5 flex-wrap">
                    <div className="flex items-center gap-3 min-w-[140px]">
                      <button onClick={() => updateDay(day, { enabled: !d.enabled })} className={`w-9 h-5 rounded-full relative transition-colors ${d.enabled ? "bg-gold" : "bg-ink-4"}`}>
                        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${d.enabled ? "left-[18px]" : "left-0.5"}`} />
                      </button>
                      <span className={`text-sm font-normal ${d.enabled ? "text-bright" : "text-dim"}`}>{day}</span>
                    </div>
                    {d.enabled && (
                      <div className="flex items-center gap-2 flex-wrap">
                        <select value={d.start} onChange={(e) => updateDay(day, { start: e.target.value })} className="bg-ink-3 border border-rule rounded-sm px-2.5 py-1.5 text-xs font-mono text-bright outline-none cursor-pointer">
                          {timeOptions.map((t) => <option key={t} value={t}>{t}</option>)}
                        </select>
                        <span className="text-dim text-xs">a</span>
                        <select value={d.end} onChange={(e) => updateDay(day, { end: e.target.value })} className="bg-ink-3 border border-rule rounded-sm px-2.5 py-1.5 text-xs font-mono text-bright outline-none cursor-pointer">
                          {timeOptions.map((t) => <option key={t} value={t}>{t}</option>)}
                        </select>
                        <button onClick={() => updateDay(day, { extraEnabled: !d.extraEnabled })} className={`px-2.5 py-1 text-[10px] uppercase rounded-[3px] border cursor-pointer font-mono ${d.extraEnabled ? "bg-gold-12 border-gold/30 text-gold" : "bg-transparent border-rule text-dim hover:border-rule-2"}`}>
                          {d.extraEnabled ? "Extra ON" : "+ Extra"}
                        </button>
                      </div>
                    )}
                  </div>
                  {d.enabled && d.extraEnabled && (
                    <div className="mt-3 ml-12 flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] uppercase text-gold font-mono">Hora extra:</span>
                      <select value={d.extraStart} onChange={(e) => updateDay(day, { extraStart: e.target.value })} className="bg-ink-3 border border-gold/20 rounded-sm px-2.5 py-1.5 text-xs font-mono text-gold outline-none cursor-pointer">
                        {timeOptions.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                      <span className="text-dim text-xs">a</span>
                      <select value={d.extraEnd} onChange={(e) => updateDay(day, { extraEnd: e.target.value })} className="bg-ink-3 border border-gold/20 rounded-sm px-2.5 py-1.5 text-xs font-mono text-gold outline-none cursor-pointer">
                        {timeOptions.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          <div className="flex justify-end">
            <button onClick={saveSchedule} disabled={isSavingSchedule} className={`px-6 py-3 rounded-sm text-xs ${isSavingSchedule ? "bg-ink-4 text-dim" : "bg-white text-ink"}`}>
              {isSavingSchedule ? "Guardando..." : "Guardar horario"}
            </button>
          </div>
        </>
      )}

      {/* ═══════ TAB: CONFIGURACIÓN ═══════ */}
      {tab === "config" && (
        <>
          <div className="mb-7">
            <h2 className="font-serif text-xl font-normal text-white mb-1">Avisos automáticos</h2>
            <p className="text-sm text-dim font-light">Configura cómo y cuándo avisar a tus clientes.</p>
          </div>
          <div className="bg-ink-2 border border-rule rounded-sm p-8">
            <div className="flex items-center justify-between mb-8 pb-8 border-b border-rule">
              <div><div className="text-sm text-bright">Recordatorios de WhatsApp</div><div className="text-xs text-dim mt-1">Enviar mensajes automáticamente a los clientes.</div></div>
              <button onClick={() => setRemindersEnabled(!remindersEnabled)} className={`w-11 h-6 rounded-full relative transition-colors ${remindersEnabled ? "bg-gold" : "bg-ink-4"}`}>
                <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${remindersEnabled ? "left-[22px]" : "left-0.5"}`} />
              </button>
            </div>
            <div className="mb-8">
              <label className="text-[11px] uppercase text-dim block mb-3">Enviar aviso con antelación</label>
              <div className="flex items-center gap-3">
                <input type="number" value={reminderHours} onChange={(e) => setReminderHours(parseInt(e.target.value))} className="w-20 bg-ink-3 border border-rule rounded-sm px-4 py-2 text-gold outline-none" />
                <span className="text-sm text-mid font-light">horas antes de la cita.</span>
              </div>
            </div>
            <div className="mb-8">
              <label className="text-[11px] uppercase text-dim block mb-3">Mensaje de recordatorio</label>
              <textarea value={reminderMessage} onChange={(e) => setReminderMessage(e.target.value)} className="w-full bg-ink-3 border border-rule rounded-sm p-4 text-sm text-bright min-h-[120px] outline-none focus:border-gold/30" />
            </div>
            <div className="flex justify-end pt-4">
              <button onClick={saveConfig} disabled={isSavingConfig} className={`px-8 py-3 rounded-sm text-xs ${isSavingConfig ? "bg-ink-4 text-dim" : "bg-white text-ink"}`}>
                {isSavingConfig ? "Guardando..." : "Guardar configuración"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
