import { useNavigate } from 'react-router-dom'
import Button from '../../../components/ui/Button'
import BuscadorPaciente from '../compartido/BuscadorPaciente'
import ModalMedica from '../compartido/ModalMedica'
import { RUTAS_MEDICA } from '../rutas'

/**
 * Consulta sin cita: se busca a la paciente en atención (por nombre, DPI o expediente) y al
 * elegirla se abre el formulario. La búsqueda la resuelve el servidor sobre todas las pacientes,
 * sin cargarlas al navegador.
 */
export default function ModalConsultaSinCita({ onCerrar }: { onCerrar: () => void }) {
  const navigate = useNavigate()

  return (
    <ModalMedica
      titulo="Consulta sin cita"
      subtitulo="Busca a la paciente en atención. Si tiene una cita hoy, regístrala desde Por atender."
      onCerrar={onCerrar}
      pie={
        <Button variante="secondary" tamano="md" onClick={onCerrar}>
          Cancelar
        </Button>
      }
    >
      <BuscadorPaciente
        etiqueta="Paciente en atención"
        situacion="EN_ATENCION"
        conSugerencias={false}
        elegida={null}
        onElegir={(paciente) => {
          if (paciente)
            navigate(
              RUTAS_MEDICA.nuevaConsulta({
                usuaria: paciente.usuariaId,
                origen: 'consultas',
              }),
            )
        }}
        enfocarAlAbrir
      />
    </ModalMedica>
  )
}
