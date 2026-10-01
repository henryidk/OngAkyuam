import { useState } from "react"
import { useSearchParams } from "react-router-dom"
import { useAuthStore } from "../../store/auth.store"

import { CalendarDays, ClipboardList, Lock, Menu, Stethoscope, UsersRound } from "lucide-react"

import { Avatar, AvatarFallback } from "./ui/avatar"
import { Button } from "./ui/button"
import { Separator } from "./ui/separator"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "./ui/sheet"
import { cn } from "./utils"
import { ConsultationDetailSheet } from "./consultation-detail-sheet"
import { ConsultationFormSheet } from "./consultation-form-sheet"
import { MedicineAgenda, type ScheduleSeed } from "./medicine-agenda"
import { PROFESSIONAL, type Consultation, type MedPatient } from "./medicine-data"
import { MedicinePatients } from "./medicine-patients"
import { MedicineReports } from "./medicine-reports"
import { PatientRecordSheet } from "./patient-record-sheet"
import { ScheduleConsultationSheet } from "./schedule-consultation-sheet"

type View = "agenda" | "pacientes" | "reportes"

const navItems = [
  { key: "agenda", label: "Agenda de consultas", Icon: CalendarDays },
  { key: "pacientes", label: "Pacientes", Icon: UsersRound },
  { key: "reportes", label: "Reportes", Icon: ClipboardList },
] as const

function Brand() {
  return (
    <div className="flex items-center gap-3">
      <div className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
        <Stethoscope className="size-5" aria-hidden="true" />
      </div>
      <div>
        <p className="font-semibold leading-tight">Centro Integral</p>
        <p className="text-xs text-muted-foreground">Módulo de Medicina</p>
      </div>
    </div>
  )
}

export function MedicineWorkspace() {
  const [searchParams, setSearchParams] = useSearchParams()
  const selectedView = searchParams.get("vista")
  const view: View = selectedView === "pacientes" || selectedView === "reportes" ? selectedView : "agenda"
  const usuario = useAuthStore((state) => state.usuario)
  const logout = useAuthStore((state) => state.logout)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [scheduleSeed, setScheduleSeed] = useState<ScheduleSeed | null>(null)
  const [activeConsultation, setActiveConsultation] = useState<Consultation | null>(null)
  const [selectedPatient, setSelectedPatient] = useState<MedPatient | null>(null)
  const [consultationDetail, setConsultationDetail] = useState<Consultation | null>(null)

  const navigate = (next: View) => {
    setSearchParams({ vista: next })
    setMobileOpen(false)
    window.scrollTo({ top: 0 })
  }

  const nav = (
    <nav aria-label="Navegación del módulo" className="flex flex-col gap-1">
      {navItems.map(({ key, label, Icon }) => (
        <button
          key={key}
          onClick={() => navigate(key)}
          aria-current={view === key ? "page" : undefined}
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors",
            view === key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          <Icon className="size-4" aria-hidden="true" />
          {label}
        </button>
      ))}
    </nav>
  )

  return (
    <main className="medicina-theme min-h-screen bg-background font-sans text-foreground">
      <div className="flex min-h-screen">
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-r bg-card p-5 lg:flex lg:flex-col">
          <Brand />
          <div className="mt-10">{nav}</div>
          <div className="mt-auto rounded-xl bg-muted p-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Lock className="size-4 text-primary" aria-hidden="true" />
              Confidencialidad médica
            </div>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              Las notas clínicas solo son visibles para el personal médico autorizado.
            </p>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b bg-background/95 px-4 backdrop-blur md:px-8">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Abrir menú">
                <Menu />
              </Button>
              <div className="lg:hidden"><Brand /></div>
              <div className="hidden lg:block">
                <p className="text-sm font-medium">Medicina</p>
                <p className="text-xs text-muted-foreground">Consulta externa y seguimiento clínico</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => void logout()}>Cerrar sesión</Button>
              <Separator orientation="vertical" className="h-7" />
              <Avatar className="size-9">
                <AvatarFallback className="bg-secondary text-secondary-foreground">{usuario?.nombreCompleto.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]).join("") ?? "LF"}</AvatarFallback>
              </Avatar>
              <div className="hidden sm:block">
                <p className="text-sm font-medium">{usuario?.nombreCompleto ?? PROFESSIONAL}</p>
                <p className="text-xs text-muted-foreground">Médica general</p>
              </div>
            </div>
          </header>

          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetContent side="left" className="w-72 p-5">
              <SheetHeader className="p-0">
                <SheetTitle className="sr-only">Menú principal</SheetTitle>
                <SheetDescription className="sr-only">Navegación del módulo de medicina</SheetDescription>
              </SheetHeader>
              <Brand />
              <div className="mt-8">{nav}</div>
            </SheetContent>
          </Sheet>

          <div className="mx-auto max-w-7xl p-4 md:p-8">
            <p role="note" className="mb-5 rounded-lg border bg-muted/40 px-4 py-2 text-xs text-muted-foreground">Vista de demostración · Datos ficticios de v0. Los formularios aún no guardan en el servidor.</p>
            {view === "agenda" && <MedicineAgenda onSchedule={setScheduleSeed} onStart={setActiveConsultation} onPatient={setSelectedPatient} />}
            {view === "pacientes" && <MedicinePatients onOpen={setSelectedPatient} />}
            {view === "reportes" && <MedicineReports onOpen={setConsultationDetail} />}
          </div>
        </div>
      </div>

      <ScheduleConsultationSheet seed={scheduleSeed} onClose={() => setScheduleSeed(null)} />
      <ConsultationFormSheet consultation={activeConsultation} onClose={() => setActiveConsultation(null)} onOpenRecord={setSelectedPatient} />
      <PatientRecordSheet patient={selectedPatient} onClose={() => setSelectedPatient(null)} onConsultation={setConsultationDetail} onSchedule={setScheduleSeed} />
      <ConsultationDetailSheet consultation={consultationDetail} onClose={() => setConsultationDetail(null)} />
    </main>
  )
}
