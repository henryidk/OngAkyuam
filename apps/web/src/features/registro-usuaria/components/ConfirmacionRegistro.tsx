import { Check, CircleCheck, CircleDashed } from 'lucide-react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ETIQUETAS_AREA_ATENCION,
  ETIQUETAS_TIPO_DOCUMENTO,
  type AreaAtencion,
  type ExpedienteCreado,
  type TipoDocumentoTrabajoSocial,
} from '@akyuam/shared'
import Button from '../../../components/ui/Button'

interface ConfirmacionRegistroProps {
  expediente: ExpedienteCreado
  usuariaExistente: boolean
  cantidadHijos: number
  areasReferidas: AreaAtencion[]
  documentosSubidos: TipoDocumentoTrabajoSocial[]
  onNuevoRegistro: () => void
}

/** Cierre del wizard: qué quedó hecho y qué falta, con lo pendiente a un clic en la ficha. */
export default function ConfirmacionRegistro({
  expediente,
  usuariaExistente,
  cantidadHijos,
  areasReferidas,
  documentosSubidos,
  onNuevoRegistro,
}: ConfirmacionRegistroProps) {
  const navigate = useNavigate()
  const rutaFicha = `/trabajo-social/usuarias/${expediente.usuariaId}`

  return (
    <div className="mx-auto mt-6 max-w-[560px] rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
      <div className="text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-700">
          <Check size={22} strokeWidth={2.5} />
        </div>
        <h2 className="mt-4 text-xl font-semibold text-gray-900">Todo listo</h2>
        <p className="mt-2 text-sm text-gray-700">
          {expediente.usuariaNombreCompleto} · Expediente <span className="font-semibold">{expediente.numero}</span>
          {cantidadHijos > 0 && ` · ${cantidadHijos} ${cantidadHijos === 1 ? 'hija/hijo' : 'hijas/hijos'}`}
        </p>
      </div>

      <ul className="mt-6 divide-y divide-gray-100 rounded-lg border border-gray-200">
        <Resumen hecho titulo={usuariaExistente ? 'Caso registrado' : 'Usuaria registrada'}>
          Expediente {expediente.numero}
        </Resumen>
        <Resumen hecho={areasReferidas.length > 0} titulo="Referida a">
          {areasReferidas.length > 0
            ? areasReferidas.map((area) => ETIQUETAS_AREA_ATENCION[area]).join(', ')
            : 'Ninguna área todavía'}
        </Resumen>
        <Resumen hecho={documentosSubidos.length > 0} titulo="Documentos">
          {documentosSubidos.length > 0
            ? documentosSubidos.map((tipo) => ETIQUETAS_TIPO_DOCUMENTO[tipo]).join(', ')
            : 'Ninguno subido; quedan en “Documentos por subir”'}
        </Resumen>
      </ul>

      <div className="mt-6 flex flex-wrap justify-center gap-3">
        {areasReferidas.length === 0 && (
          <Button
            type="button"
            variante="secondary"
            tamano="md"
            onClick={() => navigate(rutaFicha, { state: { abrirReferir: true } })}
          >
            Referir desde la ficha
          </Button>
        )}
        <Button type="button" tamano="md" onClick={() => navigate(rutaFicha)}>
          Ir a la ficha
        </Button>
      </div>
      <div className="mt-4 text-center">
        <button type="button" onClick={onNuevoRegistro} className="text-xs font-medium text-brand-600 hover:underline">
          Registrar otra usuaria
        </button>
      </div>
    </div>
  )
}

function Resumen({ hecho, titulo, children }: { hecho: boolean; titulo: string; children: ReactNode }) {
  return (
    <li className="flex items-start gap-3 px-4 py-3">
      {hecho ? (
        <CircleCheck size={18} className="mt-0.5 shrink-0 text-green-600" aria-hidden="true" />
      ) : (
        <CircleDashed size={18} className="mt-0.5 shrink-0 text-gray-400" aria-hidden="true" />
      )}
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-800">{titulo}</p>
        <p className="text-xs text-gray-500">{children}</p>
      </div>
    </li>
  )
}
