import { z } from 'zod';

const texto = z.string().trim().max(10000);
const fecha = z.iso.date();
export const historiaMedicaSchema = z.object({ personal: texto, surgical: texto, gyneco: texto, family: texto, medication: texto });
export const perfilMedicoSchema = z.object({
  bloodType: z.string().trim().max(30),
  allergies: z.array(z.string().trim().min(1).max(200)).max(100),
  chronicConditions: z.array(z.string().trim().min(1).max(200)).max(100),
  history: historiaMedicaSchema,
});
export const programarConsultaMedicaSchema = z.object({
  expedienteId: z.uuid(), isoDate: fecha,
  time: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
  place: z.string().trim().min(1).max(200), reason: texto.min(1),
});
export const signosVitalesMedicosSchema = z.object({
  systolic: z.number().positive().max(350), diastolic: z.number().positive().max(250),
  heartRate: z.number().positive().max(300), respiratoryRate: z.number().positive().max(100),
  temperature: z.number().min(25).max(45), oxygenSaturation: z.number().min(0).max(100),
  weight: z.number().positive().max(500), height: z.number().positive().max(3),
});
export const registrarConsultaMedicaSchema = z.object({
  reason: texto.min(1), physicalExam: texto, evolution: texto, plan: texto.min(1),
  diagnoses: z.array(z.object({ code: z.string().trim().min(1).max(20), label: z.string().trim().min(1).max(300) })).min(1).max(30),
  prescriptions: z.array(z.object({ medication: z.string().trim().min(1).max(300), dose: z.string().trim().max(100), frequency: z.string().trim().max(300), duration: z.string().trim().max(100) })).max(30),
  vitals: signosVitalesMedicosSchema.optional(), history: historiaMedicaSchema,
  referral: z.string().trim().max(200).optional(), nextDate: fecha.optional(),
});
export type PerfilMedico = z.infer<typeof perfilMedicoSchema>;
export type ProgramarConsultaMedicaInput = z.infer<typeof programarConsultaMedicaSchema>;
export type RegistrarConsultaMedicaInput = z.infer<typeof registrarConsultaMedicaSchema>;
export type HistoriaMedica = z.infer<typeof historiaMedicaSchema>;
export type SignosVitalesMedicos = z.infer<typeof signosVitalesMedicosSchema>;
export type DiagnosticoMedico = RegistrarConsultaMedicaInput['diagnoses'][number];
export type RecetaMedica = RegistrarConsultaMedicaInput['prescriptions'][number];
export interface PacienteMedica extends PerfilMedico {
  id: string; expedienteId: string; name: string; age: number; birthDate: string;
  municipality: string; phone: string; status: 'Nuevo ingreso' | 'En tratamiento' | 'Alta';
  referredBy: string; referredOn: string;
}
export interface ConsultaMedica {
  id: string; isoDate: string; dateLabel: string; time: string; patientId: string; patientName: string;
  reason: string; type: 'Primera consulta' | 'Reconsulta'; place: string;
  status: 'Programada' | 'Atendida' | 'Ausente'; professional: string;
  vitals?: SignosVitalesMedicos; physicalExam?: string; diagnoses?: DiagnosticoMedico[];
  history?: HistoriaMedica; plan?: string; prescriptions?: RecetaMedica[]; evolution?: string; referral?: string;
}
export interface ReferenciaMedica {
  id: string; patientId: string; patientName: string; age: number; municipality: string;
  received: string; reason: string; socialWorker: string; note: string;
}
export interface MedicinaWorkspaceData { patients: PacienteMedica[]; consultations: ConsultaMedica[]; referrals: ReferenciaMedica[] }
