import { useEffect, useState, type ReactNode } from 'react'
import { ArrowRight } from 'lucide-react'
import {
  DIAGNOSTICO_MEDICO_MAX,
  MOTIVO_CONSULTA_MEDICA_MAX,
  PLAN_TRATAMIENTO_MAX,
  RECETA_LABORATORIOS_MAX,
  formatFechaGT,
  type CampoSignoFormulario,
  type ContextoConsultaMedicaDto,
  type PersonaConsultaMedicaDto,
} from '@akyuam/shared'
import { CLASE_CAMPO, CLASE_SECCION, CLASE_TARJETA } from '../compartido/estilos'
import { clavePersona, primerNombre } from '../compartido/personas'
import CamposSignos from './CamposSignos'
import ConsultasAnteriores from './ConsultasAnteriores'
import DocumentosConsulta from './DocumentosConsulta'
import type { EstadoPersona, ResumenDocumentos } from './registroVisita'
import { useDocumentosConsulta } from './useDocumentosConsulta'

interface PanelPersonaProps {
  contexto: ContextoConsultaMedicaDto
  persona: PersonaConsultaMedicaDto
  estado: EstadoPersona
  onCambiar: (cambios: Partial<Omit<EstadoPersona, 'signos'>>) => void
  onSigno: (campo: CampoSignoFormulario, valor: string) => void
  /** Estable entre renders (se usa en un efecto): recibe la clave de la persona. */
  onDocumentos: (clave: string, resumen: ResumenDocumentos) => void
  /** Solo el panel activo se ve; los demás quedan montados para no perder lo escrito ni cortar subidas. */
  visible: boolean
  intentado: boolean
  deshabilitado: boolean
  /** Botón al pie para pasar a la siguiente persona de la visita. */
  siguiente: { nombre: string; ir: () => void } | null
}

type Pestana = 'actual' | 'anteriores'

/** El registro de una persona de la visita: su ficha, sus signos, diagnóstico, plan y documentos. */
export default function PanelPersona({
  contexto,
  persona,
  estado,
  onCambiar,
  onSigno,
  onDocumentos,
  visible,
  intentado,
  deshabilitado,
  siguiente,
}: PanelPersonaProps) {
  const clave = clavePersona(persona)
  const esHijo = persona.ninoId !== null
  const [pestana, setPestana] = useState<Pestana>('actual')
  // Cada persona tiene su propio lote: sus documentos quedan en su consulta.
  const documentos = useDocumentosConsulta(contexto.atencionId)
  const { lote, items, hayListos, subiendo, conError } = documentos
  const cantidad = items.length

  useEffect(() => {
    onDocumentos(clave, { lote, cantidad, hayListos, subiendo, conError })
  }, [onDocumentos, clave, lote, cantidad, hayListos, subiendo, conError])

  const errorDiagnostico = intentado && estado.diagnostico.trim() === '' ? 'Escribe el diagnóstico.' : null
  const nombre = primerNombre(persona.nombreCompleto)

  return (
    <div
      role="tabpanel"
      id={`panel-persona-${clave}`}
      aria-labelledby={`pestana-persona-${clave}`}
      className={visible ? 'flex flex-col gap-4' : 'hidden'}
    >
      <section className={`${CLASE_TARJETA} flex flex-col gap-4 px-5 py-[18px]`}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className={CLASE_SECCION}>{esHijo ? `Ficha de ${nombre}` : 'Ficha de la paciente'}</h2>
          <span className="text-xs text-[#9aa4b0]">Datos de Trabajo Social</span>
        </div>
        <dl className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-x-5 gap-y-3 text-[13.5px]">
          <DatoFicha etiqueta="Nombre">{persona.nombreCompleto}</DatoFicha>
          <DatoFicha etiqueta="Edad">{persona.edad} años</DatoFicha>
          <DatoFicha etiqueta="Fecha de nacimiento">{formatFechaGT(persona.fechaNacimiento)}</DatoFicha>
          <DatoFicha etiqueta="Procedencia">{contexto.procedencia ?? '—'}</DatoFicha>
          <DatoFicha etiqueta="No. de expediente">
            <span className="font-mono">{contexto.expedienteNumero}</span>
          </DatoFicha>
          <DatoFicha etiqueta={esHijo ? 'Teléfono (madre)' : 'Teléfono'}>{contexto.telefono ?? '—'}</DatoFicha>
        </dl>
      </section>

      <div role="tablist" aria-label={`Consultas de ${nombre}`} className="flex gap-5 border-b border-[#e3e6ea]">
        {(
          [
            ['actual', 'Consulta actual'],
            ['anteriores', `Consultas anteriores (${persona.consultasAnteriores})`],
          ] as const
        ).map(([valor, etiqueta]) => (
          <button
            key={valor}
            type="button"
            role="tab"
            aria-selected={pestana === valor}
            onClick={() => setPestana(valor)}
            className={`-mb-px border-b-2 px-0.5 pb-2.5 text-[13.5px] font-medium ${
              pestana === valor ? 'border-[#7346a5] text-[#5b3985]' : 'border-transparent text-[#5b6573] hover:text-[#1c2430]'
            }`}
          >
            {etiqueta}
          </button>
        ))}
      </div>

      {pestana === 'anteriores' && visible ? (
        <ConsultasAnteriores usuariaId={contexto.usuariaId} persona={clave} nombre={nombre} />
      ) : null}

      {/* La consulta actual se oculta (no se desmonta) para no perder lo escrito ni cortar subidas. */}
      <div className={pestana === 'actual' ? 'flex flex-col gap-4' : 'hidden'}>
        <section className={`${CLASE_TARJETA} flex flex-col gap-2 px-5 py-[18px]`}>
          <label htmlFor={`motivo-${clave}`} className="text-sm font-semibold text-[#1c2430]">
            Motivo de consulta
          </label>
          <textarea
            id={`motivo-${clave}`}
            rows={2}
            maxLength={MOTIVO_CONSULTA_MEDICA_MAX}
            value={estado.motivo}
            onChange={(evento) => onCambiar({ motivo: evento.target.value })}
            placeholder={esHijo ? `Lo que refieren ${nombre} o su madre` : 'Lo que refiere la paciente, con sus palabras'}
            className={CLASE_CAMPO}
          />
        </section>

        <CamposSignos
          valores={estado.signos}
          onCambiar={onSigno}
          mostrarTodos={intentado}
        />

        <section className={`${CLASE_TARJETA} flex flex-col gap-4 px-5 py-[18px]`}>
          <CampoTexto
            id={`diagnostico-${clave}`}
            etiqueta="Diagnóstico"
            obligatorio
            filas={2}
            maximo={DIAGNOSTICO_MEDICO_MAX}
            placeholder="Impresión clínica"
            valor={estado.diagnostico}
            onCambiar={(diagnostico) => onCambiar({ diagnostico })}
            error={errorDiagnostico}
          />
          <CampoTexto
            id={`plan-${clave}`}
            etiqueta="Plan de tratamiento"
            filas={3}
            maximo={PLAN_TRATAMIENTO_MAX}
            placeholder="Indicaciones, cuidados, referencias"
            valor={estado.plan}
            onCambiar={(plan) => onCambiar({ plan })}
          />
          <CampoTexto
            id={`receta-${clave}`}
            etiqueta="Receta y laboratorios"
            filas={3}
            maximo={RECETA_LABORATORIOS_MAX}
            placeholder="Medicamentos con dosis, y laboratorios solicitados"
            valor={estado.receta}
            onCambiar={(receta) => onCambiar({ receta })}
          />
        </section>

        <DocumentosConsulta documentos={documentos} deshabilitado={deshabilitado} />

        {siguiente && (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={siguiente.ir}
              className="flex items-center gap-1.5 rounded-md border border-[#7346a5] bg-white px-4 py-2 text-[13.5px] font-semibold text-[#7346a5] hover:bg-[#f7f3fc]"
            >
              Seguir con {siguiente.nombre}
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function DatoFicha({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-[#5b6573]">{etiqueta}</dt>
      <dd className="font-medium text-[#1c2430]">{children}</dd>
    </div>
  )
}

interface CampoTextoProps {
  id: string
  etiqueta: string
  obligatorio?: boolean
  filas: number
  maximo: number
  placeholder: string
  valor: string
  onCambiar: (valor: string) => void
  error?: string | null
}

function CampoTexto({ id, etiqueta, obligatorio = false, filas, maximo, placeholder, valor, onCambiar, error }: CampoTextoProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold text-[#1c2430]">
        {etiqueta}
        {obligatorio && (
          <span aria-hidden="true" className="text-[#9b2c20]">
            {' '}
            *
          </span>
        )}
      </label>
      <textarea
        id={id}
        rows={filas}
        maxLength={maximo}
        required={obligatorio}
        value={valor}
        onChange={(evento) => onCambiar(evento.target.value)}
        placeholder={placeholder}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`${CLASE_CAMPO} ${error ? 'border-[#d4574a]' : ''}`}
      />
      {error && (
        <span id={`${id}-error`} className="text-[12px] text-[#9b2c20]">
          {error}
        </span>
      )}
    </div>
  )
}
