import styles from './Disenos.module.css'

export default function Disenos() {
  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <span className={styles.label}>Galería</span>
        <h1 className={styles.title}>DISEÑOS</h1>
        <p className={styles.soon}>Próximamente</p>
        <p className={styles.desc}>Galería de trabajos reales. Cada uña, una historia.</p>
      </div>
    </div>
  )
}