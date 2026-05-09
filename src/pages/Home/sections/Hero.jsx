import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../../context/AuthContext'
import styles from './Hero.module.css'
import SmokeCanvas from '../../../components/SmokeCanvas/SmokeCanvas'

export default function Hero({ onLoginClick }) {
  const { user } = useAuth()
  const navigate = useNavigate()

  // Si hay sesión activa va directo a reservar; si no, abre el modal de login
  const handleReservar = () => {
    if (user) navigate('/reservar')
    else onLoginClick?.()
  }

  return (
    <section className={styles.hero}>
      {/* Canvas de humo animado — se renderiza detrás del contenido via CSS */}
      <SmokeCanvas className={styles.smokeCanvas} />

      <div className={styles.inner}>
        <div className={styles.content}>
          <img
            src="/logo-text2.png"
            alt="UñaPezuña"
            className={styles.logoText}
            draggable="false"
          />
          <div className={styles.actions}>
            <button className={styles.ctaBtn} onClick={handleReservar}>
              RESERVAR CITA <span className={styles.arrow}>→</span>
            </button>
          </div>
        </div>

        <div className={styles.imageCol}>
          <img
            src="/claw-halo.png"
            alt="Uñas con halo dorado"
            className={styles.clawImg}
            draggable="false"
          />
        </div>
      </div>

      {/* Indicador visual de scroll */}
      <div className={styles.scrollHint}>
        <div className={styles.scrollLine} />
      </div>
    </section>
  )
}