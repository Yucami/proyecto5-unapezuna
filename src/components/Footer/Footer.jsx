import { Link } from 'react-router-dom'
import styles from './Footer.module.css'

export default function Footer() {
  return (
    <footer className={styles.footer}>

      <div className={styles.topDecor}>
        <span className={styles.star}>+</span>
        <span className={styles.brand}>© {new Date().getFullYear()} UÑA PEZUÑA NAILS</span>
        <span className={styles.star}>+</span>
        <span className={styles.slogan}>NAILS SIN REGLAS</span>
        <span className={styles.star}>+</span>
        <span className={styles.tagline}>HECHO CON ACTITUD</span>
        <span className={styles.star}>+</span>
      </div>

      <div className={styles.main}>
        <div className={styles.inner}>

          {/* Col 1: marca */}
          <div className={styles.col}>
            <div className={styles.logoBlock}>
              <span className={styles.logoUna}>UÑA</span>
              <span className={styles.logoPezuna}>Pezuña</span>
            </div>
            <p className={styles.taglineText}>Nails sin reglas.</p>
            <p className={styles.location}>Madrid · España</p>
          </div>

          {/* Col 2: navegación — TODO: /disenos y /contacto sin Route en App.jsx */}
          <div className={styles.col}>
            <h4 className={styles.colTitle}>Navegación</h4>
            <nav className={styles.footerNav}>
              <Link to="/">Inicio</Link>
              <Link to="/sobre-mi">Sobre mí</Link>
              <a
                href="/#servicios"
                onClick={(e) => {
                  e.preventDefault()
                  const el = document.getElementById('servicios')
                  if (el) el.scrollIntoView({ behavior: 'smooth' })
                  else window.location.href = '/#servicios'
                }}
              >
                Servicios
              </a>
              <Link to="/disenos">Diseños</Link>
              <Link to="/contacto">Contacto</Link>
            </nav>
          </div>

          {/* Col 3: servicios (estático, sin enlace) */}
          <div className={styles.col}>
            <h4 className={styles.colTitle}>Servicios</h4>
            <nav className={styles.footerNav}>
              <span>Manicura clásica</span>
              <span>Nail art</span>
              <span>Acrílicas</span>
              <span>Semipermanente</span>
            </nav>
          </div>

          {/* Col 4: contacto — TODO: reemplazar número real de WhatsApp */}
          <div className={styles.col}>
            <h4 className={styles.colTitle}>Contacto</h4>
            <nav className={styles.footerNav}>
              <a href="https://instagram.com/unapezuna" target="_blank" rel="noopener noreferrer">@unapezuna</a>
              <a href="mailto:reservas@unapezuna.es">reservas@unapezuna.es</a>              <span>Madrid, España</span>
            </nav>
            <Link to="/reservar" className={styles.footerCta}>
              Reservar cita →
            </Link>
          </div>

        </div>
      </div>
    </footer>
  )
}