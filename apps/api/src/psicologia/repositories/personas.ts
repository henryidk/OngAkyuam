import {
  edadEnAniosGT,
  fechaColumnaISO,
  numeroPersona,
  type PersonaAtendidaDto,
  type PersonaParaAbrirDto,
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

/** Proceso abierto de alguien, visto solo para saber quién lo lleva. */
interface ProcesoAbiertoDe {
  psicologaAsignada: { nombreCompleto: string } | null;
}

/**
 * Las personas a quienes se puede abrir el proceso de un caso tomado: la usuaria primero y luego
 * cada hijo/a por su número. Quien ya tiene un proceso abierto lleva el nombre de quien la
 * atiende, para mostrarla deshabilitada; el servidor lo vuelve a validar al abrir.
 */
export function personasParaAbrir(
  expediente: {
    numero: string;
    usuaria: PersonaConNacimiento;
    ninos: (PersonaConNacimiento & {
      id: string;
      consecutivo: number;
      atencionesPsicologicas: ProcesoAbiertoDe[];
    })[];
  },
  abiertoDeUsuaria: ProcesoAbiertoDe | undefined,
): PersonaParaAbrirDto[] {
  const atendidaPor = (proceso: ProcesoAbiertoDe | undefined) =>
    proceso
      ? (proceso.psicologaAsignada?.nombreCompleto ?? 'otra profesional')
      : null;
  return [
    {
      ...personaAtendida(expediente.usuaria, null),
      numero: expediente.numero,
      atendidaPor: atendidaPor(abiertoDeUsuaria),
    },
    ...expediente.ninos.map((nino) => ({
      ...personaAtendida(expediente.usuaria, nino),
      numero: numeroPersona(expediente.numero, nino.consecutivo),
      atendidaPor: atendidaPor(nino.atencionesPsicologicas[0]),
    })),
  ];
}
