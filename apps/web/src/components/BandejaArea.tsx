import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import PanelLayout from './PanelLayout';
import { User, FileText, AlertCircle, MessageSquare } from 'lucide-react';

interface BandejaAreaProps {
  titulo: string;
  rol: string;
}

export default function BandejaArea({ titulo, rol }: BandejaAreaProps) {
  const [expedientes, setExpedientes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchExpedientes = async () => {
      try {
        const { data } = await api.get('/expedientes');
        // Filtrar solo los expedientes que tienen asignada esta área
        const filtrados = data
          .filter((exp: any) => exp.areasAsignadas && exp.areasAsignadas.includes(rol))
          .map((exp: any) => {
            // Extraer el motivo específico por el cual fue referido a esta área
            const motivoReferencia = exp.bitacora?.find((b: any) => b.titulo === `Expediente Referido a ${rol}`);

            // Caso Especial: Médico no ve la parte de reportes de trabajo social
            const expCopia = { ...exp, motivoReferencia };
            if (rol === 'MEDICA') {
              delete expCopia.trabajoSocial; // Ocultar reportes
            }
            
            // Ocultar bitácora completa ya que el usuario pidió no mostrarla
            delete expCopia.bitacora;
            
            return expCopia;
          });
        setExpedientes(filtrados);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    fetchExpedientes();
  }, [rol]);

  return (
    <PanelLayout>
      <div style={{ background: '#FFFFFF', borderRadius: '16px', padding: '16px 20px', border: '1px solid #E5E7EB', marginBottom: '24px' }}>
        <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 900, color: '#281F65' }}>
          Expedientes Recibidos: Área {titulo}
        </h2>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {loading ? (
          <div style={{ padding: '20px', textAlign: 'center', color: '#6B7280' }}>Cargando información...</div>
        ) : expedientes.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E5E7EB', color: '#6B7280' }}>
            No hay expedientes referidos a esta área.
          </div>
        ) : (
          expedientes.map(exp => (
            <div key={exp.id} style={{ background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E5E7EB', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
              {/* Header */}
              <div style={{ background: '#F9FAFB', padding: '16px 20px', borderBottom: '1px solid #E5E7EB', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#111827' }}>
                    EXP. {exp.codigoCaso} - {exp.nombresUsuaria} {exp.apellidosUsuaria}
                  </h3>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '8px', alignItems: 'center' }}>
                    <span style={{ background: '#EDE9FE', color: '#6D28D9', padding: '4px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 800 }}>
                      {exp.condicionRegistro}
                    </span>
                    <span style={{ color: '#6B7280', fontSize: '0.8rem', fontWeight: 600 }}>
                      Ingreso: {new Date(exp.fechaIngreso).toLocaleDateString('es-GT')}
                    </span>
                  </div>
                </div>
              </div>

              <div style={{ padding: '20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                
                {/* Datos Usuaria */}
                <div>
                  <h4 style={{ display: 'flex', alignItems: 'center', gap: '6px', margin: '0 0 12px 0', color: '#374151', fontSize: '0.9rem', fontWeight: 700 }}>
                    <User size={16} /> Datos de la Usuaria
                  </h4>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, color: '#4B5563', fontSize: '0.85rem', lineHeight: '1.6' }}>
                    <li><strong>DPI:</strong> {exp.dpi || 'No registrado'}</li>
                    <li><strong>Teléfono:</strong> {exp.telefono || 'No registrado'}</li>
                    <li><strong>Dirección:</strong> {exp.direccion || 'No registrado'}</li>
                  </ul>
                </div>

                {/* Datos Agresor */}
                <div>
                  <h4 style={{ display: 'flex', alignItems: 'center', gap: '6px', margin: '0 0 12px 0', color: '#991B1B', fontSize: '0.9rem', fontWeight: 700 }}>
                    <AlertCircle size={16} /> Datos del Agresor
                  </h4>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, color: '#4B5563', fontSize: '0.85rem', lineHeight: '1.6' }}>
                    <li><strong>Nombre:</strong> {exp.nombresAgresor} {exp.apellidosAgresor}</li>
                    <li><strong>Teléfono:</strong> {exp.telefonoAgresor || 'No registrado'}</li>
                    <li><strong>Dirección:</strong> {exp.direccionAgresor || 'No registrado'}</li>
                    <li><strong>Tipologías:</strong> {exp.tipologiasViolencia?.join(', ') || 'Ninguna'}</li>
                  </ul>
                </div>

                {/* Motivo Específico de Referencia a esta área */}
                <div style={{ gridColumn: '1 / -1' }}>
                  <h4 style={{ display: 'flex', alignItems: 'center', gap: '6px', margin: '0 0 12px 0', color: '#0369A1', fontSize: '0.9rem', fontWeight: 700 }}>
                    <MessageSquare size={16} /> Motivo de Referencia a {titulo}
                  </h4>
                  <div style={{ background: '#F0F9FF', borderLeft: '4px solid #0EA5E9', padding: '16px', borderRadius: '0 8px 8px 0' }}>
                    {exp.motivoReferencia ? (
                      <div>
                        <div style={{ fontSize: '0.75rem', color: '#64748B', marginBottom: '4px' }}>
                          Referido por {exp.motivoReferencia.usuarioNombre} el {new Date(exp.motivoReferencia.createdAt).toLocaleString('es-GT')}
                        </div>
                        <p style={{ margin: 0, color: '#0F172A', fontSize: '0.9rem', fontWeight: 500 }}>
                          {exp.motivoReferencia.descripcion || 'Sin motivo especificado.'}
                        </p>
                      </div>
                    ) : (
                      <p style={{ margin: 0, color: '#6B7280', fontSize: '0.85rem' }}>No se encontró el motivo específico de referencia.</p>
                    )}
                  </div>
                </div>

                {/* Reportes de Trabajo Social (Oculto para Médica) */}
                {exp.trabajoSocial && (
                  <div style={{ gridColumn: '1 / -1' }}>
                    <h4 style={{ display: 'flex', alignItems: 'center', gap: '6px', margin: '0 0 12px 0', color: '#15803D', fontSize: '0.9rem', fontWeight: 700 }}>
                      <FileText size={16} /> Reporte de Trabajo Social
                    </h4>
                    <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', padding: '16px', borderRadius: '8px', color: '#166534', fontSize: '0.85rem' }}>
                      <strong>Observaciones Generales:</strong>
                      <p style={{ margin: '4px 0 0 0', whiteSpace: 'pre-wrap' }}>
                        {exp.trabajoSocial.observacionesGenerales || 'No hay observaciones registradas.'}
                      </p>
                    </div>
                  </div>
                )}
                
              </div>
            </div>
          ))
        )}
      </div>
    </PanelLayout>
  );
}
