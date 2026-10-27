import { formatInstanteGT, type CitaResumen } from '@akyuam/shared'

/** Aviso de que la hora elegida choca con otras citas propias. No bloquea: la psicóloga decide. */
export default function AvisoTraslape({ citas, accion }: { citas: CitaResumen[]; accion: string }) {
  return (
    <div role="alert" className="w-full rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-left text-xs text-amber-900">
      <p className="font-medium">Ya tienes una cita a esa hora:</p>
      <ul className="mt-1 list-disc pl-4">
        {citas.map((cita) => (
          <li key={cita.id}>
            {formatInstanteGT(cita.fechaHora)} · {cita.duracionMinutos} min
          </li>
        ))}
      </ul>
      <p className="mt-1">{accion}</p>
    </div>
  )
}
