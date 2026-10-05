import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { NOVEDADES_AREA_NOTIFIER } from '../../areas/interfaces/novedades-area-notifier.interface';
import type { INovedadesAreaNotifier } from '../../areas/interfaces/novedades-area-notifier.interface';
import type { RegistrarAuditoriaParams } from '../../auth/services/audit.service';
import { AuditService } from '../../auth/services/audit.service';
import { ACCIONES_NOVEDAD_TS } from '../repositories/inicio.repository';

const ACCIONES_AVISO = new Set<string>([
  ...ACCIONES_NOVEDAD_TS.DATOS,
  ...ACCIONES_NOVEDAD_TS.DOCUMENTO,
]);

/** ¿El evento puede cambiar el Inicio de Jurídico? Una referencia solo si es a Jurídico. */
export function esNovedadParaJuridico({
  accion,
  detalles,
}: Pick<RegistrarAuditoriaParams, 'accion' | 'detalles'>): boolean {
  if ((ACCIONES_NOVEDAD_TS.REFERENCIA as readonly string[]).includes(accion)) {
    return (
      typeof detalles === 'object' &&
      detalles !== null &&
      !Array.isArray(detalles) &&
      (detalles as { area?: unknown }).area === 'JURIDICO'
    );
  }
  return ACCIONES_AVISO.has(accion);
}

/**
 * Avisa por socket a Jurídico cuando Trabajo Social hace algo que su Inicio muestra. El aviso no
 * lleva datos ni dice de qué expediente se trata: el Inicio se vuelve a pedir por HTTP y ahí se
 * filtra lo que Jurídico puede ver. Avisar de más (un documento que Jurídico no ve) solo cuesta
 * una recarga.
 */
@Injectable()
export class AvisosJuridicoListener implements OnModuleInit {
  constructor(
    private readonly auditService: AuditService,
    @Inject(NOVEDADES_AREA_NOTIFIER)
    private readonly notifier: INovedadesAreaNotifier,
  ) {}

  onModuleInit(): void {
    this.auditService.alRegistrar((evento) => {
      if (esNovedadParaJuridico(evento)) {
        this.notifier.notificarNovedades('JURIDICO');
      }
    });
  }
}
