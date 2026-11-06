import { useState, type KeyboardEvent, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { formatFechaGT, hoyGT, informeAtencionMedicaQuerySchema } from '@akyuam/shared'
import { useTituloPagina } from '../../../components/TituloPagina'
import EncabezadoPagina from '../compartido/EncabezadoPagina'
import InformeAtencion from './InformeAtencion'
import PanelIndicadores from './PanelIndicadores'
import SelectorPeriodo, { periodoDelMes, type Periodo } from './SelectorPeriodo'

type Vista = 'informe' | 'indicadores'

/** Pestaña dentro de la página: vive en `?vista=` (un valor de catálogo), así sobrevive a recargar y al botón atrás. */
function BotonVista({ id, activa, onClick, children }: { id: Vista; activa: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      role="tab"
      id={`pestana-${id}`}
      aria-selected={activa}
      aria-controls={`panel-${id}`}
      tabIndex={activa ? 0 : -1}
      onClick={onClick}
      className={`whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors ${
        activa ? 'border-brand-600 text-brand-700' : 'border-transparent text-[#5b6573] hover:text-[#1c2430]'
      }`}
    >
      {children}
    </button>
  )
}

/**
 * Reportes de Medicina. Un solo periodo arriba para las dos pestañas: el informe de atención con el
 * formato de la ONG (lo que se entrega) y los indicadores con sus filtros. Las fechas viven en el
 * estado de la pantalla; solo cifras agregadas, nunca datos de una persona.
 */
export default function Reportes() {
  useTituloPagina({ titulo: 'Reportes' })
  // Se fija al abrir la página: "hoy" no cambia a medio uso aunque pase la medianoche.
  const [hoy] = useState(hoyGT)
  const [campos, setCampos] = useState<Periodo>(() => periodoDelMes(hoy))
  // El último periodo válido: es el que se consulta mientras se corrige una fecha.
  const [periodo, setPeriodo] = useState<Periodo>(campos)
  const [parametros, setParametros] = useSearchParams()
  const vista: Vista = parametros.get('vista') === 'indicadores' ? 'indicadores' : 'informe'

  const validacion = informeAtencionMedicaQuerySchema.safeParse(campos)
  const errorPeriodo = validacion.success ? null : (validacion.error.issues[0]?.message ?? 'Revisa las fechas')

  function cambiarPeriodo(nuevo: Periodo) {
    setCampos(nuevo)
    if (informeAtencionMedicaQuerySchema.safeParse(nuevo).success) setPeriodo(nuevo)
  }

  function cambiarVista(nueva: Vista) {
    setParametros(
      (actuales) => {
        const siguientes = new URLSearchParams(actuales)
        // El informe es la vista por defecto: solo "Indicadores" deja huella en la URL.
        if (nueva === 'indicadores') siguientes.set('vista', 'indicadores')
        else siguientes.delete('vista')
        return siguientes
      },
      { replace: true },
    )
  }

  // Flechas izquierda/derecha entre pestañas, como pide el patrón de tablist.
  function teclaPestanas(evento: KeyboardEvent<HTMLDivElement>) {
    if (evento.key !== 'ArrowLeft' && evento.key !== 'ArrowRight') return
    const siguiente: Vista = vista === 'informe' ? 'indicadores' : 'informe'
    cambiarVista(siguiente)
    document.getElementById(`pestana-${siguiente}`)?.focus()
  }

  return (
    <div className="mx-auto flex max-w-[1180px] flex-col gap-[18px]">
      <EncabezadoPagina
        eyebrow="Reportes"
        titulo="Atención médica"
        descripcion={`Del ${formatFechaGT(periodo.desde)} al ${formatFechaGT(periodo.hasta)} · solo cifras, nunca datos de una persona.`}
        extremo={<SelectorPeriodo hoy={hoy} campos={campos} onCambiar={cambiarPeriodo} error={errorPeriodo} />}
      />

      <div role="tablist" aria-label="Vistas del reporte" onKeyDown={teclaPestanas} className="flex gap-1 border-b border-[#e3e6ea]">
        <BotonVista id="informe" activa={vista === 'informe'} onClick={() => cambiarVista('informe')}>
          Informe de la ONG
        </BotonVista>
        <BotonVista id="indicadores" activa={vista === 'indicadores'} onClick={() => cambiarVista('indicadores')}>
          Indicadores
        </BotonVista>
      </div>

      <div role="tabpanel" id={`panel-${vista}`} aria-labelledby={`pestana-${vista}`}>
        {vista === 'informe' ? <InformeAtencion periodo={periodo} /> : <PanelIndicadores periodo={periodo} hoy={hoy} />}
      </div>
    </div>
  )
}
