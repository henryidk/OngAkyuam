import { useState } from 'react'
import { cambiarResponsableAudienciaSchema, formatFechaGT } from '@akyuam/shared'
import ConfirmModal from '../../../components/ui/ConfirmModal'
import { cambiarResponsableAudiencia } from '../api/audiencias.api'
import { CLASE_CAMPO, CLASE_ETIQUETA } from '../compartido/campos'
import { usePersonalJuridico } from '../compartido/usePersonalJuridico'
import { useEnvio } from '../detalle/useEnvio'
import AgendaDelDia from './AgendaDelDia'
import type { PropsModalAudiencia } from './caso'
import { audienciaEnHora, textoCaso } from './formato'
import { useDisponibilidad } from './useDisponibilidad'

/** Cambia quién va a la audiencia, sin moverla: avisa si la nueva responsable ya tiene esa hora. */
export default function ModalResponsableAudiencia({ audiencia, onCerrar, onHecho, onConflicto }: PropsModalAudiencia) {
  const { abogadas, cargando, error: errorPersonal } = usePersonalJuridico()
  const [responsableId, setResponsableId] = useState('')
  const { enviando, error, setError, enviar } = useEnvio(onConflicto)
  const disponibilidad = useDisponibilidad(responsableId, audiencia.fecha)
  const choque = disponibilidad.ocupadas ? audienciaEnHora(disponibilidad.ocupadas, audiencia.hora, audiencia.id) : undefined
  const otras = abogadas.filter((abogada) => abogada.id !== audiencia.responsable.id)

  function confirmar() {
    const validado = cambiarResponsableAudienciaSchema.safeParse({ responsableId, version: audiencia.version })
    if (!validado.success) {
      setError('Elija la nueva responsable')
      return
    }
    void enviar(
      () => cambiarResponsableAudiencia(audiencia.id, validado.data),
      () => onHecho('Responsable de la audiencia actualizada'),
    )
  }

  return (
    <ConfirmModal
      abierto
      titulo="Cambiar responsable"
      descripcion={`${textoCaso(audiencia)} · ${formatFechaGT(audiencia.fecha)} ${audiencia.hora} · ahora: ${audiencia.responsable.nombre}`}
      confirmarLabel="Guardar"
      confirmarDeshabilitado={Boolean(choque)}
      cargando={enviando}
      error={error ?? errorPersonal}
      onConfirmar={confirmar}
      onCancelar={onCerrar}
    >
      <label className={CLASE_ETIQUETA}>
        <span>Nueva responsable</span>
        <select
          value={responsableId}
          disabled={cargando}
          onChange={(evento) => {
            setResponsableId(evento.target.value)
            setError(null)
          }}
          className={CLASE_CAMPO}
        >
          <option value="">{cargando ? 'Cargando…' : 'Elija la abogada…'}</option>
          {otras.map((abogada) => (
            <option key={abogada.id} value={abogada.id}>
              {abogada.nombre}
            </option>
          ))}
        </select>
      </label>
      {responsableId && <AgendaDelDia {...disponibilidad} />}
      {choque && (
        <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Ya tiene una audiencia a las {choque.hora} ({choque.codigoProceso}). Elija a otra responsable o reprograme.
        </p>
      )}
    </ConfirmModal>
  )
}
