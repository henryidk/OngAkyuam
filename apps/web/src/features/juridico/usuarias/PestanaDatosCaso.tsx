import {
  ETIQUETAS_GRUPO_ETNICO,
  ETIQUETAS_TIPO_REGISTRO,
  formatFechaGT,
} from '@akyuam/shared'
import { rangoEdadCorto } from '../../trabajo-social/usuarias/filaUsuaria'
import { Esqueleto } from '../compartido/EstadosVista'
import { useContextoFicha } from './contextoFicha'
import { textoAgresor, textoHijas, textoTipologia } from './textoCaso'

function Campo({ etiqueta, valor }: { etiqueta: string; valor: string | null | undefined }) {
  return (
    <div>
      <dt className="text-xs text-gray-500">{etiqueta}</dt>
      <dd className={`mt-0.5 text-sm ${valor ? 'text-gray-900' : 'text-[#9ca3af]'}`}>{valor || '—'}</dd>
    </div>
  )
}

export default function PestanaDatosCaso() {
  const { ficha, expedienteTs, errorExpedienteTs } = useContextoFicha()

  if (errorExpedienteTs) {
    return <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{errorExpedienteTs}</p>
  }
  if (!expedienteTs) return <Esqueleto filas={2} />

  const { usuaria, datosCaso } = expedienteTs
  const agresor = datosCaso ? textoAgresor(datosCaso) : null
  const telefonoAgresor = datosCaso?.agresor?.telefono

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-gray-200 bg-white px-5 py-4">
        <h3 className="text-sm font-semibold text-gray-900">Datos de la usuaria</h3>
        <p className="mt-0.5 text-xs text-gray-500">
          Registrados por Trabajo Social. Jurídico los consulta pero no los edita: así hay un solo registro para
          todas las áreas y el reporte.
        </p>
        <dl className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-x-6 gap-y-4">
          <Campo etiqueta="Nombres y apellidos" valor={`${usuaria.nombres} ${usuaria.apellidos}`} />
          <Campo etiqueta="DPI" valor={usuaria.dpi} />
          <Campo
            etiqueta="Fecha de nacimiento"
            valor={`${formatFechaGT(usuaria.fechaNacimiento)} · ${ficha.usuaria.edad} años (${rangoEdadCorto(ficha.usuaria.edad)})`}
          />
          <Campo etiqueta="Grupo étnico" valor={ETIQUETAS_GRUPO_ETNICO[ficha.usuaria.grupoEtnico]} />
          <Campo etiqueta="Teléfono" valor={usuaria.telefono} />
          <Campo etiqueta="Municipio" valor={ficha.usuaria.municipio} />
          <Campo etiqueta="Ubicación geográfica" valor={usuaria.ubicacionGeografica} />
          <Campo etiqueta="Dirección" valor={usuaria.direccion} />
        </dl>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white px-5 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold text-gray-900">
            Caso de Trabajo Social · Expediente {expedienteTs.numero}
          </h3>
          <span className="rounded-full bg-[#f7f3fc] px-2 py-0.5 text-[11px] font-medium text-[#7346a5]">Actual</span>
          <span className="ml-auto text-xs text-gray-500">{ETIQUETAS_TIPO_REGISTRO[expedienteTs.tipoRegistro]}</span>
        </div>
        {datosCaso ? (
          <dl className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-x-6 gap-y-4">
            <Campo etiqueta="Tipología (Decreto 22-2008)" valor={textoTipologia(datosCaso)} />
            <Campo
              etiqueta="Agresor"
              valor={agresor && telefonoAgresor ? `${agresor} · ${telefonoAgresor}` : (agresor ?? telefonoAgresor)}
            />
            <Campo etiqueta="Hijas e hijos" valor={textoHijas(expedienteTs.ninos)} />
            <div className="col-span-full">
              <Campo etiqueta="Observaciones" valor={datosCaso.observaciones} />
            </div>
          </dl>
        ) : (
          <p className="mt-3 text-sm text-gray-500">Trabajo Social no compartió los datos de este caso.</p>
        )}
      </section>
    </div>
  )
}
