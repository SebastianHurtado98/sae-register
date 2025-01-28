'use client'

import { notFound } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import EventList from './EventList'
import { use, useEffect, useState } from 'react'
import Image from "next/image"

export default function InvitacionesPage({ params }: { params: Promise<{ correo: string }> }) {
    const [macroEventName, setMacroEventName] = useState<string>()
    const [macroEventId, setMacroEventId] = useState<number>()
    const resolvedParams = use(params)

    const decodedCorreo = decodeURIComponent(resolvedParams.correo)
      
    // Validación simple de correo electrónico
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(decodedCorreo)) {
        notFound()
    }

    useEffect(() => {
        fetchMacroEvent()
    }, [])

    async function fetchMacroEvent() {
        const { data, error } = await supabase
        .from('macro_event')
        .select('id, name')
        .order('created_at', { ascending: false })
        .limit(1)

        const currentMonth = new Date().toLocaleString('es-ES', { month: 'long', timeZone: 'UTC' })
        const formattedMonth = currentMonth.charAt(0).toUpperCase() + currentMonth.slice(1)
        setMacroEventName(`Encuentro mensual - ${formattedMonth} 2025`) 

        if (error) {
            console.error('Error fetching macro_events:', error)            
        } else if (data && data.length > 0) {
            setMacroEventName(data[0].name)
            setMacroEventId(data[0].id)
        }
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
            {macroEventName}
        </h1>
        { macroEventId && <EventList email={decodedCorreo} macroEventId={macroEventId}/> }
        </main>
    )
}

