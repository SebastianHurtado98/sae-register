import { notFound } from 'next/navigation'
import EventList from './EventList'
import { use } from 'react'

export default function InvitacionesPage({ params }: { params: Promise<{ correo: string }> }) {
    const resolvedParams = use(params)

    const decodedCorreo = decodeURIComponent(resolvedParams.correo)
      
    // Validación simple de correo electrónico
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(decodedCorreo)) {
        notFound()
    }

    return (
        <main className="flex min-h-screen flex-col items-center justify-center p-24">
        <img 
            src="/SAE Logo Azul.png" 
            alt="SAE Logo Azul" 
            className="mb-8 w-64 h-auto"
        />
        <h1 className="text-3xl mb-8 text-center">
            Encuentro SAE mensual - Enero 2025
        </h1>
        <EventList email={decodedCorreo} />
        </main>
    )
}

