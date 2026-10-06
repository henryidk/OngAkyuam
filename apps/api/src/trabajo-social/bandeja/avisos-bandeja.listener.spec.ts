/* eslint-disable @typescript-eslint/unbound-method */
import type { ITrabajoSocialNotifier } from '../../areas/interfaces/trabajo-social-notifier.interface';
import type {
  AuditService,
  OyenteAuditoria,
} from '../../auth/services/audit.service';
import { AvisosBandejaListener } from './avisos-bandeja.listener';

describe('AvisosBandejaListener', () => {
  let oyente: OyenteAuditoria;
  let notifier: jest.Mocked<ITrabajoSocialNotifier>;

  beforeEach(() => {
    const auditService = {
      alRegistrar: jest.fn((fn: OyenteAuditoria) => {
        oyente = fn;
      }),
    } as unknown as AuditService;
    notifier = { notificarCambioBandeja: jest.fn() };
    new AvisosBandejaListener(auditService, notifier).onModuleInit();
  });

  it('avisa cuando se audita un evento visible', () => {
    oyente({ accion: 'PROCESOS_JURIDICOS_CREADOS_LOTE' });
    expect(notifier.notificarCambioBandeja).toHaveBeenCalledTimes(1);
  });

  it('no avisa por lecturas ni por eventos clínicos', () => {
    oyente({ accion: 'EXPEDIENTE_CONSULTADO' });
    oyente({ accion: 'REGISTRO_CONSULTA_GUARDADO' });
    oyente({ accion: 'LOGIN_SUCCESS' });
    expect(notifier.notificarCambioBandeja).not.toHaveBeenCalled();
  });
});
