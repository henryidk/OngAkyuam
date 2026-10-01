import { useState } from "react"
import { CalendarCheck } from "lucide-react"
import { Button } from "./ui/button"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "./ui/field"
import { Input } from "./ui/input"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "./ui/select"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "./ui/sheet"
import { CLINICS, lastAttended, medPatients, TODAY } from "./medicine-data"
import type { ScheduleSeed } from "./medicine-agenda"
import { PriorityBadge, SectionLabel } from "./medicine-ui"

const patientItems = medPatients.map((item) => ({ value: item.id, label: `${item.name} · ${item.id}` }))

export function ScheduleConsultationSheet({ seed, onClose }: { seed: ScheduleSeed | null; onClose: () => void }) {
  const title = seed?.consultation ? "Reprogramar consulta" : seed?.referral ? "Agendar primera consulta" : "Agendar consulta"
  return (
    <Sheet open={Boolean(seed)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="overflow-y-auto data-[side=right]:w-full data-[side=right]:sm:max-w-lg">
        <SheetHeader className="border-b p-6">
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>Define fecha, hora, clínica y motivo. Demostración sin guardado en servidor.</SheetDescription>
        </SheetHeader>
        {seed && <ScheduleForm key={`${seed.patientId}-${seed.consultation?.id ?? seed.referral?.id ?? "new"}`} seed={seed} onClose={onClose} />}
      </SheetContent>
    </Sheet>
  )
}

function ScheduleForm({ seed, onClose }: { seed: ScheduleSeed; onClose: () => void }) {
  const [patientId, setPatientId] = useState(seed.patientId)
  const [type, setType] = useState(seed.consultation?.type ?? (seed.referral ? "Primera consulta" : lastAttended(seed.patientId) ? "Reconsulta" : "Primera consulta"))
  const [place, setPlace] = useState<string>(seed.consultation?.place ?? CLINICS[0])
  const [saved, setSaved] = useState(false)

  if (saved) {
    return (
      <div className="flex flex-col items-center gap-3 p-10 text-center">
        <CalendarCheck className="size-10 text-primary" aria-hidden="true" />
        <p className="text-lg font-semibold">Simulación de agenda completada</p>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Este formulario es una demostración; la consulta no se guardó en el servidor.
          {seed.referral ? " La referencia de Trabajo Social no se modificó." : ""}
        </p>
        <Button className="mt-2" onClick={onClose}>Cerrar</Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {seed.referral && (
        <div className="rounded-lg border bg-muted/40 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-semibold">{seed.referral.patientName}</p>
              <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                {seed.referral.patientId} · {seed.referral.age} años · {seed.referral.municipality}
              </p>
            </div>
            <PriorityBadge priority={seed.referral.priority} />
          </div>
          <SectionLabel className="mt-4">Nota de Trabajo Social</SectionLabel>
          <p className="mt-1.5 text-sm leading-relaxed">{seed.referral.note}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            {seed.referral.id} · {seed.referral.socialWorker} · {seed.referral.received}
          </p>
        </div>
      )}

      {!seed.referral && seed.patientId && (
        <div className="rounded-lg border bg-muted/40 p-4">
          <p className="font-semibold">{seed.patientName}</p>
          <p className="mt-1 font-mono text-xs text-muted-foreground">{seed.patientId}</p>
          {seed.consultation && (
            <p className="mt-2 text-xs text-muted-foreground">
              Fecha actual: {seed.consultation.dateLabel} · {seed.consultation.time}
            </p>
          )}
        </div>
      )}

      <FieldGroup>
        {!seed.patientId && (
          <Field>
            <FieldLabel>Paciente</FieldLabel>
            <Select items={patientItems} value={patientId} onValueChange={(value) => {
              const next = (value as string | null) ?? ""
              setPatientId(next)
              setType(lastAttended(next) ? "Reconsulta" : "Primera consulta")
            }}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Seleccionar paciente registrada" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {patientItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <FieldDescription>Las pacientes nuevas ingresan por referencia de Trabajo Social.</FieldDescription>
          </Field>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="schedule-date">Fecha</FieldLabel>
            <Input id="schedule-date" type="date" min={TODAY} defaultValue={seed.consultation?.isoDate ?? "2026-08-19"} />
          </Field>
          <Field>
            <FieldLabel htmlFor="schedule-time">Hora</FieldLabel>
            <Input id="schedule-time" type="time" step={900} defaultValue={seed.consultation?.time ?? "09:00"} />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel>Tipo de consulta</FieldLabel>
            <Select value={type} onValueChange={(value) => value && setType(value as typeof type)}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="Primera consulta">Primera consulta</SelectItem>
                  <SelectItem value="Reconsulta">Reconsulta</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel>Clínica</FieldLabel>
            <Select value={place} onValueChange={(value) => value && setPlace(value as string)}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {CLINICS.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
        </div>
        <Field>
          <FieldLabel htmlFor="schedule-reason">Motivo de consulta</FieldLabel>
          <Input id="schedule-reason" defaultValue={seed.reason ?? ""} placeholder="Describe brevemente el motivo" />
        </Field>
      </FieldGroup>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>Cancelar</Button>
        <Button disabled={!patientId} onClick={() => setSaved(true)}>
          {seed.consultation ? "Guardar cambios" : "Guardar consulta"}
        </Button>
      </div>
    </div>
  )
}
