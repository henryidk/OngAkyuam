/** Barras grises que laten mientras carga; la clase da el tamaño. */
function Barra({ className }: { className: string }) {
  return <span aria-hidden="true" className={`block animate-pulse rounded ${className}`} />
}

/**
 * Lo que se ve mientras se valida la sesión al abrir la app (PS10): la misma silueta del menú, el
 * encabezado y el contenido, en vez de un "Cargando…" suelto sobre fondo blanco. Así la pantalla no
 * salta cuando llega el usuario: solo se rellena.
 */
export default function EsqueletoApp() {
  return (
    <div role="status" className="flex min-h-screen bg-gray-50">
      <span className="sr-only">Cargando…</span>
      <div aria-hidden="true" className="hidden h-screen w-64 shrink-0 flex-col bg-brand-950 lg:sticky lg:top-0 lg:flex">
        <div className="flex flex-col gap-2 px-5 pt-6 pb-5">
          <p className="text-lg font-semibold tracking-tight text-white">AKyuam</p>
          <Barra className="h-3 w-20 bg-white/10" />
        </div>
        <div className="flex flex-col gap-1 px-3">
          {Array.from({ length: 6 }, (_, indice) => (
            <div key={indice} className="flex items-center gap-3 px-3 py-2.5">
              <Barra className="h-[18px] w-[18px] bg-white/10" />
              <Barra className="h-3.5 w-28 bg-white/10" />
            </div>
          ))}
        </div>
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-3 border-b border-gray-200 bg-white px-4 py-4 lg:px-8">
          <Barra className="h-7 w-48 bg-superficie-hundida" />
        </div>
        <div className="flex flex-1 flex-col gap-3 px-4 py-6 lg:px-8 lg:py-10">
          <Barra className="h-24 w-full max-w-6xl bg-superficie-hundida" />
          <Barra className="h-64 w-full max-w-6xl bg-superficie-hundida" />
        </div>
      </div>
    </div>
  )
}
