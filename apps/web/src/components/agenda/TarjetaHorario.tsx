import { formatFechaLargaGT } from '@akyuam/shared'
import { horaMasMinutos, textoDuracion } from './fechas'

/** El día y la hora de una cita, bien visibles: el centro del paso de confirmación. */
export default function TarjetaHorario({ fecha, hora, duracion }: { fecha: string; hora: string; duracion: number }) {
  return (
    <div className="w-full rounded-lg border border-brand-100 bg-brand-50 px-4 py-3 text-center">
      <p className="text-[15px] font-semibold text-brand-700">{formatFechaLargaGT(fecha)}</p>
      <p className="font-mono text-2xl font-semibold text-gray-900">
        {hora} – {horaMasMinutos(hora, duracion)}
      </p>
      <p className="text-[12.5px] text-gray-500">{textoDuracion(duracion)}</p>
    </div>
  )
}
