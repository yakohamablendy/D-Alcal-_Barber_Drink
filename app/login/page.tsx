"use client"

import { useState } from "react"
import { auth } from "@/lib/firebase"
import { signInWithEmailAndPassword } from "firebase/auth"
import { useRouter } from "next/navigation"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")
    
    try {
      await signInWithEmailAndPassword(auth, email, password)
      router.push("/barbero")
    } catch (err: any) {
      console.error(err)
      setError("Credenciales incorrectas. Inténtalo de nuevo.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-ink flex items-center justify-center px-6">
      <div className="w-full max-w-[400px]">
        {/* Logo / Header */}
        <div className="text-center mb-12">
          <div className="text-[11px] tracking-[0.12em] uppercase text-dim font-normal mb-3">
            Acceso Privado
          </div>
          <h1 className="font-serif text-4xl font-normal text-white tracking-[-0.02em]">
            Alcala Barber <em className="italic text-gold">Drink</em>
          </h1>
        </div>

        {/* Login Form */}
        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label className="text-[11px] tracking-[0.08em] uppercase text-dim font-normal">
              Correo electrónico
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-ink-2 border border-rule rounded-[var(--r-sm)] px-4 py-3 text-bright font-sans text-sm outline-none focus:border-gold/50 transition-colors"
              placeholder="tu@correo.com"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[11px] tracking-[0.08em] uppercase text-dim font-normal">
              Contraseña
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-ink-2 border border-rule rounded-[var(--r-sm)] px-4 py-3 text-bright font-sans text-sm outline-none focus:border-gold/50 transition-colors"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="text-[11px] text-red mt-1 text-center bg-red/10 py-2 rounded">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className={`mt-4 py-3 rounded-[var(--r-sm)] font-sans text-sm font-medium transition-all duration-300 ${
              loading
                ? "bg-ink-4 text-dim cursor-wait"
                : "bg-white text-ink hover:bg-gold hover:text-white"
            }`}
          >
            {loading ? "Verificando..." : "Entrar al Panel"}
          </button>
        </form>

        <div className="mt-12 text-center">
          <button 
            onClick={() => router.push("/")}
            className="text-[11px] text-dim hover:text-bright transition-colors uppercase tracking-widest"
          >
            ← Volver a la web
          </button>
        </div>
      </div>
    </div>
  )
}
