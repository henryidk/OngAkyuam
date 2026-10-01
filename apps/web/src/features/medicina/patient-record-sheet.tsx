import { useState } from "react"
import { ArrowRight, CalendarPlus, ChevronRight, Pencil } from "lucide-react"
import { Badge } from "./ui/badge"
import { Button } from "./ui/button"
import { Field, FieldGroup, FieldLabel } from "./ui/field"
import { Input } from "./ui/input"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "./ui/sheet"
import { Textarea } from "./ui/textarea"
import { cn } from "./utils"
import { bmi, formatDate, lastAttended, nextScheduled, patientConsultations, type Consultation, type MedicalHistory, type MedPatient } from "./medicine-data"
import type { ScheduleSeed } from "./medicine-agenda"
import { AllergyAlert, ConsultationStatusBadge, DiagnosisChips, PatientStatusBadge, SectionLabel } from "./medicine-ui"

type Tab = "evolucion" | "signos" | "antecedentes" | "datos"
const tabs: { key: Tab; label: string }[] = [
  { key: "evolucion", label: "Evolución clínica" },
  { key: "signos", label: "Signos vitales" },
  { key: "antecedentes", label: "Antecedentes" },
  { key: "datos", label: "Datos generales" },
]

type Props = {
  patient: MedPatient | null
  onClose: () => void
  onConsultation: (item: Consultation) => void
  onSchedule: (seed: ScheduleSeed) => void
}

export function PatientRecordSheet({ patient, onClose, onConsultation, onSchedule }: Props) {
  return (
    <Sheet open={Boolean(patient)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="gap-0 overflow-y-auto data-[side=right]:w-full data-[side=right]:sm:max-w-3xl">
        {patient && <PatientRecord key={patient.id} patient={patient} onConsultation={onConsultation} onSchedule={onSchedule} />}
      </SheetContent>
    </Sheet>
  )
}

function PatientRecord({ patient, onConsultation, onSchedule }: { patient: MedPatient; onConsultation: (item: Consultation) => void; onSchedule: (seed: ScheduleSeed) => void }) {
  const [tab, setTab] = useState<Tab>("evolucion")
  const records = patientConsultations(patient.id)
  const attended = records.filter((item) => item.status === "Atendida")
  const last = lastAttended(patient.id)
  const next = nextScheduled(patient.id)

  return (
    <>
      <SheetHeader className="border-b p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 pr-8">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="font-mono">{patient.id}</Badge>
            <PatientStatusBadge status={patient.status} />
          </div>
          <Button size="sm" variant="outline" onClick={() => onSchedule({ patientId: patient.id, patientName: patient.name, reason: last ? "Reconsulta de seguimiento" : "" })}>
            <CalendarPlus data-icon="inline-start" />
            Agendar consulta
          </Button>
        </div>
        <SheetTitle className="mt-3 text-xl">{patient.name}</SheetTitle>
        <SheetDescription>
          {patient.age} años · {patient.municipality} · Tipo de sangre {patient.bloodType}
        </SheetDescription>
      </SheetHeader>

      <div className="flex flex-col gap-4 border-b p-6">
        <AllergyAlert allergies={patient.allergies} />
        {patient.chronicConditions.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">Condiciones crónicas:</span>
            {patient.chronicConditions.map((item) => <Badge key={item} variant="outline">{item}</Badge>)}
          </div>
        )}
        <dl className="grid grid-cols-3 divide-x rounded-lg border">
          <SummaryItem label="Consultas atendidas" value={String(attended.length)} />
          <SummaryItem label="Última consulta" value={last ? formatDate(last.isoDate, { day: "numeric", month: "short" }) : "—"} />
          <SummaryItem label="Próxima cita" value={next ? `${formatDate(next.isoDate, { day: "numeric", month: "short" })} · ${next.time}` : "Sin agendar"} />
        </dl>
      </div>

      <div className="border-b px-6">
        <div role="tablist" aria-label="Secciones del expediente" className="-mb-px flex gap-4 overflow-x-auto">
          {tabs.map((item) => (
            <button
              key={item.key}
              role="tab"
              id={`tab-${item.key}`}
              aria-selected={tab === item.key}
              aria-controls={`panel-${item.key}`}
              onClick={() => setTab(item.key)}
              className={cn(
                "shrink-0 border-b-2 py-3 text-sm font-medium transition-colors",
                tab === item.key ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="p-6">
        {tab === "evolucion" && <EvolutionTimeline records={records} onOpen={onConsultation} />}
        {tab === "signos" && <VitalsHistory records={attended} />}
        {tab === "antecedentes" && <HistoryPanel history={patient.history} />}
        {tab === "datos" && <GeneralData patient={patient} />}
      </div>
    </>
  )
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm font-semibold">{value}</dd>
    </div>
  )
}

function EvolutionTimeline({ records, onOpen }: { records: Consultation[]; onOpen: (item: Consultation) => void }) {
  if (!records.length) return <p className="text-sm text-muted-foreground">No hay consultas registradas.</p>
  const ordered = [...records].reverse()
  return (
    <ol className="relative flex flex-col gap-5 border-l pl-6" aria-label="Evolución por fecha">
      {ordered.map((item) => (
        <li key={item.id} className="relative">
          <span
            className={cn(
              "absolute -left-[1.85rem] top-1.5 size-3 rounded-full border-2 border-background",
              item.status === "Atendida" ? "bg-primary" : item.status === "Programada" ? "bg-accent" : "bg-muted-foreground/40",
            )}
            aria-hidden="true"
          />
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold">{formatDate(item.isoDate, { weekday: "short", day: "numeric", month: "long", year: "numeric" })}</p>
            <span className="font-mono text-xs text-muted-foreground">{item.time}</span>
            <Badge variant="outline">{item.type}</Badge>
            <ConsultationStatusBadge status={item.status} />
          </div>
          <button
            onClick={() => onOpen(item)}
            className="mt-2 flex w-full flex-col gap-3 rounded-lg border p-4 text-left transition-colors hover:bg-muted/40"
          >
            <p className="text-sm font-medium leading-relaxed">{item.reason}</p>
            {item.status === "Atendida" && (
              <>
                {item.diagnoses && <DiagnosisChips items={item.diagnoses} />}
                {item.evolution && <TimelineField label="Evolución" text={item.evolution} />}
                {item.physicalExam && <TimelineField label="Positivo en EF" text={item.physicalExam} />}
                {item.plan && <TimelineField label="Plan" text={item.plan} />}
              </>
            )}
            {item.status === "Ausente" && <p className="text-sm text-muted-foreground">No se presentó a la consulta.</p>}
            {item.status === "Programada" && <p className="text-sm text-muted-foreground">Consulta agendada en {item.place}.</p>}
            <span className="flex items-center gap-1 text-xs font-medium text-primary">
              Ver nota completa
              <ChevronRight className="size-3.5" aria-hidden="true" />
            </span>
          </button>
        </li>
      ))}
    </ol>
  )
}

function TimelineField({ label, text }: { label: string; text: string }) {
  return (
    <p className="text-sm leading-relaxed text-muted-foreground">
      <span className="font-medium text-foreground">{label}: </span>
      {text}
    </p>
  )
}

function VitalsHistory({ records }: { records: Consultation[] }) {
  const withVitals = records.filter((item) => item.vitals)
  if (!withVitals.length) return <p className="text-sm text-muted-foreground">Aún no hay signos vitales registrados.</p>
  const first = withVitals[0].vitals!
  const last = withVitals.at(-1)!.vitals!
  const firstBmi = bmi(first.weight, first.height)
  const lastBmi = bmi(last.weight, last.height)

  return (
    <div className="flex flex-col gap-5">
      <div>
        <SectionLabel>Comparativo ingreso · última consulta</SectionLabel>
        <div className="mt-2 grid gap-3 sm:grid-cols-3">
          <TrendCard label="Presión arterial" from={`${first.systolic}/${first.diastolic}`} to={`${last.systolic}/${last.diastolic}`} unit="mmHg" />
          <TrendCard label="Peso" from={first.weight.toFixed(1)} to={last.weight.toFixed(1)} unit="kg" />
          <TrendCard label="IMC" from={firstBmi?.toFixed(1) ?? "—"} to={lastBmi?.toFixed(1) ?? "—"} unit="kg/m²" />
        </div>
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[560px] text-sm">
          <caption className="sr-only">Signos vitales por fecha de consulta</caption>
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
            <tr>
              {["Fecha", "PA", "FC", "FR", "Temp.", "SatO2", "Peso", "IMC"].map((item) => (
                <th key={item} scope="col" className="px-3 py-2.5 font-medium">{item}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y font-mono text-xs">
            {[...withVitals].reverse().map((item) => {
              const v = item.vitals!
              return (
                <tr key={item.id}>
                  <th scope="row" className="px-3 py-2.5 text-left font-sans text-sm font-medium">{formatDate(item.isoDate, { day: "2-digit", month: "short", year: "2-digit" })}</th>
                  <td className="px-3 py-2.5">{v.systolic}/{v.diastolic}</td>
                  <td className="px-3 py-2.5">{v.heartRate}</td>
                  <td className="px-3 py-2.5">{v.respiratoryRate}</td>
                  <td className="px-3 py-2.5">{v.temperature.toFixed(1)}</td>
                  <td className="px-3 py-2.5">{v.oxygenSaturation}%</td>
                  <td className="px-3 py-2.5">{v.weight.toFixed(1)}</td>
                  <td className="px-3 py-2.5">{bmi(v.weight, v.height)?.toFixed(1)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function TrendCard({ label, from, to, unit }: { label: string; from: string; to: string; unit: string }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1.5 flex items-center gap-2 font-mono text-sm">
        <span className="text-muted-foreground">{from}</span>
        <ArrowRight className="size-3.5 text-primary" aria-label="a" />
        <span className="font-semibold">{to}</span>
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">{unit}</p>
    </div>
  )
}

const historyLabels: { key: keyof MedicalHistory; label: string }[] = [
  { key: "personal", label: "Personales patológicos" },
  { key: "surgical", label: "Quirúrgicos" },
  { key: "gyneco", label: "Gineco-obstétricos" },
  { key: "family", label: "Familiares" },
  { key: "medication", label: "Medicamentos actuales" },
]

function HistoryPanel({ history }: { history: MedicalHistory }) {
  const [editing, setEditing] = useState(false)
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <SectionLabel>Antecedentes importantes</SectionLabel>
        <Button size="sm" variant="outline" onClick={() => setEditing(!editing)}>
          <Pencil data-icon="inline-start" />
          {editing ? "Cancelar" : "Editar"}
        </Button>
      </div>
      {editing ? (
        <FieldGroup>
          {historyLabels.map((item) => (
            <Field key={item.key}>
              <FieldLabel htmlFor={`record-history-${item.key}`}>{item.label}</FieldLabel>
              <Textarea id={`record-history-${item.key}`} rows={2} defaultValue={history[item.key]} />
            </Field>
          ))}
          <Button className="w-fit" onClick={() => setEditing(false)}>Guardar antecedentes</Button>
        </FieldGroup>
      ) : (
        <dl className="divide-y rounded-lg border">
          {historyLabels.map((item) => (
            <div key={item.key} className="grid gap-1 p-4 sm:grid-cols-[180px_1fr]">
              <dt className="text-sm text-muted-foreground">{item.label}</dt>
              <dd className="text-sm leading-relaxed">{history[item.key] || "Sin registrar"}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  )
}

function GeneralData({ patient }: { patient: MedPatient }) {
  const [editing, setEditing] = useState(false)
  const rows = [
    ["No. de expediente", patient.id],
    ["Nombre completo", patient.name],
    ["Fecha de nacimiento", formatDate(patient.birthDate, { day: "numeric", month: "long", year: "numeric" })],
    ["Edad", `${patient.age} años`],
    ["Municipio", patient.municipality],
    ["Teléfono", patient.phone],
    ["Tipo de sangre", patient.bloodType],
    ["Referida por", patient.referredBy],
    ["Fecha de referencia", formatDate(patient.referredOn, { day: "numeric", month: "long", year: "numeric" })],
  ]
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <SectionLabel>Información personal</SectionLabel>
        <Button size="sm" variant="outline" onClick={() => setEditing(!editing)}>
          <Pencil data-icon="inline-start" />
          {editing ? "Cancelar" : "Editar"}
        </Button>
      </div>
      {editing ? (
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="edit-name">Nombre completo</FieldLabel>
            <Input id="edit-name" defaultValue={patient.name} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="edit-birth">Fecha de nacimiento</FieldLabel>
              <Input id="edit-birth" type="date" defaultValue={patient.birthDate} />
            </Field>
            <Field>
              <FieldLabel htmlFor="edit-blood">Tipo de sangre</FieldLabel>
              <Input id="edit-blood" defaultValue={patient.bloodType} />
            </Field>
            <Field>
              <FieldLabel htmlFor="edit-municipality">Municipio</FieldLabel>
              <Input id="edit-municipality" defaultValue={patient.municipality} />
            </Field>
            <Field>
              <FieldLabel htmlFor="edit-phone">Teléfono</FieldLabel>
              <Input id="edit-phone" type="tel" defaultValue={patient.phone} />
            </Field>
          </div>
          <Field>
            <FieldLabel htmlFor="edit-allergies">Alergias</FieldLabel>
            <Input id="edit-allergies" defaultValue={patient.allergies.join(", ")} placeholder="Separadas por coma" />
          </Field>
          <Button className="w-fit" onClick={() => setEditing(false)}>Guardar cambios</Button>
        </FieldGroup>
      ) : (
        <dl className="grid gap-x-6 gap-y-4 rounded-lg border p-4 sm:grid-cols-2">
          {rows.map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className="mt-0.5 text-sm font-medium">{value}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  )
}
