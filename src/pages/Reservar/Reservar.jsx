import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import styles from './Reservar.module.css'

const API_URL = import.meta.env.VITE_API_URL

// ── Helpers generales ──────────────────────────────────────────────────────

// Regla de negocio: si son las 21:00 o más, el día siguiente ya no está disponible
function esDespuesDe21() { return new Date().getHours() >= 21 }

// Fecha mínima seleccionable: mañana normalmente, pasado mañana si son +21:00
function fechaMinima() {
  const hoy  = new Date()
  const dias = esDespuesDe21() ? 2 : 1
  hoy.setDate(hoy.getDate() + dias)
  return `${hoy.getFullYear()}-${String(hoy.getMonth()+1).padStart(2,'0')}-${String(hoy.getDate()).padStart(2,'0')}`
}

function formatearFecha(fechaStr) {
  if (!fechaStr) return ''
  // T12:00:00 evita desfases de zona horaria al parsear solo la fecha
  return new Date(fechaStr + 'T12:00:00')
    .toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
}

// ── Helpers de calendario ──────────────────────────────────────────────────
const DIAS_SEM = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

function mesLabel(año, mes) {
  return new Date(año, mes, 1)
    .toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
    .replace(/^\w/, c => c.toUpperCase())
}
function diasEnMes(año, mes) { return new Date(año, mes + 1, 0).getDate() }
function primerDiaSem(año, mes) {
  const d = new Date(año, mes, 1).getDay()
  return d === 0 ? 6 : d - 1
}

// Normaliza el campo de duración — en DynamoDB puede llamarse 'duracion' o 'duracionMin'
function getDuracion(s) { return s?.duracion ?? s?.duracionMin ?? null }

const PASO = { SERVICIO: 1, FECHA: 2, HORA: 3, CONFIRMAR: 4, EXITO: 5 }

// ── Reservar ───────────────────────────────────────────────────────────────
export default function Reservar() {
  const { user, isAdmin, loading: authLoading, getToken } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  // presel: fecha y hora preseleccionadas cuando el admin navega desde el panel de admin
  const presel = location.state || {}

  const [paso,               setPaso]               = useState(PASO.SERVICIO)
  const [servicios,          setServicios]          = useState([])
  const [servicio,           setServicio]           = useState(null)
  const [fecha,              setFecha]              = useState(presel.fechaPresel || '')
  const [huecos,             setHuecos]             = useState([])
  const [hora,               setHora]               = useState(presel.horaPresel ? { horaInicio: presel.horaPresel } : null)
  const [fotos,              setFotos]              = useState([])
  const [loading,            setLoading]            = useState(false)
  const [error,              setError]              = useState('')
  const [reservaId,          setReservaId]          = useState('')
  // Campos extra solo visibles en modo admin para registrar citas de clientes sin cuenta
  const [contactoManual,     setContactoManual]     = useState({ nombre: '', email: '', telefono: '' })
  const [clienteEncontrado,  setClienteEncontrado]  = useState(null)
  const [buscandoCliente,    setBuscandoCliente]    = useState(false)

  // Redirige a home si el usuario no está autenticado
  useEffect(() => {
    if (!authLoading && !user) navigate('/')
  }, [user, authLoading, navigate])

  // Carga el catálogo de servicios al montar
  useEffect(() => {
    const cargar = async () => {
      if (!API_URL) { setServicios(SERVICIOS_FALLBACK); return }
      try {
        const res  = await fetch(`${API_URL}/servicios`)
        const data = await res.json()
        setServicios(Array.isArray(data) ? data : (data.items || data.servicios || []))
      } catch { setServicios(SERVICIOS_FALLBACK) }
    }
    cargar()
  }, [])

  // Carga los huecos disponibles cada vez que cambia la fecha seleccionada
  useEffect(() => {
    if (!fecha) return
    const cargar = async () => {
      setLoading(true); setHuecos([]); setHora(null); setError('')
      try {
        if (!API_URL) { setHuecos(HUECOS_FALLBACK); setLoading(false); return }
        const res  = await fetch(`${API_URL}/disponibilidad?fecha=${fecha}`)
        if (!res.ok) throw new Error()
        const data = await res.json()
        setHuecos(Array.isArray(data) ? data : (data.huecos || data.disponibilidad || data.items || []))
      } catch { setError('No se pudo cargar la disponibilidad. Inténtalo de nuevo.') }
      finally { setLoading(false) }
    }
    cargar()
  }, [fecha])

  // Busca una clienta por email para vincular la reserva a su historial (solo admin)
  const buscarCliente = async (email) => {
    if (!email) return
    setBuscandoCliente(true); setClienteEncontrado(null)
    try {
      const token = await getToken()
      const res  = await fetch(
        `${API_URL}/admin/buscar-cliente?email=${encodeURIComponent(email)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      const data = await res.json()
      setClienteEncontrado(data)
    } catch { setClienteEncontrado({ encontrado: false, cliente: null }) }
    finally { setBuscandoCliente(false) }
  }

  const confirmarReserva = async () => {
    setLoading(true); setError('')
    try {
      // Modo demo (sin API): simula confirmación con ID falso
      if (!API_URL) {
        await new Promise(r => setTimeout(r, 1200))
        setReservaId('DEMO-' + Date.now())
        setPaso(PASO.EXITO); setLoading(false); return
      }
      const token = await getToken()
      const res = await fetch(`${API_URL}/reservas`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({
          servicioId: servicio.servicioId,
          fecha,
          horaInicio: hora.horaInicio,
          // El admin puede registrar citas para clientas sin cuenta (contactoManual)
          // o vincularlas a una cuenta existente (clienteIdForzado)
          ...(isAdmin && {
            adminReserva:     true,
            contactoManual,
            clienteIdForzado: clienteEncontrado?.encontrado
              ? clienteEncontrado.cliente.clienteId
              : undefined
          })
        })
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.message || 'Error al crear la reserva') }
      const data = await res.json()
      setReservaId(data.reservaId)
      setPaso(PASO.EXITO)
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <div className={styles.header}>
          <span className={styles.label}>
            {isAdmin ? 'Registrar cita' : 'Reserva tu cita'}
          </span>
          <h1 className={styles.title}>
            {paso === PASO.EXITO ? 'Cita confirmada' : 'AGENDA TU\nTRANSFORMACIÓN'}
          </h1>
        </div>

        {/* Indicador de pasos — se oculta en el paso de éxito */}
        {paso !== PASO.EXITO && (
          <div className={styles.steps}>
            {[
              { n: PASO.SERVICIO,  label: 'Servicio'  },
              { n: PASO.FECHA,     label: 'Fecha'     },
              { n: PASO.HORA,      label: 'Hora'      },
              { n: PASO.CONFIRMAR, label: 'Confirmar' },
            ].map(({ n, label }) => (
              <div key={n} className={`${styles.step} ${paso === n ? styles.stepActive : ''} ${paso > n ? styles.stepDone : ''}`}>
                <div className={styles.stepNum}>{paso > n ? '✓' : n}</div>
                <span className={styles.stepLabel}>{label}</span>
              </div>
            ))}
          </div>
        )}

        <div className={styles.content}>
          {paso === PASO.SERVICIO && (
            <PasoServicio servicios={servicios}
              onSelect={s => {
                setServicio(s)
                // Si viene con fecha preseleccionada (desde admin), salta directo a confirmar
                setPaso(presel.fechaPresel ? PASO.CONFIRMAR : PASO.FECHA)
              }} />
          )}
          {paso === PASO.FECHA && (
            <PasoFecha
              servicio={servicio} fecha={fecha}
              onChange={setFecha}
              onNext={() => setPaso(PASO.HORA)}
              onBack={() => setPaso(PASO.SERVICIO)}
              isAdmin={isAdmin} />
          )}
          {paso === PASO.HORA && (
            <PasoHora
              fecha={fecha} huecos={huecos} hora={hora}
              loading={loading} error={error}
              onSelect={setHora}
              onNext={() => setPaso(PASO.CONFIRMAR)}
              onBack={() => setPaso(PASO.FECHA)}
              isAdmin={isAdmin} 
              servicio={servicio} />
          )}
          {paso === PASO.CONFIRMAR && (
            <PasoConfirmar
              servicio={servicio} fecha={fecha} hora={hora}
              fotos={fotos} onFotos={setFotos}
              loading={loading} error={error}
              onConfirmar={confirmarReserva}
              onBack={() => setPaso(PASO.HORA)}
              ausencias={user?.ausenciasInjustificadas || 0}
              isAdmin={isAdmin}
              contactoManual={contactoManual}
              onContactoManual={setContactoManual}
              clienteEncontrado={clienteEncontrado}
              onBuscarCliente={buscarCliente}
              buscandoCliente={buscandoCliente} />
          )}
          {paso === PASO.EXITO && (
            <PasoExito
              servicio={servicio} fecha={fecha} hora={hora}
              reservaId={reservaId}
              onNueva={() => {
                // Resetea todo el formulario para empezar una nueva reserva
                setServicio(null); setFecha(''); setHora(null)
                setFotos([]); setReservaId('')
                setContactoManual({ nombre: '', email: '', telefono: '' })
                setClienteEncontrado(null)
                setPaso(PASO.SERVICIO)
              }} />
          )}
        </div>
      </div>
    </div>
  )
}

// ── Paso 1: Servicio ───────────────────────────────────────────────────────
function PasoServicio({ servicios, onSelect }) {
  return (
    <div>
      <p className={styles.pasoDesc}>¿Qué servicio quieres reservar?</p>
      <div className={styles.serviciosGrid}>
        {servicios.map(s => (
          <button key={s.servicioId} className={styles.servicioCard} onClick={() => onSelect(s)}>
            <div className={styles.servicioTop}>
              <h3 className={styles.servicioNombre}>{s.nombre}</h3>
              {s.requiereFotos && <span className={styles.fotoBadge}>📎 foto</span>}
            </div>
            <p className={styles.servicioDesc}>{s.descripcion}</p>
            <div className={styles.servicioBottom}>
              {getDuracion(s) !== null && (
                <span className={styles.servicioDuracion}>⏱ {getDuracion(s)} min</span>
              )}
              <span className={styles.servicioPrecio}>
                {s.precioVariable ? `desde ${s.precio}€` : `${s.precio}€`}
              </span>
            </div>
            <div className={styles.servicioLine} />
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Paso 2: Fecha — calendario visual ──────────────────────────────────────
function PasoFecha({ servicio, fecha, onChange, onNext, onBack, isAdmin }) {
  // Admin puede seleccionar fechas pasadas (para registrar citas retroactivas)
  const min       = isAdmin ? '2020-01-01' : fechaMinima()
  const avisoHora = !isAdmin && esDespuesDe21()
  const hoy2      = new Date()
  const hoyStr    = `${hoy2.getFullYear()}-${String(hoy2.getMonth()+1).padStart(2,'0')}-${String(hoy2.getDate()).padStart(2,'0')}`
  const minDate   = new Date(min + 'T12:00:00')
  const initAño   = isAdmin ? new Date().getFullYear() : minDate.getFullYear()
  const initMes   = isAdmin ? new Date().getMonth()    : minDate.getMonth()

  const [año,        setAño]        = useState(initAño)
  const [mes,        setMes]        = useState(initMes)
  const [dispoMes,   setDispoMes]   = useState({})
  const [loadingMes, setLoadingMes] = useState(false)

  useEffect(() => {
    const cargar = async () => {
      setLoadingMes(true)
      try {
        const m = `${año}-${String(mes + 1).padStart(2, '0')}`
        const r = await fetch(`${API_URL}/disponibilidad/mes?mes=${m}`)
        const d = await r.json()
        const mapa = {}
        ;(d.dias || []).forEach(x => { mapa[x.fecha] = x })
        setDispoMes(mapa)
      } catch { /* días sin color si falla */ }
      finally { setLoadingMes(false) }
    }
    cargar()
  }, [año, mes])

  const mesActualStr = `${año}-${String(mes + 1).padStart(2, '0')}`
  const mesMinStr    = min.substring(0, 7)
  const puedeIrPrev  = mesActualStr > mesMinStr

  const prevMes = () => {
    if (!puedeIrPrev) return
    if (mes === 0) { setAño(a => a - 1); setMes(11) } else { setMes(m => m - 1) }
  }
  const nextMes = () => {
    if (mes === 11) { setAño(a => a + 1); setMes(0) } else { setMes(m => m + 1) }
  }

  const offset = primerDiaSem(año, mes)
  const total  = diasEnMes(año, mes)
  const celdas = [...Array(offset).fill(null), ...Array.from({ length: total }, (_, i) => i + 1)]

  return (
    <div className={styles.pasoWrap}>
      <div className={styles.resumenPrevio}>
        <span className={styles.resumenLabel}>Servicio seleccionado</span>
        <span className={styles.resumenVal}>
          {servicio?.nombre} — {servicio?.precioVariable ? `desde ${servicio.precio}€` : `${servicio.precio}€`}
        </span>
      </div>

      {avisoHora && (
        <div className={styles.aviso}>⚠️ Son más de las 21:00. La primera fecha disponible es pasado mañana.</div>
      )}
      {isAdmin && (
        <div className={styles.aviso} style={{ borderColor: 'rgba(198,169,107,0.4)', color: 'var(--gold)' }}>
          👑 Modo admin — puedes seleccionar cualquier fecha, incluidas pasadas.
        </div>
      )}

      <p className={styles.pasoDesc}>Elige una fecha</p>

      <div className={styles.calHeader}>
        <button className={styles.calNav} onClick={prevMes} disabled={!puedeIrPrev}>←</button>
        <span className={styles.calMes}>
          {mesLabel(año, mes)}
          {loadingMes && <span className={styles.calSpinner} />}
        </span>
        <button className={styles.calNav} onClick={nextMes}>→</button>
      </div>

      {/* Navegación por año — solo visible en modo admin */}
      {isAdmin && (
        <div className={styles.calAñoNav}>
          <button className={styles.calNavAño} onClick={() => setAño(a => a - 1)}>‹ {año - 1}</button>
          <span className={styles.calAñoActual}>{año}</span>
          <button className={styles.calNavAño} onClick={() => setAño(a => a + 1)}>{año + 1} ›</button>
        </div>
      )}

      <div className={styles.leyenda}>
        <span className={styles.leyItem}><i className={`${styles.leyDot} ${styles.dotVerde}`} />Disponible</span>
        <span className={styles.leyItem}><i className={`${styles.leyDot} ${styles.dotRojo}`}  />Completo</span>
      </div>

      <div className={styles.calGrid}>
        {DIAS_SEM.map(d => <div key={d} className={styles.calDiaSem}>{d}</div>)}
        {celdas.map((d, i) => {
          if (!d) return <div key={`v-${i}`} />
          const f         = `${año}-${String(mes + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
          const info      = dispoMes[f]
          const bloq      = !isAdmin && f < min
          const esHoy     = f === hoyStr
          const sel       = f === fecha
          const hayAgenda = (info?.total ?? 0) > 0
          const hayLibres = (info?.disponibles ?? 0) > 0
          // El admin puede clickar cualquier día; el cliente solo días con huecos libres
          const clickable = isAdmin ? true : (!bloq && hayAgenda && hayLibres)
          const colorCls  = !hayAgenda ? ''
            : hayLibres ? styles.diaVerde : styles.diaRojo

          return (
            <button key={f}
              className={[
                styles.calDia, colorCls,
                bloq                  ? styles.diaBloq          : '',
                esHoy                 ? styles.diaHoy           : '',
                sel                   ? styles.diaSel           : '',
                !hayAgenda && isAdmin ? styles.diaSinAgendaAdmin : '',
              ].filter(Boolean).join(' ')}
              onClick={() => clickable && onChange(f)}
              disabled={!clickable}
            >
              <span className={styles.calNum}>{d}</span>
            </button>
          )
        })}
      </div>

      {fecha && <p className={styles.fechaSeleccionada}>📅 {formatearFecha(fecha)}</p>}

      <div className={styles.navBtns}>
        <button className={styles.btnBack} onClick={onBack}>← Volver</button>
        <button className={styles.btnNext} onClick={onNext} disabled={!fecha}>Ver huecos →</button>
      </div>
    </div>
  )
}

// ── Paso 3: Hora ───────────────────────────────────────────────────────────
function PasoHora({ fecha, huecos, hora, loading, error, onSelect, onNext, onBack, isAdmin, servicio }) {
  const duracion = getDuracion(servicio)
  const todosDisponibles = huecos.filter(h => h.disponible !== false && h.bloqueado !== true)
  const minutosDisp = new Set(todosDisponibles.map(h => {
    const [hh, mm] = h.horaInicio.split(':').map(Number)
    return hh * 60 + mm
  }))
  const slotsNecesarios = duracion ? Math.ceil(duracion / 30) : 1
  const disponibles = todosDisponibles.filter(h => {
    const [hh, mm] = h.horaInicio.split(':').map(Number)
    const inicio = hh * 60 + mm
    for (let i = 0; i < slotsNecesarios; i++) {
      if (!minutosDisp.has(inicio + i * 30)) return false
    }
    return true
  })  
  const hoy2    = new Date()
  const hoyStr  = `${hoy2.getFullYear()}-${String(hoy2.getMonth()+1).padStart(2,'0')}-${String(hoy2.getDate()).padStart(2,'0')}`
  const esPasado = fecha < hoyStr

  return (
    <div className={styles.pasoWrap}>
      <div className={styles.resumenPrevio}>
        <span className={styles.resumenLabel}>Fecha</span>
        <span className={styles.resumenVal}>📅 {formatearFecha(fecha)}</span>
      </div>
      <p className={styles.pasoDesc}>Elige una hora</p>

      {loading && <div className={styles.spinner} />}
      {error   && <p className={styles.error}>{error}</p>}

      {/* Admin en fecha pasada sin huecos: input manual de hora para registros retroactivos */}
      {!loading && !error && disponibles.length === 0 && isAdmin && esPasado && (
        <div className={styles.aviso} style={{ borderColor: 'rgba(198,169,107,0.4)', color: 'var(--gold)' }}>
          👑 No hay huecos creados para esta fecha. Introduce la hora manualmente.
          <div style={{ marginTop: 12 }}>
            <input
              type="time" step="1800"
              className={styles.dateInput}
              onChange={e => onSelect({ horaInicio: e.target.value })}
              style={{ maxWidth: 160 }}
            />
          </div>
        </div>
      )}

      {!loading && !error && disponibles.length === 0 && (!isAdmin || !esPasado) && (
        <p className={styles.sinHuecos}>No hay huecos disponibles para esta fecha.<br />Prueba con otro día.</p>
      )}

      {!loading && disponibles.length > 0 && (
        <div className={styles.horasGrid}>
          {disponibles.map(h => (
            <button key={h.horaInicio}
              className={`${styles.horaBtn} ${hora?.horaInicio === h.horaInicio ? styles.horaSelected : ''}`}
              onClick={() => onSelect(h)}
            >{h.horaInicio}</button>
          ))}
        </div>
      )}

      <div className={styles.navBtns}>
        <button className={styles.btnBack} onClick={onBack}>← Volver</button>
        <button className={styles.btnNext} onClick={onNext} disabled={!hora}>Continuar →</button>
      </div>
    </div>
  )
}

// ── Paso 4: Confirmar ──────────────────────────────────────────────────────
function PasoConfirmar({ servicio, fecha, hora, fotos, onFotos, loading, error,
  onConfirmar, onBack, ausencias, isAdmin,
  contactoManual, onContactoManual, clienteEncontrado, onBuscarCliente, buscandoCliente }) {

  const handleFotos = e => { onFotos(Array.from(e.target.files).slice(0, 2)) }
  const duracion    = getDuracion(servicio)

  return (
    <div className={styles.pasoWrap}>
      <p className={styles.pasoDesc}>Confirma tu reserva</p>

      <div className={styles.resumenBox}>
        <div className={styles.resumenFila}><span>Servicio</span><strong>{servicio?.nombre}</strong></div>
        <div className={styles.resumenFila}><span>Fecha</span><strong>{formatearFecha(fecha)}</strong></div>
        <div className={styles.resumenFila}><span>Hora</span><strong>{hora?.horaInicio}</strong></div>
        <div className={styles.resumenFila}><span>Precio</span>
          <strong>{servicio?.precioVariable ? `desde ${servicio.precio}€` : `${servicio.precio}€`}</strong>
        </div>
        {duracion !== null && (
          <div className={styles.resumenFila}><span>Duración</span><strong>{duracion} min</strong></div>
        )}
      </div>

      {/* Bloque de datos de clienta — solo visible en modo admin */}
      {isAdmin && (
        <div className={styles.adminContacto}>
          <span className={styles.adminContactoLbl}>DATOS DE LA CLIENTA</span>

          <div className={styles.adminField}>
            <label className={styles.fieldLbl}>Nombre</label>
            <input className={styles.adminInput} type="text"
              placeholder="Nombre completo"
              value={contactoManual.nombre}
              onChange={e => onContactoManual(p => ({ ...p, nombre: e.target.value }))} />
          </div>

          <div className={styles.adminField}>
            <label className={styles.fieldLbl}>Email</label>
            <div className={styles.adminInputRow}>
              <input className={styles.adminInput} type="email"
                placeholder="email@ejemplo.com"
                value={contactoManual.email}
                onChange={e => onContactoManual(p => ({ ...p, email: e.target.value }))} />
              {/* Busca si el email corresponde a una cuenta existente en Cognito */}
              <button className={styles.btnBuscar}
                onClick={() => onBuscarCliente(contactoManual.email)}
                disabled={buscandoCliente || !contactoManual.email}>
                {buscandoCliente ? <span className={styles.spinnerInline} /> : 'Buscar'}
              </button>
            </div>
          </div>

          {clienteEncontrado && (
            <div className={clienteEncontrado.encontrado
              ? styles.clienteEncontrado : styles.clienteNoEncontrado}>
              {clienteEncontrado.encontrado
                ? `✅ Clienta encontrada: ${clienteEncontrado.cliente.nombre} — la cita se añadirá a su historial`
                : '⚠️ Sin perfil — la cita se guardará sin vincular a ninguna cuenta'}
            </div>
          )}

          <div className={styles.adminField}>
            <label className={styles.fieldLbl}>Teléfono (opcional)</label>
            <input className={styles.adminInput} type="tel"
              placeholder="+34 600 000 000"
              value={contactoManual.telefono}
              onChange={e => onContactoManual(p => ({ ...p, telefono: e.target.value }))} />
          </div>
        </div>
      )}

      {ausencias > 0 && !isAdmin && (
        <div className={styles.avisoAusencias}>
          ⚠️ Tienes {ausencias} ausencia{ausencias > 1 ? 's' : ''} sin justificar.
        </div>
      )}

      {/* Upload de fotos: obligatorio si requiereFotos, opcional para el admin */}
      {(isAdmin || servicio?.requiereFotos) && (
        <div className={styles.fotosWrap}>
          <p className={styles.fotosLabel}>
            {isAdmin
              ? '📷 Añadir fotos de referencia (opcional, máx. 2)'
              : '📎 Este servicio requiere foto de referencia (máx. 2 fotos)'}
          </p>
          <label className={styles.fotoUpload}>
            <input type="file" accept="image/*" multiple onChange={handleFotos} style={{ display: 'none' }} />
            {fotos.length === 0
              ? <span>Subir fotos de referencia</span>
              : <span>✅ {fotos.length} foto{fotos.length > 1 ? 's' : ''} seleccionada{fotos.length > 1 ? 's' : ''}</span>}
          </label>
        </div>
      )}

      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.navBtns}>
        <button className={styles.btnBack} onClick={onBack} disabled={loading}>← Volver</button>
        <button className={styles.btnConfirmar} onClick={onConfirmar} disabled={loading}>
          {loading ? <span className={styles.spinnerInline} /> : 'CONFIRMAR CITA'}
        </button>
      </div>
    </div>
  )
}

// ── Paso 5: Éxito ──────────────────────────────────────────────────────────
function PasoExito({ servicio, fecha, hora, reservaId, onNueva }) {
  return (
    <div className={styles.exitoWrap}>
      <div className={styles.exitoIcon}>✨</div>
      <h2 className={styles.exitoTitle}>¡Cita confirmada!</h2>
      <p className={styles.exitoDesc}>Te hemos enviado un email de confirmación con todos los detalles.</p>
      <div className={styles.resumenBox}>
        <div className={styles.resumenFila}><span>Servicio</span><strong>{servicio?.nombre}</strong></div>
        <div className={styles.resumenFila}><span>Fecha</span><strong>{formatearFecha(fecha)}</strong></div>
        <div className={styles.resumenFila}><span>Hora</span><strong>{hora?.horaInicio}</strong></div>
        {reservaId && <div className={styles.resumenFila}><span>Referencia</span><strong className={styles.reservaId}>{reservaId}</strong></div>}
      </div>
      <p className={styles.exitoNota}>Si necesitas cancelar, hazlo con al menos 24h de antelación desde "Mis citas".</p>
      <button className={styles.btnNueva} onClick={onNueva}>Hacer otra reserva</button>
    </div>
  )
}

// ── Fallbacks (cuando la API no está disponible) ───────────────────────────
const SERVICIOS_FALLBACK = [
  { servicioId: '1', nombre: 'Manicura Clásica',   descripcion: 'Lima, cutícula y esmaltado.',     precio: 18, duracion: 45,  precioVariable: false },
  { servicioId: '2', nombre: 'Semipermanente',      descripcion: 'Duración hasta 3 semanas.',       precio: 28, duracion: 60,  precioVariable: false },
  { servicioId: '3', nombre: 'Nail Art',            descripcion: 'Diseño personalizado.',           precio: 45, duracion: 90,  precioVariable: true, requiereFotos: true },
  { servicioId: '4', nombre: 'Acrílicas Completas', descripcion: 'Esculpido con acrílico premium.', precio: 65, duracion: 120, precioVariable: true, requiereFotos: true },
  { servicioId: '5', nombre: 'Relleno Acrílicas',   descripcion: 'Mantenimiento cada 3-4 semanas.', precio: 40, duracion: 90,  precioVariable: false },
  { servicioId: '6', nombre: 'Retirada',            descripcion: 'Retirada profesional sin daño.',  precio: 15, duracion: 30,  precioVariable: false },
]
const HUECOS_FALLBACK = [
  { horaInicio: '10:00', disponible: true },
  { horaInicio: '10:30', disponible: true },
  { horaInicio: '11:00', disponible: true },
  { horaInicio: '16:00', disponible: true },
]