import { useState } from 'react'
import ContactButton from './ContactButton'
import ContactPanel from './ContactPanel'

/**
 * Isla que sostiene el estado `isContactOpen` compartido por el botón y el
 * panel. Existe solo porque dos islas `client:load` separadas no pueden
 * compartir estado en Astro: se monta desde `index.astro`, fuera del ciclo de
 * vida de `MapView`, así el contacto sigue vivo pase lo que pase en el mapa.
 */
export default function ContactWidget() {
  const [isContactOpen, setIsContactOpen] = useState(false)

  return (
    <>
      <ContactButton isOpen={isContactOpen} onOpen={() => setIsContactOpen(true)} />
      <ContactPanel isOpen={isContactOpen} onClose={() => setIsContactOpen(false)} />
    </>
  )
}
