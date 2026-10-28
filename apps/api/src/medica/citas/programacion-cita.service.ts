import { Inject, Injectable } from '@nestjs/common';
import { fechaCalendarioGT, horaGT, etiquetaAtencion } from '@akyuam/shared';
import type {
  CitaMedicaProgramadaDto,
  ProgramarCitaMedicaInput,
} from '@akyuam/shared';
import { AuditService } from '../../auth/services/audit.service';
import type { ContextoAuditoria } from '../../common/types/contexto-auditoria';
import { AccesoMedicaService } from '../compartido/acceso-medica.service';
import { eventoAuditoria } from '../compartido/auditoria';
import { traducirErrorMedica } from '../compartido/errores-http';
import { IdempotenciaMedica } from '../compartido/idempotencia';
import { RELOJ, type IReloj } from '../../common/reloj';
import { exigirInicioValido } from '../compartido/validar-horario';
import {
  CITAS_MEDICAS_REPOSITORY,
  type ICitasMedicasRepository,
} from '../interfaces/citas-medicas-repository.interface';

/**
 * "Agendar primera consulta" y "Programar consulta". Sin atención activa, la cita abre la
 * atención (M{n}) a partir de la referencia pendiente de Trabajo Social.
 */
@Injectable()
export class ProgramacionCitaService {
  constructor(
    @Inject(CITAS_MEDICAS_REPOSITORY)
    private readonly citasRepository: ICitasMedicasRepository,
    @Inject(RELOJ) private readonly reloj: IReloj,
    private readonly acceso: AccesoMedicaService,
    private readonly idempotencia: IdempotenciaMedica,
    private readonly auditService: AuditService,
  ) {}

  async programar(
    datos: ProgramarCitaMedicaInput,
    contexto: ContextoAuditoria,
    claveIdempotencia?: string,
  ): Promise<CitaMedicaProgramadaDto> {
    const claveRedis = this.idempotencia.clave(
      claveIdempotencia,
      'programar',
      contexto.usuarioId,
    );
    const guardada =
      await this.idempotencia.recuperar<CitaMedicaProgramadaDto>(claveRedis);
    if (guardada) {
      return guardada;
    }

    const expediente = datos.referidoId
      ? await this.acceso.exigirReferencia(datos.referidoId)
      : await this.acceso.exigirExpediente(datos.expedienteId!);
    const ahora = this.reloj.ahora();
    const inicio = exigirInicioValido(datos.inicio, ahora, datos.duracionMin);

    // Que los hijos/as sean del expediente y la regla de la primera consulta (usuaria y todos
    // sus hijos/as) se validan dentro de la transacción, donde se sabe si la cita abre la atención.
    const programada = await this.citasRepository
      .programar({
        expedienteId: expediente.expedienteId,
        referidoId: datos.referidoId ?? null,
        personas: datos.personas,
        duracionMin: datos.duracionMin,
        inicio,
        creadoPorId: contexto.usuarioId,
        hoy: fechaCalendarioGT(ahora),
      })
      .catch((error: unknown) => traducirErrorMedica(error));

    if (programada.atencionAbierta) {
      await this.auditService.registrar(
        eventoAuditoria(contexto, {
          accion: 'ATENCION_MEDICA_ABIERTA',
          entidad: 'AtencionMedica',
          entidadId: programada.atencionId,
          detalles: {
            expedienteId: expediente.expedienteId,
            referidoId: datos.referidoId ?? null,
          },
        }),
      );
    }
    await this.auditService.registrar(
      eventoAuditoria(contexto, {
        accion: 'CITA_MEDICA_PROGRAMADA',
        entidad: 'CitaMedica',
        entidadId: programada.citaId,
        detalles: {
          expedienteId: expediente.expedienteId,
          atencionId: programada.atencionId,
          personas: datos.personas.length,
          duracionMin: datos.duracionMin,
        },
      }),
    );

    const respuesta: CitaMedicaProgramadaDto = {
      citaId: programada.citaId,
      atencionId: programada.atencionId,
      codigoAtencion: etiquetaAtencion(
        expediente.expedienteNumero,
        programada.consecutivo,
      ),
      atencionAbierta: programada.atencionAbierta,
      fecha: fechaCalendarioGT(inicio),
      hora: horaGT(inicio),
    };
    await this.idempotencia.guardar(claveRedis, respuesta);
    return respuesta;
  }
}
