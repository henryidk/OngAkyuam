import { Route, Routes } from 'react-router-dom'
import Home from './pages/Home'
import Gerencia from './pages/Gerencia'
import TrabajoSocial from './pages/TrabajoSocial'
import Juridica from './pages/Juridica'
import Psicologica from './pages/Psicologica'
import Medica from './pages/Medica'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/gerencia" element={<Gerencia />} />
      <Route path="/trabajo-social" element={<TrabajoSocial />} />
      <Route path="/juridica" element={<Juridica />} />
      <Route path="/psicologica" element={<Psicologica />} />
      <Route path="/medica" element={<Medica />} />
    </Routes>
  )
}

export default App
