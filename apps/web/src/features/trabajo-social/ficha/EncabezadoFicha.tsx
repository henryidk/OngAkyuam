import { AREAS_ATENCION, edadEnAniosGT, type UsuariaExpedienteHub } from '@akyuam/shared'
import Badge from '../../../components/ui/Badge'
import Button from '../../../components/ui/Button'
import Tabs from '../../../components/ui/Tabs'
import { rangoEdadCorto } from '../usuarias/filaUsuaria'
import { badgeRegistro, iniciales, nombreCompleto, textoGrupoEtnico, textoUbicacion } from './textoUsuaria'

interface EncabezadoFichaProps {
  usuaria: UsuariaExpedienteHub
  /** Mientras se editan los datos personales no se inicia otra acción sobre el caso. */
  editandoDatos: boolean
  onReferir: () => void
  onRegistrarEgreso: () => void
}

/** Encabezado de la ficha (plan §12.5): identidad en una línea, badge de registro y pestañas. */
const AVISO_EDITANDO = 'Termina de editar los datos primero'

export default function EncabezadoFicha({ usuaria, editandoDatos, onReferir, onRegistrarEgreso }: EncabezadoFichaProps) {
  const casoActual = usuaria.casos[0] ?? null
  const badge = badgeRegistro(casoActual)
  const edad = edadEnAniosGT(usuaria.fechaNacimiento)
  const ubicacion = textoUbicacion(usuaria)
  const todasReferidas = casoActual ? AREAS_ATENCION.every((area) => casoActual.areasReferidas.includes(area)) : true

  const bloqueoPorEdicion = editandoDatos
    ? { disabled: true, title: AVISO_EDITANDO, className: 'opacity-40' }
    : {}

  const datos = [
    casoActual && (
      <>
        Expediente <span className="font-semibold text-gray-800">{casoActual.numero}</span>
      </>
    ),
    `${edad} años (${rangoEdadCorto(edad)})`,
    usuaria.dpi && `DPI ${usuaria.dpi}`,
    textoGrupoEtnico(usuaria.grupoEtnico),
    ubicacion,
  ].filter(Boolean)

  return (
    <header className="rounded-xl border border-gray-200 bg-white px-6 pt-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <div
            aria-hidden="true"
            className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full bg-brand-100 text-lg font-semibold text-brand-700"
          >
            {iniciales(usuaria)}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-[22px] font-semibold tracking-tight text-gray-900">{nombreCompleto(usuaria)}</h1>
              {badge && <Badge tono={badge.tono}>{badge.texto}</Badge>}
            </div>
            <p className="mt-1.5 text-sm tabular-nums text-gray-600">
              {datos.map((dato, indice) => (
                <span key={indice}>
                  {indice > 0 && ' · '}
                  {dato}
                </span>
              ))}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {casoActual?.enAlbergue && (
            <Button variante="secondary" tamano="md" onClick={onRegistrarEgreso} {...bloqueoPorEdicion}>
              Registrar egreso
            </Button>
          )}
          {casoActual && !todasReferidas && (
            <Button tamano="md" onClick={onReferir} {...bloqueoPorEdicion}>
              Referir a un área
            </Button>
          )}
        </div>
      </div>

      <Tabs
        className="mt-5"
        items={[
          { to: '.', etiqueta: 'Resumen', fin: true },
          { to: 'datos', etiqueta: 'Datos personales' },
          { to: 'casos', etiqueta: `Casos (${usuaria.casos.length})` },
          { to: 'documentos', etiqueta: 'Documentos' },
          { to: 'accesos', etiqueta: 'Accesos y referencias' },
          { to: 'bitacora', etiqueta: 'Bitácora' },
        ]}
      />
    </header>
  )
}
