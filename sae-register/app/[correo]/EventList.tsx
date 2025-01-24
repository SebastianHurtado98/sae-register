'use client'

import { Button } from '@/components/ui/button'
import { Input } from "@/components/ui/input"
import { supabase } from '@/lib/supabase'
import { useEffect, useState } from 'react'
import DOMPurify from 'dompurify';
import { ConfirmationModal } from "@/components/ui/ConfirmationModal"


type Event = {
    id: number
    guest_id: number
    name: string
    event_type: string
    date_hour: string
    place: string
    register_open: boolean
    registered: boolean
    html_description: string
    zoom_webinar: string
}

export default function EventList({ email }: { email: string }) {
  const [events, setEvents] = useState<Event[]>([])
  const [guestName, setGuestName] = useState<string>('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null)
  const [zoomEmail, setZoomEmail] = useState<string>(email)
  const [useSameEmail, setUseSameEmail] = useState<boolean>(false)

  useEffect(() => {
    async function fetchGuests() {
      try {
        // Primero obtenemos los datos de todos los guests relacionados con el email
        const { data: guestData, error: guestError } = await supabase
          .from('guest')
          .select(
            `id,
            is_user,
            name,
            executive:executive_id (*),
            list_id`
          )
          .eq('email', email);

        console.log('guestData', guestData);
    
        if (guestError) {
          console.error('Error fetching guest:', guestError);
          return;
        }
    
        if (guestData && guestData.length > 0) {
          // Mostrar el nombre del primer guest para fines de encabezado
          const firstGuest = guestData[0];
          if (firstGuest.is_user && firstGuest.executive) {
            //@ts-expect-error type
            setGuestName(`${firstGuest.executive.name} ${firstGuest.executive.last_name}`);
          } else {
            setGuestName(firstGuest.name);
          }
    
          // Inicializar un array para almacenar todos los eventos de todos los guests
          let allMappedEvents: Event[] = [];
    
          // Iterar sobre cada guest
          for (const guest of guestData) {
            // Obtener los event_ids relacionados al list_id del guest
            const { data: eventListData, error: eventListError } = await supabase
              .from('event_list')
              .select('event_id')
              .eq('list_id', guest.list_id);
    
            if (eventListError) {
              console.error(`Error fetching event list for guest ${guest.id}:`, eventListError);
              continue;
            }
    
            if (eventListData && eventListData.length > 0) {
              const eventIds = eventListData.map((item) => item.event_id);
    
              // Obtener los eventos basados en los event_ids
              const { data: eventData, error: eventError } = await supabase
                .from('event')
                .select('*')
                .in('id', eventIds);
    
              if (eventError) {
                console.error(`Error fetching events for guest ${guest.id}:`, eventError);
                continue;
              }
    
              if (eventData) {
                // Obtener el estado de registro de cada evento para el guest actual
                const { data: eventGuestData, error: eventGuestError } = await supabase
                  .from('event_guest')
                  .select('event_id, registered')
                  .eq('guest_id', guest.id)
                  .in('event_id', eventIds);
    
                if (eventGuestError) {
                  console.error(`Error fetching event_guest data for guest ${guest.id}:`, eventGuestError);
                  continue;
                }
    
                // Crear un mapa para el estado de registro
                const registrationMap = eventGuestData?.reduce((map, item) => {
                  map[item.event_id] = item.registered;
                  return map;
                }, {} as Record<number, boolean>) || {};
    
                // Mapear los eventos y agregar el estado de registro y guest_id correspondiente
                const mappedEvents = eventData.map((event) => ({
                  ...event,
                  registered: registrationMap[event.id] || false, // Obtener el estado de registro del mapa
                  guest_id: guest.id, // Asociar el guest_id
                }));
    
                // Agregar los eventos al array acumulador
                allMappedEvents = [...allMappedEvents, ...mappedEvents];
              }
            }
          }
    
          // Ordenar todos los eventos por fecha
          const sortedEvents = allMappedEvents.sort(
            (a, b) => new Date(a.date_hour).getTime() - new Date(b.date_hour).getTime()
          );
    
          // Actualizar el estado con todos los eventos
          setEvents(sortedEvents);
        }
      } catch (err) {
        console.error('Unexpected error:', err);
      }
    }
  
    fetchGuests();
  }, [email]);
  

  const handleRegister = async (eventId: number) => {
    const event = events.find((e) => e.id === eventId)
    if (event) {
      setSelectedEvent(event)
      setIsModalOpen(true)
    }
  }

  const handleConfirmRegistration = async () => {
    if (selectedEvent) {

      if(selectedEvent.event_type === "Virtual"){
        const zoomResult = await handleZoomRegistration();
      if (!zoomResult) {
        console.error("Zoom registration failed, aborting...");
        return; 
      }
      }

      const { data, error } = await supabase
        .from("event_guest")
        .update({ 
          registered: true,
          //zoom_email: selectedEvent.event_type === "Virtual" ? zoomEmail : null, 
        })
        .eq("guest_id", selectedEvent.guest_id)
        .eq("event_id", selectedEvent.id)
        .select()
      if (error) {
        console.error("Error updating guest:", error)
        return
      }

      if (data) {

        if(selectedEvent.event_type === "Virtual" && useSameEmail){
          const { error } = await supabase
            .from("guest")
            .update({             
              zoom_email: zoomEmail, 
            })
            .eq("id", selectedEvent.guest_id)          

          if (error) {
            console.error("Error updating guest:", error)
            return
          }
        }

        setEvents((prevEvents) =>
          prevEvents.map((event) => (event.id === selectedEvent.id ? { ...event, registered: true } : event)),
        )
      }
      setIsModalOpen(false)
      setSelectedEvent(null)
    }
  }

  const handleZoomRegistration = async () => {
    try {
      const response = await fetch('/api/zoom-token', {
          method: 'POST',
      });

      if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message);
      }

      const data = await response.json();
      console.log('Token:', data);

      const webinarSuccess = await registerForWebinar(data.access_token);
      if (!webinarSuccess) {
        console.error("Error en el registro del webinar. Operación cancelada.");
        return false;
      }
      return true;

    } catch (error) {
      console.error('Error fetching token:', error);
    }
  }

  const registerForWebinar = async (token: string) => {
    try {
      const response = await fetch('/api/register-zoom-webinar', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            webinarId: selectedEvent?.zoom_webinar, 
            firstName: guestName || 'Invitado',
            lastName: '-',
            email: (useSameEmail ? zoomEmail : email),
            token: token,
        }),
      });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message);
        }

        const data = await response.json();
        console.log('Registrado con éxito:', data);
        return true;
    } catch (error) {
        console.error('Error al registrarse:', error);
        return false;
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

  const handleCheckboxChange = () => {
    setUseSameEmail(!useSameEmail)
    if (useSameEmail) {
      setZoomEmail('')
    } else {
      setZoomEmail(email)
    }
  }

  return (
<div className="p-4 w-full max-w-4xl mx-auto sm:px-6">
  <h2 className="text-lg sm:text-xl mb-4 text-center">{guestName || 'Nombre no disponible'}</h2>
  <h2 className="text-lg sm:text-xl mb-4 text-center">{email}</h2>
  <div className="mb-6">
    <h4 className="text-lg sm:text-xl font-semibold mt-6 text-center">
      Elige la reunión de tu preferencia:
    </h4>
  </div>
  {events.length === 0 ? (
    <p className="text-center text-base sm:text-lg">No hay eventos disponibles.</p>
  ) : (
    <ul className="grid grid-cols-1 gap-6">
      {/* Reuniones presenciales */}
      {events
        .filter((item) => item.register_open && item.event_type === 'Presencial')
        .map((event) => (
          <li
            key={event.id}
            className="border rounded-lg shadow-lg p-4 bg-white w-full"
          >
            <div className="flex flex-col space-y-2">
              <span className="text-base sm:text-lg font-bold">{event.name}</span>
              <div className="flex justify-between text-sm sm:text-base">
                <span>
                  <strong>Modalidad:</strong> {event.event_type}
                </span>
                <span>
                  <strong>Lugar:</strong> {event.place}
                </span>
              </div>
              <span>
                <strong>Fecha y Hora:</strong> {formatDateTime(event.date_hour)}
              </span>
              <div
                className="text-sm sm:text-base"
                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(event.html_description?.replace(/\\/g, '')) }}
                />
            </div>
            <div className="mt-4 text-center">
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
            </div>
          </li>
        ))}

      {/* Reuniones virtuales */}
      {events
        .filter((item) => item.register_open && item.event_type === 'Virtual')
        .map((event) => (
          <li
            key={event.id}
            className="border rounded-lg shadow-lg p-4 bg-white w-full"
          >
            <div className="flex flex-col space-y-2">
               <p style={{ color: '#006F96' }}>Reunión virtual</p>
              <span className="text-base sm:text-lg font-bold">{event.name}</span>
              <div className="flex justify-between text-sm sm:text-base">
                <span>
                  <strong>Modalidad:</strong> {event.event_type}
                </span>
                <span>
                  <strong>Lugar:</strong> {event.place}
                </span>
              </div>
              <span>
                <strong>Fecha y Hora:</strong> {formatDateTime(event.date_hour)}
              </span>
              <div
                className="text-sm sm:text-base"
                dangerouslySetInnerHTML={{ __html: event.html_description ? DOMPurify.sanitize(event.html_description.replace(/\\/g, '')) : '' }}
                />
            </div>

            {!event.registered && (
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="use-same-email"
                checked={useSameEmail}
                onChange={handleCheckboxChange}
                className="h-4 w-4 text-blue-600 border-gray-300 rounded"
              />
              <label htmlFor="use-same-email" className="text-sm font-medium text-gray-700">
                Deseo cambiar mi correo para entrar a zoom
              </label>
            </div>
            )}

            <div className="mt-4 space-y-4">
              {useSameEmail && !event.registered && (
                <div>
                  <label htmlFor={`zoom-email-${event.id}`} className="block text-sm font-medium text-gray-700">
                    Correo electrónico para Zoom
                  </label>
                  <Input
                    type="email"
                    id={`zoom-email-${event.id}`}
                    value={zoomEmail}
                    onChange={(e) => setZoomEmail(e.target.value)}
                    required
                    className="mt-1"
                  />
                </div>
                )}

                <div className="text-center">
                <Button
                  style={{ backgroundColor: '#006F96', color: '#FFFFFF' }}
                  className="px-4 py-2 rounded-md"
                  onClick={(e) => {
                    e.preventDefault()
                    handleRegister(event.id)
                  }}
                  disabled={event.registered}
                >
                  {event.registered ? 'Registrado' : 'Registrarse en Zoom'}
                </Button>
                </div>
            </div>
          </li>
        ))}
    </ul>
  )}
  <ConfirmationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onConfirm={handleConfirmRegistration}
        eventName={selectedEvent?.name || ""}
      />
</div>


  )
}
