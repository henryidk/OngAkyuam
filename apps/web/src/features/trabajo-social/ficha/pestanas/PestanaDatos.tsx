import { useState, type ReactNode } from 'react'
import { edadEnAniosGT, formatFechaGT } from '@akyuam/shared'
import Button from '../../../../components/ui/Button'
import Drawer from '../../../../components/ui/Drawer'
import FormularioIdentidadUsuaria from '../../FormularioIdentidadUsuaria'
import { rangoEdadCorto } from '../../usuarias/filaUsuaria'
import { useContextoFicha } from '../contextoFicha'
import { textoNino } from '../textoCaso'
import { textoGrupoEtnico, textoUbicacion } from '../textoUsuaria'
import { useDetalleCaso } from '../useDetalleCaso'
import Tarjeta from './Tarjeta'

function Campo({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-gray-500">{etiqueta}</dt>
      <dd className="mt-0.5 text-sm text-gray-900">{children || '—'}</dd>
    </div>
  )
}

/** Datos personales (plan §12.5): un solo bloque de identidad, editable, + hijas e hijos. */
export default function PestanaDatos() {
  const { usuaria, onUsuariaActualizada, version } = useContextoFicha()
  const [editando, setEditando] = useState(false)
  const casoActual = usuaria.casos[0] ?? null
  const { detalle } = useDetalleCaso(casoActual?.id ?? null, version)
  const edad = edadEnAniosGT(usuaria.fechaNacimiento)

  return (
    <div className="space-y-4">
      <Tarjeta
        titulo="Datos de la usuaria"
        accion={
          <Button variante="secondary" onClick={() => setEditando(true)}>
            Editar
          </Button>
        }
      >
        <p className="-mt-1 mb-4 text-[13px] text-gray-500">
          Un solo registro. Estos mismos datos alimentan el reporte de población beneficiada y los ven todas las áreas a
          las que se refiere.
        </p>
        <dl className="grid gap-x-6 gap-y-4 [grid-template-columns:repeat(auto-fill,minmax(200px,1fr))]">
          <Campo etiqueta="Nombres">{usuaria.nombres}</Campo>
          <Campo etiqueta="Apellidos">{usuaria.apellidos}</Campo>
          <Campo etiqueta="DPI">
            <span className="tabular-nums">{usuaria.dpi}</span>
          </Campo>
          <Campo etiqueta="Fecha de nacimiento">
            <span className="tabular-nums">
              {formatFechaGT(usuaria.fechaNacimiento)} · {edad} años ({rangoEdadCorto(edad)})
            </span>
          </Campo>
          <Campo etiqueta="Grupo étnico">{textoGrupoEtnico(usuaria.grupoEtnico)}</Campo>
          <Campo etiqueta="Municipio">{textoUbicacion(usuaria)}</Campo>
          <Campo etiqueta="Teléfono">
            <span className="tabular-nums">{usuaria.telefono}</span>
          </Campo>
          <Campo etiqueta="Dirección">{usuaria.direccion}</Campo>
          <Campo etiqueta="Ubicación geográfica">{usuaria.ubicacionGeografica}</Campo>
        </dl>
      </Tarjeta>

      <Tarjeta titulo="Hijas e hijos">
        {!casoActual ? (
          <p className="text-sm text-gray-500">Sin casos registrados.</p>
        ) : !detalle ? (
          <div className="h-10 animate-pulse rounded bg-gray-100" />
        ) : detalle.ninos.length === 0 ? (
          <p className="text-sm text-gray-500">
            {detalle.tipoRegistro === 'INTERNA'
              ? 'Ingresó al albergue sin hijas ni hijos.'
              : 'Solo se registran cuando ingresa al albergue (registro interno).'}
          </p>
        ) : (
          <>
            <ul className="space-y-1 text-sm text-gray-800">
              {detalle.ninos.map((nino, indice) => (
                <li key={indice}>{textoNino(nino)}</li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-gray-500">
              Registradas en el caso actual ({casoActual.numero}). Cada caso guarda las suyas.
            </p>
          </>
        )}
      </Tarjeta>

      <Drawer abierto={editando} titulo="Editar datos de la usuaria" onCerrar={() => setEditando(false)}>
        <FormularioIdentidadUsuaria
          usuaria={usuaria}
          onGuardado={(actualizada) => {
            onUsuariaActualizada(actualizada)
            setEditando(false)
          }}
          onCancelar={() => setEditando(false)}
        />
      </Drawer>
    </div>
  )
}
