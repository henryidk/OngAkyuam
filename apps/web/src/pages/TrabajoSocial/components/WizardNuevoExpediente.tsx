import { useState, useEffect } from 'react';
import { 
  CheckCircle2, 
  User, 
  ShieldAlert, 
  FileText, 
  Calendar, 
  Clock, 
  ArrowRight, 
  ArrowLeft, 
  Check, 
  Save 
} from 'lucide-react';

export default function WizardNuevoExpediente() {
  // Estado del Wizard: Paso 1, 2 o 3
  const [pasoActual, setPasoActual] = useState(1);
  const [toastNotif, setToastNotif] = useState<{ message: string; type: 'error' | 'success' } | null>(null);

  // Fecha y hora en tiempo real
  const [fechaActualAuto, setFechaActualAuto] = useState('');
  const [horaActualAuto, setHoraActualAuto] = useState('');
  
  // Código automático temporal
  // Código automático generado desde el backend
  const [codigoCasoAuto, setCodigoCasoAuto] = useState('Cargando...');

  useEffect(() => {
    const fetchNextId = async () => {
      try {
        const { api } = await import('../../../lib/api');
        const { data } = await api.get('/expedientes/next-id');
        setCodigoCasoAuto(data.nextId);
      } catch (error) {
        setCodigoCasoAuto('---');
      }
    };
    fetchNextId();
  }, []);
  useEffect(() => {
    const updateDateTime = () => {
      const now = new Date();
      setFechaActualAuto(now.toLocaleDateString('es-GT', { day: '2-digit', month: '2-digit', year: 'numeric' }));
      setHoraActualAuto(now.toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }));
    };
    updateDateTime();
    const interval = setInterval(updateDateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const showToast = (message: string, type: 'error' | 'success' = 'error') => {
    setToastNotif({ message, type });
    setTimeout(() => setToastNotif(null), 4000);
  };

  const cambiarPasoWizard = (nuevoPaso: number) => {
    setPasoActual(nuevoPaso);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Paso 1: Datos de la Usuaria
  const [caratulaNombresUsuaria, setCaratulaNombresUsuaria] = useState('');
  const [caratulaApellidosUsuaria, setCaratulaApellidosUsuaria] = useState('');
  const [caratulaDpi, setCaratulaDpi] = useState('');
  const [caratulaTelefonosUsuaria, setCaratulaTelefonosUsuaria] = useState('');
  const [caratulaDireccionUsuaria, setCaratulaDireccionUsuaria] = useState('');

  // Paso 2: Datos del Agresor y Tipología
  const [agresorNombres, setAgresorNombres] = useState('');
  const [agresorApellidos, setAgresorApellidos] = useState('');
  const [agresorTelefono, setAgresorTelefono] = useState('');
  const [agresorDireccion, setAgresorDireccion] = useState('');
  const [tipologiaFisica, setTipologiaFisica] = useState(true);
  const [tipologiaPsicologica, setTipologiaPsicologica] = useState(true);
  const [tipologiaEconomica, setTipologiaEconomica] = useState(false);
  const [tipologiaSexual, setTipologiaSexual] = useState(false);

  // Paso 3: Condición
  const [caratulaTipoRegistro, setCaratulaTipoRegistro] = useState<'INTERNA' | 'EXTERNA'>('INTERNA');
  const [fechaIngresoInterna, setFechaIngresoInterna] = useState(new Date().toISOString().split('T')[0]);
  const [caratulaObservaciones, setCaratulaObservaciones] = useState('');

  const handleDpiChange = (val: string) => {
    const cleanDigits = val.replace(/\D/g, '').slice(0, 13);
    setCaratulaDpi(cleanDigits);
  };

  const handleAvanzarPaso1 = () => {
    if (!caratulaNombresUsuaria.trim()) return showToast('Falta llenar el campo: Nombres de la Usuaria');
    if (!caratulaApellidosUsuaria.trim()) return showToast('Falta llenar el campo: Apellidos de la Usuaria');
    if (caratulaDpi.length > 0 && caratulaDpi.length !== 13) return showToast('El campo DPI / CUI debe contener exactamente 13 dígitos numéricos');
    if (!caratulaDireccionUsuaria.trim()) return showToast('Falta llenar el campo: Dirección Domiciliar');
    cambiarPasoWizard(2);
  };

  const handleFinalizarGuardarExpediente = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Importante: No importé `api` de `../../../lib/api` al inicio del archivo porque replace_file_content 
      // lo requiere para no romper todo. Mejor uso una importación dinámica o lo añado arriba.
      const { api } = await import('../../../lib/api');
      
      const payload = {
        nombresUsuaria: caratulaNombresUsuaria,
        apellidosUsuaria: caratulaApellidosUsuaria,
        dpi: caratulaDpi,
        telefono: caratulaTelefonosUsuaria,
        direccion: caratulaDireccionUsuaria,
        nombresAgresor: agresorNombres,
        apellidosAgresor: agresorApellidos,
        telefonoAgresor: agresorTelefono,
        direccionAgresor: agresorDireccion,
        tipologiasViolencia: [
          ...(tipologiaFisica ? ['Física'] : []),
          ...(tipologiaPsicologica ? ['Psicológica'] : []),
          ...(tipologiaEconomica ? ['Económica'] : []),
          ...(tipologiaSexual ? ['Sexual'] : []),
        ],
        condicionRegistro: caratulaTipoRegistro,
        fechaIngreso: caratulaTipoRegistro === 'INTERNA' ? fechaIngresoInterna : undefined,
        observacionesGenerales: caratulaObservaciones
      };

      await api.post('/expedientes', payload);
      showToast(`Expediente N° ${codigoCasoAuto} Generado`, 'success');
      
      // Regresar al estado limpio o redirigir
      setTimeout(() => {
        window.location.href = '/trabajo-social/registros';
      }, 2000);
      
    } catch (error: any) {
      console.error(error);
      const msg = error.response?.data?.message || 'Error al guardar el expediente';
      showToast(typeof msg === 'string' ? msg : JSON.stringify(msg), 'error');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {toastNotif && (
        <div style={{
          position: 'fixed', top: '24px', right: '24px', zIndex: 9999,
          background: toastNotif.type === 'error' ? '#FEF2F2' : '#ECFDF5',
          color: toastNotif.type === 'error' ? '#991B1B' : '#065F46',
          border: `1.5px solid ${toastNotif.type === 'error' ? '#FCA5A5' : '#6EE7B7'}`,
          padding: '14px 20px', borderRadius: '12px', fontWeight: 800, fontSize: '0.9rem',
          display: 'flex', alignItems: 'center', gap: '12px',
          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1)'
        }}>
          {toastNotif.type === 'error' ? <ShieldAlert size={20} color="#DC2626" /> : <CheckCircle2 size={20} color="#10B981" />}
          <span>{toastNotif.message}</span>
        </div>
      )}

      {/* HEADER */}
      <div className="card" style={{ padding: '10px 18px', background: '#F8FAFC', borderRadius: '12px', border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ background: '#281F65', color: '#FFFFFF', padding: '5px 12px', borderRadius: '8px', fontWeight: 900, fontSize: '0.92rem', letterSpacing: '0.04em' }}>
            NUEVO EXPEDIENTE: {codigoCasoAuto}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.82rem', fontWeight: 800, color: '#1E293B' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#FFFFFF', padding: '4px 10px', borderRadius: '8px', border: '1px solid #CBD5E1' }}>
            <Calendar size={15} color="#613E9D" />
            <span>Fecha: {fechaActualAuto}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#FFFFFF', padding: '4px 10px', borderRadius: '8px', border: '1px solid #CBD5E1' }}>
            <Clock size={15} color="#613E9D" />
            <span>Hora: {horaActualAuto}</span>
          </div>
        </div>
      </div>

      {/* STEPPER */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', background: '#FFFFFF', padding: '6px 8px', borderRadius: '12px', border: '1px solid rgba(40, 31, 101, 0.1)' }}>
        <div style={{ padding: '6px 12px', borderRadius: '8px', background: pasoActual === 1 ? '#613E9D' : pasoActual > 1 ? '#ECFDF5' : '#F3F4F6', color: pasoActual === 1 ? '#FFFFFF' : pasoActual > 1 ? '#047857' : '#6B7280', fontWeight: 800, fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          {pasoActual > 1 ? <Check size={15} color="#047857" /> : <User size={15} />}
          <span>1. Datos de la Usuaria</span>
        </div>
        <div style={{ padding: '6px 12px', borderRadius: '8px', background: pasoActual === 2 ? '#613E9D' : pasoActual > 2 ? '#ECFDF5' : '#F3F4F6', color: pasoActual === 2 ? '#FFFFFF' : pasoActual > 2 ? '#047857' : '#6B7280', fontWeight: 800, fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          {pasoActual > 2 ? <Check size={15} color="#047857" /> : <ShieldAlert size={15} />}
          <span>2. Agresor y Tipología</span>
        </div>
        <div style={{ padding: '6px 12px', borderRadius: '8px', background: pasoActual === 3 ? '#613E9D' : '#F3F4F6', color: pasoActual === 3 ? '#FFFFFF' : '#6B7280', fontWeight: 800, fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FileText size={15} />
          <span>3. Condición y Observaciones</span>
        </div>
      </div>

      {/* PASO 1 */}
      {pasoActual === 1 && (
        <div className="card" style={{ padding: '16px 20px', borderRadius: '14px', border: '1px solid rgba(40, 31, 101, 0.1)' }}>
          <div style={{ fontSize: '0.9rem', fontWeight: 900, color: '#281F65', textTransform: 'uppercase', marginBottom: '14px', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <User size={18} color="#613E9D" />
            <span>1. DATOS DE LA USUARIA</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', marginBottom: '16px' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Nombres de la Usuaria *</label>
              <input type="text" className="form-control" style={{ fontWeight: 700, color: '#281F65' }} placeholder="Ingrese nombre(s)" value={caratulaNombresUsuaria} onChange={(e) => setCaratulaNombresUsuaria(e.target.value)} required />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Apellidos de la Usuaria *</label>
              <input type="text" className="form-control" style={{ fontWeight: 700, color: '#281F65' }} placeholder="Ingrese apellido(s)" value={caratulaApellidosUsuaria} onChange={(e) => setCaratulaApellidosUsuaria(e.target.value)} required />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>DPI / CUI</span>
                <span style={{ fontSize: '0.72rem', color: caratulaDpi.length === 13 ? '#059669' : '#6B7280', fontWeight: 800 }}>{caratulaDpi.length}/13 dígitos</span>
              </label>
              <input type="text" className="form-control" placeholder="Ej. 2540123451601" maxLength={13} value={caratulaDpi} onChange={(e) => handleDpiChange(e.target.value)} style={{ fontWeight: 800, letterSpacing: '0.05em', color: '#281F65' }} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Teléfono de Contacto</span>
                <span style={{ fontSize: '0.72rem', color: caratulaTelefonosUsuaria.length === 8 ? '#059669' : '#6B7280', fontWeight: 800 }}>{caratulaTelefonosUsuaria.length}/8 dígitos</span>
              </label>
              <input type="text" className="form-control" placeholder="Ej. 55441122" maxLength={8} value={caratulaTelefonosUsuaria} onChange={(e) => setCaratulaTelefonosUsuaria(e.target.value.replace(/\D/g, '').slice(0, 8))} style={{ fontWeight: 700, color: '#281F65' }} />
            </div>
            <div className="form-group" style={{ marginBottom: 0, gridColumn: 'span 2' }}>
              <label className="form-label">Dirección Domiciliar *</label>
              <input type="text" className="form-control" placeholder="Ej. Barrio El Centro, zona 1, Cobán" value={caratulaDireccionUsuaria} onChange={(e) => setCaratulaDireccionUsuaria(e.target.value)} required />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '16px', borderTop: '1px solid #E5E7EB' }}>
            <button type="button" className="btn btn-primary" onClick={handleAvanzarPaso1} style={{ padding: '12px 28px', fontSize: '0.95rem', borderRadius: '10px', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>Siguiente</span>
              <ArrowRight size={18} />
            </button>
          </div>
        </div>
      )}

      {/* PASO 2 */}
      {pasoActual === 2 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="card" style={{ padding: '24px', borderRadius: '16px', border: '1px solid rgba(220, 38, 38, 0.15)' }}>
            <div style={{ fontSize: '0.95rem', fontWeight: 900, color: '#DC2626', textTransform: 'uppercase', marginBottom: '20px', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldAlert size={20} color="#DC2626" />
              <span>2. DATOS DEL AGRESOR Y TIPOLOGÍA</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Nombres del Agresor</label>
                <input type="text" className="form-control" placeholder="Nombres del agresor" value={agresorNombres} onChange={(e) => setAgresorNombres(e.target.value)} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Apellidos del Agresor</label>
                <input type="text" className="form-control" placeholder="Apellidos del agresor" value={agresorApellidos} onChange={(e) => setAgresorApellidos(e.target.value)} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '16px', marginBottom: '24px' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Teléfono del Agresor</label>
                <input type="text" className="form-control" placeholder="Ej. 55441122" maxLength={8} value={agresorTelefono} onChange={(e) => setAgresorTelefono(e.target.value.replace(/\D/g, '').slice(0, 8))} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Dirección del Agresor</label>
                <input type="text" className="form-control" placeholder="Dirección o ubicación" value={agresorDireccion} onChange={(e) => setAgresorDireccion(e.target.value)} />
              </div>
            </div>
            <div style={{ background: '#FAFAF9', padding: '20px', borderRadius: '12px', border: '1px solid #E5E7EB' }}>
              <label className="form-label" style={{ fontWeight: 900, color: '#281F65', marginBottom: '12px', display: 'block', fontSize: '0.9rem' }}>
                Tipología de Violencia Sufrida *
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '12px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.88rem', fontWeight: 700, cursor: 'pointer' }}>
                  <input type="checkbox" checked={tipologiaFisica} onChange={(e) => setTipologiaFisica(e.target.checked)} style={{ width: '18px', height: '18px' }} />
                  <span>Física</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.88rem', fontWeight: 700, cursor: 'pointer' }}>
                  <input type="checkbox" checked={tipologiaPsicologica} onChange={(e) => setTipologiaPsicologica(e.target.checked)} style={{ width: '18px', height: '18px' }} />
                  <span>Psicológica</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.88rem', fontWeight: 700, cursor: 'pointer' }}>
                  <input type="checkbox" checked={tipologiaEconomica} onChange={(e) => setTipologiaEconomica(e.target.checked)} style={{ width: '18px', height: '18px' }} />
                  <span>Económica / Patrimonial</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.88rem', fontWeight: 700, cursor: 'pointer' }}>
                  <input type="checkbox" checked={tipologiaSexual} onChange={(e) => setTipologiaSexual(e.target.checked)} style={{ width: '18px', height: '18px' }} />
                  <span>Sexual</span>
                </label>
              </div>
            </div>
          </div>
          <div className="card" style={{ padding: '16px 24px', borderRadius: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button type="button" className="btn btn-secondary" onClick={() => cambiarPasoWizard(1)} style={{ padding: '10px 20px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ArrowLeft size={16} /><span>Atrás</span>
            </button>
            <button type="button" className="btn btn-primary" onClick={() => cambiarPasoWizard(3)} style={{ padding: '12px 28px', fontSize: '0.95rem', borderRadius: '10px', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>Siguiente</span><ArrowRight size={18} />
            </button>
          </div>
        </div>
      )}

      {/* PASO 3 */}
      {pasoActual === 3 && (
        <form onSubmit={handleFinalizarGuardarExpediente} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="card" style={{ padding: '24px', borderRadius: '16px', border: '1px solid rgba(40, 31, 101, 0.1)' }}>
            <div style={{ fontSize: '0.95rem', fontWeight: 900, color: '#281F65', textTransform: 'uppercase', marginBottom: '20px', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileText size={20} color="#613E9D" />
              <span>3. CONDICIÓN DE REGISTRO Y OBSERVACIONES</span>
            </div>
            <div style={{ marginBottom: '24px' }}>
              <label className="form-label" style={{ fontWeight: 800, color: '#281F65', marginBottom: '10px', display: 'block' }}>Condición de Registro en Trabajo Social *</label>
              <div style={{ display: 'flex', gap: '16px', maxWidth: '500px' }}>
                <button type="button" style={{ flex: 1, padding: '14px', borderRadius: '12px', border: caratulaTipoRegistro === 'INTERNA' ? '2px solid #613E9D' : '1px solid #D1D5DB', background: caratulaTipoRegistro === 'INTERNA' ? '#613E9D' : '#FFFFFF', color: caratulaTipoRegistro === 'INTERNA' ? '#FFFFFF' : '#374151', fontWeight: 900, cursor: 'pointer', fontSize: '0.92rem' }} onClick={() => setCaratulaTipoRegistro('INTERNA')}>INTERNA</button>
                <button type="button" style={{ flex: 1, padding: '14px', borderRadius: '12px', border: caratulaTipoRegistro === 'EXTERNA' ? '2px solid #613E9D' : '1px solid #D1D5DB', background: caratulaTipoRegistro === 'EXTERNA' ? '#613E9D' : '#FFFFFF', color: caratulaTipoRegistro === 'EXTERNA' ? '#FFFFFF' : '#374151', fontWeight: 900, cursor: 'pointer', fontSize: '0.92rem' }} onClick={() => setCaratulaTipoRegistro('EXTERNA')}>EXTERNA</button>
              </div>
            </div>
            {caratulaTipoRegistro === 'INTERNA' && (
              <div style={{ background: '#FAFAF9', padding: '16px 20px', borderRadius: '12px', border: '1px solid #E5E7EB', marginBottom: '24px', maxWidth: '350px' }}>
                <label className="form-label" style={{ fontWeight: 800, color: '#281F65', marginBottom: '6px', display: 'block' }}>Fecha de Ingreso al Albergue *</label>
                <input type="date" className="form-control" style={{ fontWeight: 700, color: '#281F65', background: '#FFFFFF' }} value={fechaIngresoInterna} onChange={(e) => setFechaIngresoInterna(e.target.value)} required />
              </div>
            )}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Observaciones Iniciales de Ingreso</label>
              <textarea className="form-control" rows={4} style={{ fontWeight: 600, fontSize: '0.9rem', color: '#281F65' }} placeholder="Ingrese cualquier observación social relevante de la usuaria..." value={caratulaObservaciones} onChange={(e) => setCaratulaObservaciones(e.target.value)} />
            </div>
          </div>
          <div className="card" style={{ padding: '16px 24px', borderRadius: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button type="button" className="btn btn-secondary" onClick={() => cambiarPasoWizard(2)} style={{ padding: '10px 20px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ArrowLeft size={16} /><span>Atrás</span>
            </button>
            <button type="submit" className="btn btn-primary" style={{ padding: '12px 32px', fontSize: '1rem', borderRadius: '10px', fontWeight: 900, background: '#10B981', borderColor: '#10B981', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Save size={18} /><span>Guardar Expediente</span>
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
