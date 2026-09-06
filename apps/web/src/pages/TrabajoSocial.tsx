import PanelLayout from '../components/PanelLayout'
import WizardNuevoExpediente from './TrabajoSocial/components/WizardNuevoExpediente'

export default function TrabajoSocial() {
  return (
    <PanelLayout titulo="Trabajo Social - Nuevo Expediente">
      <WizardNuevoExpediente />
    </PanelLayout>
  )
}
