import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import styles from './Navbar.module.css'

// TODO: /servicios, /disenos y /contacto no tienen Route definida en App.jsx
const NAV_LINKS = [
  { label: 'INICIO',    to: '/' },
  { label: 'SOBRE MÍ', to: '/sobre-mi' },
  { label: 'SERVICIOS', to: '/#servicios' },
  { label: 'DISEÑOS',  to: '/disenos' },
  { label: 'CONTACTO', to: '/contacto' },
]

const IconInstagram = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="17.5" cy="6.5" r="0.6" fill="currentColor" stroke="none" />
  </svg>
)

const IconWhatsApp = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
)

export default function Navbar({ onLoginClick }) {
  const [scrolled,  setScrolled]  = useState(false)
  const [menuOpen,  setMenuOpen]  = useState(false)
  const location                  = useLocation()
  const { user, logout, isAdmin } = useAuth()

  // Cambia el estilo de la navbar al hacer scroll
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Cierra el menú móvil al navegar a otra página
  useEffect(() => setMenuOpen(false), [location.pathname])

  return (
    <>
      {/* Barra dorada superior decorativa */}
      <div className={styles.topBar}>
        <span className={styles.topBarLine} />
        <span className={styles.topBarDot}>+</span>
        <span className={styles.topBarText}>NAILS SIN REGLAS</span>
        <span className={styles.topBarDot}>+</span>
        <span className={styles.topBarLine} />
      </div>

      <nav className={`${styles.navbar} ${scrolled ? styles.scrolled : ''}`}>
        <div className={styles.inner}>
          <Link to="/" className={styles.logo}>
            <img src="/logo-navbar-transparente.png" alt="UñaPezuña" className={styles.logoImg} />
          </Link>

          {/* Links de navegación — desktop */}
          <ul className={styles.navLinks}>
            {NAV_LINKS.map(({ label, to }) => {
              // Si el link es un hash (#), usamos <a> normal en vez de <Link>
              if (to.includes('#')) {
                return (
                  <li key={to}>
                    <a
                      href={to}
                      className={styles.navLink}
                      onClick={(e) => {
                        e.preventDefault()
                        const id = to.split('#')[1]
                        const el = document.getElementById(id)
                        if (el) el.scrollIntoView({ behavior: 'smooth' })
                        else window.location.href = to
                      }}
                    >
                      {label}
                    </a>
                  </li>
                )
              }
              return (
                <li key={to}>
                  <Link
                    to={to}
                    className={`${styles.navLink} ${location.pathname === to ? styles.active : ''}`}
                  >
                    {label}
                  </Link>
                </li>
              )
            })}
          </ul>

          <div className={styles.navRight}>
            {/* Si hay sesión: muestra nombre, acceso a citas/admin y botón de salir */}
            {user ? (
              <div className={styles.userMenu}>
                <span className={styles.userName}>{isAdmin ? '👑 ' : ''}{user.name?.split(' ')[0]}</span>
                {!isAdmin && <Link to="/mis-citas" className={styles.adminLink}>MIS CITAS</Link>}
                {isAdmin  && <Link to="/admin"     className={styles.adminLink}>ADMIN</Link>}
                <button className={styles.logoutBtn} onClick={logout}>Salir</button>
              </div>
            ) : (
              <button className={styles.ctaBtn} onClick={() => onLoginClick?.()}>
                RESERVAR CITA
              </button>
            )}

            {/* TODO: reemplazar con el número real de WhatsApp */}
            <div className={styles.socials}>
              <a href="https://instagram.com/unapezuna" target="_blank" rel="noopener noreferrer" className={styles.socialIcon} aria-label="Instagram"><IconInstagram /></a>
              <a href="https://wa.me/34600123456"        target="_blank" rel="noopener noreferrer" className={styles.socialIcon} aria-label="WhatsApp"><IconWhatsApp /></a>
            </div>

            {/* Botón hamburguesa — solo visible en móvil */}
            <button
              className={`${styles.hamburger} ${menuOpen ? styles.open : ''}`}
              onClick={() => setMenuOpen(v => !v)}
              aria-label="Menú"
            >
              <span /><span /><span />
            </button>
          </div>
        </div>
      </nav>

      {/* Menú móvil desplegable */}
      <div className={`${styles.mobileMenu} ${menuOpen ? styles.mobileOpen : ''}`}>
        {NAV_LINKS.map(({ label, to }) => (
          <Link key={to} to={to} className={styles.mobileLink}>{label}</Link>
        ))}
        {user ? (
          <>
            <span className={styles.mobileUser}>{user.name?.split(' ')[0]}</span>
            {isAdmin && <Link to="/admin" className={styles.mobileLink}>PANEL ADMIN</Link>}
            <button className={styles.mobileCta} onClick={logout}>CERRAR SESIÓN</button>
          </>
        ) : (
          <button className={styles.mobileCta} onClick={() => { setMenuOpen(false); onLoginClick?.() }}>
            RESERVAR CITA
          </button>
        )}
        <div className={styles.mobileSocials}>
          <a href="https://instagram.com/unapezuna" target="_blank" rel="noopener noreferrer"><IconInstagram /></a>
          <a href="https://wa.me/34600123456"        target="_blank" rel="noopener noreferrer"><IconWhatsApp /></a>
        </div>
      </div>

      {/* Overlay oscuro detrás del menú móvil */}
      {menuOpen && <div className={styles.overlay} onClick={() => setMenuOpen(false)} />}
    </>
  )
}