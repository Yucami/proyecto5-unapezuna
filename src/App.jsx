import { useState } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import Navbar from './components/Navbar/Navbar'
import Footer from './components/Footer/Footer'
import AuthModal from './components/AuthModal/AuthModal'
import Home from './pages/Home/Home'
import Reservar from './pages/Reservar/Reservar'
import MisCitas from './pages/MisCitas/MisCitas'
import Admin from './pages/Admin/Admin'
import SobreMi from './pages/SobreMi/SobreMi'
import Disenos from './pages/Disenos/Disenos'
import Contacto from './pages/Contacto/Contacto'

function App() {
  // Controla la visibilidad del modal de autenticación
  const [authModal, setAuthModal] = useState(false)

  return (
    // AuthProvider envuelve toda la app para que cualquier componente
    // pueda acceder al estado de autenticación (usuario, login, logout...)
    <AuthProvider>
      {/* future flags evitan warnings de deprecación de React Router v7 */}
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Navbar onLoginClick={() => setAuthModal(true)} />
        <main>
          <Routes>
            <Route path="/" element={<Home onLoginClick={() => setAuthModal(true)} />} />
            <Route path="/reservar" element={<Reservar />} />
            <Route path="/mis-citas" element={<MisCitas />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/sobre-mi" element={<SobreMi />} />
            <Route path="/disenos" element={<Disenos />} />
            <Route path="/contacto" element={<Contacto />} />
          </Routes>
        </main>
        <Footer />

        {/* El modal se monta solo cuando authModal es true */}
        {authModal && (
          <AuthModal
            onClose={() => setAuthModal(false)}
            onSuccess={() => setAuthModal(false)}
          />
        )}
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App