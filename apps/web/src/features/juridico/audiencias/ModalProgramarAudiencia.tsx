import { useState } from 'react'
import {
  DESCRIPCION_AUDIENCIA_MAX,
  MOTIVO_AUDIENCIA_MAX,
  NUMERO_JUDICIAL_MAX,
  PASO_MINUTOS_HORA_AUDIENCIA,
  agendarAudienciaSchema,
  formatFechaGT,
  hoyGT,
  reprogramarAudienciaSchema,
  type AudienciaAgendadaDto,
  type AudienciaFilaDto,
} from '@akyuam/shared'
import ConfirmModal from '../../../components/ui/ConfirmModal'
import { agendarAudiencia, reprogramarAudiencia } from '../api/audiencias.api'
import { CLASE_CAMPO, CLASE_ETIQUETA } from '../compartido/campos'
import { usePersonalJuridico } from '../compartido/usePersonalJuridico'
import { useEnvio } from '../detalle/useEnvio'
import AgendaDelDia from './AgendaDelDia'
import type { CasoAudiencia } from './caso'
import { audienciaEnHora, textoFechaHora } from './formato'
import { useDisponibilidad } from './useDisponibilidad'

/** Sin `anterior` es una audiencia nueva; con él, reprogramar una programada o agendar la nueva fecha de una cancelada o no realizada. */
export interface AnteriorAudiencia {
  modo: 'REPROGRAMAR' | 'NUEVA_FECHA'
  audiencia: AudienciaFilaDto
}

interface ModalProgramarAudienciaProps {
  caso: CasoAudiencia
  anterior?: AnteriorAudiencia
  onCerrar: () => void
  onHecho: (mensaje: string) => void
  onConflicto: () => void
}

const TITULOS = { AGENDAR: 'Agendar audiencia', REPROGRAMAR: 'Reprogramar audiencia', NUEVA_FECHA: 'Agendar nueva fecha' }

function primerError(resultado: { success: boolean; error?: { issues: { message: string }[] } }): string {
  return resultado.error?.issues[0]?.message ?? 'Revise los datos de la audiencia'
}

/**
 * Agendar, reprogramar o agendar la nueva fecha. Muestra antes de guardar lo que la responsable
 * ya tiene ese día, así el rechazo por hora repetida casi nunca llega a verse. Sin clave de
 * idempotencia: el índice único de la base impide que un doble envío cree dos audiencias.
 */
export default function ModalProgramarAudiencia({ caso, anterior, onCerrar, onHecho, onConflicto }: ModalProgramarAudienciaProps) {
  const modo = anterior?.modo ?? 'AGENDAR'
  const { abogadas, cargando: cargandoPersonal, error: errorPersonal } = usePersonalJuridico()
  const [responsableId, setResponsableId] = useState(caso.responsableId ?? '')
  const [fecha, setFecha] = useState('')
  const [hora, setHora] = useState('')
  const [descripcion, setDescripcion] = useState(modo === 'AGENDAR' ? '' : (anterior?.audiencia.descripcion ?? ''))
  const [motivo, setMotivo] = useState('')
  const [numeroJudicial, setNumeroJudicial] = useState('')
  const { enviando, error, setError, enviar } = useEnvio(onConflicto)
  const disponibilidad = useDisponibilidad(responsableId, fecha)

  const propiaId = modo === 'REPROGRAMAR' ? anterior?.audiencia.id : undefined
  const choque = disponibilidad.ocupadas && hora ? audienciaEnHora(disponibilidad.ocupadas, hora, propiaId) : undefined
  // La responsable inicial puede ya no estar activa: entonces se elige otra.
  const responsableValida = abogadas.some((abogada) => abogada.id === responsableId)
  const pideNumeroJudicial = modo !== 'REPROGRAMAR' && !caso.numeroJudicial

  function guardar() {
    const fechaHora = `${fecha}T${hora}`
    let peticion: () => Promise<AudienciaAgendadaDto>
    if (modo === 'REPROGRAMAR' && anterior) {
      const validado = reprogramarAudienciaSchema.safeParse({ fechaHora, responsableId, motivo, version: anterior.audiencia.version })
      if (!validado.success) return setError(primerError(validado))
      peticion = () => reprogramarAudiencia(anterior.audiencia.id, validado.data)
    } else {
      const validado = agendarAudienciaSchema.safeParse({
        fechaHora,
        responsableId,
        descripcion,
        numeroJudicial: pideNumeroJudicial ? numeroJudicial : null,
        reprogramadaDesdeId: anterior?.audiencia.id ?? null,
      })
      if (!validado.success) return setError(primerError(validado))
      peticion = () => agendarAudiencia(caso.procesoId, validado.data)
    }
    void enviar(peticion, () =>
      onHecho(`Audiencia ${modo === 'REPROGRAMAR' ? 'reprogramada' : 'agendada'}: ${textoFechaHora(fecha, hora)}`),
    )
  }

  // Al cambiar un dato, el error del intento anterior deja de valer.
  function alCambiar(asignar: (valor: string) => void) {
    return (valor: string) => {
      asignar(valor)
      setError(null)
    }
  }

  return (
    <ConfirmModal
      abierto
      amplio
      titulo={TITULOS[modo]}
      descripcion={`${caso.usuariaNombre} · ${caso.codigoProceso}${caso.numeroJudicial ? ` · No. judicial ${caso.numeroJudicial}` : ''}`}
      confirmarLabel={modo === 'REPROGRAMAR' ? 'Reprogramar' : 'Agendar'}
      confirmarDeshabilitado={Boolean(choque) || !responsableValida}
      cargando={enviando}
      error={error ?? errorPersonal}
      onConfirmar={guardar}
      onCancelar={onCerrar}
    >
      {anterior && (
        <p className="text-xs text-gray-600 tabular-nums">
          {modo === 'REPROGRAMAR' ? 'Estaba el ' : 'La anterior era el '}
          <s>
            {formatFechaGT(anterior.audiencia.fecha)} {anterior.audiencia.hora}
          </s>
          {fecha && hora && <span className="font-medium text-gray-900"> → {formatFechaGT(fecha)} {hora}</span>}
        </p>
      )}

      <label className={CLASE_ETIQUETA}>
        <span>Responsable</span>
        <select
          value={responsableValida ? responsableId : ''}
          disabled={cargandoPersonal}
          onChange={(evento) => alCambiar(setResponsableId)(evento.target.value)}
          className={CLASE_CAMPO}
        >
          <option value="">{cargandoPersonal ? 'Cargando…' : 'Elija la abogada…'}</option>
          {abogadas.map((abogada) => (
            <option key={abogada.id} value={abogada.id}>
              {abogada.nombre}
            </option>
          ))}
        </select>
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className={CLASE_ETIQUETA}>
          <span>Fecha</span>
          <input type="date" min={hoyGT()} value={fecha} onChange={(evento) => alCambiar(setFecha)(evento.target.value)} className={CLASE_CAMPO} />
        </label>
        <label className={CLASE_ETIQUETA}>
          <span>Hora (Guatemala)</span>
          <input
            type="time"
            step={PASO_MINUTOS_HORA_AUDIENCIA * 60}
            value={hora}
            onChange={(evento) => alCambiar(setHora)(evento.target.value)}
            className={CLASE_CAMPO}
          />
        </label>
      </div>

      {fecha && hora && (
        <p className="text-sm font-medium text-gray-900" aria-live="polite">
          {textoFechaHora(fecha, hora)}
        </p>
      )}

      <AgendaDelDia {...disponibilidad} propiaId={propiaId} />
      {choque && (
        <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          La responsable ya tiene una audiencia a las {choque.hora} ({choque.codigoProceso}). Elija otra hora u otra responsable.
        </p>
      )}

      {modo === 'REPROGRAMAR' ? (
        <label className={CLASE_ETIQUETA}>
          <span>Motivo de la reprogramación</span>
          <textarea
            rows={2}
            maxLength={MOTIVO_AUDIENCIA_MAX}
            value={motivo}
            onChange={(evento) => alCambiar(setMotivo)(evento.target.value)}
            placeholder="Ej. El juzgado suspendió la diligencia"
            className={CLASE_CAMPO}
          />
        </label>
      ) : (
        <label className={CLASE_ETIQUETA}>
          <span>Descripción (opcional)</span>
          <input
            type="text"
            maxLength={DESCRIPCION_AUDIENCIA_MAX}
            value={descripcion}
            onChange={(evento) => alCambiar(setDescripcion)(evento.target.value)}
            placeholder="Ej. Conciliación"
            className={CLASE_CAMPO}
          />
        </label>
      )}

      {pideNumeroJudicial && (
        <label className={CLASE_ETIQUETA}>
          <span>No. judicial (opcional, si ya lo tiene)</span>
          <input
            type="text"
            maxLength={NUMERO_JUDICIAL_MAX}
            value={numeroJudicial}
            onChange={(evento) => alCambiar(setNumeroJudicial)(evento.target.value)}
            className={`${CLASE_CAMPO} font-mono`}
          />
        </label>
      )}
    </ConfirmModal>
  )
}
