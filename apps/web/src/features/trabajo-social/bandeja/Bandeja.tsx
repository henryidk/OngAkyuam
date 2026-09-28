import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ETIQUETAS_TIPO_REGISTRO,
  formatFechaLargaGT,
  hoyGT,
  mesActualGT,
  nombreMesGT,
  type FilaColaReferir,
  type ResumenMesTs,
} from '@akyuam/shared'
import Button from '../../../components/ui/Button'
import { useAuthStore } from '../../../store/auth.store'
import ModalReferir from '../referir/ModalReferir'
import ColaBandeja, { ColaEsqueleto, FilaCola } from './ColaBandeja'
import ListaNovedades from './ListaNovedades'
import TablaRecientes from './TablaRecientes'
import { cuandoTexto, saludoSegunHora, textoDias } from './textoBandeja'
import { useBandeja } from './useBandeja'

/** "Ver todas" solo tiene sentido cuando la cola trae más de lo que cabe en la tarjeta. */
function verTodasSiHayMas(total: number, mostradas: number, ruta: string) {
  return total > mostradas ? ruta : undefined
}

/** Inicio de Trabajo Social (plan §12.3): lo que requiere atención hoy, en vivo por socket. */
export default function Bandeja() {
  const usuario = useAuthStore((estado) => estado.usuario)
  const { bandeja, error, recargar } = useBandeja()
  const [referir, setReferir] = useState<FilaColaReferir | null>(null)

  const primerNombre = usuario?.nombreCompleto.split(' ')[0] ?? ''

  return (
    <div className="mx-auto flex max-w-[1240px] flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight text-gray-900">
            {saludoSegunHora()}
            {primerNombre && `, ${primerNombre}`}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {formatFechaLargaGT(hoyGT())} · esto es lo que requiere tu atención hoy.
          </p>
        </div>
        {bandeja && <ResumenMes resumen={bandeja.resumenMes} />}
      </header>

      {error && <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(280px,1fr))]">
        {!bandeja ? (
          <>
            <ColaEsqueleto />
            <ColaEsqueleto />
            <ColaEsqueleto />
          </>
        ) : (
          <>
            <ColaBandeja
              titulo="Pendientes de referir"
              subtitulo="Registradas, sin área asignada todavía."
              tono="warning"
              total={bandeja.pendientesReferir.total}
              verTodas={verTodasSiHayMas(
                bandeja.pendientesReferir.total,
                bandeja.pendientesReferir.filas.length,
                '/trabajo-social/usuarias?estado=SIN_REFERIR',
              )}
            >
              {bandeja.pendientesReferir.filas.map((fila) => (
                <FilaCola
                  key={fila.expedienteId}
                  usuariaId={fila.usuariaId}
                  nombre={fila.nombreCompleto}
                  meta={`${fila.numeroExpediente} · ${ETIQUETAS_TIPO_REGISTRO[fila.tipoRegistro]} · ${cuandoTexto(fila.createdAt)}`}
                  accion={
                    <Button variante="acento" onClick={() => setReferir(fila)}>
                      Referir
                    </Button>
                  }
                />
              ))}
            </ColaBandeja>

            <ColaBandeja
              titulo="Documentos por subir"
              subtitulo="Formularios físicos que aún no tienen escaneo."
              tono="brand"
              total={bandeja.documentosPendientes.total}
            >
              {bandeja.documentosPendientes.filas.map((fila) => (
                <FilaCola
                  key={fila.expedienteId}
                  usuariaId={fila.usuariaId}
                  nombre={fila.nombreCompleto}
                  meta={`${fila.numeroExpediente} · ${fila.tiposFaltantes.length} ${
                    fila.tiposFaltantes.length === 1 ? 'documento' : 'documentos'
                  }`}
                  accion={
                    <Link
                      to={`/trabajo-social/usuarias/${fila.usuariaId}/documentos?caso=${fila.expedienteId}`}
                      className="text-xs font-medium text-brand-600 hover:text-brand-700"
                    >
                      Subir
                    </Link>
                  }
                />
              ))}
            </ColaBandeja>

            <ColaBandeja
              titulo="En albergue"
              subtitulo="Usuarias internas activas y sus hijas/hijos."
              tono="success"
              total={bandeja.enAlbergue.total}
              verTodas={verTodasSiHayMas(
                bandeja.enAlbergue.total,
                bandeja.enAlbergue.filas.length,
                '/trabajo-social/usuarias?estado=EN_ALBERGUE',
              )}
            >
              {bandeja.enAlbergue.filas.map((fila) => (
                <FilaCola
                  key={fila.expedienteId}
                  usuariaId={fila.usuariaId}
                  nombre={fila.nombreCompleto}
                  meta={`${fila.numeroExpediente}${
                    fila.cantidadNinos > 0
                      ? ` · con ${fila.cantidadNinos} ${fila.cantidadNinos === 1 ? 'hija/hijo' : 'hijas/hijos'}`
                      : ''
                  }`}
                  accion={
                    <span className="text-xs tabular-nums text-gray-500">
                      {fila.diasEnAlbergue === null ? 'Sin fecha de ingreso' : textoDias(fila.diasEnAlbergue)}
                    </span>
                  }
                />
              ))}
            </ColaBandeja>
          </>
        )}
      </div>

      {bandeja && (
        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <TablaRecientes filas={bandeja.recientes} />
          <ListaNovedades novedades={bandeja.novedades} />
        </div>
      )}

      {referir && (
        <ModalReferir
          expedienteId={referir.expedienteId}
          numeroExpediente={referir.numeroExpediente}
          nombreUsuaria={referir.nombreCompleto}
          areasReferidas={[]}
          onCerrar={() => setReferir(null)}
          onReferido={() => {
            setReferir(null)
            void recargar()
          }}
        />
      )}
    </div>
  )
}

function ResumenMes({ resumen }: { resumen: ResumenMesTs }) {
  const { mes } = mesActualGT()
  return (
    <p className="text-[13px] text-gray-500">
      {nombreMesGT(mes)}: <Numero valor={resumen.usuariasRegistradas} /> usuarias registradas ·{' '}
      <Numero valor={resumen.ninosRegistrados} /> hijas/hijos · <Numero valor={resumen.referencias} /> referencias
    </p>
  )
}

function Numero({ valor }: { valor: number }) {
  return <span className="font-semibold tabular-nums text-gray-900">{valor}</span>
}
