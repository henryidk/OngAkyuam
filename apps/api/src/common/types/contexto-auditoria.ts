/** Quién hizo una acción sensible y desde dónde — se adjunta a cada registro de `AuditLog`. */
export interface ContextoAuditoria {
  usuarioId: string;
  username: string;
  ipAddress?: string;
  userAgent?: string;
}
