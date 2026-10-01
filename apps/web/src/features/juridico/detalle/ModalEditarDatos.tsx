import { useState } from 'react'
import { CONTRAPARTE_MAX, editarDatosProcesoSchema, type PersonalAsignado, type PersonalDto } from '@akyuam/shared'
import ConfirmModal from '../../../components/ui/ConfirmModal'
import { editarDatosProceso } from '../api/juridico.api'
import { CLASE_CAMPO, CLASE_ETIQUETA } from '../compartido/campos'
import { usePersonalJuridico } from '../compartido/usePersonalJuridico'
import type { PropsModalProceso } from './contextoDetalle'
import { useEnvio } from './useEnvio'

/** Las activas más la asignada actual, aunque ya esté inactiva: editar otro campo no debe quitarla. */
function opcionesCon(activas: PersonalDto[], asignada: PersonalAsignado | null): PersonalAsignado[] {
  if (!asignada || activas.some((persona) => persona.id === asignada.id)) return activas
  return [asignada, ...activas]
}

export default function ModalEditarDatos({ proceso, onCerrar, onHecho, onConflicto }: PropsModalProceso) {
  const personal = usePersonalJuridico()
  const [numeroJudicial, setNumeroJudicial] = useState(proceso.numeroJudicial ?? '')
  const [organoJudicial, setOrganoJudicial] = useState(proceso.organoJudicial ?? '')
  const [contraparte, setContraparte] = useState(proceso.contraparte ?? '')
  const [abogadaId, setAbogadaId] = useState(proceso.abogada?.id ?? '')
  const [procuradoraId, setProcuradoraId] = useState(proceso.procuradora?.id ?? '')
  const { enviando, error, setError, enviar } = useEnvio(onConflicto)

  function confirmar() {
    const validado = editarDatosProcesoSchema.safeParse({
      numeroJudicial,
      organoJudicial,
      contraparte,
      abogadaId,
      procuradoraId,
      version: proceso.version,
    })
    if (!validado.success) {
      setError('Revise los datos: algún campo supera el largo permitido')
      return
    }
    void enviar(
      () => editarDatosProceso(proceso.id, validado.data),
      () => onHecho('Datos del proceso actualizados'),
    )
  }

  const selects = [
    { etiqueta: 'Abogada', valor: abogadaId, cambiar: setAbogadaId, opciones: opcionesCon(personal.abogadas, proceso.abogada) },
    {
      etiqueta: 'Procuradora',
      valor: procuradoraId,
      cambiar: setProcuradoraId,
      opciones: opcionesCon(personal.procuradoras, proceso.procuradora),
    },
  ]

  return (
    <ConfirmModal
      abierto
      titulo="Datos del proceso"
      descripcion={proceso.codigo}
      confirmarLabel="Guardar"
      cargando={enviando}
      error={error ?? personal.error}
      onConfirmar={confirmar}
      onCancelar={onCerrar}
    >
      <label className={CLASE_ETIQUETA}>
        <span>No. judicial</span>
        <input
          type="text"
          value={numeroJudicial}
          maxLength={60}
          onChange={(evento) => setNumeroJudicial(evento.target.value)}
          className={CLASE_CAMPO}
        />
      </label>
      <label className={CLASE_ETIQUETA}>
        <span>Juzgado u órgano</span>
        <input
          type="text"
          value={organoJudicial}
          maxLength={160}
          onChange={(evento) => setOrganoJudicial(evento.target.value)}
          className={CLASE_CAMPO}
        />
      </label>
      <label className={CLASE_ETIQUETA}>
        <span>Contraparte</span>
        <input
          type="text"
          value={contraparte}
          maxLength={CONTRAPARTE_MAX}
          onChange={(evento) => setContraparte(evento.target.value)}
          className={CLASE_CAMPO}
        />
      </label>
      {selects.map((select) => (
        <label key={select.etiqueta} className={CLASE_ETIQUETA}>
          <span>{select.etiqueta}</span>
          <select
            value={select.valor}
            onChange={(evento) => select.cambiar(evento.target.value)}
            disabled={personal.cargando}
            className={CLASE_CAMPO}
          >
            <option value="">Sin asignar</option>
            {select.opciones.map((persona) => (
              <option key={persona.id} value={persona.id}>
                {persona.nombre}
              </option>
            ))}
          </select>
        </label>
      ))}
    </ConfirmModal>
  )
}
