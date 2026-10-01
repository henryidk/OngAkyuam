import { useMedicineData } from "./medicine-context"
import { Printer, Share2 } from "lucide-react"
import { Badge } from "./ui/badge"
import { Button } from "./ui/button"
import { Separator } from "./ui/separator"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "./ui/sheet"
import { historySummary, type Consultation } from "./medicine-data"
import { AllergyAlert, ClinicalText, ConsultationStatusBadge, DiagnosisChips, SectionLabel, VitalsGrid } from "./medicine-ui"

export function ConsultationDetailSheet({ consultation, onClose }: { consultation: Consultation | null; onClose: () => void }) {
  const { findPatient } = useMedicineData()
  const patient = consultation ? findPatient(consultation.patientId) : undefined
  return (
    <Sheet open={Boolean(consultation)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="overflow-y-auto data-[side=right]:w-full data-[side=right]:sm:max-w-xl">
        <SheetHeader className="border-b p-6">
          <div className="flex flex-wrap items-center gap-2">
            {consultation && <ConsultationStatusBadge status={consultation.status} />}
            {consultation && <Badge variant="outline">{consultation.type}</Badge>}
            <Badge variant="outline" className="font-mono">{consultation?.id}</Badge>
          </div>
          <SheetTitle className="mt-3">Nota de consulta médica</SheetTitle>
          <SheetDescription>
            {consultation?.dateLabel} · {consultation?.time} · {consultation?.place}
          </SheetDescription>
        </SheetHeader>

        {consultation && (
          <div className="flex flex-col gap-6 p-6">
            <div className="flex flex-col gap-3">
              <div>
                <p className="font-semibold">{consultation.patientName}</p>
                <p className="font-mono text-xs text-muted-foreground">
                  {consultation.patientId}
                  {patient ? ` · ${patient.age} años · ${patient.municipality}` : ""}
                </p>
              </div>
              {patient && <AllergyAlert allergies={patient.allergies} />}
            </div>
            <Separator />

            <ClinicalText label="Motivo de consulta">{consultation.reason}</ClinicalText>

            {consultation.status === "Ausente" && (
              <div className="rounded-lg border bg-muted/40 p-4 text-sm leading-relaxed text-muted-foreground">
                La paciente no se presentó a la consulta. No se registró nota clínica.
              </div>
            )}

            {consultation.status === "Programada" && (
              <div className="rounded-lg border bg-muted/40 p-4 text-sm leading-relaxed text-muted-foreground">
                Consulta pendiente de atención. La nota clínica estará disponible después de atenderla.
              </div>
            )}

            {consultation.status === "Atendida" && (
              <>
                {consultation.evolution && <ClinicalText label="Evolución">{consultation.evolution}</ClinicalText>}
                {consultation.vitals && (
                  <div>
                    <SectionLabel>Signos vitales</SectionLabel>
                    <div className="mt-2"><VitalsGrid vitals={consultation.vitals} /></div>
                  </div>
                )}
                {consultation.history && <ClinicalText label="Antecedentes importantes">{historySummary(consultation.history) || "Sin registrar"}</ClinicalText>}
                {consultation.physicalExam && <ClinicalText label="Positivo en examen físico">{consultation.physicalExam}</ClinicalText>}
                {consultation.diagnoses && (
                  <div>
                    <SectionLabel>Diagnóstico</SectionLabel>
                    <DiagnosisChips items={consultation.diagnoses} className="mt-2" />
                  </div>
                )}
                {consultation.plan && <ClinicalText label="Plan">{consultation.plan}</ClinicalText>}
                {consultation.prescriptions?.length ? (
                  <div>
                    <SectionLabel>Receta médica</SectionLabel>
                    <ul className="mt-2 divide-y rounded-lg border">
                      {consultation.prescriptions.map((item) => (
                        <li key={item.medication} className="flex flex-col gap-0.5 p-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                          <p className="text-sm font-semibold">
                            {item.medication} <span className="font-mono font-normal text-muted-foreground">{item.dose}</span>
                          </p>
                          <p className="text-xs text-muted-foreground">{item.frequency} · {item.duration}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {consultation.referral && (
                  <div className="flex items-center gap-3 rounded-lg border p-3">
                    <Share2 className="size-4 text-primary" aria-hidden="true" />
                    <p className="text-sm"><span className="text-muted-foreground">Indicación de interconsulta: </span><span className="font-medium">{consultation.referral}</span></p>
                  </div>
                )}
                <Separator />
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Atendió</p>
                    <p className="text-sm font-medium">{consultation.professional}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button disabled title="Impresión pendiente de implementación" size="sm" variant="outline"><Printer data-icon="inline-start" />Imprimir nota</Button>
                    {consultation.prescriptions?.length ? <Button disabled title="Impresión pendiente de implementación" size="sm"><Printer data-icon="inline-start" />Imprimir receta</Button> : null}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
