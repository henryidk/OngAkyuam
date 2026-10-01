import { useState } from "react"
import { Download } from "lucide-react"
import { Button } from "./ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card"
import { Field, FieldLabel } from "./ui/field"
import { Input } from "./ui/input"
import { consultations, findPatient, historySummary, TODAY, type Consultation } from "./medicine-data"
import { ConsultationStatusBadge } from "./medicine-ui"

const presets = [
  { label: "Este mes", from: "2026-08-01", to: "2026-08-31" },
  { label: "Últimos 3 meses", from: "2026-05-18", to: TODAY },
  { label: "Año en curso", from: "2026-01-01", to: "2026-12-31" },
]

const exportColumns = ["No. de expediente", "Fecha", "Paciente", "Edad", "Tipo", "Estado", "Motivo de consulta", "Antecedentes importantes", "Positivo en EF", "Diagnóstico", "Plan", "Evolución"]

function csvCell(value: string | number | undefined) {
  const text = String(value ?? "")
  return /[",\n;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

function exportCsv(records: Consultation[], from: string, to: string) {
  const rows = records.map((item) => {
    const patient = findPatient(item.patientId)
    return [
      item.patientId,
      item.isoDate,
      item.patientName,
      patient?.age,
      item.type,
      item.status,
      item.reason,
      patient ? historySummary(patient.history) : "",
      item.physicalExam,
      item.diagnoses?.map((dx) => `${dx.code} ${dx.label}`).join(" / "),
      item.plan,
      item.evolution,
    ].map(csvCell).join(",")
  })
  const csv = `\uFEFF${[exportColumns.join(","), ...rows].join("\n")}`
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }))
  const link = document.createElement("a")
  link.href = url
  link.download = `registro-medico_${from}_${to}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

export function MedicineReports({ onOpen }: { onOpen: (item: Consultation) => void }) {
  const [from, setFrom] = useState(presets[1].from)
  const [to, setTo] = useState(presets[1].to)
  const records = consultations
    .filter((item) => item.status !== "Programada" && item.isoDate >= from && item.isoDate <= to)
    .reverse()
  const attended = records.filter((item) => item.status === "Atendida")
  const uniquePatients = new Set(attended.map((item) => item.patientId)).size

  const diagnosisCounts = Object.values(
    attended.flatMap((item) => item.diagnoses ?? []).reduce<Record<string, { code: string; label: string; count: number }>>((acc, item) => {
      acc[item.code] = { ...item, count: (acc[item.code]?.count ?? 0) + 1 }
      return acc
    }, {}),
  ).sort((a, b) => b.count - a.count).slice(0, 6)
  const maxCount = diagnosisCounts[0]?.count ?? 1

  const stats = [
    ["Consultas atendidas", attended.length],
    ["Pacientes atendidas", uniquePatients],
    ["Primeras consultas", attended.filter((item) => item.type === "Primera consulta").length],
    ["Ausencias", records.filter((item) => item.status === "Ausente").length],
  ] as const

  return (
    <>
      <section className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-semibold text-primary">CONTROL OPERATIVO</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-balance md:text-3xl">Reporte de atención médica</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Consultas, diagnósticos y ausencias por rango de fechas.</p>
        </div>
        <Button variant="outline" onClick={() => exportCsv(records, from, to)} disabled={!records.length}>
          <Download data-icon="inline-start" />
          Exportar CSV (Excel)
        </Button>
      </section>

      <Card className="mt-7">
        <CardHeader>
          <CardTitle>Período del reporte</CardTitle>
          <CardDescription>Selecciona un rango predefinido o personalizado.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Rangos predefinidos">
            {presets.map((item) => {
              const active = item.from === from && item.to === to
              return (
                <Button key={item.label} size="sm" variant={active ? "default" : "outline"} aria-pressed={active} onClick={() => { setFrom(item.from); setTo(item.to) }}>
                  {item.label}
                </Button>
              )
            })}
          </div>
          <div className="flex flex-col gap-4 sm:flex-row">
            <Field className="flex-1">
              <FieldLabel htmlFor="report-from">Desde</FieldLabel>
              <Input id="report-from" type="date" value={from} max={to} onChange={(event) => setFrom(event.target.value)} />
            </Field>
            <Field className="flex-1">
              <FieldLabel htmlFor="report-to">Hasta</FieldLabel>
              <Input id="report-to" type="date" value={to} min={from} onChange={(event) => setTo(event.target.value)} />
            </Field>
          </div>
        </CardContent>
      </Card>

      <section className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4" aria-label="Resumen del período">
        {stats.map(([label, value]) => (
          <Card key={label}>
            <CardHeader className="pb-2"><CardDescription>{label}</CardDescription></CardHeader>
            <CardContent><p className="text-2xl font-semibold">{value}</p></CardContent>
          </Card>
        ))}
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_340px]">
        <Card className="order-2 xl:order-1">
          <CardHeader className="border-b">
            <CardTitle>Registro clínico del período</CardTitle>
            <CardDescription>{records.length} registros · selecciona uno para ver la nota completa.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {records.length ? (
              <ul className="divide-y">
                {records.map((item) => (
                  <li key={item.id}>
                    <button onClick={() => onOpen(item)} className="grid w-full gap-2 p-4 text-left hover:bg-muted/40 md:grid-cols-[110px_1fr_1.3fr_auto] md:items-center md:gap-4 md:p-5">
                      <div>
                        <p className="text-sm font-semibold">{item.dateLabel}</p>
                        <p className="font-mono text-xs text-muted-foreground">{item.time}</p>
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{item.patientName}</p>
                        <p className="font-mono text-xs text-muted-foreground">{item.patientId}</p>
                      </div>
                      <div className="min-w-0">
                        {item.diagnoses ? (
                          <p className="truncate text-sm">
                            <span className="font-mono text-xs font-semibold text-primary">{item.diagnoses[0].code}</span> {item.diagnoses[0].label}
                          </p>
                        ) : (
                          <p className="text-sm text-muted-foreground">Sin nota clínica</p>
                        )}
                        <p className="truncate text-xs text-muted-foreground">{item.type}</p>
                      </div>
                      <ConsultationStatusBadge status={item.status} />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="p-12 text-center text-sm text-muted-foreground">No hay registros en este período.</p>
            )}
          </CardContent>
        </Card>

        <Card className="order-1 h-fit xl:order-2">
          <CardHeader>
            <CardTitle className="text-base">Diagnósticos más frecuentes</CardTitle>
            <CardDescription>Según CIE-10 en consultas atendidas.</CardDescription>
          </CardHeader>
          <CardContent>
            {diagnosisCounts.length ? (
              <ol className="flex flex-col gap-4">
                {diagnosisCounts.map((item) => (
                  <li key={item.code}>
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <p className="min-w-0 truncate">
                        <span className="font-mono text-xs font-semibold text-primary">{item.code}</span> {item.label}
                      </p>
                      <span className="font-mono text-xs font-semibold">{item.count}</span>
                    </div>
                    <div className="mt-1.5 h-1.5 rounded-full bg-muted" aria-hidden="true">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${(item.count / maxCount) * 100}%` }} />
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-muted-foreground">Sin diagnósticos en este período.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
