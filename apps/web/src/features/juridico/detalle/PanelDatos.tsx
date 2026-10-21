import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ETIQUETAS_TIPO_PROCESO_JURIDICO,
  editarDatosProcesoSchema,
  formatFechaGT,
  type PersonalAsignado,
  type PersonalDto,
  type ProcesoDetalle,
} from '@akyuam/shared'
import Button from '../../../components/ui/Button'
import { editarDatosProceso } from '../api/juridico.api'
import { CLASE_CAMPO, CLASE_ETIQUETA } from '../compartido/campos'
import { usePersonalJuridico } from '../compartido/usePersonalJuridico'
import { RUTAS_JURIDICO } from '../rutas'
import { useEnvio } from './useEnvio'

const CLASE_TARJETA = 'rounded-xl bg-white shadow-[0_1px_2px_rgba(16,24,40,.04)]'

interface PanelDatosProps {
  proceso: ProcesoDetalle
  /** Se guardó: avisar y refrescar el proceso. */
  onGuardado: (mensaje: string) => void
  /** 409: otra persona cambió el proceso; refrescar para leer la versión nueva. */
  onConflicto: () => void
  /** Abre el modal para agregar o corregir el No. judicial. */
  onNumeroJudicial: () => void
}

/** Las activas más la asignada actual, aunque ya esté inactiva: editar otro campo no debe quitarla. */
function opcionesCon(activas: PersonalDto[], asignada: PersonalAsignado | null): PersonalAsignado[] {
  if (!asignada || activas.some((persona) => persona.id === asignada.id)) return activas
  return [asignada, ...activas]
}

/** Se monta solo al editar: así el personal se pide únicamente cuando hace falta. */
function FormularioAsignacion({
  proceso,
  onCancelar,
  onGuardado,
  onConflicto,
}: Pick<PanelDatosProps, 'proceso' | 'onConflicto'> & {
  onCancelar: () => void
  onGuardado: () => void
}) {
  const personal = usePersonalJuridico()
  const [abogadaId, setAbogadaId] = useState(proceso.abogada?.id ?? '')
  const [procuradoraId, setProcuradoraId] = useState(proceso.procuradora?.id ?? '')
  const { enviando, error, setError, enviar } = useEnvio(onConflicto)

  function guardar() {
    const validado = editarDatosProcesoSchema.safeParse({
      abogadaId,
      procuradoraId,
      version: proceso.version,
    })
    if (!validado.success) {
      setError('Revise la asignación elegida')
      return
    }
    void enviar(() => editarDatosProceso(proceso.id, validado.data), onGuardado)
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
  const mensajeError = error ?? personal.error

  return (
    <section className={`${CLASE_TARJETA} border-2 border-brand-600 p-[15px] ring-4 ring-brand-50`}>
      <h3 className="mb-3 text-sm font-semibold text-gray-900">Cambiar asignación</h3>
      <form
        onSubmit={(evento) => {
          evento.preventDefault()
          guardar()
        }}
      >
        <div className="space-y-3">
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
        </div>
        {mensajeError && (
          <p role="alert" className="mt-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {mensajeError}
          </p>
        )}
        <div className="mt-3.5 flex justify-end gap-2 border-t border-gray-100 pt-3">
          <Button type="button" variante="secondary" onClick={onCancelar} disabled={enviando}>
            Cancelar
          </Button>
          <Button type="submit" cargando={enviando}>
            Guardar
          </Button>
        </div>
      </form>
    </section>
  )
}

const CLASE_DT = 'text-[11px] uppercase tracking-wide text-gray-500'
const CLASE_ACCION = 'text-xs font-medium text-brand-700 hover:underline'

function Fila({ etiqueta, valor, vacio = false }: { etiqueta: string; valor: string; vacio?: boolean }) {
  return (
    <div>
      <dt className={CLASE_DT}>{etiqueta}</dt>
      <dd className={`mt-0.5 text-sm ${vacio ? 'text-gray-400' : 'text-gray-900'}`}>{valor}</dd>
    </div>
  )
}

/**
 * Datos del proceso. Cada dato que se cambia tiene su acción junto a él: el No. judicial abre su
 * modal (avisa si está repetido) y la asignación se cambia dentro de la misma tarjeta.
 */
export default function PanelDatos({ proceso, onGuardado, onConflicto, onNumeroJudicial }: PanelDatosProps) {
  const [editando, setEditando] = useState(false)

  if (editando) {
    return (
      <FormularioAsignacion
        proceso={proceso}
        onConflicto={onConflicto}
        onCancelar={() => setEditando(false)}
        onGuardado={() => {
          setEditando(false)
          onGuardado('Asignación actualizada')
        }}
      />
    )
  }

  return (
    <section className={`${CLASE_TARJETA} border border-gray-200 p-4`}>
      <h3 className="mb-3 text-sm font-semibold text-gray-900">Datos del proceso</h3>
      <dl className="space-y-2.5">
        <Fila etiqueta="No. interno" valor={proceso.codigo} />
        <div>
          <div className="flex items-center justify-between gap-2">
            <dt className={CLASE_DT}>No. judicial</dt>
            {proceso.numeroJudicial && (
              <button type="button" onClick={onNumeroJudicial} className={CLASE_ACCION}>
                Corregir
              </button>
            )}
          </div>
          <dd className="mt-0.5 text-sm">
            {proceso.numeroJudicial ? (
              <span className="break-all font-mono text-gray-900">{proceso.numeroJudicial}</span>
            ) : (
              <button
                type="button"
                onClick={onNumeroJudicial}
                className="mt-0.5 w-full rounded-lg border border-dashed border-gray-300 px-3 py-2 text-left text-[13px] font-medium text-brand-700 hover:border-brand-600 hover:bg-brand-50"
              >
                + Agregar No. judicial
              </button>
            )}
          </dd>
        </div>

        <div className="space-y-2.5 border-t border-gray-100 pt-2.5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-gray-700">Asignación</p>
            <button type="button" onClick={() => setEditando(true)} className={CLASE_ACCION}>
              Cambiar
            </button>
          </div>
          <Fila etiqueta="Abogada" valor={proceso.abogada?.nombre ?? 'Sin asignar'} vacio={!proceso.abogada} />
          <Fila etiqueta="Procuradora" valor={proceso.procuradora?.nombre ?? 'Sin asignar'} vacio={!proceso.procuradora} />
        </div>

        <div className="space-y-2.5 border-t border-gray-100 pt-2.5">
          <Fila etiqueta="Fecha de inicio" valor={formatFechaGT(proceso.fechaInicio)} />
          {proceso.fechaCierre && <Fila etiqueta="Fecha de cierre" valor={formatFechaGT(proceso.fechaCierre)} />}
          {proceso.procesoOrigen && (
            <div>
              <dt className={CLASE_DT}>Proceso de origen</dt>
              <dd className="mt-0.5 text-sm">
                <Link to={RUTAS_JURIDICO.proceso(proceso.procesoOrigen.id)} className="text-brand-700 hover:underline">
                  {proceso.procesoOrigen.codigo} · {ETIQUETAS_TIPO_PROCESO_JURIDICO[proceso.procesoOrigen.tipo]}
                </Link>
              </dd>
            </div>
          )}
        </div>
      </dl>
    </section>
  )
}
