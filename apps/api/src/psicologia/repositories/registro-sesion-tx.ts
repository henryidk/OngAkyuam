import type { Prisma } from '@prisma/client';
import { etapaTrasSesionAtendida } from '../dominio/etapa-proceso';
import type {
  ConsultaRegistrada,
  RegistrarConsultaParams,
} from '../interfaces/citas-psicologicas-repository.interface';
import { INCLUDE_CITA, mapearCita } from './citas-psicologicas.mapper';

/**
 * El registro de la sesión y lo que se deriva de él, dentro de la transacción del llamador: el
 * paso a Seguimiento con la primera sesión atendida y la próxima cita de "¿Qué sigue?".
 */
export async function guardarRegistroEnTx(
  tx: Prisma.TransactionClient,
  params: Omit<RegistrarConsultaParams, 'ahora'> & {
    atencionId: string;
    ninoId: string | null;
    fechaReal?: Date;
  },
): Promise<ConsultaRegistrada | null> {
  // La condición va en el WHERE: una cita que se movió a otra fecha ya no se registra.
  const registradas = await tx.citaPsicologica.updateMany({
    where: {
      id: params.citaId,
      atendidoPorId: params.psicologaId,
      estado: { not: 'REPROGRAMADA' },
    },
    data: {
      estado: params.estado,
      fechaHora: params.fechaReal,
      temas: params.temas,
      intervencion: params.intervencion,
      diagnostico: params.diagnostico,
      acuerdos: params.acuerdos,
      observaciones: params.observaciones,
      motivoNoAsistencia: params.motivoNoAsistencia,
      clinica: params.clinica,
      enfoqueTerapeutico: params.enfoqueTerapeutico,
      atencionBrindada: params.atencionBrindada,
    },
  });
  if (registradas.count !== 1) {
    return null;
  }

  let pasoASeguimiento = false;
  if (params.estado === 'ATENDIDA') {
    const avanzados = await tx.atencionPsicologica.updateMany({
      where: { id: params.atencionId, estado: 'INICIO' },
      data: {
        estado: etapaTrasSesionAtendida('INICIO'),
        actualizadoPorId: params.psicologaId,
        version: { increment: 1 },
      },
    });
    pasoASeguimiento = avanzados.count === 1;
    if (pasoASeguimiento) {
      await tx.cambioEstadoAtencion.create({
        data: {
          atencionId: params.atencionId,
          estadoAnterior: 'INICIO',
          estadoNuevo: etapaTrasSesionAtendida('INICIO'),
          registradoPorId: params.psicologaId,
        },
      });
    }
  }

  let proximaCitaId: string | null = null;
  if (params.proximaCita) {
    const proxima = await tx.citaPsicologica.create({
      data: {
        atencionId: params.atencionId,
        fechaHora: params.proximaCita.fechaHora,
        duracionMinutos: params.proximaCita.duracionMinutos,
        tipo: 'SEGUIMIENTO',
        ninoId: params.ninoId,
        atendidoPorId: params.psicologaId,
      },
      select: { id: true },
    });
    proximaCitaId = proxima.id;
  }

  const cita = await tx.citaPsicologica.findUniqueOrThrow({
    where: { id: params.citaId },
    include: INCLUDE_CITA,
  });
  return { cita: mapearCita(cita), pasoASeguimiento, proximaCitaId };
}
