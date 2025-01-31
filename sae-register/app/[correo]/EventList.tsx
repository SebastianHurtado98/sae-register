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

export default function EventList({ email, macroEventId }: { email: string, macroEventId: number }) {
  const [events, setEvents] = useState<Event[]>([])
  const [guestName, setGuestName] = useState<string>('')
  const [guestId, setGuestId] = useState<string>('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null)
  const [zoomEmail, setZoomEmail] = useState<string>(email)
  const [useSameEmail, setUseSameEmail] = useState<boolean>(false)
  const [hasBeenReplaced, setHasBeenReplaced] = useState<boolean>(false)
  const [newGuestEmail, setNewGuestEmail] = useState<string>('')

  const [showReplaceForm, setShowReplaceForm] = useState(false)
  const [replacementEmail, setReplacementEmail] = useState("")
  const [replacementName, setReplacementName] = useState("")

  useEffect(() => {
    async function fetchConsolidatedEventGuests() {
      try {
        // Primero obtenemos los datos de todos los guests relacionados con el email
        const emailToUse = hasBeenReplaced ? newGuestEmail : email;
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
          .eq('macro_event_id', macroEventId)
          .or(`executive_email.eq.${emailToUse},guest_email.eq.${emailToUse}`);

        console.log('consolidatedEventGuestData', consolidatedEventGuestData);

        if (consolidatedError) {
          console.error('Error fetching consolidatedEventGuestData:', consolidatedError);
          return;
        }

        if (consolidatedEventGuestData && consolidatedEventGuestData.length > 0) {
          const firstGuest = consolidatedEventGuestData[0];
          // check if not substitute
          if(!hasBeenReplaced){
          if (firstGuest.executive_name) {
            setGuestName(`${firstGuest.executive_name} ${firstGuest.executive_last_name}`);
          } else {
            setGuestName(firstGuest.guest_name);
          }
          } else {
            setReplacementName(firstGuest.guest_name)
          }
          setGuestId(firstGuest.guest_id)

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
  }, [email, hasBeenReplaced, newGuestEmail, macroEventId]);  

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

      await handleEmailConfirmation();
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
            org: 'Organizacion',
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
    
    const { data: eventData, error: eventError} = await supabase
      .from('event')
      .select(
        `event_program`
      )
      .eq('id', selectedEvent?.id)
      .single()    

    if (eventError) {
      console.error('Error fetching event:', eventError);
      return;
    }

    const { data: guestData, error: guestError} = await supabase
    .from('guest')
      .select(
        `
        *,
        company:company_id (razon_social),
        executive:executive_id (
        estimado,
        apodo        
      )
      `
    )
    .eq('id', guestId)
    .single()
    console.log("guestData", guestData)  

  if (guestError) {
    console.error('Error fetching guest:', guestError);
    return;
  }
    
    const emailToUse = hasBeenReplaced ? newGuestEmail : email
    const emailData = {
      to: emailToUse,
      template_id: "d-135fee68a2ac4cabad091a860be4331e",        
      first_name: hasBeenReplaced ? replacementName : guestName,
      estimado: hasBeenReplaced ? "Estimado (a)": (guestData.executive?.estimado || "Estimado (a)"),
      apodo: hasBeenReplaced ? replacementName : (guestData.executive?.apodo || guestName),
      event_name: selectedEvent?.name,
      event_place: selectedEvent?.place,
      event_date: selectedEvent?.date_hour,
      event_program: eventData.event_program,      
      register_link: `https://sae-register.vercel.app/${encodeURIComponent(emailToUse)}`
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
      console.log("hola")
      const { data: allOriginalGuests, error: originalGuestError } = await supabase
        .from("guest")
        .select(`
          id,
          is_user,
          executive: executive_id (
            company: company_id (razon_social)
          ),
          company_razon_social,
          list: list_id (id, macro_event_id)
          `)
        .eq("email", email)

      if (originalGuestError) throw originalGuestError

      if (!allOriginalGuests || allOriginalGuests.length === 0) {
        throw new Error("No se pudo obtener list_id del guest original")
      }

      // @ts-expect-error prisa
      const originalGuests = allOriginalGuests.filter((guest) => guest.list.macro_event_id === macroEventId)
      if (originalGuests.length === 0) {
        throw new Error("No se encontraron guests para el macro evento especificado")
      }

      originalGuests.map(async (originalGuest) => {
      const {error: newGuestError } = await supabase
        .from("guest")
        .insert({ 
          email: replacementEmail, 
          name: replacementName,
          // @ts-expect-error prisa
          company_razon_social: originalGuest.is_user ? originalGuest.executive?.company?.razon_social : originalGuest.company_razon_social,
          // @ts-expect-error prisa
          list_id: originalGuest.list.id, 
          tipo_usuario: "Reemplazo",
          position: "Reemplazo",
        })

      if (newGuestError) throw newGuestError
      })

      const { error: substituteError } = await supabase.from("substitutes").insert({
        macro_event_id: macroEventId,
        original_guest_email: email,
        new_guest_email: replacementEmail,
      })

      if (substituteError) throw substituteError

      setHasBeenReplaced(true)
      setNewGuestEmail(replacementEmail)
      setShowReplaceForm(false)

    } catch (error) {
      console.error("Error al registrar el reemplazo:", error)
    }
  }

  return (
<div className="p-4 w-full max-w-4xl mx-auto sm:px-6 text-center">
  <h2 className="text-lg sm:text-xl mb-4">{guestName || 'Nombre no disponible'}</h2>
  <h2 className="text-lg sm:text-xl mb-4">{email || 'Email no disponible'}</h2>
    <div>
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
    <h4 className="text-sm sm:text-base mt-6 text-center">
    A continuación, elige la reunión de tu preferencia. En caso desees enviar un reemplazo, haz clic en el siguiente botón:
      </h4>
    </div>
    {
  hasBeenReplaced ? (
    <div>
      <h2 className="text-lg sm:text-xl mb-4 text-center">
        Este usuario ha sido reemplazado por {newGuestEmail}
      </h2>
      <h4 className="text-lg sm:text-xl font-semibold mt-6 text-center">
        Lista de eventos del reemplazo {replacementName}
      </h4>
    </div>
  ) : (    
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
      <Button onClick={() => setShowReplaceForm(!showReplaceForm)} className="mb-4" style={{ backgroundColor: '#006F96', color: '#FFFFFF' }}>
        {showReplaceForm ? 'Cancelar reemplazo' : 'Registrar reemplazo'}
      </Button>      
      </div>
  )
  }
    {events.length === 0 ? (
      <p className="text-center text-base sm:text-lg">No hay eventos disponibles.</p>
    ) : (
      <ul className="grid grid-cols-1 gap-6">
        {/* Reuniones presenciales */}
        {events
          .filter((item) => item.event_type === 'Presencial')
          .map((event) => (
            <li
              key={event.id}
              className="border rounded-lg shadow-lg p-4 bg-white w-full"
            >
              <div className="flex flex-col space-y-2">
                <span className="text-base sm:text-lg font-bold">{event.name}</span>
                <div className="flex flex-col space-y-1 text-sm sm:text-base">
                  <span>
                    <strong>Modalidad:</strong> {event.event_type}
                  </span>
                  <span>
                    <strong>Lugar:</strong> {event.place}
                  </span>
                  <span>
                  <strong>Fecha y Hora:</strong> {formatDateTime(event.date_hour)}
                </span>
                </div>
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
                  disabled={event.registered || !event.register_open}
                >
                  {event.registered ? 'Registrado' : 'Registrarse'}
                </Button>
              </div>
            </li>
          ))}

        {/* Reuniones virtuales */}
        {events
          .filter((item) => item.event_type === 'Virtual')
          .map((event) => (
            <li
              key={event.id}
              className="border rounded-lg shadow-lg p-4 bg-white w-full"
            >
              <div className="flex flex-col space-y-2">
                <p style={{ color: '#006F96' }}>Reunión virtual</p>
                <span className="text-base sm:text-lg font-bold">{event.name}</span>
                <div className="flex flex-col space-y-1 text-sm sm:text-base">
                  <span>
                    <strong>Modalidad:</strong> {event.event_type}
                  </span>
                  <span>
                    <strong>Lugar:</strong> {event.place}
                  </span>
                  <span>
                  <strong>Fecha y Hora:</strong> {formatDateTime(event.date_hour)}
                </span>
                </div>

                <div
                  className="text-sm sm:text-base"
                  dangerouslySetInnerHTML={{ __html: event.html_description ? DOMPurify.sanitize(event.html_description.replace(/\\/g, '')) : '' }}
                  />
              </div>

              {!event.registered && event.register_open &&(
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
                    disabled={event.registered || !event.register_open}
                  >
                    {event.registered ? 'Registrado' : 'Registrarse en Zoom'}
                  </Button>
                  {!event.register_open &&(
                    <p style={{ paddingTop: '20px' }}>Escribenos a este correo contactasae@apoyoconsultoria.com</p>
                  )}
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
</div>


  )
}
