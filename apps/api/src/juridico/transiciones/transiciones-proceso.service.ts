import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
} from '@nestjs/common';
import {
  hoyGT,
  type AccionProceso,
  type FinalizarProcesoInput,
  type RegistrarAbandonoInput,
  type SuspenderProcesoInput,
  type TransicionSimpleInput,
} from '@akyuam/shared';
import type { Prisma } from '@prisma/client';
import { AuditService } from '../../auth/services/audit.service';
import type { ContextoAuditoria } from '../../common/types/contexto-auditoria';
import { vacioANulo } from '../compartido/acceso-juridico';
import { AccesoJuridicoService } from '../compartido/acceso-juridico.service';
import { eventoAuditoria } from '../compartido/auditoria';
import {
  MENSAJE_ACCION_NO_DISPONIBLE,
  MENSAJE_CONFLICTO_VERSION,
} from '../compartido/mensajes';
import { puedeAplicar } from '../dominio/maquina-estado-proceso';
import type { AccesoProceso } from '../interfaces/procesos-repository.interface';
import { TRANSICIONES_REPOSITORY } from '../interfaces/transiciones-repository.interface';
import type {
  ITransicionesRepository,
  TransicionBase,
} from '../interfaces/transiciones-repository.interface';

const ACCION_AUDITORIA: Record<AccionProceso, string> = {
  AVANZAR: 'PROCESO_JURIDICO_AVANZADO',
  FINALIZAR: 'PROCESO_JURIDICO_FINALIZADO',
  SUSPENDER: 'PROCESO_JURIDICO_SUSPENDIDO',
  ABANDONAR: 'PROCESO_JURIDICO_ABANDONADO',
  REACTIVAR: 'PROCESO_JURIDICO_REACTIVADO',
};

interface Transicion {
  procesoId: string;
  accion: AccionProceso;
  version: number;
  contexto: ContextoAuditoria;
  /** Validaciones propias de la acción, ya con el proceso cargado. */
  validar?: (proceso: AccesoProceso) => void;
  escribir: (base: TransicionBase, proceso: AccesoProceso) => Promise<boolean>;
  detalles?: Prisma.InputJsonObject;
}

@Injectable()
export class TransicionesProcesoService {
  constructor(
    @Inject(TRANSICIONES_REPOSITORY)
    private readonly transicionesRepository: ITransicionesRepository,
    private readonly acceso: AccesoJuridicoService,
    private readonly auditService: AuditService,
  ) {}

  avanzar(
    procesoId: string,
    datos: TransicionSimpleInput,
    contexto: ContextoAuditoria,
  ): Promise<void> {
    return this.ejecutar({
      procesoId,
      accion: 'AVANZAR',
      version: datos.version,
      contexto,
      escribir: (base) => this.transicionesRepository.avanzar(base),
    });
  }

  finalizar(
    procesoId: string,
    datos: FinalizarProcesoInput,
    contexto: ContextoAuditoria,
  ): Promise<void> {
    return this.ejecutar({
      procesoId,
      accion: 'FINALIZAR',
      version: datos.version,
      contexto,
      validar: (proceso) => {
        if (datos.fechaCierre > hoyGT()) {
          throw new BadRequestException(
            'La fecha de cierre no puede ser futura',
          );
        }
        // Fechas "YYYY-MM-DD": comparar el texto es comparar el calendario.
        if (datos.fechaCierre < proceso.fechaInicio) {
          throw new BadRequestException(
            'La fecha de cierre no puede ser anterior al inicio del proceso',
          );
        }
      },
      escribir: (base) =>
        this.transicionesRepository.finalizar({
          ...base,
          forma: datos.forma,
          detalle: vacioANulo(datos.detalle),
          fechaCierre: datos.fechaCierre,
        }),
      detalles: { forma: datos.forma },
    });
  }

  suspender(
    procesoId: string,
    datos: SuspenderProcesoInput,
    contexto: ContextoAuditoria,
  ): Promise<void> {
    return this.ejecutar({
      procesoId,
      accion: 'SUSPENDER',
      version: datos.version,
      contexto,
      escribir: (base) =>
        this.transicionesRepository.suspender({
          ...base,
          motivo: datos.motivo,
        }),
    });
  }

  async abandonar(
    procesoId: string,
    datos: RegistrarAbandonoInput,
    contexto: ContextoAuditoria,
  ): Promise<void> {
    const hoy = hoyGT();
    await this.ejecutar({
      procesoId,
      accion: 'ABANDONAR',
      version: datos.version,
      contexto,
      validar: () => {
        if (datos.ultimoContacto > hoy) {
          throw new BadRequestException(
            'La fecha del último contacto no puede ser futura',
          );
        }
      },
      escribir: (base, proceso) =>
        this.transicionesRepository.abandonar({
          ...base,
          fecha: hoy,
          motivoCatalogo: datos.motivoCatalogo,
          observaciones: vacioANulo(datos.observaciones),
          ultimoContacto: vacioANulo(datos.ultimoContacto),
          intentosContacto: datos.intentos,
          notificadoATs: datos.notificarTs,
          situacionActual: proceso.situacion,
        }),
      detalles: { motivoCatalogo: datos.motivoCatalogo },
    });

    if (datos.notificarTs) {
      // Jurídico no conoce a Trabajo Social: solo deja este evento en la auditoría, y quien
      // escucha la auditoría (la bandeja de Trabajo Social) decide avisar.
      await this.auditService.registrar(
        eventoAuditoria(contexto, {
          accion: 'ABANDONO_REGISTRADO',
          entidad: 'ProcesoJuridico',
          entidadId: procesoId,
        }),
      );
    }
  }

  reactivar(
    procesoId: string,
    datos: TransicionSimpleInput,
    contexto: ContextoAuditoria,
  ): Promise<void> {
    return this.ejecutar({
      procesoId,
      accion: 'REACTIVAR',
      version: datos.version,
      contexto,
      escribir: (base, proceso) =>
        this.transicionesRepository.reactivar({
          ...base,
          situacionActual: proceso.situacion,
        }),
    });
  }

  /** El orden es el mismo para toda transición: acceso, versión, regla, escritura, auditoría. */
  private async ejecutar(transicion: Transicion): Promise<void> {
    const proceso = await this.acceso.exigirProceso(transicion.procesoId);

    if (proceso.version !== transicion.version) {
      throw new ConflictException(MENSAJE_CONFLICTO_VERSION);
    }
    if (!puedeAplicar(transicion.accion, proceso)) {
      throw new ConflictException(MENSAJE_ACCION_NO_DISPONIBLE);
    }
    transicion.validar?.(proceso);

    const aplicada = await transicion.escribir(
      {
        procesoId: transicion.procesoId,
        version: transicion.version,
        usuarioId: transicion.contexto.usuarioId,
      },
      proceso,
    );
    if (!aplicada) {
      // Alguien más cambió el proceso entre la lectura de arriba y la escritura.
      throw new ConflictException(MENSAJE_CONFLICTO_VERSION);
    }

    await this.auditService.registrar(
      eventoAuditoria(transicion.contexto, {
        accion: ACCION_AUDITORIA[transicion.accion],
        entidad: 'ProcesoJuridico',
        entidadId: transicion.procesoId,
        detalles: {
          expedienteId: proceso.expedienteId,
          ...transicion.detalles,
        },
      }),
    );
  }
}
