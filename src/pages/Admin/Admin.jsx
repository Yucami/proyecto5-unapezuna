import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import styles from './Admin.module.css'

const API_URL = import.meta.env.VITE_API_URL

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
function formatFecha(fechaStr) {
  if (!fechaStr) return ''
  return new Date(fechaStr + 'T12:00:00')
    .toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

// ── Admin ──────────────────────────────────────────────────────────────────
export default function Admin() {
  const { user, isAdmin, loading: authLoading } = useAuth()
  const navigate = useNavigate()

  // Redirige a home si el usuario no está autenticado o no es admin
  useEffect(() => {
    if (!authLoading && (!user || !isAdmin)) navigate('/')
  }, [user, isAdmin, authLoading, navigate])

  if (authLoading) return <div className={styles.loading}><div className={styles.spinner} /></div>

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <div className={styles.header}>
          <span className={styles.label}>Panel de administración</span>
          <h1 className={styles.title}>ADMIN</h1>
          <p className={styles.subtitle}>Bienvenida, {user?.name?.split(' ')[0]} 👑</p>
        </div>
        <TabCalendario user={user} />
      </div>
    </div>
  )
}

// ── TabCalendario ──────────────────────────────────────────────────────────
function TabCalendario({ user }) {
  const navigate = useNavigate()
  const hoyDate = new Date()
  const hoyStr  = `${hoyDate.getFullYear()}-${String(hoyDate.getMonth()+1).padStart(2,'0')}-${String(hoyDate.getDate()).padStart(2,'0')}`

  const [año,          setAño]          = useState(hoyDate.getFullYear())
  const [mes,          setMes]          = useState(hoyDate.getMonth())
  const [dispoMes,     setDispoMes]     = useState({})
  const [loadingMes,   setLoadingMes]   = useState(false)
  const [statsMes,     setStatsMes]     = useState(null)
  const [fechaSel,     setFechaSel]     = useState(null)
  const [huecosDia,    setHuecosDia]    = useState([])
  const [loadingCitas, setLoadingCitas] = useState(false)
  const [clienteModal, setClienteModal] = useState(null)
  const [loadingHist,  setLoadingHist]  = useState(false)
  const [errorPanel,   setErrorPanel]   = useState('')

  // Estado del formulario inline para crear huecos
  const [mostrarCrear, setMostrarCrear] = useState(false)
  const [horaInicio,   setHoraInicio]   = useState('10:00')
  const [horaFin,      setHoraFin]      = useState('20:00')
  const [creando,      setCreando]      = useState(false)
  const [msgCrear,     setMsgCrear]     = useState(null) // { ok, texto }

  // horaInicio del hueco que se está bloqueando en este momento (para el spinner)
  const [bloqueando, setBloqueando] = useState(null)

  // ── Carga disponibilidad del mes (colores del calendario) ──
  const cargarMes = async (a, m) => {
    if (!API_URL) return
    setDispoMes({})
    setLoadingMes(true)
    try {
      const mStr = `${a}-${String(m + 1).padStart(2, '0')}`
      const r    = await fetch(`${API_URL}/disponibilidad/mes?mes=${mStr}`)
      const d    = await r.json()
      // Convertimos el array a un mapa { fecha: { total, disponibles } } para acceso O(1)
      const mapa = {}
      ;(d.dias || []).forEach(x => { mapa[x.fecha] = x })
      setDispoMes(mapa)
      setStatsMes(d.stats || null)
    } catch { /* si falla, los días se quedan sin color (gris) */ }
    finally { setLoadingMes(false) }
  }

  useEffect(() => { cargarMes(año, mes) }, [año, mes])

  // ── Abre el panel de un día: fusiona huecos de disponibilidad + citas ──
  const abrirDia = async (f) => {
    // Si se hace click en el día ya seleccionado, cierra el panel
    if (fechaSel === f) {
      setFechaSel(null); setHuecosDia([])
      setMostrarCrear(false); setMsgCrear(null)
      return
    }
    setFechaSel(f); setHuecosDia([])
    setMostrarCrear(false); setMsgCrear(null)
    setErrorPanel(''); setLoadingCitas(true)
    try {
      // Pedimos en paralelo: huecos del día + citas del día
      const [rHuecos, rCitas] = await Promise.all([
        fetch(`${API_URL}/disponibilidad?fecha=${f}&admin=true`, {
          headers: { Authorization: `Bearer ${user.token}` }
        }),
        fetch(`${API_URL}/admin?fecha=${f}`, {
          headers: { Authorization: `Bearer ${user.token}` }
        })
      ])
      const dHuecos = await rHuecos.json()
      const dCitas  = await rCitas.json()

      const listaHuecos = Array.isArray(dHuecos) ? dHuecos
        : (dHuecos.huecos || dHuecos.disponibilidad || [])
      const listaCitas  = Array.isArray(dCitas) ? dCitas
        : (dCitas.citas || dCitas.reservas || [])

      // Índice de citas por horaInicio para cruzar con los huecos
      const citasPorHora = {}
      listaCitas.forEach(c => { citasPorHora[c.horaInicio] = c })

      // Fusión: enriquecemos cada hueco con su reserva (si la tiene)
      const fusionados = listaHuecos.map(h => ({
        ...h,
        reserva: citasPorHora[h.horaInicio] || null
      }))

      // Caso especial: citas cuyo hueco ya no aparece en disponibilidad (slot ocupado)
      // Las añadimos igualmente para que el admin las vea
      const horasConHueco = new Set(listaHuecos.map(h => h.horaInicio))
      listaCitas.forEach(c => {
        if (!horasConHueco.has(c.horaInicio)) {
          fusionados.push({
            horaInicio: c.horaInicio,
            disponible: false,
            reservado:  true,
            reserva:    c
          })
        }
      })

      fusionados.sort((a, b) => (a.horaInicio || '').localeCompare(b.horaInicio || ''))
      setHuecosDia(fusionados)
    } catch { setErrorPanel('No se pudieron cargar los huecos.') }
    finally { setLoadingCitas(false) }
  }

  // ── Crear huecos de 30 en 30 min para el día seleccionado ──
  const crearHuecos = async () => {
    setCreando(true); setMsgCrear(null)
    try {
      const res  = await fetch(`${API_URL}/disponibilidad`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.token}` },
        body:    JSON.stringify({ fecha: fechaSel, horaInicio, horaFin })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || data.message || 'Error al crear huecos')
      setMsgCrear({ ok: true, texto: data.mensaje || `Huecos creados para ${fechaSel}` })
      setMostrarCrear(false)
      // Recargamos el panel del día y el calendario para reflejar los nuevos huecos
      await Promise.all([abrirDia(fechaSel), cargarMes(año, mes)])
    } catch (err) {
      setMsgCrear({ ok: false, texto: err.message })
    } finally { setCreando(false) }
  }

  // ── Bloquear un hueco (actualización optimista: no espera a recargar) ──
  const bloquearHueco = async (hora) => {
    setBloqueando(hora)
    try {
      const res  = await fetch(`${API_URL}/disponibilidad/bloquear`, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.token}` },
        body:    JSON.stringify({ fecha: fechaSel, horaInicio: hora })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || data.message || 'Error al bloquear')

      // Actualización optimista: modificamos el estado local sin recargar la API
      setHuecosDia(prev => prev.map(h =>
        h.horaInicio === hora
          ? { ...h, disponible: false, bloqueadoPorAdmin: true, reserva: null }
          : h
      ))
      // Actualizamos también el contador del mes en el calendario
      setDispoMes(prev => {
        const actual = prev[fechaSel] || { total: 0, disponibles: 0 }
        return {
          ...prev,
          [fechaSel]: { ...actual, disponibles: Math.max(0, actual.disponibles - 1) }
        }
      })
    } catch (err) { setErrorPanel(err.message) }
    finally { setBloqueando(null) }
  }

  // ── Historial completo de una clienta ──
  const verHistorial = async (clienteId) => {
    if (!clienteId || loadingHist) return
    setLoadingHist(true); setErrorPanel('')
    try {
      const r = await fetch(`${API_URL}/admin/cliente?clienteId=${clienteId}`, {
        headers: { Authorization: `Bearer ${user.token}` }
      })
      if (!r.ok) throw new Error()
      setClienteModal(await r.json())
    } catch { setErrorPanel('No se pudo cargar el historial.') }
    finally { setLoadingHist(false) }
  }

  // ── Navegación mensual ──
  const prevMes = () => {
    cerrarPanel()
    if (mes === 0) { setAño(a => a - 1); setMes(11) } else { setMes(m => m - 1) }
  }
  const nextMes = () => {
    cerrarPanel()
    if (mes === 11) { setAño(a => a + 1); setMes(0) } else { setMes(m => m + 1) }
  }
  const cerrarPanel = () => {
    setFechaSel(null); setHuecosDia([])
    setMostrarCrear(false); setMsgCrear(null); setErrorPanel('')
  }

  // Construimos la grilla del mes con celdas vacías para el offset del primer día
  const offset = primerDiaSem(año, mes)
  const total  = diasEnMes(año, mes)
  const celdas = [
    ...Array(offset).fill(null),
    ...Array.from({ length: total }, (_, i) => i + 1)
  ]

  // Contadores para el resumen del panel del día
  const nLibres = huecosDia.filter(h => h.disponible).length
  const nReserv = huecosDia.filter(h => !h.disponible && h.reserva).length
  const nBloq   = huecosDia.filter(h => !h.disponible && !h.reserva).length

  return (
    <div className={styles.tabContent}>

      {/* ── Cabecera del mes ── */}
      <div className={styles.calHeader}>
        <button className={styles.calNav} onClick={prevMes}>←</button>
        <span className={styles.calMes}>
          {mesLabel(año, mes)}
          {loadingMes && <span className={styles.calSpinner} />}
        </span>
        <button className={styles.calNav} onClick={nextMes}>→</button>
      </div>

      {/* ── Estadísticas del mes ── */}
      {statsMes && (
        <div className={styles.statsMes}>
          {[
            { n: statsMes.completadas, lbl: 'Completadas', cls: styles.statDorado  },
            { n: statsMes.pendientes,  lbl: 'Pendientes',  cls: styles.statGris    },
            { n: statsMes.canceladas,  lbl: 'Canceladas',  cls: styles.statRojo    },
            { n: statsMes.perdidos,    lbl: 'Sin ocupar',  cls: styles.statApagado },
            { n: statsMes.bloqueados,  lbl: 'Bloqueados',  cls: styles.statApagado },
          ].map(({ n, lbl, cls }) => (
            <div key={lbl} className={styles.statMesBox}>
              <span className={`${styles.statMesNum} ${cls}`}>{n}</span>
              <span className={styles.statMesLbl}>{lbl}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Leyenda de colores ── */}
      <div className={styles.leyenda}>
        <span className={styles.leyItem}><i className={`${styles.leyDot} ${styles.dotVerde}`} />Huecos libres</span>
        <span className={styles.leyItem}><i className={`${styles.leyDot} ${styles.dotRojo}`}  />Completo</span>
        <span className={styles.leyItem}><i className={`${styles.leyDot} ${styles.dotGris}`}  />Sin agenda</span>
      </div>

      {/* ── Grilla del calendario ── */}
      <div className={styles.calGrid}>
        {DIAS_SEM.map(d => <div key={d} className={styles.calDiaSem}>{d}</div>)}
        {celdas.map((d, i) => {
          if (!d) return <div key={`v-${i}`} />
          const f        = `${año}-${String(mes + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
          const info     = dispoMes[f]
          const hayAg    = (info?.total ?? 0) > 0
          const hayLib   = (info?.disponibles ?? 0) > 0
          const pasado   = f < hoyStr
          const esHoy    = f === hoyStr
          const sel      = f === fechaSel
          const colorCls = hayAg ? (hayLib ? styles.diaVerde : styles.diaRojo) : ''

          return (
            <button key={f}
              className={[
                styles.calDia,
                colorCls,
                pasado && !esHoy ? styles.diaPasado : '',
                esHoy  ? styles.diaHoy  : '',
                sel    ? styles.diaSel  : '',
              ].filter(Boolean).join(' ')}
              onClick={() => abrirDia(f)}
              title={hayAg
                ? `${info.disponibles} libre${info.disponibles !== 1 ? 's' : ''} de ${info.total}`
                : 'Sin agenda — click para añadir huecos'}
            >
              <span className={styles.calNum}>{d}</span>
              {hayAg && <span className={styles.calCount}>{info.disponibles}/{info.total}</span>}
            </button>
          )
        })}
      </div>

      {/* ── Panel del día seleccionado ── */}
      {fechaSel && (
        <div className={styles.panelCitas}>

          <div className={styles.panelHead}>
            <div className={styles.panelHeadLeft}>
              <h3 className={styles.panelTit}>{formatFecha(fechaSel)}</h3>
              {!loadingCitas && huecosDia.length > 0 && (
                <div className={styles.panelResumen}>
                  <span className={styles.resumenLibre}>{nLibres} libre{nLibres !== 1 ? 's' : ''}</span>
                  <span className={styles.resumenSep}>·</span>
                  <span className={styles.resumenOcup}>{nReserv} reservado{nReserv !== 1 ? 's' : ''}</span>
                  {nBloq > 0 && <>
                    <span className={styles.resumenSep}>·</span>
                    <span className={styles.resumenBloq}>{nBloq} bloqueado{nBloq !== 1 ? 's' : ''}</span>
                  </>}
                </div>
              )}
            </div>
            <div className={styles.panelHeadRight}>
              <button
                className={styles.btnCrearHuecos}
                onClick={() => { setMostrarCrear(v => !v); setMsgCrear(null) }}
              >
                {mostrarCrear ? 'Cancelar' : '+ Añadir huecos'}
              </button>
              <button className={styles.panelClose} onClick={cerrarPanel}>✕</button>
            </div>
          </div>

          {/* Formulario inline para crear huecos en el día seleccionado */}
          {mostrarCrear && (
            <div className={styles.crearForm}>
              <p className={styles.crearDesc}>
                Crear huecos de 30 en 30 min para <strong>{formatFecha(fechaSel)}</strong>
              </p>
              <div className={styles.crearFields}>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Hora inicio</label>
                  <input type="time" className={styles.dateInput} value={horaInicio}
                    step="1800" onChange={e => setHoraInicio(e.target.value)} />
                </div>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Hora fin</label>
                  <input type="time" className={styles.dateInput} value={horaFin}
                    step="1800" onChange={e => setHoraFin(e.target.value)} />
                </div>
                <button className={styles.btnAccion} onClick={crearHuecos} disabled={creando}>
                  {creando ? <span className={styles.spinnerInline} /> : 'CREAR'}
                </button>
              </div>
            </div>
          )}

          {msgCrear && (
            <div className={msgCrear.ok ? styles.exito : styles.error} style={{ margin: '0 24px 16px' }}>
              {msgCrear.ok ? '✅ ' : '⚠️ '}{msgCrear.texto}
            </div>
          )}

          {(loadingCitas || loadingHist) && <div className={styles.spinnerSm} />}
          {errorPanel && <p className={styles.error} style={{ margin: '0 24px 16px' }}>{errorPanel}</p>}

          {!loadingCitas && !errorPanel && huecosDia.length === 0 && (
            <p className={styles.vacio}>
              Sin huecos para este día. Usa el botón <em>"+ Añadir huecos"</em> para crearlos.
            </p>
          )}

          {/* Lista de huecos del día */}
          {!loadingCitas && huecosDia.length > 0 && (
            <div className={styles.citasList}>
              {huecosDia.map(h => {
                const reserva   = h.reserva
                const libre     = h.disponible === true
                const bloqueado = !h.disponible && !reserva
                const estado    = reserva ? (reserva.estado || '').toLowerCase() : null

                return (
                  <div key={h.horaInicio}
                    className={[
                      styles.citaRow,
                      libre     ? styles.huecLibre  : '',
                      bloqueado ? styles.huecBloq   : '',
                      reserva   ? styles.huecReserv : '',
                    ].filter(Boolean).join(' ')}
                    onClick={() => reserva?.clienteId && verHistorial(reserva.clienteId)}
                    style={{ cursor: reserva?.clienteId ? 'pointer' : 'default' }}
                  >
                    <div className={styles.citaHora}>{h.horaInicio}</div>

                    <div className={styles.citaInfo}>
                      {libre     && <strong className={styles.libreLabel}>Disponible</strong>}
                      {bloqueado && <strong className={styles.bloqLabel}>Bloqueado por admin</strong>}
                      {reserva   && (
                        <>
                          <strong>{reserva.nombre || reserva.nombreCliente || '—'}</strong>
                          <span>{reserva.nombreServicio}</span>
                          <span className={styles.citaEmail}>{reserva.email}</span>
                        </>
                      )}
                    </div>

                    <div className={styles.citaDerecha}>
                      {libre && (
                        <>
                          <span className={styles.badgeLibre}>LIBRE</span>
                          <button
                            className={styles.btnRegistrarInline}
                            onClick={e => {
                              e.stopPropagation()
                              // Navega a Reservar con fecha y hora preseleccionadas
                              navigate('/reservar', {
                                state: { fechaPresel: fechaSel, horaPresel: h.horaInicio }
                              })
                            }}
                            title="Registrar cita para este hueco"
                          >
                            + Cita
                          </button>
                          <button
                            className={styles.btnBloquearInline}
                            onClick={e => { e.stopPropagation(); bloquearHueco(h.horaInicio) }}
                            disabled={bloqueando === h.horaInicio}
                            title="Bloquear este hueco"
                          >
                            {bloqueando === h.horaInicio
                              ? <span className={styles.spinnerInline} />
                              : 'Bloquear'}
                          </button>
                        </>
                      )}
                      {bloqueado && <span className={styles.badgeBloq}>BLOQ.</span>}
                      {reserva   && (
                        <>
                          <span className={`${styles.badge} ${styles[estado] || ''}`}>{reserva.estado}</span>
                          {reserva.clienteId && <span className={styles.citaArrow}>→</span>}
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Modal de historial de clienta */}
      {clienteModal && (
        <ModalHistorial data={clienteModal} onCerrar={() => setClienteModal(null)} user={user} />
      )}
    </div>
  )
}


// ── ModalHistorial ─────────────────────────────────────────────────────────
function ModalHistorial({ data, onCerrar, user }) {
  const { cliente = {}, reservas = [], totalReservas = 0 } = data

  // sinPerfil: la clienta tiene reservas pero no tiene cuenta en Cognito
  // (reserva registrada manualmente por el admin)
  const sinPerfil      = reservas.some(r => r.sinPerfil)
  const primeraRes     = reservas[0] || {}
  const nombreMostrar  = cliente.nombre   || primeraRes.nombreCliente  || '—'
  const emailMostrar   = cliente.email    || primeraRes.emailCliente   || ''
  const telefonMostrar = cliente.telefono || primeraRes.telefonoManual || ''
  const clienteId      = primeraRes.clienteId || ''

  const completadas = reservas.filter(r => r.estado?.toUpperCase() === 'COMPLETADA').length
  const canceladas  = reservas.filter(r => r.estado?.toUpperCase() === 'CANCELADA').length

  // Mapa de fotos por reservaId — se inicializa con las fotos que ya vienen en la respuesta
  const [fotosMap,     setFotosMap]     = useState(() => {
    const m = {}
    reservas.forEach(r => { if (r.fotos?.length) m[r.reservaId] = r.fotos })
    return m
  })
  const [subiendo,     setSubiendo]     = useState(null) // reservaId de la foto en curso
  const [errorFoto,    setErrorFoto]    = useState(null)
  const [editando,     setEditando]     = useState(false)
  const [editNombre,   setEditNombre]   = useState(nombreMostrar === '—' ? '' : nombreMostrar)
  const [editEmail,    setEditEmail]    = useState(emailMostrar)
  const [editTelefono, setEditTelefono] = useState(telefonMostrar)
  const [guardando,    setGuardando]    = useState(false)
  const [msgEdicion,   setMsgEdicion]   = useState(null)

  const guardarContacto = async () => {
    setGuardando(true); setMsgEdicion(null)
    try {
      const res = await fetch(`${API_URL}/admin/contacto`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.token}` },
        body:    JSON.stringify({ clienteId, nombre: editNombre, email: editEmail, telefono: editTelefono })
      })
      if (!res.ok) throw new Error('Error al guardar')
      setMsgEdicion({ ok: true, texto: 'Datos actualizados correctamente' })
      setEditando(false)
    } catch (err) {
      setMsgEdicion({ ok: false, texto: err.message })
    } finally { setGuardando(false) }
  }

  // Subida de foto en 3 pasos:
  // 1. Pide una presigned URL a la API (Lambda genera la URL de S3)
  // 2. Sube el archivo directamente a S3 con PUT (sin pasar por Lambda)
  // 3. Guarda la referencia (s3Key) en DynamoDB a través de la API
  const subirFoto = async (reservaId, clienteId, archivo) => {
    setSubiendo(reservaId); setErrorFoto(null)
    try {
      const ext = archivo.name.split('.').pop().toLowerCase() || 'jpg'

      // Paso 1: obtener presigned URL
      const r1 = await fetch(`${API_URL}/admin/fotos/url`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.token}` },
        body:    JSON.stringify({ reservaId, clienteId, tipo: 'resultado', extension: ext })
      })
      if (!r1.ok) throw new Error('No se pudo obtener URL de subida')
      const { uploadUrl, s3Key } = await r1.json()

      // Paso 2: subir el archivo directamente a S3
      const r2 = await fetch(uploadUrl, {
        method:  'PUT',
        headers: { 'Content-Type': `image/${ext}` },
        body:    archivo
      })
      if (!r2.ok) throw new Error('Error al subir la imagen')

      // Paso 3: guardar la referencia en DynamoDB
      const r3 = await fetch(`${API_URL}/admin/fotos/guardar`, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.token}` },
        body:    JSON.stringify({ reservaId, clienteId, s3Key, tipo: 'resultado' })
      })
      if (!r3.ok) throw new Error('Error al guardar referencia')

      // Recargamos el historial de la clienta para mostrar la foto recién subida
      const r4 = await fetch(`${API_URL}/admin/cliente?clienteId=${clienteId}`, {
        headers: { Authorization: `Bearer ${user.token}` }
      })
      if (r4.ok) {
        const d = await r4.json()
        const m = {}
        ;(d.reservas || []).forEach(r => { if (r.fotos?.length) m[r.reservaId] = r.fotos })
        setFotosMap(m)
      }
    } catch (err) { setErrorFoto(err.message) }
    finally { setSubiendo(null) }
  }

  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onCerrar()}>
      <div className={styles.modal}>

        <div className={styles.modalHead}>
          <div className={styles.modalInfo}>
            <div className={styles.modalNombreRow}>
              <span className={styles.modalLbl}>
                {sinPerfil ? 'Clienta sin perfil' : 'Historial de clienta'}
              </span>
              {sinPerfil && <span className={styles.badgeSinPerfil}>SIN CUENTA</span>}
            </div>

            {!editando && (
              <>
                <h3 className={styles.modalNombre}>{nombreMostrar}</h3>
                <div className={styles.modalContacto}>
                  {emailMostrar   && <span>✉ {emailMostrar}</span>}
                  {telefonMostrar && <span>📞 {telefonMostrar}</span>}
                  {!emailMostrar && !telefonMostrar && (
                    <span className={styles.sinContacto}>Sin datos de contacto</span>
                  )}
                </div>
                <button className={styles.btnEditarContacto} onClick={() => setEditando(true)}>
                  ✏️ Editar datos
                </button>
              </>
            )}

            {editando && (
              <div className={styles.editContactoForm}>
                <input className={styles.editInput} type="text"
                  placeholder="Nombre" value={editNombre}
                  onChange={e => setEditNombre(e.target.value)} />
                <input className={styles.editInput} type="email"
                  placeholder="Email" value={editEmail}
                  onChange={e => setEditEmail(e.target.value)} />
                <input className={styles.editInput} type="tel"
                  placeholder="Teléfono" value={editTelefono}
                  onChange={e => setEditTelefono(e.target.value)} />
                <div className={styles.editBtns}>
                  <button className={styles.btnCancelarEdit}
                    onClick={() => { setEditando(false); setMsgEdicion(null) }}
                    disabled={guardando}>Cancelar</button>
                  <button className={styles.btnGuardarEdit}
                    onClick={guardarContacto} disabled={guardando}>
                    {guardando ? <span className={styles.spinnerInline} /> : 'Guardar'}
                  </button>
                </div>
                {msgEdicion && (
                  <p className={msgEdicion.ok ? styles.exitoMsg : styles.error}>
                    {msgEdicion.texto}
                  </p>
                )}
              </div>
            )}
          </div>
          <button className={styles.modalClose} onClick={onCerrar}>✕</button>
        </div>

        <div className={styles.modalStats}>
          {[
            [totalReservas, 'Total'],
            [completadas,   'Completadas'],
            [canceladas,    'Canceladas'],
            [cliente.ausenciasInjustificadas || 0, 'Ausencias'],
          ].map(([n, lbl]) => (
            <div key={lbl} className={styles.statBox}>
              <span className={`${styles.statNum} ${lbl === 'Ausencias' && n > 0 ? styles.statRojo : ''}`}>{n}</span>
              <span className={styles.statLbl}>{lbl}</span>
            </div>
          ))}
        </div>

        {errorFoto && (
          <p className={styles.error} style={{ margin: '0 28px 8px' }}>⚠️ {errorFoto}</p>
        )}

        <div className={styles.modalLista}>
          {reservas.length === 0 && <p className={styles.vacio}>Sin reservas registradas.</p>}
          {reservas.map(r => {
            const fotos        = fotosMap[r.reservaId] || []
            const completada   = r.estado?.toUpperCase() === 'COMPLETADA'
            const estaSubiendo = subiendo === r.reservaId

            return (
              <div key={r.reservaId} className={styles.modalRow}>
                <div className={styles.modalRowTop}>
                  <div className={styles.modalFecha}>
                    <span>{r.fecha}</span>
                    <span className={styles.modalHora}>{r.horaInicio}</span>
                  </div>
                  <div className={styles.modalSvc}>
                    <strong>{r.nombreServicio}</strong>
                    {r.precioFinal && <span>{r.precioFinal}€</span>}
                  </div>
                  <div className={styles.modalRowDerecha}>
                    <span className={`${styles.badge} ${styles[(r.estado || '').toLowerCase()]}`}>
                      {r.estado}
                    </span>
                    {/* Botón de subir foto solo disponible en reservas completadas */}
                    {completada && (
                      <label className={styles.btnSubirFoto} title="Subir foto resultado">
                        <input type="file" accept="image/*"
                          style={{ display: 'none' }}
                          disabled={estaSubiendo}
                          onChange={e => {
                            const archivo = e.target.files?.[0]
                            if (archivo) subirFoto(r.reservaId, r.clienteId, archivo)
                            e.target.value = ''
                          }} />
                        {estaSubiendo ? <span className={styles.spinnerInline} /> : '📷'}
                      </label>
                    )}
                  </div>
                </div>

                {fotos.length > 0 && (
                  <div className={styles.fotosRow}>
                    {fotos.map((f, idx) => (
                      <a key={idx} href={f.url} target="_blank" rel="noopener noreferrer"
                        className={styles.fotoThumb}>
                        <img src={f.url} alt={`foto ${idx + 1}`}
                          onError={e => { e.target.style.display = 'none' }} />
                      </a>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>

      </div>
    </div>
  )
}