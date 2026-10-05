import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CONTRAPARTE_MAX,
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

const SIN_DATO = '—'
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
function FormularioDatos({ proceso, onCancelar, onGuardado, onConflicto }: Omit<PanelDatosProps, 'onGuardado'> & {
  onCancelar: () => void
  onGuardado: () => void
}) {
  const personal = usePersonalJuridico()
  const [numeroJudicial, setNumeroJudicial] = useState(proceso.numeroJudicial ?? '')
  const [organoJudicial, setOrganoJudicial] = useState(proceso.organoJudicial ?? '')
  const [contraparte, setContraparte] = useState(proceso.contraparte ?? '')
  const [abogadaId, setAbogadaId] = useState(proceso.abogada?.id ?? '')
  const [procuradoraId, setProcuradoraId] = useState(proceso.procuradora?.id ?? '')
  const { enviando, error, setError, enviar } = useEnvio(onConflicto)

  function guardar() {
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
    void enviar(() => editarDatosProceso(proceso.id, validado.data), onGuardado)
  }

  const textos = [
    { etiqueta: 'No. judicial', valor: numeroJudicial, cambiar: setNumeroJudicial, largo: 60 },
    { etiqueta: 'Juzgado u órgano', valor: organoJudicial, cambiar: setOrganoJudicial, largo: 160 },
    { etiqueta: 'Contraparte', valor: contraparte, cambiar: setContraparte, largo: CONTRAPARTE_MAX },
  ]
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
      <h3 className="mb-3 text-sm font-semibold text-gray-900">Editando datos del proceso</h3>
      <form
        onSubmit={(evento) => {
          evento.preventDefault()
          guardar()
        }}
      >
        <div className="space-y-3">
          {textos.map((campo) => (
            <label key={campo.etiqueta} className={CLASE_ETIQUETA}>
              <span>{campo.etiqueta}</span>
              <input
                type="text"
                value={campo.valor}
                maxLength={campo.largo}
                onChange={(evento) => campo.cambiar(evento.target.value)}
                className={CLASE_CAMPO}
              />
            </label>
          ))}
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

/** Datos del proceso; se editan dentro de la misma tarjeta, como Datos personales en Trabajo Social. */
export default function PanelDatos({ proceso, onGuardado, onConflicto }: PanelDatosProps) {
  const [editando, setEditando] = useState(false)

  if (editando) {
    return (
      <FormularioDatos
        proceso={proceso}
        onConflicto={onConflicto}
        onCancelar={() => setEditando(false)}
        onGuardado={() => {
          setEditando(false)
          onGuardado('Datos del proceso actualizados')
        }}
      />
    )
  }

  const filas: [string, string][] = [
    ['No. interno', proceso.codigo],
    ['No. judicial', proceso.numeroJudicial || SIN_DATO],
    ['Juzgado u órgano', proceso.organoJudicial || SIN_DATO],
    ['Contraparte', proceso.contraparte || SIN_DATO],
    ['Abogada', proceso.abogada?.nombre ?? 'Sin asignar'],
    ['Procuradora', proceso.procuradora?.nombre ?? 'Sin asignar'],
    ['Fecha de inicio', formatFechaGT(proceso.fechaInicio)],
  ]
  if (proceso.fechaCierre) filas.push(['Fecha de cierre', formatFechaGT(proceso.fechaCierre)])

  return (
    <section className={`${CLASE_TARJETA} border border-gray-200 p-4`}>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">Datos del proceso</h3>
        <Button variante="secondary" onClick={() => setEditando(true)}>
          Editar
        </Button>
      </div>
      <dl className="space-y-2.5">
        {filas.map(([etiqueta, valor]) => (
          <div key={etiqueta}>
            <dt className="text-[11px] uppercase tracking-wide text-gray-500">{etiqueta}</dt>
            <dd className={`mt-0.5 text-sm ${valor === SIN_DATO || valor === 'Sin asignar' ? 'text-gray-400' : 'text-gray-900'}`}>
              {valor}
            </dd>
          </div>
        ))}
        {proceso.procesoOrigen && (
          <div>
            <dt className="text-[11px] uppercase tracking-wide text-gray-500">Proceso de origen</dt>
            <dd className="mt-0.5 text-sm">
              <Link to={RUTAS_JURIDICO.proceso(proceso.procesoOrigen.id)} className="text-brand-700 hover:underline">
                {proceso.procesoOrigen.codigo} · {ETIQUETAS_TIPO_PROCESO_JURIDICO[proceso.procesoOrigen.tipo]}
              </Link>
            </dd>
          </div>
        )}
      </dl>
    </section>
  )
}
