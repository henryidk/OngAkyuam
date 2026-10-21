import { useCallback } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ETIQUETAS_ESTADO_CITA_PSICOLOGICA, ETIQUETAS_MODALIDAD_CITA, ETIQUETAS_TIPO_CITA_PSICOLOGICA, formatInstanteGT } from '@akyuam/shared'
import { useTituloPagina } from '../../../components/TituloPagina'
import Badge from '../../../components/ui/Badge'
import { ErrorVista, Esqueleto } from '../../../components/ui/EstadosVista'
import { useRecurso } from '../../../lib/useRecurso'
import { obtenerDetalleCita } from '../api/psicologia.api'
import { RUTAS_PSICOLOGIA } from '../rutas'
import CodigoProceso from '../compartido/CodigoProceso'
import BotonVerDocumento from '../procesos/BotonVerDocumento'

function Dato({ titulo, texto }: { titulo: string; texto: string | null | undefined }) {
  return <div><dt className="text-xs font-medium text-gray-500">{titulo}</dt><dd className="mt-1 whitespace-pre-wrap text-sm text-gray-800">{texto || 'Sin registrar'}</dd></div>
}
export default function DetalleCita() {
  const { citaId } = useParams<{ citaId: string }>()
  const { datos: cita, error, recargar } = useRecurso(useCallback(() => obtenerDetalleCita(citaId!), [citaId]))
  useTituloPagina({ titulo: 'Detalle de cita', migas: [{ etiqueta: 'Citas', ruta: RUTAS_PSICOLOGIA.citas() }] })
  if (error) return <ErrorVista mensaje={error.mensaje} sinPermiso={error.sinPermiso} recurso="esta cita" onReintentar={() => void recargar()} />
  if (!cita) return <Esqueleto />
  return <div className="mx-auto max-w-3xl space-y-4">
    <header><Link to={RUTAS_PSICOLOGIA.citas()} className="text-sm font-medium text-brand-700 hover:underline">← Volver a Citas</Link>
      <div className="mt-3 flex flex-wrap items-center gap-3"><h1 className="text-2xl font-semibold text-gray-900">{cita.ninoNombreCompleto ?? cita.usuariaNombreCompleto}</h1><Badge>{ETIQUETAS_ESTADO_CITA_PSICOLOGICA[cita.estado]}</Badge>{cita.borrador && <Badge>Borrador</Badge>}</div>
      <p className="mt-1 text-sm text-gray-500">{cita.numero} · <CodigoProceso codigo={cita.procesoCodigo} />{cita.ninoNombreCompleto && <> · Hija/o de {cita.usuariaNombreCompleto}</>}</p>
    </header>
    <section className="rounded-xl border border-gray-200 bg-white p-5"><h2 className="mb-4 font-semibold text-gray-900">Información de la cita</h2>
      <dl className="grid gap-4 sm:grid-cols-2">
        <Dato titulo="Fecha y hora" texto={formatInstanteGT(cita.fechaHora)} />
        <Dato titulo="Duración" texto={`${cita.duracionMinutos} minutos`} />
        <Dato titulo={cita.estado === 'ATENDIDA' ? 'Atendió' : 'Profesional de la cita'} texto={cita.atendidoPor} />
        <Dato titulo="Responsable del proceso" texto={cita.responsable?.nombre} />
        <Dato titulo="Clínica" texto={cita.lugar} />
        <Dato titulo="Modalidad" texto={ETIQUETAS_MODALIDAD_CITA[cita.modalidad]} />
        <Dato titulo="Tipo" texto={ETIQUETAS_TIPO_CITA_PSICOLOGICA[cita.tipo]} />
        {cita.motivo && <Dato titulo="Motivo" texto={cita.motivo} />}
      </dl>
    </section>
    {cita.estado === 'ATENDIDA' && <section className="space-y-4 rounded-xl border border-gray-200 bg-white p-5">
      <h2 className="font-semibold text-gray-900">Registro de la sesión</h2><dl className="space-y-4">
        <Dato titulo="Enfoque terapéutico" texto={cita.enfoqueTerapeutico} /><Dato titulo="Temas abordados" texto={cita.temas} />
        <Dato titulo="Intervención" texto={cita.intervencion} /><Dato titulo="Recomendaciones" texto={cita.recomendaciones} />
        <Dato titulo="Acuerdos" texto={cita.acuerdos} /><Dato titulo="Observaciones" texto={cita.observaciones} />
      </dl>
    </section>}
    {(cita.estado === 'NO_ASISTIO' || cita.estado === 'CANCELADA') && <dl className="rounded-xl border border-gray-200 bg-white p-5"><Dato titulo={cita.estado === 'NO_ASISTIO' ? 'Motivo de inasistencia' : 'Motivo de cancelación'} texto={cita.motivoNoAsistencia} /></dl>}
    {cita.documento && <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-5"><span className="text-sm text-gray-700">Hoja de evolución · {cita.documento.nombreArchivo}</span><BotonVerDocumento citaId={cita.id} nombreArchivo={cita.documento.nombreArchivo} /></div>}
    <div className="flex flex-wrap gap-4 text-sm font-medium">
      {cita.procesoEtapa !== 'CIERRE' && (!cita.soloLectura || cita.puedeAsumirAtencion) && (cita.estado === 'PROGRAMADA' || (!cita.soloLectura && cita.estado === 'ATENDIDA')) && <Link to={RUTAS_PSICOLOGIA.registrarConsulta(cita.id)} className="text-brand-700 hover:underline">{cita.estado === 'ATENDIDA' ? 'Corregir registro' : 'Registrar sesión'}</Link>}
      <Link to={RUTAS_PSICOLOGIA.proceso(cita.procesoId)} className="text-gray-600 hover:underline">Ver proceso</Link>
    </div>
  </div>
}
