import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { etiquetaAtencion, fechaCalendarioGT, horaGT } from '@akyuam/shared';
import type {
  ConsultaMedicaRegistradaDto,
  RegistrarConsultaMedicaDatos,
} from '@akyuam/shared';
import { AuditService } from '../../auth/services/audit.service';
import type { ContextoAuditoria } from '../../common/types/contexto-auditoria';
import { AccesoMedicaService } from '../compartido/acceso-medica.service';
import { eventoAuditoria } from '../compartido/auditoria';
import { traducirErrorMedica } from '../compartido/errores-http';
import { IdempotenciaMedica } from '../compartido/idempotencia';
import {
  MENSAJE_ATENCION_NO_ACTIVA,
  MENSAJE_CITA_NO_REGISTRABLE,
  MENSAJE_PERSONA_AJENA,
  MENSAJE_PERSONAS_VISITA_INCOMPLETA,
  MENSAJE_SIN_ACCESO_CITA,
} from '../compartido/mensajes';
import { RELOJ, type IReloj } from '../../common/reloj';
import { exigirInicioValido } from '../compartido/validar-horario';
import type { AccesoAtencionMedica } from '../interfaces/acceso-medica-repository.interface';
import {
  CONSULTAS_MEDICAS_REPOSITORY,
  type IConsultasMedicasRepository,
} from '../interfaces/consultas-medicas-repository.interface';

/** "Guardar consulta": desde una cita de la agenda o, excepcionalmente, sin cita. */
@Injectable()
export class RegistroConsultaService {
  constructor(
    @Inject(CONSULTAS_MEDICAS_REPOSITORY)
    private readonly consultasRepository: IConsultasMedicasRepository,
    @Inject(RELOJ) private readonly reloj: IReloj,
    private readonly acceso: AccesoMedicaService,
    private readonly idempotencia: IdempotenciaMedica,
    private readonly auditService: AuditService,
  ) {}

  async registrar(
    datos: RegistrarConsultaMedicaDatos,
    contexto: ContextoAuditoria,
    claveIdempotencia?: string,
  ): Promise<ConsultaMedicaRegistradaDto> {
    const claveRedis = this.idempotencia.clave(
      claveIdempotencia,
      'consulta',
      contexto.usuarioId,
    );
    const guardada =
      await this.idempotencia.recuperar<ConsultaMedicaRegistradaDto>(
        claveRedis,
      );
    if (guardada) {
      return guardada;
    }

    const atencion = await this.acceso.exigirAtencion(datos.atencionId);
    if (atencion.estado !== 'ACTIVA') {
      throw new ConflictException(MENSAJE_ATENCION_NO_ACTIVA);
    }
    const ahora = this.reloj.ahora();
    const fechaHora = await this.visitaDeConsulta(datos, atencion, ahora);
    // Los hijos/as de la próxima se comprueban en la transacción, contra el expediente.
    const proxima = datos.proxima
      ? {
          inicio: exigirInicioValido(
            datos.proxima.inicio,
            ahora,
            datos.proxima.duracionMin,
          ),
          duracionMin: datos.proxima.duracionMin,
          personas: datos.proxima.personas,
        }
      : null;

    const registrada = await this.consultasRepository
      .registrar({
        atencionId: datos.atencionId,
        citaId: datos.citaId,
        registros: datos.registros,
        fechaHora,
        proxima,
        registradaPorId: contexto.usuarioId,
        ahora,
      })
      .catch((error: unknown) =>
        traducirErrorMedica(error, {
          citaNoDisponible: MENSAJE_CITA_NO_REGISTRABLE,
        }),
      );

    // Una entrada por consulta: cada persona tiene su propio registro clínico.
    for (const consulta of registrada.consultas) {
      await this.auditService.registrar(
        eventoAuditoria(contexto, {
          accion: 'CONSULTA_MEDICA_REGISTRADA',
          entidad: 'ConsultaMedica',
          entidadId: consulta.consultaId,
          detalles: {
            expedienteId: atencion.expedienteId,
            atencionId: atencion.atencionId,
            citaId: datos.citaId,
            personasVisita: registrada.consultas.length,
            documentos: consulta.documentosAsociados,
          },
        }),
      );
    }
    if (registrada.proximaCitaId) {
      await this.auditService.registrar(
        eventoAuditoria(contexto, {
          accion: 'CITA_MEDICA_PROGRAMADA',
          entidad: 'CitaMedica',
          entidadId: registrada.proximaCitaId,
          detalles: {
            expedienteId: atencion.expedienteId,
            atencionId: atencion.atencionId,
            consultaIds: registrada.consultas.map((c) => c.consultaId),
            personas: proxima?.personas.length,
            duracionMin: proxima?.duracionMin,
          },
        }),
      );
    }

    const respuesta: ConsultaMedicaRegistradaDto = {
      usuariaId: atencion.usuariaId,
      consultas: registrada.consultas.map(
        ({ consultaId, ninoId, personaNombre }) => ({
          consultaId,
          ninoId,
          personaNombre,
        }),
      ),
      proximaCita:
        registrada.proximaCitaId && proxima
          ? {
              citaId: registrada.proximaCitaId,
              atencionId: atencion.atencionId,
              codigoAtencion: etiquetaAtencion(
                atencion.expedienteNumero,
                atencion.consecutivo,
              ),
              atencionAbierta: false,
              fecha: fechaCalendarioGT(proxima.inicio),
              hora: horaGT(proxima.inicio),
            }
          : null,
    };
    await this.idempotencia.guardar(claveRedis, respuesta);
    return respuesta;
  }

  /**
   * Con cita: debe ser de esta atención y seguir programada, y los registros deben ser
   * exactamente sus personas pendientes (ni falta ni sobra nadie) y la consulta toma la hora de la
   * cita. Sin cita: cada persona debe ser del expediente y la consulta queda con la hora actual.
   * El repositorio repite la comprobación dentro de la transacción. Devuelve la fecha y hora de
   * la consulta.
   */
  private async visitaDeConsulta(
    datos: RegistrarConsultaMedicaDatos,
    atencion: AccesoAtencionMedica,
    ahora: Date,
  ): Promise<Date> {
    const enviadas = datos.registros.map((registro) => registro.ninoId);
    if (datos.citaId === null) {
      for (const ninoId of enviadas) {
        if (
          !(await this.acceso.personaDelExpediente(
            ninoId,
            atencion.expedienteId,
          ))
        ) {
          throw new BadRequestException(MENSAJE_PERSONA_AJENA);
        }
      }
      return ahora;
    }
    const cita = await this.acceso.exigirCita(datos.citaId);
    if (cita.atencionId !== atencion.atencionId) {
      throw new ForbiddenException(MENSAJE_SIN_ACCESO_CITA);
    }
    if (enviadas.some((ninoId) => !cita.personas.includes(ninoId))) {
      throw new BadRequestException(MENSAJE_PERSONA_AJENA);
    }
    if (
      cita.estadoCita !== 'PROGRAMADA' ||
      enviadas.some((ninoId) => cita.personasRegistradas.includes(ninoId))
    ) {
      throw new ConflictException(MENSAJE_CITA_NO_REGISTRABLE);
    }
    const pendientes = cita.personas.filter(
      (ninoId) => !cita.personasRegistradas.includes(ninoId),
    );
    if (pendientes.some((ninoId) => !enviadas.includes(ninoId))) {
      throw new BadRequestException(MENSAJE_PERSONAS_VISITA_INCOMPLETA);
    }
    return cita.inicio;
  }
}
