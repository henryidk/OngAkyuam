import { LogOut } from 'lucide-react';
import { useAuthStore } from '../../store/auth.store';

export default function Navbar() {
  const { usuario, logout } = useAuthStore();

  if (!usuario) return null;

  return (
    <header className="navbar" style={{ background: '#281F65', height: '68px', padding: '0 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'white', position: 'sticky', top: 0, zIndex: 50 }}>
      <div className="navbar-brand" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ background: 'white', borderRadius: '8px', padding: '4px 8px', display: 'flex', alignItems: 'center' }}>
          <img src="/logo.png" alt="AK' YU'AM" style={{ height: '32px', width: 'auto', objectFit: 'contain' }} />
        </div>
        <div>
          <div className="navbar-title" style={{ fontSize: '1.25rem', fontWeight: 800 }}>AK' YU'AM</div>
          <div className="navbar-subtitle" style={{ fontSize: '0.75rem', opacity: 0.95, fontWeight: 600, textTransform: 'uppercase' }}>Centro de Atención Integral</div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(255, 255, 255, 0.1)', padding: '6px 14px', borderRadius: '20px' }}>
          <div style={{ fontSize: '0.82rem', lineHeight: '1.2' }}>
            <div style={{ fontWeight: 800, color: '#FFFFFF' }}>{usuario.nombreCompleto}</div>
            <div style={{ fontSize: '0.72rem', color: '#FFFFFF', opacity: 0.95, fontWeight: 600 }}>{usuario.rol}</div>
          </div>
        </div>

        <button 
          onClick={logout}
          className="btn btn-outline" 
          style={{ color: 'white', border: '1px solid rgba(255,255,255,0.3)', background: 'transparent', padding: '6px 10px', borderRadius: '8px', cursor: 'pointer' }}
          title="Cerrar sesión"
        >
          <LogOut size={16} />
        </button>
      </div>
    </header>
  );
}
