import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { NOVEDADES_AREA_NOTIFIER } from '../../areas/interfaces/novedades-area-notifier.interface';
import type { INovedadesAreaNotifier } from '../../areas/interfaces/novedades-area-notifier.interface';
import type { RegistrarAuditoriaParams } from '../../auth/services/audit.service';
import { AuditService } from '../../auth/services/audit.service';

/** ¿El evento cambia el Área de atención de Psicología? Entra una referencia o alguien toma una. */
export function esNovedadParaPsicologia({
  accion,
  detalles,
}: Pick<RegistrarAuditoriaParams, 'accion' | 'detalles'>): boolean {
  if (accion === 'CASO_PSICOLOGIA_TOMADO') return true;
  if (accion !== 'EXPEDIENTE_REFERIDO') return false;
  return (
    typeof detalles === 'object' &&
    detalles !== null &&
    !Array.isArray(detalles) &&
    (detalles as { area?: unknown }).area === 'PSICOLOGIA'
  );
}

/**
 * Avisa por socket a todas las psicólogas cuando cambia la lista de referencias sin tomar: la
 * bandeja es común, así que si una toma un caso las demás deben dejar de verlo. El aviso no lleva
 * datos ni dice de qué expediente se trata: la bandeja se vuelve a pedir por HTTP.
 */
@Injectable()
export class AvisosPsicologiaListener implements OnModuleInit {
  constructor(
    private readonly auditService: AuditService,
    @Inject(NOVEDADES_AREA_NOTIFIER)
    private readonly notifier: INovedadesAreaNotifier,
  ) {}

  onModuleInit(): void {
    this.auditService.alRegistrar((evento) => {
      if (esNovedadParaPsicologia(evento)) {
        this.notifier.notificarNovedades('PSICOLOGIA');
      }
    });
  }
}
