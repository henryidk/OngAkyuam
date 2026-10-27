import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { fechaCalendarioGT, horaGT, etiquetaAtencion } from '@akyuam/shared';
import type {
  CitaMedicaProgramadaDto,
  InasistenciaCitaMedicaInput,
  InasistenciaRegistradaDto,
  ReprogramarCitaMedicaInput,
} from '@akyuam/shared';
import { AuditService } from '../../auth/services/audit.service';
import type { ContextoAuditoria } from '../../common/types/contexto-auditoria';
import { AccesoMedicaService } from '../compartido/acceso-medica.service';
import { eventoAuditoria } from '../compartido/auditoria';
import { traducirErrorMedica } from '../compartido/errores-http';
import {
  MENSAJE_CITA_CAMBIO,
  MENSAJE_CITA_NO_REPROGRAMABLE,
  MENSAJE_INASISTENCIA_NO_PERMITIDA,
} from '../compartido/mensajes';
import { RELOJ, type IReloj } from '../../common/reloj';
import { exigirInicioValido } from '../compartido/validar-horario';
import { admiteInasistencia } from '../dominio/estado-cita';
import type { AccesoCitaMedica } from '../interfaces/acceso-medica-repository.interface';
import {
  CITAS_MEDICAS_REPOSITORY,
  type ICitasMedicasRepository,
} from '../interfaces/citas-medicas-repository.interface';

const MENSAJES_CITA = {
  version: MENSAJE_CITA_CAMBIO,
  citaNoDisponible: MENSAJE_CITA_NO_REPROGRAMABLE,
};

/** "No asistió" (con reprogramación opcional en el mismo paso) y "Reprogramar" después. */
@Injectable()
export class InasistenciaService {
  constructor(
    @Inject(CITAS_MEDICAS_REPOSITORY)
    private readonly citasRepository: ICitasMedicasRepository,
    @Inject(RELOJ) private readonly reloj: IReloj,
    private readonly acceso: AccesoMedicaService,
    private readonly auditService: AuditService,
  ) {}

  async registrar(
    citaId: string,
    datos: InasistenciaCitaMedicaInput,
    contexto: ContextoAuditoria,
  ): Promise<InasistenciaRegistradaDto> {
    const cita = await this.acceso.exigirCita(citaId);
    const ahora = this.reloj.ahora();
    if (
      !admiteInasistencia(
        {
          estado: cita.estadoCita,
          inicio: cita.inicio,
          duracionMin: cita.duracionMin,
        },
        ahora,
      )
    ) {
      throw new ConflictException(MENSAJE_INASISTENCIA_NO_PERMITIDA);
    }
    const reprogramarA = datos.reprogramarA
      ? exigirInicioValido(datos.reprogramarA, ahora, cita.duracionMin)
      : null;

    const nuevaCitaId = await this.citasRepository
      .registrarInasistencia({
        citaId,
        version: datos.version,
        ahora,
        reprogramarA,
        creadoPorId: contexto.usuarioId,
      })
      .catch((error: unknown) => traducirErrorMedica(error, MENSAJES_CITA));

    await this.auditService.registrar(
      eventoAuditoria(contexto, {
        accion: 'CITA_MEDICA_NO_ASISTIO',
        entidad: 'CitaMedica',
        entidadId: citaId,
        detalles: {
          expedienteId: cita.expedienteId,
          atencionId: cita.atencionId,
        },
      }),
    );
    const nuevaCita =
      nuevaCitaId && reprogramarA
        ? await this.concluirReprogramacion(
            cita,
            nuevaCitaId,
            reprogramarA,
            contexto,
          )
        : null;
    return { citaId, nuevaCita };
  }

  async reprogramar(
    citaId: string,
    datos: ReprogramarCitaMedicaInput,
    contexto: ContextoAuditoria,
  ): Promise<CitaMedicaProgramadaDto> {
    const cita = await this.acceso.exigirCita(citaId);
    const inicio = exigirInicioValido(
      datos.inicio,
      this.reloj.ahora(),
      cita.duracionMin,
    );

    const nuevaCitaId = await this.citasRepository
      .reprogramar({
        citaId,
        version: datos.version,
        inicio,
        creadoPorId: contexto.usuarioId,
      })
      .catch((error: unknown) => traducirErrorMedica(error, MENSAJES_CITA));

    return this.concluirReprogramacion(cita, nuevaCitaId, inicio, contexto);
  }

  private async concluirReprogramacion(
    cita: AccesoCitaMedica,
    nuevaCitaId: string,
    inicio: Date,
    contexto: ContextoAuditoria,
  ): Promise<CitaMedicaProgramadaDto> {
    await this.auditService.registrar(
      eventoAuditoria(contexto, {
        accion: 'CITA_MEDICA_REPROGRAMADA',
        entidad: 'CitaMedica',
        entidadId: nuevaCitaId,
        detalles: {
          expedienteId: cita.expedienteId,
          atencionId: cita.atencionId,
          citaOriginalId: cita.citaId,
        },
      }),
    );
    return {
      citaId: nuevaCitaId,
      atencionId: cita.atencionId,
      codigoAtencion: etiquetaAtencion(cita.expedienteNumero, cita.consecutivo),
      atencionAbierta: false,
      fecha: fechaCalendarioGT(inicio),
      hora: horaGT(inicio),
    };
  }
}
