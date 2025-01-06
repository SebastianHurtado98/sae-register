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
        console.log("Raw data:", data);

        // Set the guest name based on the first matching criteria
        //@ts-expect-error type check
        const guest = data.find(item => item.event.register_open);
        if (guest) {
          if (guest.is_user && guest.executive) {
            //@ts-expect-error type check
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
        .flat()      
        .sort((a, b) => new Date(a.date_hour).getTime() - new Date(b.date_hour).getTime()); // Ordenar por fecha  
        setEvents(mappedEvents);
      }
    }

    fetchGuests()
  }, [email])

  const handleRegister = async (eventId: number) => {
    const { data, error } = await supabase
      .from('event_guest')
      .update({'registered': true})
      .eq('email', email)
      .eq('event_id', eventId)
      .select()

    if (error) {
      console.error('Error updating guest:', error)
      return
    }
    if (data) {
      console.log("Data:", data);
      
      setEvents((prevEvents) =>
        prevEvents.map((event) =>
          event.id === eventId
            ? { ...event, registered: true }
            : event
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
    <div className="p-6 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-6 text-center">{guestName || 'Nombre no disponible'}</h2>
      <h2 className="text-2xl font-bold mb-6 text-center">{email}</h2>
      <h3 className="text-2xl font-bold mb-6 text-center">Por favor registrarse en el evento al cual desea asistir:</h3>
      {events.length === 0 ? (
        <p className="text-center">No hay eventos disponibles.</p>
      ) : (
        <ul className="space-y-6">
          {events
            .filter(item => item.register_open)
            .map(event => (
              <li key={event.id} className="border p-6 rounded-lg shadow-lg w-full">
                <div className="flex flex-col space-y-4">
                    <span className="text-lg font-semibold">{event.name}</span>
                    <div className="flex justify-between">
                        <span><strong>Tipo:</strong> {event.event_type}</span>
                        <span><strong>Lugar:</strong> {event.place}</span>
                    </div>
                    <span><strong>Fecha y Hora:</strong> {formatDateTime(event.date_hour)}</span>                   
                </div>
                <div className="mt-4 text-center">
                  <Button 
                    className={`px-6 py-3 rounded-md ${
                      event.registered 
                        ? 'bg-gray-400 text-gray-700 cursor-not-allowed'
                        : 'bg-blue-500 text-white'
                    }`}
                    onClick={() => handleRegister(event.id)}
                    disabled={event.registered} 
                  >
                    {event.registered ? 'Registrado' : 'Registrarse'}
                  </Button>
                </div>
              </li>
            ))}
        </ul>
      )}
    </div>
  )
}
