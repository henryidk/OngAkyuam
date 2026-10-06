import type { ReactNode } from 'react'
import type { UseFormReturn } from 'react-hook-form'
import {
  ETIQUETAS_GENERO,
  ETIQUETAS_GRUPO_ETNICO,
  ETIQUETAS_MUNICIPIO_ALTA_VERAPAZ,
  ETIQUETAS_TIPO_REGISTRO,
  ETIQUETAS_TIPO_DOCUMENTO,
  ETIQUETAS_TIPOLOGIA_DELITO,
  formatFechaGT,
  municipiosDeDepartamento,
  tipoDocumentoAplicaARegistro,
  type RegistroUsuariaNuevaFormValues,
  type TipoRegistro,
} from '@akyuam/shared'
import type { DocumentoRegistro } from '../hooks/useDocumentosStaging'
import type { PasoId } from '../wizard'

interface PasoRevisionProps {
  form: UseFormReturn<RegistroUsuariaNuevaFormValues>
  onEditar: (pasoId: PasoId) => void
  /** Cuando la usuaria ya existe, su identidad no es parte de este wizard — no hay nada que revisar aquí. */
  usuariaExistente: boolean
  documentos: DocumentoRegistro[]
  tipoRegistro: TipoRegistro | ''
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
    <section className="rounded-lg border border-gray-200 px-4 py-3.5">
      <div className="mb-1 flex items-center justify-between">
        <h3 className="text-[13px] font-semibold text-gray-700">{titulo}</h3>
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

export default function PasoRevision({ form, onEditar, usuariaExistente, documentos, tipoRegistro }: PasoRevisionProps) {
  const datos = form.getValues()
  const caso = datos.datosCaso
  const agresor = caso.datosAgresor
  const esInterna = caso.tipoRegistro === 'INTERNA'
  // Mismo criterio que lo que se envía al registrar (`idsParaRegistrar`).
  const aplicables = documentos.filter((documento) =>
    tipoDocumentoAplicaARegistro(documento.tipo, tipoRegistro || 'EXTERNA'),
  )
  const nombres = (estado: DocumentoRegistro['estado']) =>
    aplicables
      .filter((documento) => documento.estado === estado)
      .map((documento) => ETIQUETAS_TIPO_DOCUMENTO[documento.tipo])
      .join(', ')
  const subidos = nombres('subido')
  const subiendo = nombres('subiendo')
  const conError = nombres('error')

  const tieneDatosAgresor = agresor.nombres || agresor.apellidos || agresor.telefono || agresor.direccion

  return (
    <div className="flex flex-col gap-4">
      {!usuariaExistente && (
        <Seccion titulo="Usuaria" pasoId="usuaria" onEditar={onEditar}>
          <Fila etiqueta="Fecha de registro" valor={formatFechaGT(caso.fecha)} />
          <Fila etiqueta="Nombres" valor={datos.datosUsuaria.nombres} />
          <Fila etiqueta="Apellidos" valor={datos.datosUsuaria.apellidos} />
          <Fila etiqueta="DPI" valor={datos.datosUsuaria.dpi ?? ''} />
          <Fila etiqueta="Teléfono" valor={datos.datosUsuaria.telefono ?? ''} />
          <Fila etiqueta="Dirección" valor={datos.datosUsuaria.direccion ?? ''} />
          <Fila etiqueta="Fecha de nacimiento" valor={formatFechaGT(datos.datosUsuaria.fechaNacimiento)} />
          <Fila etiqueta="Grupo étnico" valor={ETIQUETAS_GRUPO_ETNICO[datos.datosUsuaria.grupoEtnico]} />
          {datos.datosUsuaria.fueraDeAltaVerapaz ? (
            <>
              <Fila etiqueta="Departamento de origen" valor={datos.datosUsuaria.departamentoOtro} />
              <Fila
                etiqueta="Municipio de origen"
                valor={
                  municipiosDeDepartamento(datos.datosUsuaria.departamentoOtro).includes(datos.datosUsuaria.municipioOtro)
                    ? datos.datosUsuaria.municipioOtro
                    : `${datos.datosUsuaria.municipioOtro} (escrito a mano)`
                }
              />
            </>
          ) : (
            <Fila
              etiqueta="Municipio"
              valor={
                datos.datosUsuaria.municipio
                  ? ETIQUETAS_MUNICIPIO_ALTA_VERAPAZ[
                      datos.datosUsuaria.municipio as keyof typeof ETIQUETAS_MUNICIPIO_ALTA_VERAPAZ
                    ]
                  : ''
              }
            />
          )}
          <Fila etiqueta="Ubicación geográfica" valor={datos.datosUsuaria.ubicacionGeografica} />
        </Seccion>
      )}

      <Seccion titulo="Situación de violencia" pasoId="situacion" onEditar={onEditar}>
        {usuariaExistente && <Fila etiqueta="Fecha de registro" valor={formatFechaGT(caso.fecha)} />}
        <Fila
          etiqueta="Tipología del delito"
          valor={caso.tipologiaDelito.map((tipo) => ETIQUETAS_TIPOLOGIA_DELITO[tipo]).join(', ')}
        />
        <Fila
          etiqueta="Agresor"
          valor={
            tieneDatosAgresor
              ? [`${agresor.nombres} ${agresor.apellidos}`.trim(), agresor.telefono, agresor.direccion]
                  .filter(Boolean)
                  .join(' · ')
              : 'La usuaria no proporcionó datos'
          }
        />
        <Fila etiqueta="Observaciones" valor={caso.observaciones.trim()} />
      </Seccion>

      <Seccion titulo="Tipo de registro" pasoId="registro" onEditar={onEditar}>
        <Fila etiqueta="Tipo" valor={ETIQUETAS_TIPO_REGISTRO[caso.tipoRegistro]} />
        {esInterna && <Fila etiqueta="Ingreso al albergue" valor={formatFechaGT(caso.fechaIngresoAlbergue)} />}
      </Seccion>

      {esInterna && (
        <Seccion titulo="Hijas e hijos" pasoId="hijos" onEditar={onEditar}>
          {caso.ninos.length === 0 ? (
            <p className="py-1.5 text-sm text-gray-500">Ingresa sin hijas ni hijos.</p>
          ) : (
            <ul className="space-y-1 py-1.5 text-sm">
              {caso.ninos.map((nino, indice) => (
                <li key={indice} className="text-gray-700">
                  {nino.nombres} {nino.apellidos} — {ETIQUETAS_GENERO[nino.genero]}, nacimiento{' '}
                  {formatFechaGT(nino.fechaNacimiento)}
                </li>
              ))}
            </ul>
          )}
        </Seccion>
      )}

      <Seccion titulo="Documentos" pasoId="documentos" onEditar={onEditar}>
        <Fila etiqueta="Subidos" valor={subidos || 'Ninguno por ahora'} />
        {subiendo && <Fila etiqueta="Todavía subiendo" valor={subiendo} />}
        {conError && <Fila etiqueta="No se subieron (no se adjuntarán)" valor={conError} />}
      </Seccion>
    </div>
  )
}
