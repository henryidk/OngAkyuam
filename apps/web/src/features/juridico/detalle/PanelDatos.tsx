import { useState, type ReactNode } from 'react'
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

const CLASE_ACCION = 'rounded text-[13px] font-medium text-brand-700 hover:underline'

/** Etiqueta en gris a la izquierda y el valor a la derecha, como una ficha. */
function Fila({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-3 text-[13px]">
      <dt className="whitespace-nowrap text-gray-500">{etiqueta}</dt>
      <dd className="min-w-0 text-right break-words text-gray-900">{children}</dd>
    </div>
  )
}

const SIN_ASIGNAR = <span className="text-gray-500">Sin asignar</span>

/**
 * Datos del proceso. El No. interno y el No. judicial (con su acción) ya están en la cabecera: aquí
 * no se repiten. La asignación se cambia dentro de la misma tarjeta.
 */
export default function PanelDatos({ proceso, onGuardado, onConflicto }: PanelDatosProps) {
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
    <section className={`${CLASE_TARJETA} border border-gray-200 px-[18px] py-4`}>
      <h3 className="mb-3 text-sm font-semibold text-gray-900">Datos del proceso</h3>
      <dl className="space-y-2.5">
        <Fila etiqueta="Abogada">{proceso.abogada?.nombre ?? SIN_ASIGNAR}</Fila>
        <Fila etiqueta="Procuradora">{proceso.procuradora?.nombre ?? SIN_ASIGNAR}</Fila>
        <Fila etiqueta="Inicio">
          <span className="tabular-nums">{formatFechaGT(proceso.fechaInicio)}</span>
        </Fila>
        {proceso.fechaCierre && (
          <Fila etiqueta="Cierre">
            <span className="tabular-nums">{formatFechaGT(proceso.fechaCierre)}</span>
          </Fila>
        )}
        {proceso.procesoOrigen && (
          <Fila etiqueta="Origen">
            <Link to={RUTAS_JURIDICO.proceso(proceso.procesoOrigen.id)} className="group block">
              <span className="font-mono text-brand-700 group-hover:underline">{proceso.procesoOrigen.codigo}</span>
              <span className="block text-xs text-gray-500">
                {ETIQUETAS_TIPO_PROCESO_JURIDICO[proceso.procesoOrigen.tipo]}
              </span>
            </Link>
          </Fila>
        )}
      </dl>
      <button type="button" onClick={() => setEditando(true)} className={`${CLASE_ACCION} mt-3`}>
        Cambiar asignación
      </button>
    </section>
  )
}
