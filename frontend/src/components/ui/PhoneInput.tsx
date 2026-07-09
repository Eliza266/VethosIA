import { useEffect, useRef, useState } from 'react';
import type { ComponentType } from 'react';
import { PAISES_INDICATIVO, type PaisIndicativo } from '../../lib/phone';

interface PhoneInputProps {
  id: string;
  label: string;
  icon?: ComponentType<{ className?: string }>;
  pais: PaisIndicativo;
  numero: string;
  onChangePais: (pais: PaisIndicativo) => void;
  onChangeNumero: (numero: string) => void;
}

// Campo de telefono reutilizable: selector compacto de pais (bandera + indicativo) que se
// despliega mostrando bandera + nombre completo para elegir, y el numero con todo el ancho
// que le sobra a un lado. Antes el pais se escribia como texto libre en una caja ancha fija,
// lo que le quitaba casi todo el espacio al numero.
export default function PhoneInput({
  id,
  label,
  icon: Icon,
  pais,
  numero,
  onChangePais,
  onChangeNumero,
}: PhoneInputProps) {
  const [abierto, setAbierto] = useState(false);
  const contenedorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!abierto) return;
    const handleClickFuera = (e: MouseEvent) => {
      if (contenedorRef.current && !contenedorRef.current.contains(e.target as Node)) {
        setAbierto(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAbierto(false);
    };
    document.addEventListener('mousedown', handleClickFuera);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickFuera);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [abierto]);

  return (
    <div>
      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
        {label}
      </label>
      <div className="flex gap-2">
        <div ref={contenedorRef} className="relative w-24 shrink-0">
          <button
            type="button"
            onClick={() => setAbierto((v) => !v)}
            aria-label={`País (${label})`}
            aria-expanded={abierto}
            className="flex w-full items-center justify-center gap-1.5 px-2 py-2.5 border border-slate-200 rounded-xl text-sm bg-white hover:border-accent focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-shadow"
          >
            <span>{pais.bandera}</span>
            <span className="font-semibold text-slate-700">{pais.code}</span>
          </button>
          {abierto && (
            <div className="absolute z-20 mt-1 max-h-56 w-60 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
              {PAISES_INDICATIVO.map((p) => (
                <button
                  key={p.code}
                  type="button"
                  onClick={() => {
                    onChangePais(p);
                    setAbierto(false);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-slate-50"
                >
                  <span>{p.bandera}</span>
                  <span className="flex-1 truncate text-slate-700">{p.nombre}</span>
                  <span className="text-slate-400">{p.code}</span>
                </button>
              ))}
            </div>
          )}
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
