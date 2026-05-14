import { useState } from 'react'
import styles from './Contacto.module.css'

const API_URL = import.meta.env.VITE_API_URL

export default function Contacto() {
  const [form, setForm]       = useState({ nombre: '', email: '', mensaje: '' })
  const [estado, setEstado]   = useState('') // '' | 'enviando' | 'ok' | 'error'

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setEstado('enviando')
    try {
      const res = await fetch(`${API_URL}/contacto`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      })
      if (res.ok) {
        setEstado('ok')
        setForm({ nombre: '', email: '', mensaje: '' })
      } else {
        setEstado('error')
      }
    } catch {
      setEstado('error')
    }
  }

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

        <form className={styles.form} onSubmit={handleSubmit}>
          <input
            type="text"
            name="nombre"
            placeholder="Tu nombre"
            value={form.nombre}
            onChange={handleChange}
            required
            className={styles.input}
          />
          <input
            type="email"
            name="email"
            placeholder="Tu email"
            value={form.email}
            onChange={handleChange}
            required
            className={styles.input}
          />
          <textarea
            name="mensaje"
            placeholder="Tu mensaje"
            rows="5"
            value={form.mensaje}
            onChange={handleChange}
            required
            className={styles.textarea}
          />
          <button
            type="submit"
            className={styles.btn}
            disabled={estado === 'enviando'}
          >
            {estado === 'enviando' ? 'Enviando...' : 'ENVIAR MENSAJE'}
          </button>
          {estado === 'ok'    && <p className={styles.ok}>✅ Mensaje enviado correctamente</p>}
          {estado === 'error' && <p className={styles.error}>❌ Error al enviar. Inténtalo de nuevo.</p>}
        </form>
      </div>
    </div>
  )
}