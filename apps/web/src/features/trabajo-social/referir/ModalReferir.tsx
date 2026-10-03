import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import {
  AREAS_ATENCION,
  ETIQUETAS_AREA_ATENCION,
  ETIQUETAS_TIPO_DOCUMENTO,
  MOTIVO_REFERIDO_MAX,
  type AreaAtencion,
  type ReferidoCreado,
} from '@akyuam/shared'
import Button from '../../../components/ui/Button'
import Switch from '../../../components/ui/Switch'
import { useDialogoModal } from '../../../components/ui/useDialogoModal'
import { useReferir } from './useReferir'

interface ModalReferirProps {
  expedienteId: string
  numeroExpediente: string
  /** Si se conoce, el título dice "Referir a {nombre}"; si no, "Referir caso {número}". */
  nombreUsuaria?: string
  areasReferidas: AreaAtencion[]
  /** Área ya elegida al abrir (p. ej. botón "Referir" de un área no referida en el Resumen). */
  areaInicial?: AreaAtencion
  onCerrar: () => void
  onReferido: (referido: ReferidoCreado) => void
}

const CLASE_CAMPO =
  'w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500'

function TituloSeccion({ numero, children }: { numero: number; children: ReactNode }) {
  return (
    <h3 className="text-[13px] font-semibold text-gray-800">
      {numero}. {children}
    </h3>
  )
}

function FilaVisibilidad({ etiqueta, descripcion, control }: { etiqueta: string; descripcion?: string; control: ReactNode }) {
  return (
    <li className="flex items-center justify-between gap-4 py-2.5">
      <div>
        <p className="text-sm font-medium text-gray-800">{etiqueta}</p>
        {descripcion && <p className="text-xs text-gray-500">{descripcion}</p>}
      </div>
      {control}
    </li>
  )
}

function ControlVisibilidad({
  visible,
  onChange,
  ariaLabel,
  bloqueado = false,
  deshabilitado = false,
}: {
  visible: boolean
  onChange: (valor: boolean) => void
  ariaLabel: string
  bloqueado?: boolean
  deshabilitado?: boolean
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-gray-500">{deshabilitado ? 'No subido' : visible ? 'Visible' : 'Privado'}</span>
      <Switch encendido={visible} onChange={onChange} ariaLabel={ariaLabel} bloqueado={bloqueado} deshabilitado={deshabilitado} />
    </div>
  )
}

/**
 * Modal ancho de §12.7: elegir área, motivo y qué podrá ver el área. Quién atiende y la
 * prioridad no se deciden aquí: cada área las define desde su panel.
 */
export default function ModalReferir({
  expedienteId,
  numeroExpediente,
  nombreUsuaria,
  areasReferidas,
  areaInicial,
  onCerrar,
  onReferido,
}: ModalReferirProps) {
  const referir = useReferir(expedienteId, areasReferidas, onReferido, areaInicial)
  const { area } = referir
  const panel = useDialogoModal<HTMLDivElement>(true, onCerrar)
  // Jurídico tiene acceso completo por normativa: la visibilidad se muestra bloqueada y encendida.
  const esJuridico = area === 'JURIDICO'
  const todasReferidas = AREAS_ATENCION.every((opcion) => areasReferidas.includes(opcion))

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-gray-900/50 px-4 py-10">
      <div aria-hidden="true" className="absolute inset-0" onClick={onCerrar} />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-modal-referir"
        tabIndex={-1}
        className="relative w-full max-w-[640px] rounded-xl bg-white shadow-2xl outline-none"
      >
        <div className="border-b border-gray-200 px-6 py-5">
          <h2 id="titulo-modal-referir" className="text-lg font-semibold text-gray-900">
            {nombreUsuaria ? `Referir a ${nombreUsuaria}` : `Referir caso ${numeroExpediente}`}
          </h2>
          <p className="mt-0.5 text-[13px] text-gray-500">
            Expediente {numeroExpediente} · al referir, el área recibe la usuaria en su bandeja.
          </p>
        </div>

        <div className="flex flex-col gap-5 px-6 py-5">
          {referir.errorCarga && (
            <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{referir.errorCarga}</p>
          )}

          <section className="space-y-2">
            <TituloSeccion numero={1}>Área</TituloSeccion>
            {todasReferidas && <p className="text-[13px] text-gray-500">Este caso ya fue referido a todas las áreas.</p>}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {AREAS_ATENCION.map((opcion) => {
                const yaReferida = areasReferidas.includes(opcion)
                const seleccionada = area === opcion
                return (
                  <button
                    key={opcion}
                    type="button"
                    disabled={yaReferida}
                    aria-pressed={seleccionada}
                    onClick={() => referir.setArea(opcion)}
                    className={`rounded-lg border-2 p-3 text-left ${
                      yaReferida
                        ? 'cursor-not-allowed border-gray-200 bg-gray-50 opacity-60'
                        : seleccionada
                          ? 'border-brand-600 bg-brand-50'
                          : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <span className="block text-sm font-semibold text-gray-900">{ETIQUETAS_AREA_ATENCION[opcion]}</span>
                    <span className="block text-xs text-gray-500">{yaReferida ? 'Ya referida' : 'Disponible'}</span>
                  </button>
                )
              })}
            </div>
          </section>

          {area && (
            <>
              <section className="space-y-2">
                <TituloSeccion numero={2}>Motivo de la referencia</TituloSeccion>
                <label className="block">
                  <span className="sr-only">Motivo de la referencia</span>
                  <textarea
                    rows={2}
                    maxLength={MOTIVO_REFERIDO_MAX}
                    value={referir.motivo}
                    onChange={(event) => referir.setMotivo(event.target.value)}
                    placeholder="Qué necesita la usuaria de esta área"
                    className={CLASE_CAMPO}
                  />
                </label>
              </section>

              <section className="space-y-1">
                <TituloSeccion numero={3}>Qué podrá ver esta área</TituloSeccion>
                <p className="text-[13px] text-gray-500">
                  {esJuridico
                    ? 'Jurídico tiene acceso completo por normativa.'
                    : 'Puedes cambiarlo después desde Accesos y referencias.'}
                </p>
                <ul className="divide-y divide-gray-100">
                  <FilaVisibilidad
                    etiqueta="Datos de la usuaria e hijas/hijos"
                    control={<span className="text-xs text-gray-500">Siempre incluido</span>}
                  />
                  <FilaVisibilidad
                    etiqueta="Agresor, tipología y observaciones"
                    descripcion="Datos del caso"
                    control={
                      <ControlVisibilidad
                        visible={esJuridico || referir.datosCaso}
                        onChange={referir.setDatosCaso}
                        ariaLabel="Agresor, tipología y observaciones"
                        bloqueado={esJuridico}
                      />
                    }
                  />
                  {referir.documentos?.map((fila) => {
                    const subido = fila.estado === 'SUBIDO'
                    const etiqueta = ETIQUETAS_TIPO_DOCUMENTO[fila.tipo]
                    return (
                      <FilaVisibilidad
                        key={fila.tipo}
                        etiqueta={etiqueta}
                        descripcion={subido ? `Subido · v${fila.vigente?.version ?? 1}` : 'Aún no se ha subido'}
                        control={
                          <ControlVisibilidad
                            visible={esJuridico ? subido : referir.documentosVisibles.includes(fila.tipo)}
                            onChange={(visible) => referir.alternarDocumento(fila.tipo, visible)}
                            ariaLabel={etiqueta}
                            bloqueado={esJuridico}
                            deshabilitado={!subido}
                          />
                        }
                      />
                    )
                  })}
                </ul>
              </section>
            </>
          )}

          {referir.error && <p className="text-sm text-red-600">{referir.error}</p>}
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-200 bg-gray-50/50 px-6 py-4">
          <Button variante="secondary" tamano="md" onClick={onCerrar} disabled={referir.enviando}>
            Cancelar
          </Button>
          <Button tamano="md" onClick={() => void referir.referir()} cargando={referir.enviando} disabled={!area}>
            {area ? `Referir a ${ETIQUETAS_AREA_ATENCION[area]}` : 'Referir'}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
