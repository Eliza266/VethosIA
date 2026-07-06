import { useState } from 'react';
import type { ComponentType } from 'react';
import { PAISES_INDICATIVO, buscarPaisPorNombre, type PaisIndicativo } from '../../lib/phone';

interface PhoneInputProps {
  id: string;
  label: string;
  icon?: ComponentType<{ className?: string }>;
  pais: PaisIndicativo;
  numero: string;
  onChangePais: (pais: PaisIndicativo) => void;
  onChangeNumero: (numero: string) => void;
}

// Campo de telefono reutilizable: el pais se escribe por nombre (con autocompletado del
// navegador vía <datalist>) y el indicativo (+57) se resuelve solo y se muestra debajo.
export default function PhoneInput({
  id,
  label,
  icon: Icon,
  pais,
  numero,
  onChangePais,
  onChangeNumero,
}: PhoneInputProps) {
  const [textoPais, setTextoPais] = useState(pais.nombre);
  const datalistId = `paises-${id}`;

  const handlePaisChange = (valor: string) => {
    setTextoPais(valor);
    const encontrado = buscarPaisPorNombre(valor);
    if (encontrado) onChangePais(encontrado);
  };

  return (
    <div>
      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
        {label}
      </label>
      <div className="flex gap-2">
        <div className="w-40 shrink-0">
          <input
            list={datalistId}
            value={textoPais}
            onChange={(e) => handlePaisChange(e.target.value)}
            placeholder="País"
            aria-label={`País (${label})`}
            className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-700 bg-white focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-shadow"
          />
          <datalist id={datalistId}>
            {PAISES_INDICATIVO.map((p) => (
              <option key={p.code} value={p.nombre} />
            ))}
          </datalist>
          <p className="mt-1 text-[11px] font-semibold text-slate-400">{pais.code}</p>
        </div>
        <div className="relative flex-1">
          {Icon && (
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Icon className="h-4 w-4" />
            </div>
          )}
          <input
            type="tel"
            inputMode="numeric"
            placeholder="300 123 4567"
            value={numero}
            onChange={(e) => onChangeNumero(e.target.value.replace(/\D/g, ''))}
            className={`block w-full ${Icon ? 'pl-10' : 'pl-3'} pr-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-shadow`}
          />
        </div>
      </div>
    </div>
  );
}
