import { NavLink, Outlet } from 'react-router-dom'

const PESTANAS = [
  { ruta: '', etiqueta: 'Resumen', fin: true },
  { ruta: 'citas', etiqueta: 'Historial de citas', fin: false },
  { ruta: 'consultas', etiqueta: 'Consultas registradas', fin: false },
  { ruta: 'documentos', etiqueta: 'Documentos', fin: false },
  { ruta: 'datos', etiqueta: 'Datos de la usuaria', fin: false },
]

export default function ExpedienteUsuaria() {
  return (
    <div className="space-y-4">
      <nav className="flex flex-wrap gap-1 border-b border-gray-200">
        {PESTANAS.map((pestana) => (
          <NavLink
            key={pestana.ruta}
            to={pestana.ruta}
            end={pestana.fin}
            className={({ isActive }) =>
              `border-b-2 px-3 py-2 text-sm font-medium ${
                isActive ? 'border-brand-600 text-brand-700' : 'border-transparent text-gray-500 hover:text-gray-800'
              }`
            }
          >
            {pestana.etiqueta}
          </NavLink>
        ))}
      </nav>

      <Outlet />
    </div>
  )
}
