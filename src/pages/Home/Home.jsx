import Hero from './sections/Hero'
import Servicios from './sections/Servicios'

// VITE_API_URL viene de .env.local — apunta al endpoint de API Gateway
const API_URL = import.meta.env.VITE_API_URL

export default function Home({ onLoginClick }) {
  return (
    <>
      <Hero onLoginClick={onLoginClick} />
      <Servicios apiUrl={API_URL} />
    </>
  )
}