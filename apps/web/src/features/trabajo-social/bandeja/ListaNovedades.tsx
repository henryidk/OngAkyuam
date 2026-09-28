import { Link } from 'react-router-dom'
import { ETIQUETAS_AREA_ATENCION, type NovedadArea } from '@akyuam/shared'
import Tarjeta from '../ficha/pestanas/Tarjeta'
import { ABREVIATURA_AREA } from '../abreviaturaArea'
import { cuandoTexto } from './textoBandeja'

/** "Novedades de las áreas": lo que hicieron las áreas con las usuarias que esta persona registró o refirió. */
export default function ListaNovedades({ novedades }: { novedades: NovedadArea[] }) {
  return (
    <Tarjeta titulo="Novedades de las áreas">
      <p className="-mt-2 mb-4 text-xs text-gray-500">Lo que pasa con las usuarias que referiste.</p>
      {novedades.length === 0 ? (
        <p className="text-sm text-gray-500">Sin novedades por ahora.</p>
      ) : (
        <ul className="flex flex-col gap-3.5">
          {novedades.map((novedad) => (
            <li key={novedad.id} className="flex gap-3">
              <span
                title={ETIQUETAS_AREA_ATENCION[novedad.area]}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-50 text-[11px] font-semibold text-brand-700"
              >
                {ABREVIATURA_AREA[novedad.area]}
              </span>
              <div className="min-w-0">
                <p className="text-pretty text-[13px] text-gray-800">
                  <Link
                    to={`/trabajo-social/usuarias/${novedad.usuariaId}`}
                    className="font-medium hover:underline"
                  >
                    {novedad.nombreCompleto}
                  </Link>
                  {' · '}
                  {novedad.texto}
                </p>
                <p className="text-xs text-gray-400">{cuandoTexto(novedad.createdAt)}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Tarjeta>
  )
}
