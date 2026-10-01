import { hoyGT } from '@akyuam/shared'
import Campo from '../../../components/form/Campo'
import ConfirmModal from '../../../components/ui/ConfirmModal'
import { ACCEPT_DOCUMENTOS } from '../documentos/archivoDocumento'
import type { ResultadoEgreso } from './textoEgreso'
import { useRegistrarEgreso } from './useRegistrarEgreso'

interface ModalEgresoProps {
  expedienteId: string
  numeroExpediente: string
  onCerrar: () => void
  onRegistrado: (resultado: ResultadoEgreso) => void
}

const CLASES_INPUT =
  'mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500'

/** Salida del albergue del caso activo: fecha obligatoria y, si ya está escaneado, el convenio. */
export default function ModalEgreso({ expedienteId, numeroExpediente, onCerrar, onRegistrado }: ModalEgresoProps) {
  const { fechaEgreso, setFechaEgreso, elegirConvenio, error, enviando, registrar } = useRegistrarEgreso(
    expedienteId,
    onRegistrado,
  )

  return (
    <ConfirmModal
      abierto
      titulo="Registrar egreso del albergue"
      descripcion={`Expediente ${numeroExpediente}. Una vez registrado, el egreso no se puede deshacer desde aquí.`}
      confirmarLabel="Registrar egreso"
      cargando={enviando}
      error={error}
      onConfirmar={() => void registrar()}
      onCancelar={onCerrar}
    >
      <Campo label="Fecha de egreso" htmlFor="fechaEgreso">
        <input
          id="fechaEgreso"
          type="date"
          className={CLASES_INPUT}
          value={fechaEgreso}
          max={hoyGT()}
          onChange={(event) => setFechaEgreso(event.target.value)}
        />
      </Campo>
      <Campo
        label="Convenio de egreso"
        htmlFor="convenioEgreso"
        opcional
        ayuda="PDF o imagen, hasta 15 MB. Si aún no está escaneado, queda como pendiente en Documentos."
      >
        <input
          id="convenioEgreso"
          type="file"
          accept={ACCEPT_DOCUMENTOS}
          className="mt-1 block w-full text-sm text-gray-700 file:mr-3 file:rounded-md file:border file:border-gray-300 file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-gray-700 hover:file:bg-gray-50"
          onChange={(event) => elegirConvenio(event.target.files?.[0] ?? null)}
        />
      </Campo>
    </ConfirmModal>
  )
}
