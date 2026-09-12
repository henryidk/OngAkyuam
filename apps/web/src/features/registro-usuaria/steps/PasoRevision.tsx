import type { ReactNode } from 'react'
import type { UseFormReturn } from 'react-hook-form'
import {
  ETIQUETAS_AREA_ATENCION,
  ETIQUETAS_GENERO,
  ETIQUETAS_GRUPO_ETNICO,
  ETIQUETAS_MUNICIPIO_ALTA_VERAPAZ,
  ETIQUETAS_TIPO_REGISTRO,
  ETIQUETAS_TIPOLOGIA_DELITO,
  formatFechaGT,
  type RegistroUsuariaFormValues,
} from '@akyuam/shared'
import type { PasoId } from '../wizard'

interface PasoRevisionProps {
  form: UseFormReturn<RegistroUsuariaFormValues>
  onEditar: (pasoId: PasoId) => void
}

function Fila({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 text-sm">
      <dt className="text-gray-500">{etiqueta}</dt>
      <dd className="text-right font-medium text-gray-800">{valor || '—'}</dd>
    </div>
  )
}

function Seccion({
  titulo,
  pasoId,
  onEditar,
  children,
}: {
  titulo: string
  pasoId: PasoId
  onEditar: (pasoId: PasoId) => void
  children: ReactNode
}) {
  return (
    <section className="rounded border border-gray-200 p-4">
      <div className="mb-1 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-800">{titulo}</h3>
        <button
          type="button"
          onClick={() => onEditar(pasoId)}
          className="text-xs font-medium text-brand-600 hover:underline"
        >
          Editar
        </button>
      </div>
      <dl className="divide-y divide-gray-100">{children}</dl>
    </section>
  )
}

export default function PasoRevision({ form, onEditar }: PasoRevisionProps) {
  const datos = form.getValues()

  const tieneDatosAgresor =
    datos.datosAgresor.nombres || datos.datosAgresor.apellidos || datos.datosAgresor.telefono || datos.datosAgresor.direccion

  return (
    <div className="space-y-4">
      <Seccion titulo="Datos del caso" pasoId="caso" onEditar={onEditar}>
        <Fila etiqueta="Fecha" valor={formatFechaGT(datos.datosCaso.fecha)} />
        {datos.datosCaso.fueraDeAltaVerapaz ? (
          <>
            <Fila etiqueta="Departamento de origen" valor={datos.datosCaso.departamentoOtro} />
            <Fila etiqueta="Municipio de origen" valor={datos.datosCaso.municipioOtro} />
          </>
        ) : (
          <Fila
            etiqueta="Municipio"
            valor={
              datos.datosCaso.municipio
                ? ETIQUETAS_MUNICIPIO_ALTA_VERAPAZ[
                    datos.datosCaso.municipio as keyof typeof ETIQUETAS_MUNICIPIO_ALTA_VERAPAZ
                  ]
                : ''
            }
          />
        )}
        <Fila etiqueta="Ubicación geográfica" valor={datos.datosCaso.ubicacionGeografica} />
      </Seccion>

      <Seccion titulo="Datos de la usuaria" pasoId="usuaria" onEditar={onEditar}>
        <Fila etiqueta="Nombres" valor={datos.datosUsuaria.nombres} />
        <Fila etiqueta="Apellidos" valor={datos.datosUsuaria.apellidos} />
        <Fila etiqueta="DPI" valor={datos.datosUsuaria.dpi ?? ''} />
        <Fila etiqueta="Teléfono" valor={datos.datosUsuaria.telefono ?? ''} />
        <Fila etiqueta="Dirección" valor={datos.datosUsuaria.direccion ?? ''} />
        <Fila etiqueta="Fecha de nacimiento" valor={formatFechaGT(datos.datosUsuaria.fechaNacimiento)} />
        <Fila etiqueta="Grupo étnico" valor={ETIQUETAS_GRUPO_ETNICO[datos.datosUsuaria.grupoEtnico]} />
        <Fila
          etiqueta="Tipología del delito"
          valor={datos.datosUsuaria.tipologiaDelito.map((tipo) => ETIQUETAS_TIPOLOGIA_DELITO[tipo]).join(', ')}
        />
      </Seccion>

      <Seccion titulo="Datos del agresor" pasoId="agresor" onEditar={onEditar}>
        {tieneDatosAgresor ? (
          <>
            <Fila etiqueta="Nombres" valor={datos.datosAgresor.nombres ?? ''} />
            <Fila etiqueta="Apellidos" valor={datos.datosAgresor.apellidos ?? ''} />
            <Fila etiqueta="Teléfono" valor={datos.datosAgresor.telefono ?? ''} />
            <Fila etiqueta="Dirección" valor={datos.datosAgresor.direccion ?? ''} />
          </>
        ) : (
          <p className="py-1.5 text-sm text-gray-400">No se registraron datos del agresor.</p>
        )}
      </Seccion>

      <Seccion titulo="Tipo de registro" pasoId="registro" onEditar={onEditar}>
        <Fila etiqueta="Tipo" valor={ETIQUETAS_TIPO_REGISTRO[datos.tipoRegistro]} />
        {datos.tipoRegistro === 'INTERNA' && (
          <div className="py-1.5">
            <p className="text-sm text-gray-500">
              {datos.ninos.length === 0
                ? 'Sin niñas o niños registrados.'
                : `${datos.ninos.length} niña(s)/niño(s) registrados:`}
            </p>
            {datos.ninos.length > 0 && (
              <ul className="mt-1 space-y-1 text-sm">
                {datos.ninos.map((nino, indice) => (
                  <li key={indice} className="text-gray-700">
                    {nino.nombres} {nino.apellidos} — {ETIQUETAS_GENERO[nino.genero]}, nacimiento{' '}
                    {formatFechaGT(nino.fechaNacimiento)}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </Seccion>

      <Seccion titulo="Áreas de atención" pasoId="areas" onEditar={onEditar}>
        <Fila
          etiqueta="Referido a"
          valor={
            datos.areasReferidas.length > 0
              ? datos.areasReferidas.map((area) => ETIQUETAS_AREA_ATENCION[area]).join(', ')
              : 'Ninguna seleccionada'
          }
        />
      </Seccion>
    </div>
  )
}
