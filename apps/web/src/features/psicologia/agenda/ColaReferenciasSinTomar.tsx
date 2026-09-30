import { Inbox } from 'lucide-react'
import { diasDesdeGT, formatInstanteGT, type ReferenciaSinTomar } from '@akyuam/shared'
import Badge from '../../../components/ui/Badge'
import Button from '../../../components/ui/Button'
import EmptyState from '../../../components/ui/EmptyState'
import TarjetaCola from './TarjetaCola'

/** A partir de este número de días esperando, la referencia se marca en rojo (§5.1 del plan). */
const DIAS_PARA_ALERTA = 5

interface ColaReferenciasSinTomarProps {
  referencias: ReferenciaSinTomar[]
  /** Id de la referencia que está siendo reclamada en este momento, para el estado de carga. */
  reclamandoId: string | null
  error: string | null
  onTomarYAgendar: (expedienteId: string) => void
  onSoloTomar: (expedienteId: string) => void
}

/**
 * Cola de entrada de trabajo social: expedientes referidos que todavía no tiene nadie. Es la
 * única lista de la agenda que no es "mis pacientes" — nadie es dueña todavía (§7.4 del plan).
 */
export default function ColaReferenciasSinTomar({
  referencias,
  reclamandoId,
  error,
  onTomarYAgendar,
  onSoloTomar,
}: ColaReferenciasSinTomarProps) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-gray-800">Referencias sin tomar</h2>
        <p className="text-xs text-gray-500">Casos referidos que requieren primera cita.</p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {referencias.length === 0 ? (
        <EmptyState Icono={Inbox} titulo="No hay referencias pendientes" />
      ) : (
        <div className="space-y-2">
          {referencias.map((referencia) => {
            const diasEsperando = diasDesdeGT(referencia.fechaReferido)
            const reclamando = reclamandoId === referencia.expedienteId
            return (
              <TarjetaCola
                key={referencia.expedienteId}
                nombre={referencia.usuariaNombreCompleto}
                numero={referencia.numero}
                detalle={`Referida el ${formatInstanteGT(referencia.fechaReferido)}`}
                insignia={
                  <Badge tono={diasEsperando >= DIAS_PARA_ALERTA ? 'danger' : 'neutral'}>
                    {diasEsperando === 0 ? 'Hoy' : `${diasEsperando} d`}
                  </Badge>
                }
              >
                <Button
                  className="w-full"
                  cargando={reclamando}
                  onClick={() => onTomarYAgendar(referencia.expedienteId)}
                >
                  Tomar caso y agendar
                </Button>
                <button
                  type="button"
                  disabled={reclamando}
                  onClick={() => onSoloTomar(referencia.expedienteId)}
                  className="text-xs font-medium text-gray-500 hover:underline disabled:opacity-50"
                >
                  Solo tomar el caso
                </button>
              </TarjetaCola>
            )
          })}
        </div>
      )}
    </section>
  )
}
