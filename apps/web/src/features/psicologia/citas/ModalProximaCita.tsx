import { useState } from 'react'
import { sumarDiasGT, type CitaResumen, type DuracionCitaPsicologica } from '@akyuam/shared'
import Button from '../../../components/ui/Button'
import Modal, { CuerpoModal, PieModal } from '../../../components/ui/Modal'
import AvisoTraslape from './AvisoTraslape'
import ElegirHorario from './ElegirHorario'
import TextoHorario from './TextoHorario'

/** Lo elegido para la próxima cita: se agenda junto con el registro de la sesión, al guardarlo. */
export interface ProximaCitaElegida {
  fecha: string
  hora: string
  duracion: DuracionCitaPsicologica
}

interface ModalProximaCitaProps {
  /** Lo elegido antes (o la hora de esta sesión como preferencia, sin día). */
  inicial: ProximaCitaElegida
  /** Día (`YYYY-MM-DD`) desde el que se cuentan los atajos de "en 1 / 2 semanas". */
  diaBase: string
  /** Se reabrió porque al registrar, la hora elegida chocó con otras citas propias. */
  conflicto: CitaResumen[] | null
  onCerrar: () => void
  onElegir: (elegida: ProximaCitaElegida) => void
}

const ATAJOS = [
  { etiqueta: 'En 1 semana', dias: 7 },
  { etiqueta: 'En 2 semanas', dias: 14 },
]

/**
 * Próxima cita desde Registrar sesión: el mismo selector de día, hora y duración de la agenda,
 * pero no guarda nada — devuelve lo elegido y el formulario la agenda al registrar la sesión,
 * todo junto (como "Próxima consulta" en Médica). Solo se sale con Cancelar.
 */
export default function ModalProximaCita({ inicial, diaBase, conflicto, onCerrar, onElegir }: ModalProximaCitaProps) {
  const [elegida, setElegida] = useState<ProximaCitaElegida>(inicial)
  const listo = elegida.fecha !== '' && elegida.hora !== ''

  return (
    <Modal
      abierto
      ancho="agenda"
      titulo="Próxima cita"
      descripcion="Elige el día y la hora. Se agenda al registrar la sesión."
      soloConCancelar
      onCerrar={onCerrar}
    >
      <CuerpoModal className="space-y-4">
        {conflicto && (
          <AvisoTraslape
            citas={conflicto}
            accion="Elige otra hora, o deja esta si es intencional: se agenda al registrar la sesión."
          />
        )}

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[13px] font-medium text-gray-900">Atajos</span>
          {ATAJOS.map((atajo) => {
            const fecha = sumarDiasGT(diaBase, atajo.dias)
            const elegido = elegida.fecha === fecha
            return (
              <button
                key={atajo.dias}
                type="button"
                aria-pressed={elegido}
                onClick={() => setElegida({ ...elegida, fecha })}
                className={`rounded-md border px-3 py-1.5 text-[13px] font-medium ${
                  elegido
                    ? 'border-brand-600 bg-brand-50 text-brand-700'
                    : 'border-gray-300 bg-white text-gray-700 hover:border-brand-600'
                }`}
              >
                {atajo.etiqueta}
              </button>
            )
          })}
        </div>

        <ElegirHorario
          fecha={elegida.fecha}
          hora={elegida.hora}
          duracion={elegida.duracion}
          onDuracion={(duracion) => setElegida((actual) => ({ ...actual, duracion }))}
          onCambio={(horario) => setElegida((actual) => ({ ...actual, ...horario }))}
        />
      </CuerpoModal>
      <PieModal>
        <p aria-live="polite" className="mr-auto hidden min-w-0 truncate text-[13px] text-gray-700 sm:block">
          {listo ? <TextoHorario {...elegida} corto /> : <span className="text-gray-500">Falta elegir el día y la hora.</span>}
        </p>
        <Button variante="secondary" tamano="md" onClick={onCerrar}>
          Cancelar
        </Button>
        <Button tamano="md" disabled={!listo} onClick={() => onElegir(elegida)}>
          Elegir esta hora
        </Button>
      </PieModal>
    </Modal>
  )
}
