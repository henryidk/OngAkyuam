import React, { useState, useRef } from 'react';
import { useAuthStore } from '../store/auth.store';
import PanelLayout from '../components/PanelLayout';
import { 
  Settings, 
  User, 
  Camera, 
  Lock, 
  Save, 
  CheckCircle2, 
  Upload, 
  Eye, 
  EyeOff, 
  Mail, 
  Building 
} from 'lucide-react';

export default function Ajustes() {
  const { usuario } = useAuthStore();
  const currentUser = { name: usuario?.username || 'Usuario', areaName: usuario?.rol || 'Rol', avatar: '' };

  // Sub-pestaña activa de sección ('foto' | 'datos' | 'seguridad')
  const [activeSection, setActiveSection] = useState<'foto' | 'datos' | 'seguridad'>('foto');

  // Estados de datos
  const [nombre, setNombre] = useState(currentUser?.name || 'Licda. Izabel Tut');
  const [email, setEmail] = useState('');
  const [avatar, setAvatar] = useState(currentUser?.avatar || 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80');

  // Estados de contraseña
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Notificaciones y Drag & Drop
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [errorPassword, setErrorPassword] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!currentUser) return null;

  // Manejar selección de imagen
  const handleAvatarFileSelect = (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Por favor seleccione un archivo de imagen válido.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        setAvatar(e.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleAvatarFileSelect(e.dataTransfer.files[0]);
    }
  };

  // Guardar únicamente Fotografía
  const handleSaveFoto = (e: React.FormEvent) => {
    e.preventDefault();
    console.log({ avatar });
    setToastMessage('Fotografía de perfil actualizada correctamente.');
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Guardar únicamente Datos Personales
  const handleSaveDatos = (e: React.FormEvent) => {
    e.preventDefault();
    console.log({
      name: nombre.trim(),
      email: email.trim()
    });
    setToastMessage('Datos personales actualizados correctamente.');
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Guardar únicamente Contraseña
  const handleSaveSeguridad = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorPassword(null);

    if (!currentPassword) {
      setErrorPassword('Debe ingresar su contraseña actual.');
      return;
    }
    if (newPassword.length < 6) {
      setErrorPassword('La nueva contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorPassword('La nueva contraseña y la confirmación no coinciden.');
      return;
    }

    // Resetear campos
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');

    setToastMessage('Contraseña actualizada correctamente.');
    setTimeout(() => setToastMessage(null), 3500);
  };

  const SECCIONES = [
    { id: 'foto', label: 'Fotografía de Perfil', icon: Camera },
    { id: 'datos', label: 'Datos Personales', icon: User },
    { id: 'seguridad', label: 'Seguridad y Contraseña', icon: Lock }
  ];

  return (
    <PanelLayout>
    <div style={{ padding: '24px', maxWidth: '900px', margin: '0 auto' }}>
      
      {/* Toast Flotante de Notificación */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 9999,
          background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
          color: '#FFFFFF',
          padding: '14px 20px',
          borderRadius: '12px',
          boxShadow: '0 10px 25px rgba(16, 185, 129, 0.35)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontWeight: 800,
          fontSize: '0.92rem',
          animation: 'slideInRight 0.3s ease-out'
        }}>
          <CheckCircle2 size={20} color="#FFFFFF" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Encabezado del Módulo */}
      <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ background: '#F5F3FF', padding: '12px', borderRadius: '12px', border: '1.5px solid #613E9D' }}>
          <Settings size={24} color="#613E9D" />
        </div>
        <div>
          <h2 style={{ margin: 0, color: '#281F65', fontWeight: 900, fontSize: '1.4rem' }}>
            Ajustes de Perfil
          </h2>
        </div>
      </div>

      {/* Sub-Pestañas de Secciones (Independientes) */}
      <div style={{
        display: 'flex',
        gap: '12px',
        borderBottom: '2px solid #E5E7EB',
        marginBottom: '24px'
      }}>
        {SECCIONES.map((sec) => {
          const IconComp = sec.icon;
          const isActive = activeSection === sec.id;
          return (
            <button
              key={sec.id}
              type="button"
              onClick={() => setActiveSection(sec.id as any)}
              style={{
                padding: '12px 18px',
                border: 'none',
                borderBottom: isActive ? '3px solid #613E9D' : '3px solid transparent',
                background: 'transparent',
                color: isActive ? '#613E9D' : '#6B7280',
                fontWeight: isActive ? 900 : 700,
                fontSize: '0.9rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.15s ease'
              }}
            >
              <IconComp size={17} color={isActive ? '#613E9D' : '#6B7280'} />
              <span>{sec.label}</span>
            </button>
          );
        })}
      </div>

      {/* SECCIÓN 1: FOTOGRAFÍA DE PERFIL */}
      {activeSection === 'foto' && (
        <form onSubmit={handleSaveFoto} className="card" style={{ padding: '24px', borderRadius: '16px' }}>
          <h3 style={{ margin: '0 0 16px 0', color: '#281F65', fontWeight: 900, fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Camera size={18} color="#613E9D" />
            <span>Fotografía de Perfil</span>
          </h3>

          <div style={{ display: 'flex', gap: '24px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '24px' }}>
            {/* Previsualización Avatar */}
            <div style={{ position: 'relative' }}>
              <img 
                src={avatar} 
                alt={nombre} 
                style={{
                  width: '110px',
                  height: '110px',
                  borderRadius: '50%',
                  objectFit: 'cover',
                  border: '4px solid #613E9D',
                  boxShadow: '0 8px 20px rgba(97, 62, 157, 0.2)'
                }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                style={{
                  position: 'absolute',
                  bottom: '2px',
                  right: '2px',
                  background: '#613E9D',
                  color: '#FFFFFF',
                  border: '2px solid #FFFFFF',
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer'
                }}
                title="Seleccionar nueva imagen"
              >
                <Camera size={16} />
              </button>
            </div>

            {/* Drag and Drop */}
            <div style={{ flex: 1, minWidth: '260px' }}>
              <div 
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: isDragging ? '2px dashed #613E9D' : '2px dashed #D1D5DB',
                  borderRadius: '12px',
                  padding: '24px 20px',
                  background: isDragging ? '#F5F3FF' : '#FAFAF9',
                  textAlign: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                <Upload size={24} color="#613E9D" style={{ margin: '0 auto 8px auto', display: 'block' }} />
                <span style={{ fontWeight: 800, color: '#281F65', fontSize: '0.9rem', display: 'block' }}>
                  Arrastre su imagen aquí o haga clic para buscar
                </span>
                <span style={{ fontSize: '0.78rem', color: '#6B7280', marginTop: '2px', display: 'block' }}>
                  Formatos permitidos: JPG, PNG, WEBP (Máx. 5MB)
                </span>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={(e) => e.target.files?.[0] && handleAvatarFileSelect(e.target.files[0])}
                  accept="image/*"
                  style={{ display: 'none' }}
                />
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid #E5E7EB', paddingTop: '16px' }}>
            <button 
              type="submit" 
              className="btn btn-primary"
              style={{ padding: '10px 24px', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Save size={16} />
              <span>Guardar</span>
            </button>
          </div>
        </form>
      )}

      {/* SECCIÓN 2: DATOS PERSONALES */}
      {activeSection === 'datos' && (
        <form onSubmit={handleSaveDatos} className="card" style={{ padding: '24px', borderRadius: '16px' }}>
          <h3 style={{ margin: '0 0 16px 0', color: '#281F65', fontWeight: 900, fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <User size={18} color="#613E9D" />
            <span>Datos Personales y Perfil</span>
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontWeight: 800, color: '#281F65' }}>
                Nombre Completo *
              </label>
              <div style={{ position: 'relative' }}>
                <User size={16} color="#613E9D" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                <input 
                  type="text" 
                  className="form-control"
                  style={{ paddingLeft: '38px', fontWeight: 700, color: '#281F65' }}
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Ingrese su nombre completo..."
                  required
                />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontWeight: 800, color: '#281F65' }}>
                Correo Electrónico
              </label>
              <div style={{ position: 'relative' }}>
                <Mail size={16} color="#613E9D" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                <input 
                  type="email" 
                  className="form-control"
                  style={{ paddingLeft: '38px', fontWeight: 700, color: '#281F65' }}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="correo@akyuam.gob.gt"
                />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontWeight: 800, color: '#281F65' }}>
                Área / Rol Asignado
              </label>
              <div style={{ position: 'relative' }}>
                <Building size={16} color="#613E9D" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                <input 
                  type="text" 
                  className="form-control"
                  style={{ paddingLeft: '38px', fontWeight: 800, color: '#613E9D', background: '#F5F3FF' }}
                  value={currentUser.areaName}
                  disabled
                />
              </div>
            </div>

          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid #E5E7EB', paddingTop: '16px' }}>
            <button 
              type="submit" 
              className="btn btn-primary"
              style={{ padding: '10px 24px', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Save size={16} />
              <span>Guardar</span>
            </button>
          </div>
        </form>
      )}

      {/* SECCIÓN 3: SEGURIDAD Y CAMBIO DE CONTRASEÑA */}
      {activeSection === 'seguridad' && (
        <form onSubmit={handleSaveSeguridad} className="card" style={{ padding: '24px', borderRadius: '16px' }}>
          <h3 style={{ margin: '0 0 16px 0', color: '#281F65', fontWeight: 900, fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Lock size={18} color="#613E9D" />
            <span>Seguridad y Cambio de Contraseña</span>
          </h3>

          {errorPassword && (
            <div style={{
              background: '#FEE2E2',
              border: '1px solid #EF4444',
              color: '#991B1B',
              padding: '10px 14px',
              borderRadius: '10px',
              marginBottom: '16px',
              fontSize: '0.86rem',
              fontWeight: 700
            }}>
              ⚠️ {errorPassword}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            
            {/* Contraseña Actual */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontWeight: 700, color: '#374151' }}>
                Contraseña Actual *
              </label>
              <div style={{ position: 'relative' }}>
                <input 
                  type={showCurrentPassword ? "text" : "password"} 
                  className="form-control"
                  style={{ paddingRight: '38px' }}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
                <button 
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280' }}
                >
                  {showCurrentPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Nueva Contraseña */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontWeight: 700, color: '#374151' }}>
                Nueva Contraseña *
              </label>
              <div style={{ position: 'relative' }}>
                <input 
                  type={showNewPassword ? "text" : "password"} 
                  className="form-control"
                  style={{ paddingRight: '38px' }}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  required
                />
                <button 
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280' }}
                >
                  {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Confirmar Nueva Contraseña */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontWeight: 700, color: '#374151' }}>
                Confirmar Nueva Contraseña *
              </label>
              <div style={{ position: 'relative' }}>
                <input 
                  type={showConfirmPassword ? "text" : "password"} 
                  className="form-control"
                  style={{ paddingRight: '38px' }}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repita la nueva contraseña"
                  required
                />
                <button 
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280' }}
                >
                  {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid #E5E7EB', paddingTop: '16px' }}>
            <button 
              type="submit" 
              className="btn btn-primary"
              style={{ padding: '10px 24px', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Save size={16} />
              <span>Guardar</span>
            </button>
          </div>
        </form>
      )}

    </div>
    </PanelLayout>
  );
}
