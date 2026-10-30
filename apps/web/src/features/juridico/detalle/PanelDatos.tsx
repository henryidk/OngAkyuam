import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { UserPlus } from 'lucide-react'
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
      <h3 className="mb-3 text-sm font-semibold text-gray-900">Equipo responsable</h3>
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

function iniciales(nombre: string): string {
  return nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0]?.toUpperCase())
    .join('')
}

/** Una persona del equipo con sus iniciales; si falta, un botón punteado para asignarla. */
function MiembroEquipo({
  cargo,
  persona,
  onAsignar,
}: {
  cargo: 'Abogada' | 'Procuradora'
  persona: PersonalAsignado | null
  onAsignar: () => void
}) {
  if (!persona) {
    return (
      <li>
        <button
          type="button"
          onClick={onAsignar}
          className="flex w-full items-center gap-2.5 rounded-lg border border-dashed border-gray-300 px-2.5 py-2 text-left text-[13px] text-gray-600 hover:border-brand-500 hover:bg-brand-50 hover:text-brand-700"
        >
          <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-gray-100">
            <UserPlus className="h-4 w-4" aria-hidden="true" />
          </span>
          Asignar {cargo.toLowerCase()}
        </button>
      </li>
    )
  }
  return (
    <li className="flex items-center gap-2.5 px-2.5 py-1">
      <span
        aria-hidden="true"
        className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700"
      >
        {iniciales(persona.nombre)}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[13px] font-medium text-gray-900">{persona.nombre}</span>
        <span className="block text-xs text-gray-500">{cargo}</span>
      </span>
    </li>
  )
}

/**
 * Datos del proceso. El No. interno y el No. judicial (con su acción) ya están en la cabecera: aquí
 * no se repiten. El equipo (abogada y procuradora) se asigna dentro de la misma tarjeta.
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
          onGuardado('Equipo responsable actualizado')
        }}
      />
    )
  }

  return (
    <section className={`${CLASE_TARJETA} border border-gray-200 px-[18px] py-4`}>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-semibold text-gray-900">Equipo responsable</h3>
        {(proceso.abogada || proceso.procuradora) && (
          <button type="button" onClick={() => setEditando(true)} className={CLASE_ACCION}>
            Cambiar
          </button>
        )}
      </div>
      <ul className="-mx-2.5 space-y-1.5">
        <MiembroEquipo cargo="Abogada" persona={proceso.abogada} onAsignar={() => setEditando(true)} />
        <MiembroEquipo cargo="Procuradora" persona={proceso.procuradora} onAsignar={() => setEditando(true)} />
      </ul>

      <h3 className="mb-3 mt-4 border-t border-gray-100 pt-4 text-sm font-semibold text-gray-900">Datos del proceso</h3>
      <dl className="space-y-2.5">
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
    </section>
  )
}
