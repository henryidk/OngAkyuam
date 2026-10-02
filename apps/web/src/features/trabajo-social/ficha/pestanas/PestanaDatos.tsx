import { useCallback, useEffect, useRef, useState } from 'react'
import { edadEnAniosGT, fechaCalendarioGT, formatFechaGT, type UsuariaExpedienteHub } from '@akyuam/shared'
import Button from '../../../../components/ui/Button'
import { useToast } from '../../../../components/ui/Toast'
import EdicionIdentidadUsuaria from '../../identidad/EdicionIdentidadUsuaria'
import { rangoEdadCorto } from '../../usuarias/filaUsuaria'
import { useContextoFicha } from '../contextoFicha'
import { textoNino } from '../textoCaso'
import { textoAreasQueVenDatos, textoDepartamento, textoGrupoEtnico, textoMunicipio } from '../textoUsuaria'
import { useDetalleCaso } from '../useDetalleCaso'
import CampoLectura from './CampoLectura'
import Tarjeta from './Tarjeta'

type Modo = 'lectura' | 'edicion'

/** Datos personales (plan §12.5): un solo bloque de identidad, editable en línea, + hijas e hijos. */
export default function PestanaDatos() {
  const { usuaria, onUsuariaActualizada, version, setEditandoDatos } = useContextoFicha()
  const { mostrar } = useToast()
  const [modo, setModo] = useState<Modo>('lectura')
  const botonEditar = useRef<HTMLButtonElement>(null)
  const vuelveDeEditar = useRef(false)
  const casoActual = usuaria.casos[0] ?? null
  const { detalle } = useDetalleCaso(casoActual?.id ?? null, version)
  const edad = edadEnAniosGT(usuaria.fechaNacimiento)

  // El encabezado de la ficha deshabilita egreso y referir mientras se edita.
  useEffect(() => {
    setEditandoDatos(modo === 'edicion')
    return () => setEditandoDatos(false)
  }, [modo, setEditandoDatos])

  // Al salir de la edición, el foco vuelve al botón que la abrió.
  useEffect(() => {
    if (modo === 'lectura' && vuelveDeEditar.current) {
      vuelveDeEditar.current = false
      botonEditar.current?.focus()
    }
  }, [modo])

  const salirDeEdicion = useCallback(() => {
    vuelveDeEditar.current = true
    setModo('lectura')
  }, [])

  const onGuardado = useCallback(
    (actualizada: UsuariaExpedienteHub) => {
      onUsuariaActualizada(actualizada)
      salirDeEdicion()
      mostrar('Datos actualizados · ya se ven en las áreas y en el reporte')
    },
    [onUsuariaActualizada, salirDeEdicion, mostrar],
  )

  return (
    <div className="space-y-4">
      {modo === 'lectura' ? (
        <Tarjeta
          titulo="Datos de la usuaria"
          accion={
            <Button ref={botonEditar} variante="secondary" onClick={() => setModo('edicion')}>
              Editar
            </Button>
          }
        >
          <p className="-mt-1 mb-4 text-[13px] text-gray-500">
            Un solo registro. Estos mismos datos alimentan el reporte de población beneficiada y los ven todas las áreas
            a las que se refiere.
          </p>
          <dl className="grid gap-x-6 gap-y-4 [grid-template-columns:repeat(auto-fill,minmax(200px,1fr))]">
            <CampoLectura etiqueta="Nombres" valor={usuaria.nombres} />
            <CampoLectura etiqueta="Apellidos" valor={usuaria.apellidos} />
            <CampoLectura etiqueta="DPI" valor={usuaria.dpi} formato="numerico" />
            <CampoLectura
              etiqueta="Fecha de nacimiento"
              valor={`${formatFechaGT(usuaria.fechaNacimiento)} · ${edad} años (${rangoEdadCorto(edad)})`}
              formato="numerico"
            />
            <CampoLectura etiqueta="Grupo étnico" valor={textoGrupoEtnico(usuaria.grupoEtnico)} />
            <CampoLectura etiqueta="Teléfono" valor={usuaria.telefono} formato="numerico" />
            <CampoLectura etiqueta="Departamento" valor={textoDepartamento(usuaria)} />
            <CampoLectura etiqueta="Municipio" valor={textoMunicipio(usuaria)} />
            <CampoLectura etiqueta="Ubicación geográfica" valor={usuaria.ubicacionGeografica} />
            <CampoLectura etiqueta="Dirección" valor={usuaria.direccion} />
            <CampoLectura
              etiqueta="Registrada"
              valor={formatFechaGT(fechaCalendarioGT(new Date(usuaria.createdAt)))}
              formato="numerico"
            />
          </dl>
        </Tarjeta>
      ) : (
        <section
          aria-labelledby="titulo-edicion-datos"
          className="rounded-xl border-2 border-brand-600 bg-white p-5 ring-4 ring-brand-50"
        >
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 id="titulo-edicion-datos" className="text-[15px] font-semibold text-gray-900">
              Editando datos de la usuaria
            </h2>
            <span className="text-xs text-gray-500">Esc para cancelar</span>
          </div>
          <p className="mb-5 rounded-lg border border-brand-100 bg-brand-50 px-3.5 py-2.5 text-[13px] text-brand-800">
            Son datos compartidos: al guardar, el cambio se refleja en{' '}
            <strong>{textoAreasQueVenDatos(casoActual)}</strong> y en el reporte de población beneficiada. Queda
            registrado en la bitácora.
          </p>
          <EdicionIdentidadUsuaria
            usuaria={usuaria}
            disposicion="cuadricula"
            onGuardado={onGuardado}
            onSalir={salirDeEdicion}
            clasePie="-mx-5 -mb-5 mt-5 rounded-b-xl px-5"
          />
        </section>
      )}

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
    </div>
  )
}
