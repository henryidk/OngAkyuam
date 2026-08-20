import { Link } from 'react-router-dom'

const areas = [
  { path: '/gerencia', label: 'Gerencia' },
  { path: '/trabajo-social', label: 'Trabajo social' },
  { path: '/juridica', label: 'Jurídica' },
  { path: '/psicologica', label: 'Psicológica' },
  { path: '/medica', label: 'Médica' },
]

export default function Home() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold">AKyuam</h1>
      <ul className="mt-4 space-y-2">
        {areas.map((area) => (
          <li key={area.path}>
            <Link className="text-blue-600 hover:underline" to={area.path}>
              {area.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
