import {
  etiquetaProcesoPsicologia,
  fechaColumnaISO,
  numeroPersona,
  type EstadoAtencionPsicologica,
  type HijoFichaPsicologiaDto,
} from '@akyuam/shared';
import type { GeneroPersona } from '@prisma/client';
import { edad, nombreCompleto, type PersonaConNacimiento } from './personas';

/** Lo que la ficha lee de un hijo/a y de sus procesos (más reciente primero). */
export interface NinoConProcesos extends PersonaConNacimiento {
  id: string;
  consecutivo: number;
  genero: GeneroPersona;
  atencionesPsicologicas: {
    id: string;
    consecutivo: number;
    estado: EstadoAtencionPsicologica;
    fechaCierre: Date | null;
    psicologaAsignada: { nombreCompleto: string; puesto: string | null } | null;
    /** Solo la próxima cita programada, si hay. */
    citas: { fechaHora: Date }[];
  }[];
}

/**
 * Fila "Hijas e hijos" de la ficha. Un hijo/a tiene a lo más un proceso abierto (lo garantiza un
 * índice único parcial); si no tiene, se informa cuándo se cerró el último.
 */
export function hijoDeFicha(
  nino: NinoConProcesos,
  expedienteNumero: string,
  expedienteTomado: boolean,
): HijoFichaPsicologiaDto {
  const procesos = nino.atencionesPsicologicas;
  const abierto = procesos.find((proceso) => proceso.estado !== 'CIERRE');
  const ultimoCierre = abierto
    ? null
    : procesos
        .map((proceso) => proceso.fechaCierre)
        .filter((fecha): fecha is Date => fecha !== null)
        .reduce<Date | null>(
          (mayor, fecha) => (mayor === null || fecha > mayor ? fecha : mayor),
          null,
        );
  const ultimoConsecutivo = Math.max(
    0,
    ...procesos.map((proceso) => proceso.consecutivo),
  );

  return {
    ninoId: nino.id,
    numero: numeroPersona(expedienteNumero, nino.consecutivo),
    nombreCompleto: nombreCompleto(nino),
    edad: edad(nino),
    genero: nino.genero === 'MUJER' ? 'M' : 'H',
    fechaNacimiento: fechaColumnaISO(nino.fechaNacimiento),
    procesoAbierto: abierto
      ? {
          procesoId: abierto.id,
          codigo: etiquetaProcesoPsicologia(
            expedienteNumero,
            abierto.consecutivo,
            nino.consecutivo,
          ),
          etapa: abierto.estado,
          responsable: abierto.psicologaAsignada,
          proximaCita: abierto.citas[0]?.fechaHora.toISOString() ?? null,
        }
      : null,
    ultimoCierre: ultimoCierre?.toISOString() ?? null,
    puedeAbrirProceso: expedienteTomado && !abierto,
    codigoProcesoNuevo: etiquetaProcesoPsicologia(
      expedienteNumero,
      ultimoConsecutivo + 1,
      nino.consecutivo,
    ),
  };
}
