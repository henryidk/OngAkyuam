import { useCallback } from 'react'
import { Link } from 'react-router-dom'
import { ETIQUETAS_TIPO_DOCUMENTO_MEDICO, formatFechaGT } from '@akyuam/shared'
import { ErrorVista, Esqueleto } from '../../../components/ui/EstadosVista'
import { useRecurso } from '../../../lib/useRecurso'
import { listarDocumentos } from '../api/medica.api'
import AccionesDocumento from '../compartido/AccionesDocumento'
import { InsigniaFormato } from '../compartido/DetalleConsulta'
import { CLASE_TARJETA } from '../compartido/estilos'
import { RUTAS_MEDICA } from '../rutas'
import { useContextoFicha } from './contextoFicha'

/** Documentos médicos: todo lo adjuntado en las consultas, del más reciente al más antiguo. */
export default function PestanaDocumentos() {
  const { ficha } = useContextoFicha()
  const { usuariaId, totalDocumentos } = ficha
  const cargar = useCallback(
    () => listarDocumentos(usuariaId),
    // Se vuelve a pedir si la ficha recargada trae otro total.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [usuariaId, totalDocumentos],
  )
  const { datos: documentos, error, recargar } = useRecurso(cargar)

  return (
    <section className={`${CLASE_TARJETA} flex flex-col gap-2.5 px-5 py-4`}>
      <h2 className="text-sm font-semibold text-[#1c2430]">Documentos médicos</h2>
      <p className="text-[12.5px] text-[#5b6573]">
        Resultados, recetas, órdenes y constancias adjuntados en cada consulta. Los documentos de Trabajo Social están en{' '}
        <Link to={RUTAS_MEDICA.datos(usuariaId)} className="font-medium text-brand-700 hover:underline">
          Datos y caso
        </Link>
        .
      </p>
      {error ? (
        <ErrorVista mensaje={error.mensaje} sinPermiso={error.sinPermiso} recurso="los documentos" onReintentar={() => void recargar()} />
      ) : !documentos ? (
        <Esqueleto filas={3} />
      ) : documentos.length === 0 ? (
        <p className="text-[13px] text-[#5b6573]">Sin documentos todavía.</p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {documentos.map((documento) => (
            <li key={documento.id} className="flex flex-wrap items-center gap-2.5 rounded-md border border-[#e3e6ea] px-3 py-[9px]">
              <InsigniaFormato mimeType={documento.mimeType} />
              <div className="flex min-w-[180px] flex-1 flex-col">
                <span className="text-[13px] font-medium text-[#1c2430]">{documento.nombreVisible}</span>
                <span className="text-xs tabular-nums text-[#5b6573]">
                  {ETIQUETAS_TIPO_DOCUMENTO_MEDICO[documento.tipo]} · {formatFechaGT(documento.fechaConsulta)} · {documento.personaNombre}
                </span>
              </div>
              <AccionesDocumento documentoId={documento.id} nombre={documento.nombreVisible} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
