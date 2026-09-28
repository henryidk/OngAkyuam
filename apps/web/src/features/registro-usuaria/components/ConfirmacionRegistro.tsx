import { Check } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AREAS_ATENCION,
  ETIQUETAS_AREA_ATENCION,
  ETIQUETAS_TIPO_DOCUMENTO,
  type AreaAtencion,
  type ExpedienteCreado,
  type TipoDocumentoTrabajoSocial,
} from '@akyuam/shared'
import Button from '../../../components/ui/Button'
import ModalReferir from '../../trabajo-social/referir/ModalReferir'
import type { DocumentoEnSubida } from '../hooks/useDocumentosStaging'

interface ConfirmacionRegistroProps {
  expediente: ExpedienteCreado
  usuariaExistente: boolean
  cantidadHijos: number
  documentosEnSubida: DocumentoEnSubida[]
  onReintentarDocumento: (tipo: TipoDocumentoTrabajoSocial) => void
  onNuevoRegistro: () => void
}

export default function ConfirmacionRegistro({
  expediente,
  usuariaExistente,
  cantidadHijos,
  documentosEnSubida,
  onReintentarDocumento,
  onNuevoRegistro,
}: ConfirmacionRegistroProps) {
  const navigate = useNavigate()
  const [referirAbierto, setReferirAbierto] = useState(false)
  // Referir ya no es parte del wizard: se hace aquí mismo, una área a la vez, con el modal de la ficha.
  const [areasReferidas, setAreasReferidas] = useState<AreaAtencion[]>([])
  const todasReferidas = AREAS_ATENCION.every((area) => areasReferidas.includes(area))

  function irALaFicha() {
    // Un caso nuevo siempre es el activo: la ficha lo muestra por defecto.
    navigate(`/trabajo-social/usuarias/${expediente.usuariaId}`)
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
        {areasReferidas.length > 0
          ? `Referida a ${areasReferidas.map((area) => ETIQUETAS_AREA_ATENCION[area]).join(', ')} · ya aparece en su bandeja.`
          : 'Siguiente paso: referirla a las áreas que la atenderán. También puedes hacerlo después desde su ficha.'}
      </p>

      {documentosEnSubida.length > 0 && (
        <div className="mt-6 space-y-2 text-left">
          <p className="text-xs font-medium text-gray-700">Documentos</p>
          {documentosEnSubida.map((documento) => (
            <div
              key={documento.tipo}
              className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2 text-xs"
            >
              <div>
                <p className="font-medium text-gray-800">{ETIQUETAS_TIPO_DOCUMENTO[documento.tipo]}</p>
                {documento.estado === 'error' && (
                  <p className="mt-0.5 text-red-600">{documento.mensajeError ?? 'Error al subir el archivo.'}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <EstadoDocumento estado={documento.estado} />
                {documento.estado === 'error' && (
                  <Button type="button" variante="acento" onClick={() => onReintentarDocumento(documento.tipo)}>
                    Reintentar
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Button type="button" variante="secondary" tamano="md" onClick={irALaFicha}>
          Ir a la ficha
        </Button>
        {!todasReferidas && (
          <Button type="button" tamano="md" onClick={() => setReferirAbierto(true)}>
            {areasReferidas.length > 0 ? 'Referir a otra área' : 'Referir ahora'}
          </Button>
        )}
      </div>
      <button type="button" onClick={onNuevoRegistro} className="mt-4 text-xs font-medium text-brand-600 hover:underline">
        {usuariaExistente ? 'Volver a buscar' : 'Registrar otra usuaria'}
      </button>

      {referirAbierto && (
        <ModalReferir
          expedienteId={expediente.id}
          numeroExpediente={expediente.numero}
          nombreUsuaria={expediente.usuariaNombreCompleto}
          areasReferidas={areasReferidas}
          onCerrar={() => setReferirAbierto(false)}
          onReferido={(referido) => {
            setAreasReferidas((actual) => [...actual, referido.area])
            setReferirAbierto(false)
          }}
        />
      )}
    </div>
  )
}

function EstadoDocumento({ estado }: { estado: DocumentoEnSubida['estado'] }) {
  if (estado === 'subiendo') {
    return <span className="text-gray-500">Subiendo…</span>
  }
  if (estado === 'ok') {
    return <span className="font-medium text-green-700">Subido</span>
  }
  return <span className="font-medium text-red-700">Error</span>
}
