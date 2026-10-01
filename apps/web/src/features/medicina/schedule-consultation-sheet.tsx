import { useMedicineData } from "./medicine-context"
import { useState } from "react"
import { CalendarCheck } from "lucide-react"
import { Button } from "./ui/button"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "./ui/field"
import { Input } from "./ui/input"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "./ui/select"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "./ui/sheet"
import { CLINICS, TODAY } from "./medicine-data"
import type { ScheduleSeed } from "./medicine-agenda"
import { programarConsultaMedicaSchema } from "@akyuam/shared"
import { extraerMensajeError } from "../../lib/errors"


export function ScheduleConsultationSheet({ seed, onClose }: { seed: ScheduleSeed | null; onClose: () => void }) {
  const title = seed?.consultation ? "Reprogramar consulta" : seed?.referral ? "Agendar primera consulta" : "Agendar consulta"
  return (
    <Sheet open={Boolean(seed)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="overflow-y-auto data-[side=right]:w-full data-[side=right]:sm:max-w-lg">
        <SheetHeader className="border-b p-6">
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>Define fecha, hora, clínica y motivo de la consulta.</SheetDescription>
        </SheetHeader>
        {seed && <ScheduleForm key={`${seed.patientId}-${seed.consultation?.id ?? seed.referral?.id ?? "new"}`} seed={seed} onClose={onClose} />}
      </SheetContent>
    </Sheet>
  )
}

function ScheduleForm({ seed, onClose }: { seed: ScheduleSeed; onClose: () => void }) {
  const { medPatients, lastAttended, findPatient, schedule } = useMedicineData()
  const patientItems = medPatients.map(item => ({ value: item.id, label: `${item.name} · ${item.id}` }))
  const [date, setDate] = useState(seed.consultation?.isoDate ?? TODAY)
  const [time, setTime] = useState(seed.consultation?.time ?? "09:00")
  const [reason, setReason] = useState(seed.reason ?? "")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [patientId, setPatientId] = useState(seed.patientId)
  const type = lastAttended(patientId) ? "Reconsulta" : "Primera consulta"
  const [place, setPlace] = useState<string>(seed.consultation?.place ?? CLINICS[0])
  const [saved, setSaved] = useState(false)

  async function save() {
    const patient = findPatient(patientId)
    const parsed = programarConsultaMedicaSchema.safeParse({ expedienteId: patient?.expedienteId, isoDate: date, time, reason, place })
    if (!parsed.success) { setError("Selecciona una paciente, fecha, hora, clínica y motivo válidos."); return }
    setBusy(true); setError(null)
    try { await schedule(parsed.data, seed.consultation?.id); setSaved(true) }
    catch (err) { setError(extraerMensajeError(err)) }
    finally { setBusy(false) }
  }

  if (saved) {
    return (
      <div className="flex flex-col items-center gap-3 p-10 text-center">
        <CalendarCheck className="size-10 text-primary" aria-hidden="true" />
        <p className="text-lg font-semibold">Consulta guardada</p>
        <p className="text-sm leading-relaxed text-muted-foreground">
          La consulta quedó registrada en la agenda médica.
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
          </div>
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
            <Input id="schedule-date" type="date" min={TODAY} value={date} onChange={event => setDate(event.target.value)} />
          </Field>
          <Field>
            <FieldLabel htmlFor="schedule-time">Hora</FieldLabel>
            <Input id="schedule-time" type="time" step={900} value={time} onChange={event => setTime(event.target.value)} />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel>Tipo de consulta</FieldLabel>
<p className="rounded-lg border px-3 py-2 text-sm">{type}</p>
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
          <Input id="schedule-reason" value={reason} onChange={event => setReason(event.target.value)} placeholder="Describe brevemente el motivo" />
        </Field>
      </FieldGroup>

      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>Cancelar</Button>
        <Button disabled={busy || !patientId || !reason.trim()} onClick={() => void save()}>
          {seed.consultation ? "Guardar cambios" : "Guardar consulta"}
        </Button>
      </div>
    </div>
  )
}
