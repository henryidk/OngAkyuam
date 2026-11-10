import { formatFechaLargaGT, partesFechaGT } from '@akyuam/shared'
import { horaMasMinutos, textoDuracion } from '../../../components/agenda/fechas'

interface TextoHorarioProps {
  /** `YYYY-MM-DD` */
  fecha: string
  /** "HH:mm" */
  hora: string
  duracion: number
  /** "Lunes 16 nov" en vez de "Lunes 16 de noviembre", para donde hay poco espacio. */
  corto?: boolean
}

/** "Lunes 16 de noviembre · 09:00 – 09:45 (45 min)": el día y la hora elegidos para una cita. */
export default function TextoHorario({ fecha, hora, duracion, corto = false }: TextoHorarioProps) {
  const partes = partesFechaGT(fecha)
  return (
    <>
      <span className="font-semibold text-brand-700">
        {corto ? `${partes.diaSemana} ${partes.dia} ${partes.mesCorto}` : formatFechaLargaGT(fecha)}
      </span>
      {' · '}
      <span className="tabular-nums">
        {hora} – {horaMasMinutos(hora, duracion)}
      </span>
      {` (${textoDuracion(duracion)})`}
    </>
  )
}
