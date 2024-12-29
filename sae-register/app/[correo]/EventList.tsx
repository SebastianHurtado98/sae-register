'use client'

import { supabase } from '@/lib/supabase'
import { useEffect, useState } from 'react'

type Event = {
    id: number
    name: string
    event_type: string
    date_hour: string
    place: string
    register_open: boolean
}

type EventGuest = {
    id: string
    event?: Event[]
}

export default function EventList({ email }: { email: string }) {
  const [events, setEvents] = useState<Event[]>([])

  useEffect(() => {
    async function fetchGuests() {
      console.log("Fetching guests")

      const { data, error, count } = await supabase
        .from('event_guest')
        .select(
            `id,
            event:event_id (*)`,            
            { count: 'exact' })
        .eq('email', email)     
    
      if (error) {
        console.error('Error fetching guests:', error)
        return
      }
    
      if (data && count !== null) {
        console.log("Raw data:", data);
        const mappedEvents = data.map(item => item.event).flat();
        console.log("Mapped events:", mappedEvents);
        setEvents(mappedEvents);
      }
    }

    fetchGuests()
  }, [email])

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Eventos:</h2>
      {events.length === 0 ? (
        <p>No hay eventos disponibles.</p>
      ) : (
        <ul>
            {events.map(event => (
                <li key={event.id}>
                {event.name} - {event.date_hour}
                </li>
            ))}
        </ul>
      )}
    </div>
  )
}

