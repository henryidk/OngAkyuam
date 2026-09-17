import { Module } from '@nestjs/common';
import { UsuariosModule } from './usuarios/usuarios.module';

// Módulo padre: hoy solo agrupa `usuarios`, deja el hueco para futuras secciones de
// Administración sin obligar a reestructurar carpetas.
@Module({
  imports: [UsuariosModule],
})
export class AdministracionModule {}
