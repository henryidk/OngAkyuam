import { Check, CircleCheck } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import {
  ETIQUETAS_TIPO_DOCUMENTO,
  type ExpedienteCreado,
  type TipoDocumentoTrabajoSocial,
} from '@akyuam/shared'
import Button from '../../../components/ui/Button'

interface ConfirmacionRegistroProps {
  expediente: ExpedienteCreado
  usuariaExistente: boolean
  cantidadHijos: number
  /** Ya forman parte del caso: se subieron en el paso Documentos y se adjuntaron al registrar. */
  documentosAdjuntados: TipoDocumentoTrabajoSocial[]
  onNuevoRegistro: () => void
}

export default function ConfirmacionRegistro({
  expediente,
  usuariaExistente,
  cantidadHijos,
  documentosAdjuntados,
  onNuevoRegistro,
}: ConfirmacionRegistroProps) {
  const navigate = useNavigate()
  const rutaFicha = `/trabajo-social/usuarias/${expediente.usuariaId}`

  // Un caso nuevo siempre es el activo: la ficha lo muestra por defecto.
  function irALaFicha() {
    navigate(rutaFicha)
  }

  // Referir no es parte del wizard: la ficha abre su modal sobre el caso recién creado.
  function referirAhora() {
    navigate(rutaFicha, { state: { abrirReferir: true } })
  }

  return (
    <div className="mx-auto mt-6 max-w-[560px] rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-700">
        <Check size={22} strokeWidth={2.5} />
      </div>
      <h2 className="mt-4 text-xl font-semibold text-gray-900">
        {usuariaExistente ? 'Caso registrado' : 'Usuaria registrada'}
      </h2>
      <p className="mt-2 text-sm text-gray-700">
        {expediente.usuariaNombreCompleto} · Expediente <span className="font-semibold">{expediente.numero}</span>
        {cantidadHijos > 0 && ` · ${cantidadHijos} ${cantidadHijos === 1 ? 'hija/hijo' : 'hijas/hijos'}`}
      </p>
      <p className="mt-2 text-[13px] text-gray-500">
        Siguiente paso: referirla a las áreas que la atenderán. También puedes hacerlo después desde su ficha.
      </p>

      {documentosAdjuntados.length > 0 && (
        <p className="mt-4 inline-flex items-center gap-1.5 text-[13px] text-green-700">
          <CircleCheck size={14} aria-hidden="true" />
          {documentosAdjuntados.length === 1 ? 'Documento adjuntado' : 'Documentos adjuntados'}:{' '}
          {documentosAdjuntados.map((tipo) => ETIQUETAS_TIPO_DOCUMENTO[tipo]).join(', ')}
        </p>
      )}

      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Button type="button" variante="secondary" tamano="md" onClick={irALaFicha}>
          Ir a la ficha
        </Button>
        <Button type="button" tamano="md" onClick={referirAhora}>
          Referir ahora
        </Button>
      </div>
      <button type="button" onClick={onNuevoRegistro} className="mt-4 text-xs font-medium text-brand-600 hover:underline">
        Registrar otra usuaria
      </button>
    </div>
  )
}
