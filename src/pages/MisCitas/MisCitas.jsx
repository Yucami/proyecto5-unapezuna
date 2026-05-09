import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import styles from './MisCitas.module.css'

const API_URL = import.meta.env.VITE_API_URL

function formatearFecha(fechaStr) {
  if (!fechaStr) return ''
  // T12:00:00 evita desfases de zona horaria al parsear solo la fecha
  return new Date(fechaStr + 'T12:00:00')
    .toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

// Mapeo de estados de DynamoDB (uppercase) a etiqueta y color visual
const ESTADO_LABEL = {
  confirmada:     { texto: 'Confirmada', color: 'verde'  },
  pendiente:      { texto: 'Pendiente',  color: 'gris'   },
  cancelada:      { texto: 'Cancelada',  color: 'rojo'   },
  completada:     { texto: 'Completada', color: 'dorado' },
  no_se_presento: { texto: 'No asistió', color: 'rojo'   },
}

export default function MisCitas() {
  const { user, loading: authLoading, getToken } = useAuth()
  const navigate = useNavigate()
  const [reservas,          setReservas]          = useState([])
  const [loading,           setLoading]           = useState(true)
  const [error,             setError]             = useState('')
  const [cancelando,        setCancelando]        = useState(null)
  const [confirmarCancelar, setConfirmarCancelar] = useState(null)

  // Redirige a home si no hay sesión
  useEffect(() => {
    if (!authLoading && !user) navigate('/')
  }, [user, authLoading, navigate])

  useEffect(() => {
    if (!user) return
    cargarReservas()
  }, [user])

  const cargarReservas = async () => {
    console.log('DEBUG user', { sub: user.sub, email: user.email })
    setLoading(true); setError('')
    try {
      if (!API_URL) { setReservas(RESERVAS_FALLBACK); setLoading(false); return }
      const token = await getToken()
      const res = await fetch(`${API_URL}/reservas`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (!res.ok) throw new Error('Error al cargar las citas')
      const data  = await res.json()
      console.log('DEBUG reservas', data)

      const lista = Array.isArray(data) ? data : (data.reservas || data.items || [])
      setReservas(lista)
    } catch { setError('No se pudieron cargar tus citas. Inténtalo de nuevo.') }
    finally { setLoading(false) }
  }

  const cancelarReserva = async (reserva) => {
    setCancelando(reserva.reservaId); setError('')
    try {
      // Modo demo: cancelación optimista sin API
      if (!API_URL) {
        setReservas(prev => prev.map(r =>
          r.reservaId === reserva.reservaId ? { ...r, estado: 'cancelada' } : r
        ))
        setCancelando(null); setConfirmarCancelar(null); return
      }
      const token = await getToken()
      const res = await fetch(`${API_URL}/reservas`, {
        method:  'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        // La Lambda de cancelación requiere ambos campos para localizar el item en DynamoDB
        body: JSON.stringify({ reservaId: reserva.reservaId, clienteId: user.sub })
      })
      if (!res.ok) { const data = await res.json(); throw new Error(data.message || 'Error al cancelar') }
      // Actualización optimista: marca como cancelada sin recargar la lista completa
      setReservas(prev => prev.map(r =>
        r.reservaId === reserva.reservaId ? { ...r, estado: 'cancelada' } : r
      ))
      setConfirmarCancelar(null)
    } catch (err) { setError(err.message) }
    finally { setCancelando(null) }
  }

  const hoy = new Date().toISOString().split('T')[0]
  // Próximas: fecha >= hoy y no canceladas | Pasadas: fecha pasada o canceladas
  const proximas = reservas.filter(r => r.fecha >= hoy && r.estado !== 'cancelada')
  const pasadas  = reservas.filter(r => r.fecha < hoy  || r.estado === 'cancelada')

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <div className={styles.header}>
          <span className={styles.label}>Tu historial</span>
          <h1 className={styles.title}>MIS CITAS</h1>
          {user && <p className={styles.bienvenida}>Hola, {user.name?.split(' ')[0]}</p>}
        </div>

        {loading && <div className={styles.spinner} />}
        {error   && <p className={styles.error}>{error}</p>}

        {!loading && !error && reservas.length === 0 && (
          <div className={styles.vacio}>
            <p>Aún no tienes citas.</p>
            <button className={styles.btnReservar} onClick={() => navigate('/reservar')}>
              Reservar primera cita →
            </button>
          </div>
        )}

        {proximas.length > 0 && (
          <div className={styles.seccion}>
            <h2 className={styles.seccionTitulo}>Próximas citas</h2>
            <div className={styles.lista}>
              {proximas.map(r => (
                <CitaCard key={r.reservaId} reserva={r} pasada={false}
                  onCancelar={() => setConfirmarCancelar(r)}
                  cancelando={cancelando === r.reservaId} />
              ))}
            </div>
          </div>
        )}

        {pasadas.length > 0 && (
          <div className={styles.seccion}>
            <h2 className={styles.seccionTitulo}>Historial</h2>
            <div className={styles.lista}>
              {pasadas.map(r => (
                <CitaCard key={r.reservaId} reserva={r} pasada />
              ))}
            </div>
          </div>
        )}

        {!loading && reservas.length > 0 && (
          <div className={styles.nuevaCita}>
            <button className={styles.btnReservar} onClick={() => navigate('/reservar')}>
              + Reservar nueva cita
            </button>
          </div>
        )}
      </div>

      {confirmarCancelar && (
        <ModalCancelar
          reserva={confirmarCancelar}
          cancelando={cancelando === confirmarCancelar.reservaId}
          onConfirmar={() => cancelarReserva(confirmarCancelar)}
          onCerrar={() => setConfirmarCancelar(null)}
        />
      )}
    </div>
  )
}

function CitaCard({ reserva, onCancelar, cancelando, pasada }) {
  const { nombreServicio, fecha, horaInicio, estado, precio } = reserva
  // estado viene en uppercase desde DynamoDB — normalizamos para buscar en ESTADO_LABEL
  const estadoInfo  = ESTADO_LABEL[estado?.toLowerCase()] || { texto: estado, color: 'gris' }
  const estadoLower = estado?.toLowerCase()
  const puedeCancelar = !pasada && (estadoLower === 'confirmada' || estadoLower === 'pendiente')

  return (
    <article className={styles.card}>
      <div className={styles.cardLeft}>
        <div className={styles.cardFecha}>
          <span className={styles.cardDia}>
            {new Date(fecha + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
          </span>
          <span className={styles.cardHora}>{horaInicio}</span>
        </div>
      </div>
      <div className={styles.cardCenter}>
        <h3 className={styles.cardServicio}>{nombreServicio}</h3>
        <span className={styles.cardFechaCompleta}>{formatearFecha(fecha)}</span>
        {precio && <span className={styles.cardPrecio}>{precio}€</span>}
      </div>
      <div className={styles.cardRight}>
        <span className={`${styles.estadoBadge} ${styles[estadoInfo.color]}`}>{estadoInfo.texto}</span>
        {puedeCancelar && (
          <button className={styles.btnCancelar} onClick={onCancelar} disabled={cancelando}>
            {cancelando ? '...' : 'Cancelar'}
          </button>
        )}
      </div>
    </article>
  )
}

function ModalCancelar({ reserva, cancelando, onConfirmar, onCerrar }) {
  return (
    // Click fuera del modal lo cierra
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onCerrar()}>
      <div className={styles.modal}>
        <div className={styles.modalTop}>
          <h3 className={styles.modalTitle}>¿Cancelar esta cita?</h3>
          <button className={styles.modalClose} onClick={onCerrar}>✕</button>
        </div>
        <div className={styles.modalInfo}>
          <p><strong>{reserva.nombreServicio}</strong></p>
          <p>{formatearFecha(reserva.fecha)} a las {reserva.horaInicio}</p>
        </div>
        <p className={styles.modalAviso}>Si cancelas, el hueco quedará libre y no podrás recuperarlo.</p>
        <div className={styles.modalBtns}>
          <button className={styles.btnVolver} onClick={onCerrar} disabled={cancelando}>Volver</button>
          <button className={styles.btnConfirmarCancelar} onClick={onConfirmar} disabled={cancelando}>
            {cancelando ? <span className={styles.spinnerInline} /> : 'Sí, cancelar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// Datos de ejemplo cuando la API no está disponible
const RESERVAS_FALLBACK = [
  { reservaId: 'demo-1', nombreServicio: 'Manicura permanente 1 tono', fecha: '2026-05-05', horaInicio: '11:00', estado: 'confirmada', precio: '25' },
  { reservaId: 'demo-2', nombreServicio: 'Nail Art',                   fecha: '2026-04-20', horaInicio: '10:30', estado: 'completada', precio: '45' },
]