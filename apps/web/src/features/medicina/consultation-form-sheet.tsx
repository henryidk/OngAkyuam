import { useMedicineData } from "./medicine-context"
import { registrarConsultaMedicaSchema } from "@akyuam/shared"
import { extraerMensajeError } from "../../lib/errors"
import { useAuthStore } from "../../store/auth.store"
import { useMemo, useState } from "react"
import { AlertTriangle, CheckCircle2, FolderOpen, History, Pencil, Plus, Printer, Search, Trash2, X } from "lucide-react"
import { Badge } from "./ui/badge"
import { Button } from "./ui/button"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "./ui/field"
import { Input } from "./ui/input"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "./ui/select"
import { Separator } from "./ui/separator"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "./ui/sheet"
import { Textarea } from "./ui/textarea"
import {
  bmi,
  bmiCategory,
  cie10Catalog,
  REFERRAL_TARGETS,
  type Consultation,
  type Diagnosis,
  type MedicalHistory,
  type MedPatient,
  type Prescription,
} from "./medicine-data"
import { AllergyAlert, ClinicalText, DiagnosisChips } from "./medicine-ui"

type Props = {
  consultation: Consultation | null
  onClose: () => void
  onOpenRecord: (patient: MedPatient) => void
}

export function ConsultationFormSheet({ consultation, onClose, onOpenRecord }: Props) {
  return (
    <Sheet open={Boolean(consultation)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="overflow-y-auto data-[side=right]:w-full data-[side=right]:sm:max-w-2xl">
        <SheetHeader className="border-b p-6">
          <SheetTitle>Registro de consulta médica</SheetTitle>
          <SheetDescription>Registra la atención en el expediente médico de la paciente.</SheetDescription>
        </SheetHeader>
        {consultation && <ConsultationForm key={consultation.id} consultation={consultation} onClose={onClose} onOpenRecord={onOpenRecord} />}
      </SheetContent>
    </Sheet>
  )
}

const historyFields: { key: keyof MedicalHistory; label: string; placeholder: string }[] = [
  { key: "personal", label: "Personales patológicos", placeholder: "Enfermedades crónicas, hospitalizaciones previas" },
  { key: "surgical", label: "Quirúrgicos", placeholder: "Cirugías y año" },
  { key: "gyneco", label: "Gineco-obstétricos", placeholder: "G P C A, FUR, método de planificación" },
  { key: "family", label: "Familiares", placeholder: "Enfermedades relevantes en la familia" },
  { key: "medication", label: "Medicamentos actuales", placeholder: "Medicamento, dosis y frecuencia" },
]

const emptyPrescription: Prescription = { medication: "", dose: "", frequency: "", duration: "" }

function ConsultationForm({ consultation, onClose, onOpenRecord }: { consultation: Consultation; onClose: () => void; onOpenRecord: (patient: MedPatient) => void }) {
  const { findPatient, lastAttended, attend, absent } = useMedicineData()
  const professional = useAuthStore(state => state.usuario?.nombreCompleto) ?? "Personal médico"
  const [nextDate, setNextDate] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const patient = findPatient(consultation.patientId)
  const previous = lastAttended(consultation.patientId, `${consultation.isoDate}${consultation.time}`)
  const isFollowUp = Boolean(previous)

  const [reason, setReason] = useState(consultation.reason)
  const [evolution, setEvolution] = useState("")
  const [vitals, setVitals] = useState({ bp: "", heartRate: "", respiratoryRate: "", temperature: "", oxygenSaturation: "", weight: "", height: previous?.vitals?.height.toFixed(2) ?? "" })
  const [history, setHistory] = useState<MedicalHistory>(patient?.history ?? { personal: "", surgical: "", gyneco: "", family: "", medication: "" })
  const [editingHistory, setEditingHistory] = useState(!isFollowUp)
  const [exam, setExam] = useState("")
  const [diagnoses, setDiagnoses] = useState<Diagnosis[]>(previous?.diagnoses ?? [])
  const [query, setQuery] = useState("")
  const [plan, setPlan] = useState("")
  const [prescriptions, setPrescriptions] = useState<Prescription[]>(previous?.prescriptions ?? [])
  const [referral, setReferral] = useState<string>(REFERRAL_TARGETS[0])
  const [saved, setSaved] = useState(false)

  const imc = bmi(Number(vitals.weight), Number(vitals.height))
  const matches = useMemo(() => {
    const term = query.trim().toLowerCase()
    if (!term) return []
    return cie10Catalog
      .filter((item) => !diagnoses.some((selected) => selected.code === item.code))
      .filter((item) => `${item.code} ${item.label}`.toLowerCase().includes(term))
      .slice(0, 6)
  }, [query, diagnoses])

  const canSave = reason.trim() && diagnoses.length > 0 && plan.trim()
  const setVital = (key: keyof typeof vitals) => (event: React.ChangeEvent<HTMLInputElement>) => setVitals({ ...vitals, [key]: event.target.value })
  const updatePrescription = (index: number, key: keyof Prescription, value: string) =>
    setPrescriptions(prescriptions.map((item, position) => (position === index ? { ...item, [key]: value } : item)))

  async function save(isAbsent = false) {
    setBusy(true); setError(null)
    try {
      if (isAbsent) { await absent(consultation.id); onClose(); return }
      const measured = Object.entries(vitals).some(([key, value]) => key !== "height" && value.trim())
      if (measured && Object.values(vitals).some(value => !value.trim())) throw new Error("Completa todos los signos vitales o déjalos sin registrar.")
      if (measured && !/^\d{2,3}\s*\/\s*\d{2,3}$/.test(vitals.bp)) throw new Error("Ingresa la presión arterial como 120/80.")
      const [systolic, diastolic] = vitals.bp.split("/").map(Number)
      const parsed = registrarConsultaMedicaSchema.safeParse({ reason, physicalExam: exam, evolution, plan, diagnoses,
        prescriptions: prescriptions.filter(item => item.medication.trim()), history, referral: referral === "No aplica" ? undefined : referral,
        nextDate: nextDate || undefined,
        vitals: measured ? { systolic, diastolic, heartRate: Number(vitals.heartRate), respiratoryRate: Number(vitals.respiratoryRate), temperature: Number(vitals.temperature), oxygenSaturation: Number(vitals.oxygenSaturation), weight: Number(vitals.weight), height: Number(vitals.height) } : undefined })
      if (!parsed.success) throw new Error("Revisa los datos de la nota: motivo, diagnóstico, plan y signos vitales válidos.")
      await attend(consultation, parsed.data); setSaved(true)
    } catch (err) { setError(err instanceof Error && !("response" in err) ? err.message : extraerMensajeError(err)) }
    finally { setBusy(false) }
  }

  if (saved) {
    return (
      <div className="flex flex-col items-center gap-3 p-10 text-center">
        <CheckCircle2 className="size-10 text-primary" aria-hidden="true" />
        <p className="text-lg font-semibold">Consulta registrada</p>
        <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
          La nota de {consultation.patientName} quedó guardada en su expediente.
        </p>
        <DiagnosisChips items={diagnoses} className="mt-2 justify-center" />
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {prescriptions.some((item) => item.medication) && (
            <Button disabled title="Impresión pendiente de implementación" variant="outline">
              <Printer data-icon="inline-start" />
              Imprimir receta
            </Button>
          )}
          {patient && (
            <Button variant="outline" onClick={() => { onClose(); onOpenRecord(patient) }}>
              <FolderOpen data-icon="inline-start" />
              Ver expediente
            </Button>
          )}
          <Button onClick={onClose}>Cerrar</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-7 p-6">
      <div className="flex flex-col gap-3">
        <div className="rounded-lg border bg-muted/40 p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="font-semibold">{consultation.patientName}</p>
              <p className="mt-1 font-mono text-xs text-muted-foreground">
                {consultation.patientId}
                {patient ? ` · ${patient.age} años` : ""} · {consultation.dateLabel} · {consultation.time}
              </p>
            </div>
            <Badge variant={isFollowUp ? "outline" : "secondary"}>{isFollowUp ? "Reconsulta" : "Primera consulta"}</Badge>
          </div>
        </div>
        {patient && <AllergyAlert allergies={patient.allergies} />}
      </div>

      {previous && (
        <section aria-labelledby="previous-title" className="rounded-lg border p-4">
          <div className="flex items-center gap-2">
            <History className="size-4 text-primary" aria-hidden="true" />
            <h3 id="previous-title" className="text-sm font-semibold">Última consulta · {previous.dateLabel}</h3>
          </div>
          {previous.diagnoses && <DiagnosisChips items={previous.diagnoses} className="mt-3" />}
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            <span className="font-medium text-foreground">Plan: </span>
            {previous.plan}
          </p>
        </section>
      )}

      <FormSection title="Motivo de consulta">
        <Field>
          <FieldLabel htmlFor="reason" className="sr-only">Motivo de consulta</FieldLabel>
          <Input id="reason" value={reason} onChange={(event) => setReason(event.target.value)} />
        </Field>
      </FormSection>

      {isFollowUp && (
        <FormSection title="Evolución" description="Cambios desde la última consulta: síntomas, adherencia y resultados.">
          <Field>
            <FieldLabel htmlFor="evolution" className="sr-only">Evolución</FieldLabel>
            <Textarea id="evolution" rows={3} value={evolution} onChange={(event) => setEvolution(event.target.value)} placeholder="Ej. Refiere mejoría del dolor, buena adherencia al tratamiento…" />
          </Field>
        </FormSection>
      )}

      <FormSection title="Signos vitales">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <VitalInput id="bp" label="PA (mmHg)" placeholder="120/80" value={vitals.bp} onChange={setVital("bp")} inputMode="text" />
          <VitalInput id="hr" label="FC (lpm)" placeholder="80" value={vitals.heartRate} onChange={setVital("heartRate")} />
          <VitalInput id="rr" label="FR (rpm)" placeholder="16" value={vitals.respiratoryRate} onChange={setVital("respiratoryRate")} />
          <VitalInput id="temp" label="Temp. (°C)" placeholder="36.5" value={vitals.temperature} onChange={setVital("temperature")} />
          <VitalInput id="sat" label="SatO2 (%)" placeholder="98" value={vitals.oxygenSaturation} onChange={setVital("oxygenSaturation")} />
          <VitalInput id="weight" label="Peso (kg)" placeholder="60.0" value={vitals.weight} onChange={setVital("weight")} />
          <VitalInput id="height" label="Talla (m)" placeholder="1.55" value={vitals.height} onChange={setVital("height")} />
          <div className="flex flex-col justify-center rounded-lg border bg-muted/40 px-3 py-2">
            <p className="text-xs text-muted-foreground">IMC</p>
            <p className="font-mono text-base font-semibold" aria-live="polite">{imc?.toFixed(1) ?? "—"}</p>
            {imc && <p className="text-xs text-muted-foreground">{bmiCategory(imc)}</p>}
          </div>
        </div>
      </FormSection>

      <FormSection
        title="Antecedentes importantes"
        action={isFollowUp && (
          <Button size="sm" variant="ghost" onClick={() => setEditingHistory(!editingHistory)}>
            <Pencil data-icon="inline-start" />
            {editingHistory ? "Listo" : "Actualizar"}
          </Button>
        )}
      >
        {editingHistory ? (
          <FieldGroup>
            {historyFields.map((item) => (
              <Field key={item.key}>
                <FieldLabel htmlFor={`history-${item.key}`}>{item.label}</FieldLabel>
                <Textarea id={`history-${item.key}`} rows={2} value={history[item.key]} placeholder={item.placeholder} onChange={(event) => setHistory({ ...history, [item.key]: event.target.value })} />
              </Field>
            ))}
          </FieldGroup>
        ) : (
          <dl className="grid gap-3 rounded-lg border p-4 sm:grid-cols-2">
            {historyFields.map((item) => (
              <div key={item.key}>
                <dt className="text-xs text-muted-foreground">{item.label}</dt>
                <dd className="mt-0.5 text-sm leading-relaxed">{history[item.key] || "Sin registrar"}</dd>
              </div>
            ))}
          </dl>
        )}
      </FormSection>

      <FormSection title="Positivo en examen físico" description="Registra únicamente los hallazgos positivos o relevantes.">
        <Field>
          <FieldLabel htmlFor="exam" className="sr-only">Positivo en examen físico</FieldLabel>
          <Textarea id="exam" rows={3} value={exam} onChange={(event) => setExam(event.target.value)} placeholder="Ej. Dolor a la palpación en epigastrio, sin signos de irritación peritoneal…" />
        </Field>
      </FormSection>

      <FormSection title="Diagnóstico (CIE-10)" description={isFollowUp ? "Se precargaron los diagnósticos de la consulta anterior." : undefined}>
        {diagnoses.length > 0 && (
          <ul className="flex flex-wrap gap-2" aria-label="Diagnósticos seleccionados">
            {diagnoses.map((item) => (
              <li key={item.code} className="inline-flex items-center gap-2 rounded-md border bg-muted/50 py-1 pl-2 pr-1 text-xs">
                <span className="font-mono font-semibold text-primary">{item.code}</span>
                <span>{item.label}</span>
                <button
                  type="button"
                  onClick={() => setDiagnoses(diagnoses.filter((selected) => selected.code !== item.code))}
                  className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label={`Quitar ${item.code}`}
                >
                  <X className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} className="pl-9" placeholder="Buscar por código o nombre (ej. I10, gastritis)" aria-label="Buscar diagnóstico CIE-10" />
        </div>
        {matches.length > 0 && (
          <ul className="divide-y rounded-lg border" aria-label="Resultados CIE-10">
            {matches.map((item) => (
              <li key={item.code}>
                <button
                  type="button"
                  onClick={() => { setDiagnoses([...diagnoses, item]); setQuery("") }}
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm hover:bg-muted/60"
                >
                  <span className="w-12 shrink-0 font-mono text-xs font-semibold text-primary">{item.code}</span>
                  <span className="flex-1">{item.label}</span>
                  <Plus className="size-4 text-muted-foreground" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
        {query.trim() && matches.length === 0 && <p className="text-sm text-muted-foreground">Sin coincidencias en el catálogo.</p>}
      </FormSection>

      <FormSection title="Plan" description="Tratamiento, indicaciones, estudios solicitados y educación a la paciente.">
        <Field>
          <FieldLabel htmlFor="plan" className="sr-only">Plan</FieldLabel>
          <Textarea id="plan" rows={4} value={plan} onChange={(event) => setPlan(event.target.value)} placeholder="Ej. Dieta hiposódica, control de PA semanal, laboratorios de control…" />
        </Field>
      </FormSection>

      <FormSection
        title="Receta médica"
        action={
          <Button size="sm" variant="ghost" onClick={() => setPrescriptions([...prescriptions, emptyPrescription])}>
            <Plus data-icon="inline-start" />
            Agregar
          </Button>
        }
      >
        {prescriptions.length ? (
          <ul className="flex flex-col gap-3">
            {prescriptions.map((item, index) => (
              <li key={index} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[1.3fr_0.7fr_1.4fr_0.8fr_auto] sm:items-end">
                <PrescriptionInput label="Medicamento" value={item.medication} onChange={(value) => updatePrescription(index, "medication", value)} placeholder="Losartán" />
                <PrescriptionInput label="Dosis" value={item.dose} onChange={(value) => updatePrescription(index, "dose", value)} placeholder="50 mg" />
                <PrescriptionInput label="Frecuencia" value={item.frequency} onChange={(value) => updatePrescription(index, "frequency", value)} placeholder="1 tableta cada 24 horas" />
                <PrescriptionInput label="Duración" value={item.duration} onChange={(value) => updatePrescription(index, "duration", value)} placeholder="30 días" />
                <Button size="icon" variant="ghost" onClick={() => setPrescriptions(prescriptions.filter((_, position) => position !== index))} aria-label={`Quitar ${item.medication || "medicamento"}`}>
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">Sin medicamentos indicados.</p>
        )}
        {patient?.allergies.length ? (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <AlertTriangle className="size-3.5 text-secondary" aria-hidden="true" />
            Verifica que la receta no incluya: {patient.allergies.join(", ")}.
          </p>
        ) : null}
      </FormSection>

      <FormSection title="Seguimiento">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="next-date">Próxima cita</FieldLabel>
            <Input id="next-date" type="date" min={consultation.isoDate} value={nextDate} onChange={event => setNextDate(event.target.value)} />
            <FieldDescription>Se agenda a la misma hora y en la misma clínica.</FieldDescription>
          </Field>
          <Field>
            <FieldLabel>Indicación de interconsulta</FieldLabel>
            <Select value={referral} onValueChange={(value) => value && setReferral(value as string)}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {REFERRAL_TARGETS.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
                </SelectGroup>
              </SelectContent>
            </Select>
            <FieldDescription>Se guarda como indicación en la nota clínica.</FieldDescription>
          </Field>
        </div>
      </FormSection>

      <Separator />

      <div className="flex flex-col gap-3">
        <ClinicalText label="Profesional que atiende">{professional} · {consultation.place}</ClinicalText>
        {!canSave && <p className="text-xs text-muted-foreground">Para guardar se requiere motivo, al menos un diagnóstico y el plan.</p>}
      </div>

      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
        <Button disabled={busy} onClick={() => void save(true)} variant="outline" className="text-destructive">
          <AlertTriangle data-icon="inline-start" />
          Marcar ausente
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose} className="flex-1 sm:flex-none">Cancelar</Button>
          <Button disabled={busy || !canSave} onClick={() => void save()} className="flex-1 sm:flex-none">
            <CheckCircle2 data-icon="inline-start" />
            Guardar consulta
          </Button>
        </div>
      </div>
    </div>
  )
}

function FormSection({ title, description, action, children }: { title: string; description?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          {description && <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

function VitalInput({ id, label, inputMode = "decimal", ...props }: { id: string; label: string; inputMode?: "text" | "decimal" } & Omit<React.ComponentProps<typeof Input>, "id" | "inputMode">) {
  return (
    <Field className="gap-1.5">
      <FieldLabel htmlFor={`vital-${id}`} className="text-xs font-normal text-muted-foreground">{label}</FieldLabel>
      <Input id={`vital-${id}`} inputMode={inputMode} className="font-mono" {...props} />
    </Field>
  )
}

function PrescriptionInput({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder: string }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <Input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
    </label>
  )
}
