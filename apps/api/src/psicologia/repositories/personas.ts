import {
  edadEnAniosGT,
  fechaColumnaISO,
  type PersonaAtendidaDto,
} from '@akyuam/shared';

export interface PersonaConNacimiento {
  nombres: string;
  apellidos: string;
  fechaNacimiento: Date;
}

export const SELECT_PERSONA = {
  nombres: true,
  apellidos: true,
  fechaNacimiento: true,
} as const;

export function nombreCompleto(persona: {
  nombres: string;
  apellidos: string;
}): string {
  return `${persona.nombres} ${persona.apellidos}`;
}

export function edad(persona: PersonaConNacimiento): number {
  return edadEnAniosGT(fechaColumnaISO(persona.fechaNacimiento));
}

/** A quién se atiende en una cita: el hijo/a indicado o, si no hay, la usuaria. */
export function personaAtendida(
  usuaria: PersonaConNacimiento,
  nino: (PersonaConNacimiento & { id: string }) | null,
): PersonaAtendidaDto {
  const persona = nino ?? usuaria;
  return {
    ninoId: nino?.id ?? null,
    nombreCompleto: nombreCompleto(persona),
    edad: edad(persona),
  };
}

/** La usuaria primero y luego sus hijos/as: las personas a quienes se puede dar la cita. */
export function personasDelExpediente(expediente: {
  usuaria: PersonaConNacimiento;
  ninos: (PersonaConNacimiento & { id: string })[];
}): PersonaAtendidaDto[] {
  return [
    personaAtendida(expediente.usuaria, null),
    ...expediente.ninos.map((nino) =>
      personaAtendida(expediente.usuaria, nino),
    ),
  ];
}
