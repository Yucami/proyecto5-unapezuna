import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import styles from './Servicios.module.css'

// Datos de respaldo si la API no está disponible o falla
const SERVICIOS_FALLBACK = [
  { servicioId: '1', nombre: 'Manicura Clásica',   descripcion: 'Lima, cutícula y esmaltado clásico.',          precio: 18, duracion: 45,  precioVariable: false },
  { servicioId: '2', nombre: 'Semipermanente',      descripcion: 'Esmaltado de larga duración hasta 3 semanas.', precio: 28, duracion: 60,  precioVariable: false },
  { servicioId: '3', nombre: 'Nail Art',            descripcion: 'Diseño personalizado. Consulta tu idea.',      precio: 45, duracion: 90,  precioVariable: true  },
  { servicioId: '4', nombre: 'Acrílicas Completas', descripcion: 'Esculpido completo con acrílico premium.',     precio: 65, duracion: 120, precioVariable: true  },
  { servicioId: '5', nombre: 'Relleno Acrílicas',   descripcion: 'Mantenimiento cada 3-4 semanas.',              precio: 40, duracion: 90,  precioVariable: false },
  { servicioId: '6', nombre: 'Retirada',            descripcion: 'Retirada profesional sin daño.',               precio: 15, duracion: 30,  precioVariable: false },
]

export default function Servicios({ apiUrl }) {
  const [servicios, setServicios] = useState([])
  const [loading, setLoading]     = useState(true)

  useEffect(() => {
    const fetchServicios = async () => {
      // Sin API URL usamos el fallback directamente (ej: build estático sin backend)
      if (!apiUrl) { setServicios(SERVICIOS_FALLBACK); setLoading(false); return }
      try {
        const res = await fetch(`${apiUrl}/servicios`)
        if (!res.ok) throw new Error('Error al cargar servicios')
        const data = await res.json()
        // La API devuelve { servicios: [...] } — defensivo por si cambia la forma
        const lista = Array.isArray(data) ? data : (data.items || data.servicios || [])
        setServicios(lista)
      } catch {
        // Si la API falla, mostramos el catálogo estático para no dejar la sección vacía
        setServicios(SERVICIOS_FALLBACK)
      } finally {
        setLoading(false)
      }
    }
    fetchServicios()
  }, [apiUrl])

  return (
    <section className={styles.section} id="servicios">
      <div className={styles.inner}>
        <div className={styles.header}>
          <span className={styles.label}>Catálogo de servicios</span>
          <h2 className={styles.title}>PARA ALMAS<br /><em>REBELDES</em></h2>
          <p className={styles.desc}>Cada diseño es único. Cada servicio, una transformación.</p>
        </div>
        {loading ? (
          <div className={styles.loading}><div className={styles.spinner} /></div>
        ) : (
          <div className={styles.grid}>
            {servicios.map((s) => <ServiceCard key={s.servicioId} servicio={s} />)}
          </div>
        )}
        <div className={styles.cta}>
          <Link to="/reservar" className={styles.ctaBtn}>RESERVAR CITA →</Link>
        </div>
      </div>
    </section>
  )
}

function ServiceCard({ servicio }) {
  const { nombre, descripcion, precio, duracion, duracionMin, precioVariable, requiereFotos } = servicio
  return (
    <article className={styles.card}>
      <div className={styles.cardTop}>
        <h3 className={styles.cardTitle}>{nombre}</h3>
        {/* Badge solo aparece si el servicio requiere foto de referencia (campo de DynamoDB) */}
        {requiereFotos && <span className={styles.badge} title="Requiere foto de referencia">📎</span>}
      </div>
      <p className={styles.cardDesc}>{descripcion}</p>
      <div className={styles.cardBottom}>
        {/* duracion es el campo principal, duracionMin es el nombre alternativo en algunos registros */}
        <div className={styles.cardMeta}><span className={styles.duration}>⏱ {duracion ?? duracionMin} min</span></div>
        <div className={styles.price}>
          {precioVariable
            ? <span>desde <strong>{precio}€</strong></span>
            : <strong>{precio}€</strong>
          }
        </div>
      </div>
      <div className={styles.cardLine} />
    </article>
  )
}