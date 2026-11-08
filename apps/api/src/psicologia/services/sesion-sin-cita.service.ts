import { ConflictException, Inject, Injectable } from '@nestjs/common';
import type { ConsultaRegistradaDto, SesionSinCitaInput } from '@akyuam/shared';
import { AuditService } from '../../auth/services/audit.service';
import { RELOJ, type IReloj } from '../../common/reloj';
import type { ContextoAuditoria } from '../../common/types/contexto-auditoria';
import { CITAS_PSICOLOGICAS_REPOSITORY } from '../interfaces/citas-psicologicas-repository.interface';
import type { ICitasPsicologicasRepository } from '../interfaces/citas-psicologicas-repository.interface';
import { eventoAuditoria } from '../compartido/auditoria';
import { IdempotenciaPsicologia } from '../compartido/idempotencia';
import { MENSAJE_PROCESO_CERRADO } from '../compartido/mensajes';
import {
  camposDelRegistro,
  proximaCitaDelRegistro,
} from '../compartido/registro-sesion';
import { avisarTraslape } from '../compartido/traslape';
import { estaCerrado } from '../dominio/etapa-proceso';
import { AccesoPsicologiaService } from './acceso-psicologia.service';

const OPERACION = 'sesion-sin-cita';
const MENSAJE_SESION_GUARDANDOSE =
  'Esta sesión se está guardando en este momento. Espera unos segundos e intenta de nuevo.';

/**
 * La persona llegó sin cita y se atendió. La cita nace al registrar la sesión, con la fecha y la
 * hora del servidor: abrir el formulario y salir no deja ninguna sesión vacía. Si después hay que
 * corregirla, se edita como cualquier otra (`RegistroConsultaService`).
 */
@Injectable()
export class SesionSinCitaService {
  constructor(
    private readonly acceso: AccesoPsicologiaService,
    @Inject(CITAS_PSICOLOGICAS_REPOSITORY)
    private readonly citasRepository: ICitasPsicologicasRepository,
    private readonly auditService: AuditService,
    private readonly idempotencia: IdempotenciaPsicologia,
    @Inject(RELOJ) private readonly reloj: IReloj,
  ) {}

  async registrar(
    procesoId: string,
    datos: SesionSinCitaInput,
    contexto: ContextoAuditoria,
    claveIdempotencia?: string,
  ): Promise<ConsultaRegistradaDto> {
    // Abrir una sesión en un proceso es gestionarlo: solo su responsable.
    const proceso = await this.acceso.exigirAccesoProceso(
      procesoId,
      contexto.usuarioId,
    );
    if (estaCerrado(proceso.etapa)) {
      throw new ConflictException(MENSAJE_PROCESO_CERRADO);
    }

    // Después del acceso: un reintento de quien ya no es responsable no recibe la respuesta.
    const claveRedis = this.idempotencia.clave(
      claveIdempotencia,
      `${OPERACION}:${procesoId}`,
      contexto.usuarioId,
    );
    const guardada =
      await this.idempotencia.recuperar<ConsultaRegistradaDto>(claveRedis);
    if (guardada) {
      return guardada;
    }
    // Dos envíos simultáneos con la misma clave no encuentran respuesta todavía: solo uno escribe.
    if (!(await this.idempotencia.reservar(claveRedis))) {
      throw new ConflictException(MENSAJE_SESION_GUARDANDOSE);
    }
    try {
      // El otro envío pudo terminar entre la lectura y la reserva.
      return (
        (await this.idempotencia.recuperar<ConsultaRegistradaDto>(
          claveRedis,
        )) ??
        (await this.escribir(procesoId, datos, contexto, proceso, claveRedis))
      );
    } finally {
      await this.idempotencia.liberar(claveRedis);
    }
  }

  private async escribir(
    procesoId: string,
    datos: SesionSinCitaInput,
    contexto: ContextoAuditoria,
    proceso: { expedienteId: string },
    claveRedis: string | null,
  ): Promise<ConsultaRegistradaDto> {
    const siguiente = proximaCitaDelRegistro(datos.registro);
    if (siguiente) {
      await avisarTraslape(this.citasRepository, {
        ...siguiente.cita,
        psicologaId: contexto.usuarioId,
        confirmarTraslape: siguiente.confirmarTraslape,
      });
    }

    const registrada = await this.citasRepository.registrarSesionSinCita({
      ...camposDelRegistro(datos.registro),
      procesoId,
      psicologaId: contexto.usuarioId,
      fechaHora: this.reloj.ahora(),
      duracionMinutos: datos.duracionMinutos,
      proximaCita: siguiente?.cita ?? null,
    });
    if (!registrada) {
      // Se cerró o cambió de responsable entre la validación y la transacción.
      throw new ConflictException(MENSAJE_PROCESO_CERRADO);
    }

    // Mismo evento que cualquier registro, sin texto clínico: solo ids y banderas.
    await this.auditService.registrar(
      eventoAuditoria(contexto, {
        accion: 'REGISTRO_CONSULTA_GUARDADO',
        entidad: 'CitaPsicologica',
        entidadId: registrada.cita.id,
        detalles: {
          sinCita: true,
          expedienteId: proceso.expedienteId,
          procesoId,
          pasoASeguimiento: registrada.pasoASeguimiento,
          proximaCitaId: registrada.proximaCitaId,
        },
      }),
    );

    const respuesta: ConsultaRegistradaDto = {
      cita: registrada.cita,
      procesoId,
      pasoASeguimiento: registrada.pasoASeguimiento,
      proximaCita:
        registrada.proximaCitaId && siguiente
          ? {
              id: registrada.proximaCitaId,
              procesoId,
              fechaHora: siguiente.cita.fechaHora.toISOString(),
            }
          : null,
    };
    await this.idempotencia.guardar(claveRedis, respuesta);
    return respuesta;
  }
}
