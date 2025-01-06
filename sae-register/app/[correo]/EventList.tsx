'use client'

import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import { useEffect, useState } from 'react'

type Event = {
    id: number
    name: string
    event_type: string
    date_hour: string
    place: string
    register_open: boolean
    registered: boolean
}

export default function EventList({ email }: { email: string }) {
  const [events, setEvents] = useState<Event[]>([])
  const [guestName, setGuestName] = useState<string>('')

  useEffect(() => {
    async function fetchGuests() {      
      const { data, error, count } = await supabase
        .from('event_guest')
        .select(
            `id,
            is_user,
            name,
            executive:executive_id (*),
            registered,
            event:event_id (*)`,            
            { count: 'exact' })
        .eq('email', email)     
      if (error) {
        console.error('Error fetching guests:', error)
        return
      }
      if (data && count !== null) {
        //@ts-expect-error type
        const guest = data.find(item => item.event.register_open);
        if (guest) {
          if (guest.is_user && guest.executive) {
            //@ts-expect-error type
            setGuestName(`${guest.executive.name} ${guest.executive.last_name}`);
          } else {
            setGuestName(guest.name);
          }
        }
        const mappedEvents = data
          .map(item => ({
            ...item.event,
            registered: item.registered
          }))
          //@ts-expect-error type
          .sort((a, b) => new Date(a.date_hour).getTime() - new Date(b.date_hour).getTime())
          //@ts-expect-error type
        setEvents(mappedEvents);
      }
    }
    fetchGuests()
  }, [email])

  const handleRegister = async (eventId: number) => {
    const { data, error } = await supabase
      .from('event_guest')
      .update({ 'registered': true })
      .eq('email', email)
      .eq('event_id', eventId)
      .select()
    if (error) {
      console.error('Error updating guest:', error)
      return
    }
    if (data) {
      setEvents(prevEvents =>
        prevEvents.map(event =>
          event.id === eventId ? { ...event, registered: true } : event
        )
      )
    }
  }

  const formatDateTime = (dateTime: string) => {
    const date = new Date(dateTime)
    return date.toLocaleString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
    })
  }

  return (
<div className="p-4 w-full max-w-4xl mx-auto sm:px-6">
  <h2 className="text-lg sm:text-xl mb-4 text-center">{guestName || 'Nombre no disponible'}</h2>
  <h2 className="text-lg sm:text-xl mb-4 text-center">{email}</h2>
  <h3 className="text-base sm:text-lg font-semibold mb-4 text-center">
    Por favor registrarse en el evento al cual desea asistir:
  </h3>
  {events.length === 0 ? (
    <p className="text-center text-base sm:text-lg">No hay eventos disponibles.</p>
  ) : (
    <ul className="grid grid-cols-1 gap-6">
      {events
        .filter((item) => item.register_open)
        .map((event) => (
          <li
            key={event.id}
            className="border rounded-lg shadow-lg p-4 bg-white w-full"
          >
            <div className="flex flex-col space-y-2">
              <span className="text-base sm:text-lg font-bold">{event.name}</span>
              <div className="flex justify-between text-sm sm:text-base">
                <span>
                  <strong>Tipo:</strong> {event.event_type}
                </span>
                <span>
                  <strong>Lugar:</strong> {event.place}
                </span>
              </div>
              <span>
                <strong>Fecha y Hora:</strong> {formatDateTime(event.date_hour)}
              </span>
              {event.event_type === 'Virtual' && (
                <p className="text-sm text-blue-600 mt-2">
                  Nota: El registro a este evento se realizará vía Zoom. Haga click en el botón de Registro.
                </p>
              )}
            </div>
            <div className="mt-4 text-center">
              {event.event_type === 'Virtual' ? (
                <a
                  href="https://us02web.zoom.us/webinar/register/WN_Cj9_wD_ERze4Qym8WtO8VA"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button
                    style={{ backgroundColor: '#006F96', color: '#FFFFFF' }}
                    className="px-4 py-2 rounded-md"
                  >
                    Registrarse en Zoom
                  </Button>
                </a>
              ) : (
                <Button
                  style={{ backgroundColor: '#006F96', color: '#FFFFFF' }}
                  className={`px-4 py-2 rounded-md ${
                    event.registered ? 'cursor-not-allowed' : ''
                  }`}
                  onClick={() => handleRegister(event.id)}
                  disabled={event.registered}
                >
                  {event.registered ? 'Registrado' : 'Registrarse'}
                </Button>
              )}
            </div>
          </li>
        ))}
    </ul>
  )}
</div>


  )
}
