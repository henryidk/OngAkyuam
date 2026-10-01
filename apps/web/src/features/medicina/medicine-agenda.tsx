import { useMedicineData } from "./medicine-context"
import { useState } from "react"
import { CalendarDays, FolderOpen, Inbox, Plus, Stethoscope } from "lucide-react"
import { Avatar, AvatarFallback } from "./ui/avatar"
import { Badge } from "./ui/badge"
import { Button } from "./ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card"
import { cn } from "./utils"
import { formatDate, TODAY, type Consultation, type MedPatient, type MedReferral } from "./medicine-data"
import { AllergyMarker, ConsultationStatusBadge, initials } from "./medicine-ui"

export type ScheduleSeed = {
  patientId: string
  patientName: string
  reason?: string
  referral?: MedReferral
  consultation?: Consultation
}

type AgendaProps = {
  onSchedule: (seed: ScheduleSeed) => void
  onStart: (item: Consultation) => void
  onPatient: (item: MedPatient) => void
}

export function MedicineAgenda({ onSchedule, onStart, onPatient }: AgendaProps) {
  const { consultations } = useMedicineData()
  const [mode, setMode] = useState<"Día" | "Próximas">("Día")
  const [selectedDay, setSelectedDay] = useState(TODAY)
  const visible = mode === "Próximas"
    ? consultations.filter((item) => item.status === "Programada" && item.isoDate >= TODAY)
    : consultations.filter((item) => item.isoDate === selectedDay)
  const firstVisits = visible.filter((item) => item.type === "Primera consulta").length
  const title = mode === "Próximas"
    ? "Próximas consultas"
    : selectedDay === TODAY
      ? `Hoy, ${formatDate(selectedDay, { weekday: "long", day: "numeric", month: "long" })}`
      : formatDate(selectedDay, { weekday: "long", day: "numeric", month: "long", year: "numeric" })

  return (
    <>
      <section className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-semibold text-primary">AGENDA MÉDICA</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-balance md:text-3xl">Consultas programadas</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Atiende las referencias de Trabajo Social y da seguimiento a cada paciente por fecha.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => onSchedule({ patientId: "", patientName: "" })}>
            <Plus data-icon="inline-start" />
            Agendar consulta
          </Button>
          <div className="flex rounded-lg border bg-card p-1" role="group" aria-label="Vista de agenda">
            {(["Día", "Próximas"] as const).map((item) => (
              <Button key={item} size="sm" variant={mode === item ? "default" : "ghost"} onClick={() => setMode(item)} aria-pressed={mode === item}>
                {item}
              </Button>
            ))}
          </div>
        </div>
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_340px]">
        <Card>
          <CardHeader className="border-b">
            <CardTitle className="first-letter:uppercase">{title}</CardTitle>
            <CardDescription>
              {visible.length} {visible.length === 1 ? "consulta" : "consultas"}
              {firstVisits ? ` · ${firstVisits} ${firstVisits === 1 ? "primera consulta" : "primeras consultas"}` : ""}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {visible.length ? (
              <ul className="divide-y">
                {visible.map((item) => (
                  <ConsultationRow
                    key={item.id}
                    item={item}
                    showDate={mode === "Próximas"}
                    onStart={onStart}
                    onPatient={onPatient}
                    onReschedule={() => onSchedule({ patientId: item.patientId, patientName: item.patientName, reason: item.reason, consultation: item })}
                  />
                ))}
              </ul>
            ) : (
              <div className="flex flex-col items-center gap-2 p-12 text-center">
                <CalendarDays className="size-6 text-muted-foreground" aria-hidden="true" />
                <p className="text-sm text-muted-foreground">No hay consultas registradas para este día.</p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-6">
          <ReferralInbox onSchedule={onSchedule} />
          <MiniCalendar selectedDay={selectedDay} onSelect={(day) => { setSelectedDay(day); setMode("Día") }} />
        </div>
      </div>
    </>
  )
}

type RowProps = {
  item: Consultation
  showDate: boolean
  onStart: (item: Consultation) => void
  onPatient: (item: MedPatient) => void
  onReschedule: () => void
}

function ConsultationRow({ item, showDate, onStart, onPatient, onReschedule }: RowProps) {
  const { findPatient } = useMedicineData()
  const patient = findPatient(item.patientId)
  return (
    <li className="flex flex-col gap-4 p-4 md:p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-start">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <div className="w-16 shrink-0">
            <p className="font-mono text-sm font-semibold text-primary">{item.time}</p>
            {showDate && <p className="mt-1 text-xs text-muted-foreground">{formatDate(item.isoDate, { day: "numeric", month: "short" })}</p>}
          </div>
          <Avatar className="size-10">
            <AvatarFallback className="bg-secondary text-secondary-foreground">{initials(item.patientName)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-sm font-semibold">
              <span className="truncate">{item.patientName}</span>
              {patient && <AllergyMarker allergies={patient.allergies} />}
            </p>
            <p className="font-mono text-xs text-muted-foreground">
              {item.patientId}
              {patient ? ` · ${patient.age} años` : ""} · {item.place}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-pretty">{item.reason}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Badge variant={item.type === "Primera consulta" ? "secondary" : "outline"}>{item.type}</Badge>
          <ConsultationStatusBadge status={item.status} />
        </div>
      </div>
      <div className="flex flex-wrap gap-2 md:justify-end">
        {patient && (
          <Button size="sm" variant="outline" onClick={() => onPatient(patient)}>
            <FolderOpen data-icon="inline-start" />
            Ver expediente
          </Button>
        )}
        {item.status === "Programada" && (
          <>
            <Button size="sm" variant="outline" onClick={onReschedule}>
              <CalendarDays data-icon="inline-start" />
              Reprogramar
            </Button>
            <Button size="sm" disabled={item.isoDate > TODAY} onClick={() => onStart(item)}>
              <Stethoscope data-icon="inline-start" />
              Iniciar consulta
            </Button>
          </>
        )}
      </div>
    </li>
  )
}

function ReferralInbox({ onSchedule }: { onSchedule: (seed: ScheduleSeed) => void }) {
  const { medReferrals } = useMedicineData()
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Inbox className="size-4 text-primary" aria-hidden="true" />
            Referencias de Trabajo Social
          </CardTitle>
          <Badge variant="secondary">{medReferrals.length}</Badge>
        </div>
        <CardDescription>Pacientes referidas sin consulta asignada.</CardDescription>
      </CardHeader>
      <CardContent>
        {!medReferrals.length && <p className="text-sm text-muted-foreground">No hay referencias pendientes de agendar.</p>}
        <ul className="flex flex-col gap-3">
          {medReferrals.map((item) => (
            <li key={item.id} className="rounded-lg border p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{item.patientName}</p>
                  <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                    {item.patientId} · {item.received}
                  </p>
                </div>
              </div>
              {item.reason && <p className="mt-2 text-sm leading-relaxed">{item.reason}</p>}
              <p className="mt-1 text-xs text-muted-foreground">Refiere: {item.socialWorker}</p>
              <Button
                className="mt-3 w-full"
                size="sm"
                variant="outline"
                onClick={() => onSchedule({ patientId: item.patientId, patientName: item.patientName, reason: item.reason, referral: item })}
              >
                <CalendarDays data-icon="inline-start" />
                Agendar primera consulta
              </Button>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}

function MiniCalendar({ selectedDay, onSelect }: { selectedDay: string; onSelect: (day: string) => void }) {
  const { consultations } = useMedicineData()
  const month = selectedDay.slice(0, 7)
  const [year, monthNumber] = month.split("-").map(Number)
  const padding = (new Date(Date.UTC(year, monthNumber - 1, 1)).getUTCDay() + 6) % 7
  const monthLabel = formatDate(month + "-01", { month: "long", year: "numeric" })
  const counts = consultations
    .filter((item) => item.isoDate.startsWith(month))
    .reduce<Record<number, number>>((acc, item) => {
      const day = Number(item.isoDate.slice(-2))
      acc[day] = (acc[day] ?? 0) + 1
      return acc
    }, {})
  const days = Array.from({ length: new Date(Date.UTC(year, monthNumber, 0)).getUTCDate() }, (_, index) => index + 1)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base capitalize">{monthLabel}</CardTitle>
        <input type="month" aria-label="Mes de la agenda" className="rounded-md border bg-background px-2 py-1 text-sm" value={month} onChange={event => event.target.value && onSelect(event.target.value + "-01")} />
        <CardDescription>Selecciona un día para ver sus consultas.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground" aria-hidden="true">
          {"L M M J V S D".split(" ").map((day, index) => (
            <span key={`${day}-${index}`} className="py-1 font-medium">{day}</span>
          ))}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-1">
          {Array.from({ length: padding }).map((_, index) => <span key={`empty-${index}`} />)}
          {days.map((day) => {
            const iso = `${month}-${String(day).padStart(2, "0")}`
            const selected = selectedDay === iso
            return (
              <button
                key={day}
                onClick={() => onSelect(iso)}
                aria-pressed={selected}
                aria-label={`${formatDate(iso)}${counts[day] ? `, ${counts[day]} consultas` : ""}`}
                className={cn(
                  "flex min-h-11 flex-col items-center justify-center rounded-md text-sm hover:bg-muted",
                  iso === TODAY && !selected && "font-semibold text-primary ring-1 ring-primary/40",
                  selected && "bg-primary text-primary-foreground hover:bg-primary",
                )}
              >
                <span>{day}</span>
                {counts[day] ? (
                  <span className={cn("mt-0.5 size-1.5 rounded-full", selected ? "bg-primary-foreground" : "bg-primary")} />
                ) : null}
              </button>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
