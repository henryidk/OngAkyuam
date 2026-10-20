import { ConflictException, Inject, Injectable } from '@nestjs/common';
import {
  ETIQUETAS_TIPO_PROCESO_JURIDICO,
  type AsignarNumeroJudicialInput,
  type ErrorNumeroJudicialRepetido,
  type ProcesoVinculadoDto,
} from '@akyuam/shared';
import { AuditService } from '../../auth/services/audit.service';
import type { ContextoAuditoria } from '../../common/types/contexto-auditoria';
import { AccesoJuridicoService } from '../compartido/acceso-juridico.service';
import { eventoAuditoria } from '../compartido/auditoria';
import { MENSAJE_CONFLICTO_VERSION } from '../compartido/mensajes';
import {
  TEXTO_NUMERO_JUDICIAL_CORREGIDO,
  TEXTO_NUMERO_JUDICIAL_REGISTRADO,
} from '../compartido/textos-bitacora';
import { NUMERO_JUDICIAL_REPOSITORY } from '../interfaces/numero-judicial-repository.interface';
import type { INumeroJudicialRepository } from '../interfaces/numero-judicial-repository.interface';

/** "Ya está en el expediente 03-2026 · Fijación de pensión alimenticia" (§4). */
function mensajeRepetido(procesos: ProcesoVinculadoDto[]): string {
  const donde = procesos
    .map(
      (proceso) =>
        `${proceso.codigo} · ${ETIQUETAS_TIPO_PROCESO_JURIDICO[proceso.tipo]}`,
    )
    .join('; ');
  return procesos.length === 1
    ? `Ya está en el expediente ${donde}`
    : `Ya está en los expedientes ${donde}`;
}

/**
 * Registrar o corregir el No. judicial desde donde esté la operadora (§4). No es único — una
 * ejecución va en el mismo expediente judicial que la fijación —, así que uno repetido solo se
 * avisa y se guarda si la persona lo confirma.
 */
@Injectable()
export class NumeroJudicialService {
  constructor(
    @Inject(NUMERO_JUDICIAL_REPOSITORY)
    private readonly numeroJudicialRepository: INumeroJudicialRepository,
    private readonly acceso: AccesoJuridicoService,
    private readonly auditService: AuditService,
  ) {}

  async asignar(
    procesoId: string,
    datos: AsignarNumeroJudicialInput,
    contexto: ContextoAuditoria,
  ): Promise<void> {
    const proceso = await this.acceso.exigirProceso(procesoId);
    if (proceso.version !== datos.version) {
      throw new ConflictException(MENSAJE_CONFLICTO_VERSION);
    }
    if (proceso.numeroJudicial === datos.numeroJudicial) {
      // Ya lo tenía: sin escritura, sin bitácora y sin auditoría.
      return;
    }
    if (!datos.confirmarNumeroRepetido) {
      await this.exigirNoRepetido(datos.numeroJudicial, procesoId);
    }

    const corregido = proceso.numeroJudicial !== null;
    const asignado = await this.numeroJudicialRepository.asignar({
      procesoId,
      version: datos.version,
      numeroJudicial: datos.numeroJudicial,
      usuarioId: contexto.usuarioId,
      textoBitacora: corregido
        ? TEXTO_NUMERO_JUDICIAL_CORREGIDO
        : TEXTO_NUMERO_JUDICIAL_REGISTRADO,
    });
    if (!asignado) {
      // Alguien más cambió el proceso entre la lectura de arriba y la escritura.
      throw new ConflictException(MENSAJE_CONFLICTO_VERSION);
    }

    // Nunca el número en `detalles`: identifica el expediente judicial de la usuaria.
    await this.auditService.registrar(
      eventoAuditoria(contexto, {
        accion: 'PROCESO_NUMERO_JUDICIAL',
        entidad: 'ProcesoJuridico',
        entidadId: procesoId,
        detalles: {
          expedienteId: proceso.expedienteId,
          corregido,
          repetidoConfirmado: datos.confirmarNumeroRepetido,
        },
      }),
    );
  }

  private async exigirNoRepetido(
    numeroJudicial: string,
    procesoId: string,
  ): Promise<void> {
    const procesos =
      await this.numeroJudicialRepository.buscarProcesosConNumero(
        numeroJudicial,
        procesoId,
      );
    if (procesos.length === 0) {
      return;
    }
    const cuerpo: ErrorNumeroJudicialRepetido = {
      codigo: 'NUMERO_JUDICIAL_REPETIDO',
      message: mensajeRepetido(procesos),
      detalle: { procesos },
    };
    throw new ConflictException(cuerpo);
  }
}
