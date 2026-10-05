import { Inject, Injectable } from '@nestjs/common';
import {
  MAX_SUGERENCIAS_TIPO_ACTUACION,
  type EntradaBitacoraDto,
  type RegistrarActuacionInput,
} from '@akyuam/shared';
import { AuditService } from '../../auth/services/audit.service';
import type { ContextoAuditoria } from '../../common/types/contexto-auditoria';
import { AccesoJuridicoService } from '../compartido/acceso-juridico.service';
import { eventoAuditoria } from '../compartido/auditoria';
import { BITACORA_REPOSITORY } from '../interfaces/bitacora-repository.interface';
import type { IBitacoraRepository } from '../interfaces/bitacora-repository.interface';
import { combinarSugerencias } from './sugerencias-tipo-actuacion';

@Injectable()
export class BitacoraService {
  constructor(
    @Inject(BITACORA_REPOSITORY)
    private readonly bitacoraRepository: IBitacoraRepository,
    private readonly acceso: AccesoJuridicoService,
    private readonly auditService: AuditService,
  ) {}

  async registrarActuacion(
    procesoId: string,
    datos: RegistrarActuacionInput,
    contexto: ContextoAuditoria,
  ): Promise<EntradaBitacoraDto> {
    await this.acceso.exigirProceso(procesoId);

    const entrada = await this.bitacoraRepository.registrar({
      procesoId,
      tipo: datos.tipo,
      // Lo que escribe la operadora nunca es una entrada de sistema, aunque el tipo diga "Sistema".
      esSistema: false,
      contenido: datos.contenido,
      registradoPorId: contexto.usuarioId,
    });

    await this.auditService.registrar(
      eventoAuditoria(contexto, {
        accion: 'ACTUACION_PROCESO_REGISTRADA',
        entidad: 'NotaAvanceProceso',
        entidadId: entrada.id,
        detalles: { procesoId, tipo: datos.tipo },
      }),
    );

    return entrada;
  }

  /** Sugerencias para el campo Tipo: primero lo usado en este proceso, luego lo usual en su tipo. */
  async sugerirTipos(procesoId: string): Promise<string[]> {
    const acceso = await this.acceso.exigirProceso(procesoId);
    const [delProceso, delTipoDeProceso] = await Promise.all([
      this.bitacoraRepository.tiposUsadosEnProceso(
        procesoId,
        MAX_SUGERENCIAS_TIPO_ACTUACION,
      ),
      this.bitacoraRepository.tiposMasUsadosPorTipoProceso(
        acceso.tipo,
        MAX_SUGERENCIAS_TIPO_ACTUACION,
      ),
    ]);
    return combinarSugerencias(delProceso, delTipoDeProceso);
  }
}
