import { useMedicineData } from "./medicine-context"
import { useState } from "react"
import { ChevronRight, Search } from "lucide-react"
import { Avatar, AvatarFallback } from "./ui/avatar"
import { Button } from "./ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card"
import { Input } from "./ui/input"
import { formatDate, type MedPatient, type PatientStatus } from "./medicine-data"
import { AllergyMarker, initials, PatientStatusBadge } from "./medicine-ui"

const filters: ("Todas" | PatientStatus)[] = ["Todas", "Nuevo ingreso", "En tratamiento"]

export function MedicinePatients({ onOpen }: { onOpen: (item: MedPatient) => void }) {
  const { medPatients, lastAttended } = useMedicineData()
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState<(typeof filters)[number]>("Todas")
  const rows = medPatients.map((patient) => ({ patient, last: lastAttended(patient.id) }))
  const term = query.trim().toLowerCase()
  const filtered = rows.filter(({ patient, last }) => {
    const haystack = `${patient.name} ${patient.id} ${last?.diagnoses?.map((item) => `${item.code} ${item.label}`).join(" ") ?? ""}`.toLowerCase()
    return (filter === "Todas" || patient.status === filter) && haystack.includes(term)
  })

  return (
    <>
      <section>
        <p className="text-sm font-semibold text-primary">EXPEDIENTES MÉDICOS</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-balance md:text-3xl">Pacientes</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Consulta el expediente, la evolución clínica por fecha y los antecedentes de cada paciente.
        </p>
      </section>

      <Card className="mt-7">
        <CardHeader className="border-b">
          <CardTitle>Directorio de expedientes</CardTitle>
          <CardDescription>{filtered.length} de {medPatients.length} pacientes</CardDescription>
          <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input value={query} onChange={(event) => setQuery(event.target.value)} className="pl-9" placeholder="Buscar por nombre, expediente o diagnóstico" aria-label="Buscar paciente" />
            </div>
            <div className="flex flex-wrap gap-1 rounded-lg border bg-card p-1" role="group" aria-label="Filtrar por estado">
              {filters.map((item) => (
                <Button key={item} size="sm" variant={filter === item ? "default" : "ghost"} onClick={() => setFilter(item)} aria-pressed={filter === item}>
                  {item}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {filtered.length ? (
            <ul className="divide-y">
              {filtered.map(({ patient, last }) => (
                <li key={patient.id}>
                  <button onClick={() => onOpen(patient)} className="flex w-full items-center gap-4 p-4 text-left hover:bg-muted/40 md:p-5">
                    <Avatar className="size-11">
                      <AvatarFallback className="bg-secondary text-secondary-foreground">{initials(patient.name)}</AvatarFallback>
                    </Avatar>
                    <div className="grid min-w-0 flex-1 gap-2 md:grid-cols-[1.1fr_1.4fr_auto] md:items-center md:gap-6">
                      <div className="min-w-0">
                        <p className="flex items-center gap-1.5 font-semibold">
                          <span className="truncate">{patient.name}</span>
                          <AllergyMarker allergies={patient.allergies} />
                        </p>
                        <p className="font-mono text-xs text-muted-foreground">{patient.id}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{patient.age} años · {patient.municipality}</p>
                      </div>
                      <div className="min-w-0">
                        {last?.diagnoses ? (
                          <p className="truncate text-sm">
                            <span className="font-mono text-xs font-semibold text-primary">{last.diagnoses[0].code}</span>{" "}
                            {last.diagnoses[0].label}
                            {last.diagnoses.length > 1 && <span className="text-muted-foreground"> +{last.diagnoses.length - 1}</span>}
                          </p>
                        ) : (
                          <p className="text-sm text-muted-foreground">Pendiente de primera consulta</p>
                        )}
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {last ? `Última consulta: ${formatDate(last.isoDate)}` : "Sin consultas atendidas"}
                        </p>
                      </div>
                      <PatientStatusBadge status={patient.status} />
                    </div>
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="p-12 text-center text-sm text-muted-foreground">No se encontraron pacientes con esos criterios.</p>
          )}
        </CardContent>
      </Card>
    </>
  )
}
