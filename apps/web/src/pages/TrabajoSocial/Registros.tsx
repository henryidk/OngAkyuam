import { useState, useEffect } from 'react';
import PanelLayout from '../../components/PanelLayout';
import { Search, Share2 } from 'lucide-react';
import { api } from '../../lib/api';
import { ReferralModal } from './components/ReferralModal';

import { useNavigate } from 'react-router-dom';

export default function Registros() {
  const navigate = useNavigate();
  const [expedientes, setExpedientes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [referirExpediente, setReferirExpediente] = useState<any | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchExpedientes = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/expedientes');
      setExpedientes(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExpedientes();
  }, []);

  const filteredExpedientes = expedientes.filter(exp => {
    const searchLower = searchTerm.toLowerCase();
    const fullName = `${exp.nombresUsuaria || ''} ${exp.apellidosUsuaria || ''}`.toLowerCase();
    return exp.codigoCaso?.toLowerCase().includes(searchLower) || fullName.includes(searchLower);
  });

  return (
    <PanelLayout>
      <div style={{ background: '#FFFFFF', borderRadius: '16px', padding: '16px 20px', border: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 900, color: '#281F65', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ padding: '6px', background: '#F5F3FF', borderRadius: '8px' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6D28D9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"></ellipse><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path></svg>
          </div>
          Expedientes
        </h2>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', width: '320px' }}>
            <Search size={15} color="#9CA3AF" style={{ position: 'absolute', left: '12px', top: '10px' }} />
            <input 
              type="text"
              className="form-control"
              style={{ paddingLeft: '36px', paddingTop: '8px', paddingBottom: '8px', fontWeight: 600, fontSize: '0.84rem', borderRadius: '8px', border: '1px solid #E5E7EB', width: '100%' }}
              placeholder="Buscar por código de expediente o nombre de usuaria..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button style={{ padding: '6px 14px', borderRadius: '6px', border: '2px solid #613E9D', background: '#613E9D', color: '#FFFFFF', fontWeight: 800, fontSize: '0.8rem', cursor: 'pointer' }}>
              Todos los registros
            </button>
            <button style={{ padding: '6px 14px', borderRadius: '6px', border: '1px solid #E5E7EB', background: '#FFFFFF', color: '#4B5563', fontWeight: 800, fontSize: '0.8rem', cursor: 'pointer' }}>
              Internas
            </button>
            <button style={{ padding: '6px 14px', borderRadius: '6px', border: '1px solid #E5E7EB', background: '#FFFFFF', color: '#4B5563', fontWeight: 800, fontSize: '0.8rem', cursor: 'pointer' }}>
              Externas
            </button>
            <button style={{ padding: '6px 14px', borderRadius: '6px', border: '1.5px solid #613E9D', background: '#F5F3FF', color: '#613E9D', fontWeight: 800, fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5h10"></path><path d="M11 9h7"></path><path d="M11 13h4"></path><path d="M3 17l3 3 3-3"></path><path d="M6 18V4"></path></svg>
              Descendente
            </button>
          </div>
        </div>
      </div>

      <div className="card" style={{ background: '#FFFFFF', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(40, 31, 101, 0.08)', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto', padding: '8px 14px' }}>
          <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ background: '#FFFFFF', borderBottom: '2px solid #E5E7EB' }}>
              <tr>
                <th style={{ padding: '16px 12px', textAlign: 'left', color: '#000000', fontSize: '0.8rem', fontWeight: 900, textTransform: 'uppercase' }}>CÓDIGO EXPEDIENTE</th>
                <th style={{ padding: '16px 12px', textAlign: 'left', color: '#000000', fontSize: '0.8rem', fontWeight: 900, textTransform: 'uppercase' }}>NOMBRE DE LA USUARIA</th>
                <th style={{ padding: '16px 12px', textAlign: 'left', color: '#000000', fontSize: '0.8rem', fontWeight: 900, textTransform: 'uppercase' }}>REGISTRO</th>
                <th style={{ padding: '16px 12px', textAlign: 'left', color: '#000000', fontSize: '0.8rem', fontWeight: 900, textTransform: 'uppercase' }}>FECHA Y HORA INGRESO</th>
                <th style={{ padding: '16px 12px', textAlign: 'left', color: '#000000', fontSize: '0.8rem', fontWeight: 900, textTransform: 'uppercase' }}>DOCS ADJUNTOS</th>
                <th style={{ padding: '16px 12px', textAlign: 'center', color: '#000000', fontSize: '0.8rem', fontWeight: 900, textTransform: 'uppercase' }}>ACCIONES DE GESTIÓN</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={{ padding: '20px', textAlign: 'center' }}>Cargando...</td></tr>
              ) : filteredExpedientes.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: '#6B7280', fontWeight: 600 }}>No hay expedientes registrados aún.</td></tr>
              ) : (
                filteredExpedientes.map(exp => (
                  <tr key={exp.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                    <td style={{ padding: '16px 12px', fontWeight: 900, color: '#281F65', fontSize: '0.85rem' }}>EXP. {exp.codigoCaso}</td>
                    <td style={{ padding: '16px 12px', fontWeight: 800, color: '#111827', fontSize: '0.85rem' }}>
                      {exp.nombresUsuaria} {exp.apellidosUsuaria}
                    </td>
                    <td style={{ padding: '16px 12px' }}>
                      <span style={{ 
                        background: exp.condicionRegistro === 'INTERNA' ? '#FEF3C7' : '#EDE9FE', 
                        color: exp.condicionRegistro === 'INTERNA' ? '#B45309' : '#6D28D9', 
                        padding: '4px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 800 
                      }}>
                        {exp.condicionRegistro}
                      </span>
                    </td>
                    <td style={{ padding: '16px 12px', fontWeight: 700, color: '#4B5563', fontSize: '0.85rem' }}>
                      {new Date(exp.fechaIngreso).toLocaleString('es-GT', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: true }).replace(',', '')}
                    </td>
                    <td style={{ padding: '16px 12px' }}>
                      <span style={{ background: '#E0F2FE', color: '#0369A1', padding: '3px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 800 }}>
                        {exp.archivos?.length || 0} adjuntos
                      </span>
                    </td>
                    <td style={{ padding: '16px 12px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                        <button 
                          className="btn btn-outline" 
                          onClick={() => navigate(`/trabajo-social/expedientes/${exp.id}`)}
                          style={{ background: '#F5F3FF', color: '#6D28D9', border: '1px solid #EDE9FE', fontWeight: 800, padding: '6px 14px', borderRadius: '8px', fontSize: '0.8rem' }}
                        >
                          Gestión de Expediente
                        </button>
                        <button 
                          className="btn btn-primary" 
                          onClick={() => setReferirExpediente(exp)}
                          style={{ background: '#6D28D9', color: '#FFFFFF', border: 'none', fontWeight: 800, padding: '6px 14px', borderRadius: '8px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                        >
                          <Share2 size={14} /> Referir
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {referirExpediente && (
        <ReferralModal 
          isOpen={!!referirExpediente} 
          onClose={() => setReferirExpediente(null)} 
          expediente={referirExpediente} 
          onSuccess={() => fetchExpedientes()}
        />
      )}
    </PanelLayout>
  );
}
