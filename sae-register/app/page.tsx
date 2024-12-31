'use client'

import { useState } from 'react'
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useRouter } from 'next/navigation'

export default function Home() {
  const [email, setEmail] = useState('')
  const router = useRouter()

  const handleVerInvitaciones = () => {
    if (email) {
      router.push(`/${encodeURIComponent(email)}`)
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-4xl font-bold mb-8">Registro Eventos SAE</h1>
      <div className="w-full max-w-md space-y-4">
        <Input
          type="email"
          placeholder="Escribe tu correo"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Button 
          className="w-full" 
          onClick={handleVerInvitaciones}
        >
          Ver invitaciones
        </Button>
      </div>
    </main>
  )
}

