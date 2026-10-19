import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { fechaCalendarioGT, horaGT, etiquetaAtencion } from '@akyuam/shared';
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
  MENSAJE_SIN_ACCESO_CITA,
} from '../compartido/mensajes';
import { RELOJ, type IReloj } from '../compartido/reloj';
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
    const fechaHora = await this.fechaDeConsulta(datos, atencion, ahora);
    const proxima = datos.proxima
      ? exigirInicioValido(datos.proxima, ahora)
      : null;

    const registrada = await this.consultasRepository
      .registrar({
        atencionId: datos.atencionId,
        citaId: datos.citaId,
        ninoId: datos.ninoId,
        fechaHora,
        motivoConsulta: datos.motivoConsulta,
        signos: datos.signos,
        diagnostico: datos.diagnostico,
        planTratamiento: datos.planTratamiento,
        recetaLaboratorios: datos.recetaLaboratorios,
        proxima,
        loteDocumentos: datos.loteDocumentos,
        registradaPorId: contexto.usuarioId,
        ahora,
      })
      .catch((error: unknown) =>
        traducirErrorMedica(error, {
          citaNoDisponible: MENSAJE_CITA_NO_REGISTRABLE,
        }),
      );

    await this.auditService.registrar(
      eventoAuditoria(contexto, {
        accion: 'CONSULTA_MEDICA_REGISTRADA',
        entidad: 'ConsultaMedica',
        entidadId: registrada.consultaId,
        detalles: {
          expedienteId: atencion.expedienteId,
          atencionId: atencion.atencionId,
          citaId: datos.citaId,
          documentos: registrada.documentosAsociados,
        },
      }),
    );
    if (registrada.proximaCitaId) {
      await this.auditService.registrar(
        eventoAuditoria(contexto, {
          accion: 'CITA_MEDICA_PROGRAMADA',
          entidad: 'CitaMedica',
          entidadId: registrada.proximaCitaId,
          detalles: {
            expedienteId: atencion.expedienteId,
            atencionId: atencion.atencionId,
            consultaId: registrada.consultaId,
          },
        }),
      );
    }

    const respuesta: ConsultaMedicaRegistradaDto = {
      consultaId: registrada.consultaId,
      usuariaId: atencion.usuariaId,
      personaNombre: registrada.personaNombre,
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
              fecha: fechaCalendarioGT(proxima),
              hora: horaGT(proxima),
            }
          : null,
    };
    await this.idempotencia.guardar(claveRedis, respuesta);
    return respuesta;
  }

  /**
   * Con cita: debe ser de esta atención, seguir programada y sin consulta, y la persona es la de
   * la cita; la consulta toma la hora de la cita. Sin cita: la persona debe ser del expediente y
   * la consulta queda con la hora actual.
   */
  private async fechaDeConsulta(
    datos: RegistrarConsultaMedicaDatos,
    atencion: AccesoAtencionMedica,
    ahora: Date,
  ): Promise<Date> {
    if (datos.citaId === null) {
      if (
        !(await this.acceso.personaDelExpediente(
          datos.ninoId,
          atencion.expedienteId,
        ))
      ) {
        throw new BadRequestException(MENSAJE_PERSONA_AJENA);
      }
      return ahora;
    }
    const cita = await this.acceso.exigirCita(datos.citaId);
    if (cita.atencionId !== atencion.atencionId) {
      throw new ForbiddenException(MENSAJE_SIN_ACCESO_CITA);
    }
    if (cita.estadoCita !== 'PROGRAMADA' || cita.consultaId !== null) {
      throw new ConflictException(MENSAJE_CITA_NO_REGISTRABLE);
    }
    if (cita.ninoId !== datos.ninoId) {
      throw new BadRequestException(MENSAJE_PERSONA_AJENA);
    }
    return cita.inicio;
  }
}
