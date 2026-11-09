import type { ReactNode } from 'react'
import { CalendarCheck } from 'lucide-react'
import { ETIQUETAS_DURACION_CITA_MEDICA, type DuracionCitaMedica, type PersonaAtendidaDto } from '@akyuam/shared'
import { fechaLarga, horaMasMinutos } from './fechas'
import { primerNombre } from './personas'

interface ResumenCitaProps {
  /** "Consulta de", "Primera consulta de", "Próxima consulta de". */
  encabezado: string
  /** Las personas que se atienden, en el orden del expediente (la usuaria primero). */
  atendidas: PersonaAtendidaDto[]
  usuariaNombreCompleto: string
  fecha: string
  hora: string
  duracion: DuracionCitaMedica
  /** Línea final: expediente, atención o un aviso. */
  pie?: ReactNode
}

/**
 * Paso de confirmación de una cita: a quiénes se atiende y la fecha y hora bien visibles antes de
 * guardar. Lo comparten "Programar consulta" y "Próxima consulta".
 */
export default function ResumenCita({
  encabezado,
  atendidas,
  usuariaNombreCompleto,
  fecha,
  hora,
  duracion,
  pie,
}: ResumenCitaProps) {
  const usuariaAcompana = atendidas.length > 0 && !atendidas.some((una) => una.ninoId === null)
  return (
    <div className="flex flex-col items-center gap-3 py-2 text-center">
      <span aria-hidden="true" className="flex h-12 w-12 items-center justify-center rounded-full bg-seleccion text-brand-600">
        <CalendarCheck className="h-6 w-6" />
      </span>
      <div className="w-full">
        <p className="text-[13px] text-texto-suave">{encabezado}</p>
        {atendidas.length === 1 ? (
          <p className="text-base font-semibold text-texto">{atendidas[0].nombreCompleto}</p>
        ) : (
          <ul className="mx-auto mt-1 flex max-w-sm flex-col gap-1 text-left">
            {atendidas.map((una) => (
              <li
                key={una.ninoId ?? 'usuaria'}
                className="flex items-baseline justify-between gap-3 rounded-md bg-superficie px-3 py-1.5 text-[13.5px]"
              >
                <span className="font-semibold text-texto">
                  {una.ninoId ? primerNombre(una.nombreCompleto) : una.nombreCompleto}
                </span>
                <span className="text-[12px] text-texto-suave">{una.ninoId ? `Hijo/a · ${una.edad} años` : 'Usuaria'}</span>
              </li>
            ))}
          </ul>
        )}
        {usuariaAcompana && <p className="mt-1 text-[12.5px] text-texto-suave">Acompaña {usuariaNombreCompleto}</p>}
      </div>
      <div className="w-full rounded-lg border border-seleccion-borde bg-brand-50 px-4 py-3">
        <p className="text-[15px] font-semibold text-brand-700">{fechaLarga(fecha)}</p>
        <p className="font-mono text-2xl font-semibold text-texto">
          {hora} – {horaMasMinutos(hora, duracion)}
        </p>
        <p className="text-[12.5px] text-texto-suave">{ETIQUETAS_DURACION_CITA_MEDICA[duracion]}</p>
      </div>
      {pie && <p className="text-[12.5px] text-texto-suave">{pie}</p>}
    </div>
  )
}
