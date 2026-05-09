import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import styles from './SobreMi.module.css'

// ── Contador de uñas ──────────────────────────────────────────────────────
// Simula un contador creciente basado en la fecha de apertura del negocio.
// Arranca en NUMERO_INICIAL y suma INCREMENTO_DIARIO por cada día transcurrido.
const FECHA_INICIO       = new Date('2026-05-04')
const NUMERO_INICIAL     = 50
const INCREMENTO_DIARIO  = 3

function calcularUnas() {
  const hoy  = new Date()
  const dias = Math.floor((hoy - FECHA_INICIO) / (1000 * 60 * 60 * 24))
  return NUMERO_INICIAL + Math.max(0, dias) * INCREMENTO_DIARIO
}

// Anima un número de 0 hasta 'objetivo' en 'duracion' ms con easing cúbico
function useContador(objetivo, duracion = 1800) {
  const [valor, setValor] = useState(0)
  const rafRef = useRef(null)

  useEffect(() => {
    const inicio = performance.now()
    const animar = (ahora) => {
      const progreso = Math.min((ahora - inicio) / duracion, 1)
      const ease     = 1 - Math.pow(1 - progreso, 3) // easeOutCubic
      setValor(Math.floor(ease * objetivo))
      if (progreso < 1) rafRef.current = requestAnimationFrame(animar)
    }
    rafRef.current = requestAnimationFrame(animar)
    return () => cancelAnimationFrame(rafRef.current)
  }, [objetivo, duracion])

  return valor
}

// ── Componente principal ──────────────────────────────────────────────────
export default function SobreMi() {
  const navigate   = useNavigate()
  const totalUnas  = calcularUnas()
  const contadorUI = useContador(totalUnas)

  // Activa la animación de entrada de los valores cuando la sección es visible
  const secRef = useRef(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true) },
      { threshold: 0.15 }
    )
    if (secRef.current) obs.observe(secRef.current)
    return () => obs.disconnect()
  }, [])

  return (
    <div className={styles.page}>

      {/* ── Hero ── */}
      <section className={styles.hero}>
        <div className={styles.heroBg} />
        <div className={styles.heroInner}>
          <span className={styles.overline}>Sobre mí</span>
          <h1 className={styles.headline}>
            ESTO NO ES<br />
            <em className={styles.headlineEm}>un salón de uñas.</em>
          </h1>
        </div>
      </section>

      {/* ── Texto principal ── */}
      <section className={styles.textoSection}>
        <div className={styles.inner}>
          <div className={styles.textoCols}>
            <div className={styles.textoBloque}>
              <p className={styles.parrafo}>
                Es el sitio donde traes esa foto que llevas semanas guardando en el móvil
                y te digo <span className={styles.highlight}>"sí, lo hacemos"</span> en vez
                de "eso es muy complicado".
              </p>
              <p className={styles.parrafo}>
                Manicurista en Madrid. Trabajo sola, con cita, y con toda la atención puesta
                en ti. Sin listas de espera, sin prisas, sin diseños de catálogo si no los quieres.
              </p>
              <p className={styles.parrafo}>
                Me formé porque me obsesioné. Sigo formándome porque el mundo de las uñas
                no para. Y atiendo como me gustaría que me atendieran a mí: con honestidad,
                sin humo, y con ganas de que salgas con algo que te quite el aliento.
              </p>
              <p className={`${styles.parrafo} ${styles.parrafoCierre}`}>
                Las reglas del nail art son sugerencias.
              </p>
            </div>

            {/* Contador animado — número crece desde 0 al valor calculado */}
            <div className={styles.contadorWrap}>
              <div className={styles.contadorNum}>{contadorUI.toLocaleString('es-ES')}</div>
              <div className={styles.contadorLabel}>uñas pintadas<br />desde que abrí</div>
              <div className={styles.contadorLinea} />
            </div>
          </div>
        </div>
      </section>

      {/* ── Valores — se animan al entrar en viewport ── */}
      <section className={styles.valoresSection} ref={secRef}>
        <div className={styles.inner}>
          <span className={styles.sectionLabel}>Lo que me define</span>
          <div className={`${styles.valoresGrid} ${visible ? styles.valoresVisible : ''}`}>
            {[
              { palabra: 'HONESTA',  desc: 'Si tu idea no va a quedar bien, te lo digo antes.' },
              { palabra: 'OBSESIVA', desc: 'Con los detalles, con los materiales, con que dure.' },
              { palabra: 'TUYA',     desc: 'Cada cita es diferente porque tú eres diferente.' },
            ].map(({ palabra, desc }, i) => (
              <div key={palabra} className={styles.valorCard} style={{ '--delay': `${i * 0.15}s` }}>
                <span className={styles.valorNum}>0{i + 1}</span>
                <h3 className={styles.valorPalabra}>{palabra}</h3>
                <p className={styles.valorDesc}>{desc}</p>
                <div className={styles.valorLinea} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA final ── */}
      <section className={styles.ctaSection}>
        <div className={styles.inner}>
          <p className={styles.ctaPregunta}>¿Tienes la foto guardada?</p>
          <button className={styles.ctaBtn} onClick={() => navigate('/reservar')}>
            RESERVAR CITA <span className={styles.ctaArrow}>→</span>
          </button>
        </div>
      </section>

    </div>
  )
}