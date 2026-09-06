import React, { useState } from 'react';
import { X, Check } from 'lucide-react';
import { api } from '../../../lib/api';

interface ReferralDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  expediente: {
    id: string;
    codigoCaso: string;
    nombresUsuaria: string;
    apellidosUsuaria: string;
    condicionRegistro: string;
    dpi?: string | null;
    tipologiasViolencia: string[];
  };
  onSuccess: () => void;
}

export function ReferralModal({ isOpen, onClose, expediente, onSuccess }: ReferralDrawerProps) {
  const [selectedAreas, setSelectedAreas] = useState<string[]>([]);
  const [motivos, setMotivos] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const toggleArea = (area: string) => {
    setSelectedAreas(prev => {
      const isSelected = prev.includes(area);
      if (isSelected) {
        setMotivos(m => {
          const newMotivos = { ...m };
          delete newMotivos[area];
          return newMotivos;
        });
        return prev.filter(a => a !== area);
      } else {
        return [...prev, area];
      }
    });
  };

  const handleMotivoChange = (area: string, value: string) => {
    setMotivos(prev => ({
      ...prev,
      [area]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedAreas.length === 0) {
      setError('Debes seleccionar al menos un área para referir.');
      return;
    }
    
    for (const area of selectedAreas) {
      if (!motivos[area] || !motivos[area].trim()) {
        setError('Debes especificar el motivo para cada área seleccionada.');
        return;
      }
    }

    try {
      setIsSubmitting(true);
      setError(null);
      
      const referencias = selectedAreas.map(area => ({ 
        area, 
        motivo: motivos[area] 
      }));
      
      await api.post(`/expedientes/${expediente.id}/referir`, { referencias });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error al referir el expediente');
    } finally {
      setIsSubmitting(false);
    }
  };

  const areasList = [
    { id: 'JURIDICO', name: 'Atención Jurídica', desc: 'Asesoría legal y seguimiento judicial', color: 'blue' },
    { id: 'PSICOLOGIA', name: 'Atención Psicológica', desc: 'Terapia y apoyo emocional', color: 'purple' },
    { id: 'MEDICA', name: 'Atención Médica', desc: 'Evaluación y tratamiento médica', color: 'emerald' }
  ];

  return (
    <>
      <div 
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 transition-opacity"
        onClick={onClose}
      />
      
      <div className="fixed inset-y-0 right-0 w-full max-w-xl bg-white shadow-2xl z-50 flex flex-col transform transition-transform duration-300 ease-in-out">
        {/* Header & Resumen */}
        <div className="p-6 pb-4 border-b border-gray-100 bg-white space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Referir Expediente</h2>
              <p className="text-sm text-gray-500 mt-1">Caso: {expediente.codigoCaso}</p>
            </div>
            <button 
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100/50">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="block text-gray-500 mb-0.5">Nombre</span>
                <span className="font-medium text-gray-900">{expediente.nombresUsuaria} {expediente.apellidosUsuaria}</span>
              </div>
              <div>
                <span className="block text-gray-500 mb-0.5">DPI</span>
                <span className="font-medium text-gray-900">{expediente.dpi || 'No registrado'}</span>
              </div>
              <div>
                <span className="block text-gray-500 mb-0.5">Condición</span>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-white text-gray-700 border border-gray-200 shadow-sm">
                  {expediente.condicionRegistro}
                </span>
              </div>
              <div>
                <span className="block text-gray-500 mb-0.5">Tipología</span>
                <span className="font-medium text-gray-900 truncate block" title={expediente.tipologiasViolencia.join(', ')}>
                  {expediente.tipologiasViolencia.length > 0 ? expediente.tipologiasViolencia.join(', ') : 'Ninguna'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 pt-4">
          <form id="referral-form" onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-3">
              {areasList.map((area) => {
                const isSelected = selectedAreas.includes(area.id);
                return (
                  <div 
                    key={area.id}
                    className={`relative rounded-xl border-2 transition-all duration-200 overflow-hidden ${
                      isSelected 
                        ? 'border-blue-600 bg-blue-50/10' 
                        : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <div 
                      onClick={() => toggleArea(area.id)}
                      className="flex items-start p-4 cursor-pointer"
                    >
                      <div className="min-w-0 flex-1 text-sm">
                        <label className="font-medium text-gray-900 cursor-pointer block">
                          {area.name}
                        </label>
                        <p className="text-gray-500 mt-0.5">{area.desc}</p>
                      </div>
                      <div className={`ml-3 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
                        isSelected
                          ? 'bg-blue-600 border-blue-600'
                          : 'border-gray-300 bg-white'
                      }`}>
                        {isSelected && <Check className="h-4 w-4 text-white" />}
                      </div>
                    </div>

                    {isSelected && (
                      <div className="px-4 pb-4 animate-in fade-in slide-in-from-top-2">
                        <label htmlFor={`motivo-${area.id}`} className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
                          Motivo para {area.name}
                        </label>
                        <textarea
                          id={`motivo-${area.id}`}
                          rows={3}
                          className="block w-full rounded-lg border-gray-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm resize-none bg-white"
                          placeholder={`Especifica por qué estás refiriendo a ${area.name}...`}
                          value={motivos[area.id] || ''}
                          onChange={(e) => handleMotivoChange(area.id, e.target.value)}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {error && (
              <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-100">
                {error}
              </div>
            )}
          </form>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-100 bg-gray-50">
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="referral-form"
              disabled={isSubmitting}
              className="inline-flex justify-center px-4 py-2.5 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-xl hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
            >
              {isSubmitting ? 'Refiriendo...' : 'Referir Expediente'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
