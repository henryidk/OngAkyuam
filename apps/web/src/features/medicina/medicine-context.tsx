import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import type { MedicinaWorkspaceData, PerfilMedico, ProgramarConsultaMedicaInput, RegistrarConsultaMedicaInput } from '@akyuam/shared'
import { api } from '../../lib/api'
import { extraerMensajeError } from '../../lib/errors'
import { crearSocketArea } from '../../lib/socket'
import type { Consultation, MedPatient } from './medicine-data'

function buildData(data: MedicinaWorkspaceData) {
  const patientConsultations = (id: string) => data.consultations.filter(item => item.patientId === id)
  return {
    medPatients: data.patients, consultations: data.consultations, medReferrals: data.referrals,
    findPatient: (id: string) => data.patients.find(item => item.id === id), patientConsultations,
    lastAttended: (id: string, before = '9999-12-31') => patientConsultations(id).filter(item => item.status === 'Atendida' && `${item.isoDate}${item.time}` < before).at(-1),
    nextScheduled: (id: string) => patientConsultations(id).find(item => item.status === 'Programada'),
  }
}
interface DataContext extends ReturnType<typeof buildData> {
  loading: boolean; error: string | null; reload: () => Promise<void>;
  schedule: (input: ProgramarConsultaMedicaInput, id?: string) => Promise<void>;
  attend: (consultation: Consultation, input: RegistrarConsultaMedicaInput) => Promise<void>;
  absent: (id: string) => Promise<void>;
  updateProfile: (patient: MedPatient, input: PerfilMedico) => Promise<void>;
}
const Context = createContext<DataContext | null>(null)
export function MedicineDataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<MedicinaWorkspaceData>({ patients: [], consultations: [], referrals: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const generation = useRef(0)
  const reload = useCallback(async () => {
    const request = ++generation.current
    try {
      const response = await api.get<MedicinaWorkspaceData>('/medicina/workspace')
      if (request === generation.current) { setData(response.data); setError(null); setLoading(false) }
    } catch (err) {
      if (request === generation.current) { setError(extraerMensajeError(err)); setData({ patients: [], consultations: [], referrals: [] }); setLoading(false) }
    }
  }, [])
  useEffect(() => {
    void reload()
    const socket = crearSocketArea()
    const refresh = () => { void reload() }
    socket.on('referido:nuevo', refresh)
    window.addEventListener('focus', refresh)
    return () => { ++generation.current; socket.disconnect(); window.removeEventListener('focus', refresh) }
  }, [reload])
  const mutate = async (operation: Promise<unknown>) => { await operation; await reload() }
  return <Context.Provider value={{ ...buildData(data), loading, error, reload,
    schedule: (input, id) => mutate(id ? api.patch(`/medicina/citas/${id}`, input) : api.post('/medicina/citas', input)),
    attend: (consultation, input) => mutate(api.post(`/medicina/citas/${consultation.id}/consulta`, input)),
    absent: id => mutate(api.post(`/medicina/citas/${id}/ausencia`)),
    updateProfile: (patient, input) => mutate(api.patch(`/medicina/expedientes/${patient.expedienteId}/perfil`, input)),
  }}>{children}</Context.Provider>
}
export function useMedicineData() {
  const context = useContext(Context)
  if (!context) throw new Error('Falta MedicineDataProvider')
  return context
}
