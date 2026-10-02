import { Logger } from '@nestjs/common';
import {
  OnGatewayConnection,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { AREAS_ATENCION, type ExpedienteResumenArea } from '@akyuam/shared';
import type { Rol } from '@prisma/client';
import type { Server, Socket } from 'socket.io';
import { ACCESS_TOKEN_TTL_MS } from '../../auth/constants/auth.constants';
import { SocketAuthService } from '../../auth/services/socket-auth.service';
import type { IAreaNotifier } from '../interfaces/area-notifier.interface';
import type { ITrabajoSocialNotifier } from '../interfaces/trabajo-social-notifier.interface';

const SALA_TRABAJO_SOCIAL = 'trabajo-social';

function salaDeArea(area: Rol): string {
  return `area:${area}`;
}

@WebSocketGateway({
  // ConfigService no está disponible cuando este decorador se evalúa (corre antes de
  // que Nest arme el árbol de DI) — se lee la variable de entorno directamente, como
  // segunda capa de defensa (CSWSH) sobre la cookie accessToken, que ya es sameSite=strict.
  cors: { origin: process.env.FRONTEND_URL, credentials: true },
})
export class AreasGateway
  implements OnGatewayConnection, IAreaNotifier, ITrabajoSocialNotifier
{
  private readonly logger = new Logger(AreasGateway.name);

  @WebSocketServer()
  private readonly server!: Server;

  constructor(private readonly socketAuth: SocketAuthService) {}

  async handleConnection(client: Socket): Promise<void> {
    try {
      const usuario = await this.socketAuth.autenticar(client);
      if (usuario.rol === 'TRABAJO_SOCIAL') {
        await client.join(SALA_TRABAJO_SOCIAL);
      } else if ((AREAS_ATENCION as readonly Rol[]).includes(usuario.rol)) {
        await client.join(salaDeArea(usuario.rol));
      } else {
        client.disconnect(true);
        return;
      }

      // Ata la vida del socket a la del access token: pasado ese tiempo, el cliente
      // debe reconectar con una cookie fresca, igual que ya se re-verifica en cada
      // petición HTTP — un socket nunca queda autenticado más allá de ese margen.
      setTimeout(() => client.disconnect(true), ACCESS_TOKEN_TTL_MS);
    } catch (error) {
      this.logger.debug(`Conexión WebSocket rechazada: ${String(error)}`);
      client.disconnect(true);
    }
  }

  notificarReferido(area: Rol, resumen: ExpedienteResumenArea): void {
    this.server.to(salaDeArea(area)).emit('referido:nuevo', resumen);
  }

  notificarUsuariaActualizada(area: Rol, expedienteId: string): void {
    // Solo el id del expediente: el área vuelve a pedir los datos por HTTP, donde se valida
    // su permiso — ningún dato personal viaja por el socket.
    this.server
      .to(salaDeArea(area))
      .emit('usuaria:actualizada', { expedienteId });
  }

  notificarCambioBandeja(): void {
    // Sin datos: el evento solo dice "vuelve a pedir tu bandeja" — la bandeja ya filtra por
    // usuario en el backend y así nunca viaja por el socket algo de un caso ajeno.
    this.server.to(SALA_TRABAJO_SOCIAL).emit('bandeja:cambio');
  }
}
