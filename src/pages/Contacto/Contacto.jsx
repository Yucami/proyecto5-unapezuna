import styles from './Contacto.module.css'

export default function Contacto() {
  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <span className={styles.label}>Encuéntrame</span>
        <h1 className={styles.title}>CONTACTO</h1>
        <div className={styles.datos}>
          <div className={styles.dato}>
            <span className={styles.datoIcon}>📍</span>
            <span className={styles.datoText}>Madrid, zona norte</span>
          </div>
          <div className={styles.dato}>
            <span className={styles.datoIcon}>✉</span>
            <a href="mailto:reservas@unapezuna.es" className={styles.datoLink}>
              reservas@unapezuna.es
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}