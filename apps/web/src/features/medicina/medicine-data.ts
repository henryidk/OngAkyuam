import { hoyGT } from '@akyuam/shared'
import type { DiagnosticoMedico, SignosVitalesMedicos, RecetaMedica, HistoriaMedica, PacienteMedica, ConsultaMedica, ReferenciaMedica } from '@akyuam/shared'
export type Diagnosis = DiagnosticoMedico
export type VitalSigns = SignosVitalesMedicos
export type Prescription = RecetaMedica
export type MedicalHistory = HistoriaMedica
export type MedPatient = PacienteMedica
export type Consultation = ConsultaMedica
export type MedReferral = ReferenciaMedica
export type PatientStatus = MedPatient['status']
export type ConsultationStatus = Consultation['status']
export const TODAY = hoyGT()
export const CLINICS = ['Clínica médica 1', 'Clínica médica 2'] as const
export const REFERRAL_TARGETS = ['No aplica', 'Psicología', 'Trabajo Social', 'Fisioterapia', 'Laboratorio clínico', 'Hospital Regional de Cobán'] as const
export function formatDate(iso: string, options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }) {
  if (!iso) return 'Sin registrar'
  return new Intl.DateTimeFormat('es-GT', { ...options, timeZone: 'UTC' }).format(new Date(iso + 'T12:00:00Z'))
}
const round1 = (value: number) => Math.round(value * 10) / 10

export const cie10Catalog: Diagnosis[] = [
  { code: "D50.9", label: "Anemia por deficiencia de hierro, sin otra especificación" },
  { code: "E03.9", label: "Hipotiroidismo, no especificado" },
  { code: "E11.9", label: "Diabetes mellitus tipo 2 sin complicaciones" },
  { code: "E66.9", label: "Obesidad, no especificada" },
  { code: "E78.5", label: "Hiperlipidemia, no especificada" },
  { code: "G43.9", label: "Migraña, no especificada" },
  { code: "G44.2", label: "Cefalea de tipo tensional" },
  { code: "G47.0", label: "Trastornos del inicio y del mantenimiento del sueño" },
  { code: "I10", label: "Hipertensión esencial (primaria)" },
  { code: "J00", label: "Rinofaringitis aguda (resfriado común)" },
  { code: "J02.9", label: "Faringitis aguda, no especificada" },
  { code: "K29.5", label: "Gastritis crónica, no especificada" },
  { code: "K30", label: "Dispepsia funcional" },
  { code: "L30.9", label: "Dermatitis, no especificada" },
  { code: "M17.9", label: "Gonartrosis, no especificada" },
  { code: "M54.5", label: "Lumbago no especificado" },
  { code: "N39.0", label: "Infección de vías urinarias, sitio no especificado" },
  { code: "N76.0", label: "Vaginitis aguda" },
  { code: "N94.6", label: "Dismenorrea, no especificada" },
  { code: "R10.4", label: "Otros dolores abdominales y los no especificados" },
  { code: "R51", label: "Cefalea" },
  { code: "T14.0", label: "Traumatismo superficial de región no especificada del cuerpo" },
  { code: "Z00.0", label: "Examen médico general" },
]

export function bmi(weight: number, height: number) {
  if (!weight || !height) return null
  return round1(weight / (height * height))
}

export function bmiCategory(value: number) {
  if (value < 18.5) return "Bajo peso"
  if (value < 25) return "Normal"
  if (value < 30) return "Sobrepeso"
  return "Obesidad"
}

export function historySummary(history: MedicalHistory) {
  return [history.personal, history.surgical && history.surgical !== "Ninguno." ? `Qx: ${history.surgical}` : "", history.family]
    .filter(Boolean)
    .join(" ")
}
