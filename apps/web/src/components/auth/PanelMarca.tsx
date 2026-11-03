import { ShieldCheck } from 'lucide-react'

const AREAS = ['Trabajo social', 'Jurídica', 'Psicológica', 'Médica']

/** Panel de marca de las pantallas de acceso (login y cambio de contraseña). Solo en pantallas grandes. */
export default function PanelMarca() {
  return (
    <aside className="relative hidden w-[46%] overflow-hidden bg-gradient-to-br from-brand-950 via-brand-900 to-brand-700 lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-16">
      {/* Formas decorativas suaves */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 -right-32 h-96 w-96 rounded-full bg-brand-500/25 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-40 -left-24 h-[28rem] w-[28rem] rounded-full bg-brand-400/20 blur-3xl"
      />
      <svg
        aria-hidden
        className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.06]"
      >
        <defs>
          <pattern id="puntos" width="24" height="24" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1.5" fill="white" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#puntos)" />
      </svg>

      {/* Espaciador para mantener el bloque central centrado (justify-between) */}
      <div aria-hidden />

      <div className="relative max-w-md">
        <h2 className="text-white">
          <span className="block text-sm font-semibold uppercase tracking-[0.4em] text-brand-300">
            Centro
          </span>
          <span className="mt-2 block text-5xl font-bold tracking-tight xl:text-6xl">
            Ak’ Yu’am
          </span>
        </h2>
        <ul className="mt-8 flex flex-wrap gap-2">
          {AREAS.map((area) => (
            <li
              key={area}
              className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-brand-100 backdrop-blur-sm"
            >
              {area}
            </li>
          ))}
        </ul>
      </div>

      <div className="relative flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-brand-100/80 backdrop-blur-sm">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-brand-300" />
        <p>
          La información de este sistema es confidencial. Todo acceso queda
          registrado.
        </p>
      </div>
    </aside>
  )
}
