'use client'

import { notFound } from 'next/navigation'
import EventList from './EventList'
import { use } from 'react'
import Image from "next/image"

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
        <Image 
            src="/SAE Logo Azul.png"
            alt="SAE Logo Azul"
            width={256}
            height={64}
            className="mb-8"
        />
        <h1 className="text-3xl mb-8 text-center">
            Encuentro mensual - Enero 2025
        </h1>
        <EventList email={decodedCorreo} />
        </main>
    )
}

