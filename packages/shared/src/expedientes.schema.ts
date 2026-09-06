import { z } from 'zod';

export const createExpedienteSchema = z.object({
  // Paso 1: Datos Usuaria
  nombresUsuaria: z.string().min(1, 'Los nombres son obligatorios'),
  apellidosUsuaria: z.string().min(1, 'Los apellidos son obligatorios'),
  dpi: z.string().length(13, 'El DPI debe tener exactamente 13 dígitos').optional().or(z.literal('')),
  telefono: z.string().max(8, 'El teléfono no puede exceder 8 dígitos').optional().or(z.literal('')),
  direccion: z.string().min(1, 'La dirección es obligatoria'),
  
  // Paso 2: Datos Agresor
  nombresAgresor: z.string().optional(),
  apellidosAgresor: z.string().optional(),
  telefonoAgresor: z.string().optional(),
  direccionAgresor: z.string().optional(),
  
  // Tipologías
  tipologiasViolencia: z.array(z.string()),

  // Paso 3: Condición
  condicionRegistro: z.enum(['INTERNA', 'EXTERNA']),
  fechaIngreso: z.string().optional(), // ISODate
  observacionesGenerales: z.string().optional(),
});

export type CreateExpedienteDto = z.infer<typeof createExpedienteSchema>;
