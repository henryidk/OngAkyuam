import { AlertTriangle, ShieldCheck } from "lucide-react"
import { Badge } from "./ui/badge"
import { cn } from "./utils"
import { bmi, bmiCategory, type ConsultationStatus, type Diagnosis, type PatientStatus, type ReferralPriority, type VitalSigns } from "./medicine-data"

export function initials(name: string) {
  return name.split(" ").slice(0, 2).map((part) => part[0]).join("")
}

export function ConsultationStatusBadge({ status }: { status: ConsultationStatus }) {
  return <Badge variant={status === "Ausente" ? "destructive" : "outline"}>{status}</Badge>
}

export function PatientStatusBadge({ status }: { status: PatientStatus }) {
  return <Badge variant={status === "Nuevo ingreso" ? "default" : status === "Alta" ? "secondary" : "outline"}>{status}</Badge>
}

export function PriorityBadge({ priority }: { priority: ReferralPriority }) {
  return (
    <Badge variant={priority === "Alta" ? "default" : "outline"} className={cn(priority === "Baja" && "text-muted-foreground")}>
      Prioridad {priority.toLowerCase()}
    </Badge>
  )
}

export function SectionLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn("text-xs font-semibold uppercase tracking-wider text-muted-foreground", className)}>{children}</p>
}

export function DiagnosisChips({ items, className }: { items: Diagnosis[]; className?: string }) {
  return (
    <ul className={cn("flex flex-wrap gap-2", className)} aria-label="Diagnósticos">
      {items.map((item) => (
        <li key={item.code} className="inline-flex items-center gap-2 rounded-md border bg-muted/50 px-2 py-1 text-xs leading-relaxed">
          <span className="font-mono font-semibold text-primary">{item.code}</span>
          <span>{item.label}</span>
        </li>
      ))}
    </ul>
  )
}

export function AllergyAlert({ allergies }: { allergies: string[] }) {
  if (!allergies.length) {
    return (
      <div className="flex items-center gap-2 rounded-lg border px-3 py-2 text-xs text-muted-foreground">
        <ShieldCheck className="size-4 text-primary" aria-hidden="true" />
        Sin alergias conocidas
      </div>
    )
  }
  return (
    <div role="note" className="flex items-start gap-3 rounded-lg border border-accent bg-accent/15 px-3 py-2.5">
      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-secondary" aria-hidden="true" />
      <p className="text-sm">
        <span className="font-semibold">Alergias: </span>
        {allergies.join(", ")}
      </p>
    </div>
  )
}

export function AllergyMarker({ allergies }: { allergies: string[] }) {
  if (!allergies.length) return null
  return (
    <span title={`Alergias: ${allergies.join(", ")}`} className="inline-flex text-secondary">
      <AlertTriangle className="size-3.5" aria-hidden="true" />
      <span className="sr-only">Alergias registradas: {allergies.join(", ")}</span>
    </span>
  )
}

export function VitalsGrid({ vitals }: { vitals: VitalSigns }) {
  const imc = bmi(vitals.weight, vitals.height)
  const items = [
    ["Presión arterial", `${vitals.systolic}/${vitals.diastolic}`, "mmHg"],
    ["Frec. cardiaca", vitals.heartRate, "lpm"],
    ["Frec. respiratoria", vitals.respiratoryRate, "rpm"],
    ["Temperatura", vitals.temperature.toFixed(1), "°C"],
    ["Saturación O2", vitals.oxygenSaturation, "%"],
    ["Peso", vitals.weight.toFixed(1), "kg"],
    ["Talla", vitals.height.toFixed(2), "m"],
    ["IMC", imc?.toFixed(1) ?? "—", imc ? bmiCategory(imc) : ""],
  ] as const
  return (
    <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {items.map(([label, value, unit]) => (
        <div key={label} className="rounded-lg border p-3">
          <dt className="text-xs text-muted-foreground">{label}</dt>
          <dd className="mt-1 flex items-baseline gap-1">
            <span className="font-mono text-base font-semibold">{value}</span>
            <span className="text-xs text-muted-foreground">{unit}</span>
          </dd>
        </div>
      ))}
    </dl>
  )
}

export function ClinicalText({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <SectionLabel>{label}</SectionLabel>
      <p className="mt-1.5 text-sm leading-relaxed text-pretty">{children}</p>
    </div>
  )
}
