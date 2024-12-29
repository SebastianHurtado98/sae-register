import { notFound } from 'next/navigation'
import EventList from './EventList'

export default async function InvitacionesPage({ params }: { params: { correo: string } }) {
    const param = (await params)

    const decodedCorreo = decodeURIComponent(param.correo)
      
    // Validación simple de correo electrónico
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(decodedCorreo)) {
        notFound()
    }

    return (
        <main className="flex min-h-screen flex-col items-center justify-center p-24">
        <h1 className="text-3xl font-bold mb-8 text-center">
            Invitaciones a Eventos para:
        </h1>
        <p className="text-2xl mb-8 text-center text-blue-600">
            {decodedCorreo}
        </p>
        <EventList email={decodedCorreo} />
        </main>
    )
}

