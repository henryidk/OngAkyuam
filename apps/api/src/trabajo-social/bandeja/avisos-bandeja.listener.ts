import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { TRABAJO_SOCIAL_NOTIFIER } from '../../areas/interfaces/trabajo-social-notifier.interface';
import type { ITrabajoSocialNotifier } from '../../areas/interfaces/trabajo-social-notifier.interface';
import { AuditService } from '../../auth/services/audit.service';
import { ACCIONES_BITACORA } from '../eventos/plantillas-eventos';

/**
 * Avisa por socket a Trabajo Social cada vez que se audita un evento visible (de un área o de
 * otra trabajadora social). Se cuelga de `AuditService` para que Jurídico y Psicología no tengan
 * que saber que existe la bandeja: su única obligación sigue siendo auditar lo que hacen.
 */
@Injectable()
export class AvisosBandejaListener implements OnModuleInit {
  private readonly accionesVisibles = new Set(ACCIONES_BITACORA);

  constructor(
    private readonly auditService: AuditService,
    @Inject(TRABAJO_SOCIAL_NOTIFIER)
    private readonly notifier: ITrabajoSocialNotifier,
  ) {}

  onModuleInit(): void {
    this.auditService.alRegistrar(({ accion }) => {
      if (this.accionesVisibles.has(accion)) {
        this.notifier.notificarCambioBandeja();
      }
    });
  }
}
