'use client'

import { Button } from '@/components/ui/button'
import { Input } from "@/components/ui/input"
import { supabase } from '@/lib/supabase'
import { useEffect, useState } from 'react'
import DOMPurify from 'dompurify';
import { ConfirmationModal } from "@/components/ui/ConfirmationModal"
import { useRouter } from "next/navigation"


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

export default function EventList({ email, macroEventId }: { email: string, macroEventId: number }) {
  const [events, setEvents] = useState<Event[]>([])
  const [guestName, setGuestName] = useState<string>('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null)
  const [zoomEmail, setZoomEmail] = useState<string>(email)
  const [useSameEmail, setUseSameEmail] = useState<boolean>(false)
  const [hasBeenReplaced, setHasBeenReplaced] = useState<boolean>(false)
  const [newGuestEmail, setNewGuestEmail] = useState<string>('')

  const [showReplaceForm, setShowReplaceForm] = useState(false)
  const [replacementEmail, setReplacementEmail] = useState("")
  const [replacementName, setReplacementName] = useState("")
  const router = useRouter()

  useEffect(() => {
    async function fetchConsolidatedEventGuests() {
      try {
        // Primero obtenemos los datos de todos los guests relacionados con el email
        const { data: consolidatedEventGuestData, error: consolidatedError } = await supabase
          .from('consolidated_event_guests')
          .select(
            `guest_id,
            guest_name,
            guest_email,
            executive_name,
            executive_last_name,
            executive_email,
            is_user,
            executive_id,
            id,
            name,
            event_type,
            date_hour,
            place,
            register_open,
            html_description,
            macro_event_id,
            event_registered,
            event_guest_id,
            zoom_webinar
            `
          )
          .eq('register_open', true)
          .or(`executive_email.eq.${email},guest_email.eq.${email}`);

        console.log('consolidatedEventGuestData', consolidatedEventGuestData);

        if (consolidatedError) {
          console.error('Error fetching consolidatedEventGuestData:', consolidatedError);
          return;
        }

        if (consolidatedEventGuestData && consolidatedEventGuestData.length > 0) {
          const firstGuest = consolidatedEventGuestData[0];
          // check if not substitute
          if (firstGuest.executive_name) {
            setGuestName(`${firstGuest.executive_name} ${firstGuest.executive_last_name}`);
          } else {
            setGuestName(firstGuest.guest_name);
          }

          // Mapear los eventos con su estado registrado
          const mappedEvents = consolidatedEventGuestData.map((event) => ({
            id: event.id,
            guest_id: event.guest_id,
            name: event.name,
            event_type: event.event_type,
            date_hour: event.date_hour,
            place: event.place,
            register_open: event.register_open,
            registered: event.event_registered,
            html_description: event.html_description,
            zoom_webinar: event.zoom_webinar,
          }));

          // Ordenar eventos por fecha y actualizar el estado
          setEvents(mappedEvents.sort((a, b) => new Date(a.date_hour).getTime() - new Date(b.date_hour).getTime()));
        }
      } catch (err) {
        console.error('Unexpected error:', err);
      }
    }

    async function checkIfNotReplaced() {
      const { data, error } = await supabase
        .from('substitutes')
        .select('new_guest_email')
        .eq('macro_event_id', macroEventId)
        .eq('original_guest_email', email);

      if (error) {
        console.error('Error fetching guest:', error);
        return;
      }

      if (data && data.length > 0) {
        setHasBeenReplaced(true);
        setNewGuestEmail(data[0].new_guest_email);
      }
    }

    fetchConsolidatedEventGuests();
    checkIfNotReplaced();
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
  
      if (selectedEvent.event_type === "Virtual") {
        const zoomResult = await handleZoomRegistration();
        if (!zoomResult) {
          console.error("Zoom registration failed, aborting...");
          return;
        }
      }
  
      const { data, error } = await supabase
        .from("event_guest")
        .upsert({
          guest_id: selectedEvent.guest_id,
          event_id: selectedEvent.id,
          registered: true,
        }, { onConflict: "guest_id,event_id"
        })
        .select();
  
      if (error) {
        console.error("Error upserting guest:", error);
        return;
      }
  
      if (data) {
        if (selectedEvent.event_type === "Virtual" && useSameEmail) {
          const { error } = await supabase
            .from("guest")
            .update({
              zoom_email: zoomEmail,
            })
            .eq("id", selectedEvent.guest_id);
  
          if (error) {
            console.error("Error updating guest:", error);
            return;
          }
        }
  
        setEvents((prevEvents) =>
          prevEvents.map((event) =>
            event.id === selectedEvent.id ? { ...event, registered: true } : event
          )
        );
      }

      handleEmailConfirmation();
      setIsModalOpen(false);
      setSelectedEvent(null);
    }
  };
  

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

  const handleEmailConfirmation = async () => {  
    const emailData = {
      to: "shurtado100998@gmail.com",
      template_id: "d-e9c0123bda8f46eabd8cda5feb941e09",        
      first_name: "Sebastian",
      register_link: `https://sae-register.vercel.app/${encodeURIComponent("shurtado100998@gmail.com")}`        
    }

    try {
      const response = await fetch("/api/email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(emailData),
      })

      if (!response.ok) {
        throw new Error("Failed to send email")
      }

    } catch (error) {
      console.error(`Error sending email to guest.email:`, error)
    }
  }

  const handleReplaceSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const { data: originalGuest, error: originalGuestError } = await supabase
        .from("guest")
        .select("list_id")
        .eq("email", email)
        .single()

      if (originalGuestError) throw originalGuestError

      if (!originalGuest || !originalGuest.list_id) {
        throw new Error("No se pudo obtener el list_id del guest original")
      }

      const { data: newGuest, error: newGuestError } = await supabase
        .from("guest")
        .insert({ 
          email: replacementEmail, 
          name: replacementName,
          list_id: originalGuest.list_id, 
          tipo_usuario: "Reemplazo",
        })
        .select()

      if (newGuestError) throw newGuestError

      const { data: originalEventGuests, error: originalEventGuestsError } = await supabase
        .from("event_guest")
        .select("event_id")
        .eq("guest_id", events[0].guest_id)

      if (originalEventGuestsError) throw originalEventGuestsError

      const newEventGuests = originalEventGuests.map((eg) => ({
        guest_id: newGuest[0].id,
        event_id: eg.event_id,
        registered: false,
      }))

      const { error: newEventGuestsError } = await supabase.from("event_guest").insert(newEventGuests)

      if (newEventGuestsError) throw newEventGuestsError

      const { error: substituteError } = await supabase.from("substitutes").insert({
        macro_event_id: macroEventId,
        original_guest_email: email,
        new_guest_email: replacementEmail,
      })

      if (substituteError) throw substituteError

      setHasBeenReplaced(true)
      setNewGuestEmail(replacementEmail)
      setShowReplaceForm(false)

      router.push(`/${encodeURIComponent(replacementEmail)}`)
    } catch (error) {
      console.error("Error al registrar el reemplazo:", error)
    }
  }

  return (
<div className="p-4 w-full max-w-4xl mx-auto sm:px-6">
  <h2 className="text-lg sm:text-xl mb-4 text-center">{guestName || 'Nombre no disponible'}</h2>
  <h2 className="text-lg sm:text-xl mb-4 text-center">{email}</h2>
  {
  hasBeenReplaced ? (
    <div>
      <h2 className="text-lg sm:text-xl mb-4 text-center">
        Este usuario ha sido reemplazado por {newGuestEmail}
      </h2>
      <h4 className="text-lg sm:text-xl font-semibold mt-6 text-center">
        El sustituto debe registrarse en este <a href={`https://sae-register.vercel.app/${encodeURIComponent(newGuestEmail)}`}>link</a>.
      </h4>
    </div>
  ) : (
    <div>
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
      <Button onClick={() => setShowReplaceForm(!showReplaceForm)} className="mb-4" style={{ backgroundColor: '#006F96', color: '#FFFFFF' }}>
        {showReplaceForm ? 'Cancelar reemplazo' : 'Registrar reemplazo'}
      </Button>
      </div>
      {showReplaceForm && (
        <form onSubmit={handleReplaceSubmit} className="mb-6">
          <Input
            type="email"
            placeholder="Correo del reemplazo"
            value={replacementEmail}
            onChange={(e) => setReplacementEmail(e.target.value)}
            required
            className="mb-2"
          />
          <Input
            type="text"
            placeholder="Nombre del reemplazo"
            value={replacementName}
            onChange={(e) => setReplacementName(e.target.value)}
            required
            className="mb-2"
          />
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
          <Button type="submit" style={{ backgroundColor: '#006F96', color: '#FFFFFF' }}>Confirmar reemplazo</Button>
          </div>
        </form>
      )}

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
</div>


  )
}
