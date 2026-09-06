import { useState } from 'react';
import { Menu, FolderPlus, Database, BarChart3, Settings } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/auth.store';

export default function Sidebar() {
  const { usuario } = useAuthStore();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  if (!usuario) return null;
  const role = usuario.rol;
  const currentPath = location.pathname;

  return (
    <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}>
      {/* Botón de Colapso */}
      <div style={{ paddingBottom: '8px', borderBottom: '1px solid #F3F4F6' }}>
        <button
          type="button"
          onClick={() => setIsCollapsed(!isCollapsed)}
          title={isCollapsed ? 'Expandir menú' : 'Colapsar menú'}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            background: 'transparent',
            border: 'none',
            color: '#613E9D',
            cursor: 'pointer',
            padding: '8px 12px',
            borderRadius: '8px',
            fontWeight: 800,
            fontSize: '0.88rem',
            width: '100%',
            justifyContent: isCollapsed ? 'center' : 'flex-start',
            transition: 'background 0.2s ease',
          }}
        >
          <Menu size={20} color="#613E9D" />
          {!isCollapsed && <span>Menú</span>}
        </button>
      </div>

      <nav style={{ flex: 1, marginTop: '16px' }}>
        <ul className="nav-menu" style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
          
          {role === 'TRABAJO_SOCIAL' && (
            <>
              <li className="nav-item">
                <button
                  className={`nav-link ${currentPath === '/trabajo-social' ? 'active' : ''}`}
                  onClick={() => navigate('/trabajo-social')}
                  title="Nuevo Expediente"
                  style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', width: '100%', border: 'none', background: currentPath === '/trabajo-social' ? '#613E9D' : 'transparent', color: currentPath === '/trabajo-social' ? 'white' : '#4B5563', borderRadius: '8px', fontWeight: 700, cursor: 'pointer' }}
                >
                  <FolderPlus size={18} />
                  {!isCollapsed && <span>Nuevo Expediente</span>}
                </button>
              </li>
              <li className="nav-item">
                <button
                  className={`nav-link ${currentPath === '/trabajo-social/registros' ? 'active' : ''}`}
                  onClick={() => navigate('/trabajo-social/registros')}
                  title="Expedientes Registrados"
                  style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', width: '100%', border: 'none', background: currentPath === '/trabajo-social/registros' ? '#613E9D' : 'transparent', color: currentPath === '/trabajo-social/registros' ? 'white' : '#4B5563', borderRadius: '8px', fontWeight: 700, cursor: 'pointer' }}
                >
                  <Database size={18} />
                  {!isCollapsed && <span>Expedientes</span>}
                </button>
              </li>
              <li className="nav-item">
                <button
                  className={`nav-link ${currentPath === '/trabajo-social/reportes' ? 'active' : ''}`}
                  onClick={() => navigate('/trabajo-social/reportes')}
                  title="Reportes y Estadísticas"
                  style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', width: '100%', border: 'none', background: currentPath === '/trabajo-social/reportes' ? '#613E9D' : 'transparent', color: currentPath === '/trabajo-social/reportes' ? 'white' : '#4B5563', borderRadius: '8px', fontWeight: 700, cursor: 'pointer' }}
                >
                  <BarChart3 size={18} />
                  {!isCollapsed && <span>Reportes</span>}
                </button>
              </li>
              <li className="nav-item">
                <button
                  className={`nav-link ${currentPath === '/trabajo-social/ajustes' ? 'active' : ''}`}
                  onClick={() => navigate('/trabajo-social/ajustes')}
                  title="Ajustes de Perfil"
                  style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', width: '100%', border: 'none', background: currentPath === '/trabajo-social/ajustes' ? '#613E9D' : 'transparent', color: currentPath === '/trabajo-social/ajustes' ? 'white' : '#4B5563', borderRadius: '8px', fontWeight: 700, cursor: 'pointer' }}
                >
                  <Settings size={18} />
                  {!isCollapsed && <span>Ajustes</span>}
                </button>
              </li>
            </>
          )}

        </ul>
      </nav>
    </aside>
  );
}
