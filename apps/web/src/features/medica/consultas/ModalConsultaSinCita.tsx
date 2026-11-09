import { useNavigate } from 'react-router-dom'
import Button from '../../../components/ui/Button'
import BuscadorPaciente from '../compartido/BuscadorPaciente'
import Modal, { CuerpoModal, PieModal } from '../../../components/ui/Modal'
import { RUTAS_MEDICA } from '../rutas'

/**
 * Consulta sin cita: se busca a la paciente en atención (por nombre, DPI o expediente) y al
 * elegirla se abre el formulario. La búsqueda la resuelve el servidor sobre todas las pacientes,
 * sin cargarlas al navegador.
 */
export default function ModalConsultaSinCita({ onCerrar }: { onCerrar: () => void }) {
  const navigate = useNavigate()

  return (
    <Modal
      abierto
      ancho="agenda"
      titulo="Consulta sin cita"
      descripcion="Busca a la paciente en atención. Se registra con la fecha y hora de ahora, cualquier día. Si tiene una cita hoy, regístrala desde esa cita."
      cerrarAlTocarFuera
      onCerrar={onCerrar}
    >
      <CuerpoModal className="space-y-4">
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
      </CuerpoModal>
      <PieModal>
        <Button variante="secondary" tamano="md" onClick={onCerrar}>
          Cancelar
        </Button>
      </PieModal>
    </Modal>
  )
}
