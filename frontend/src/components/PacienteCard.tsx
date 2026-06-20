import { useNavigate } from 'react-router-dom';
import type { Paciente } from '../types';
import { Phone, User, Calendar, ArrowRight, ShieldCheck } from 'lucide-react';

interface PacienteCardProps {
  paciente: Paciente;
}

const PacienteCard: React.FC<PacienteCardProps> = ({ paciente }) => {
  const { id, nombre, especie, raza, sexo, propietario, fechaNacimiento, foto } = paciente;

  // Compute species styling and emoji/icon
  const getSpeciesConfig = (esp: typeof especie) => {
    switch (esp) {
      case 'perro':
        return { emoji: '🐶', label: 'Perro', bg: 'bg-amber-50 text-amber-800 border-amber-100', avatarBg: 'bg-amber-100 text-amber-800 ring-4 ring-amber-50' };
      case 'gato':
        return { emoji: '🐱', label: 'Gato', bg: 'bg-purple-50 text-purple-800 border-purple-100', avatarBg: 'bg-purple-100 text-purple-800 ring-4 ring-purple-50' };
      case 'ave':
        return { emoji: '🦜', label: 'Ave', bg: 'bg-sky-50 text-sky-800 border-sky-100', avatarBg: 'bg-sky-100 text-sky-800 ring-4 ring-sky-50' };
      case 'reptil':
        return { emoji: '🦎', label: 'Reptil', bg: 'bg-emerald-50 text-emerald-800 border-emerald-100', avatarBg: 'bg-emerald-100 text-emerald-800 ring-4 ring-emerald-50' };
      default:
        return { emoji: '🐾', label: 'Otro', bg: 'bg-slate-50 text-slate-800 border-slate-100', avatarBg: 'bg-slate-100 text-slate-800 ring-4 ring-slate-50' };
    }
  };

  const speciesConfig = getSpeciesConfig(especie);

  // Calculate approximate age
  const getAge = (birthDateString?: string) => {
    if (!birthDateString) return 'Edad desconocida';
    const birthDate = new Date(birthDateString);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    if (age === 0) {
      const months = (today.getFullYear() - birthDate.getFullYear()) * 12 + today.getMonth() - birthDate.getMonth();
      return months <= 0 ? 'Recién nacido' : `${months} ${months === 1 ? 'mes' : 'meses'}`;
    }
    return `${age} ${age === 1 ? 'año' : 'años'}`;
  };

  const initial = nombre.trim().charAt(0).toUpperCase();
  const navigate = useNavigate();

  return (
    <div
      role="link"
      tabIndex={0}
      aria-label={`Abrir expediente de ${nombre}`}
      onClick={() => navigate(`/pacientes/${id}`)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          navigate(`/pacientes/${id}`);
        }
      }}
      className="premium-card premium-card-hover group relative flex min-h-[320px] cursor-pointer flex-col justify-between overflow-hidden p-5 outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--accent)_32%,transparent)]"
    >
      <div className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-[var(--accent-soft)] blur-2xl transition-transform group-hover:scale-125" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[var(--accent)] via-[var(--clinical-cyan)] to-[var(--clinical-blue)] opacity-80" />
      <div>
        {/* Header with Avatar and Species Badge */}
        <div className="flex items-center gap-4 mb-4">
          {foto ? (
            <img
              src={foto}
              alt={nombre}
            className="h-14 w-14 rounded-2xl object-cover shrink-0 ring-4 ring-white border border-slate-100 shadow-sm"
          />
        ) : (
            <div className={`h-14 w-14 rounded-2xl flex items-center justify-center font-black text-xl shrink-0 shadow-sm ${speciesConfig.avatarBg}`}>
              {initial}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h3 className="font-extrabold text-slate-800 text-lg group-hover:text-[#0F6E56] transition-colors truncate">
              {nombre}
            </h3>
            {raza ? (
              <p className="text-xs text-slate-400 font-semibold truncate">{raza}</p>
            ) : (
              <p className="text-xs text-slate-400 font-semibold">Raza no especificada</p>
            )}
          </div>
          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border shrink-0 ${speciesConfig.bg}`}>
            <span>{speciesConfig.emoji}</span>
            <span>{speciesConfig.label}</span>
          </span>
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          <span className="clinical-chip normal-case tracking-normal">
            <ShieldCheck className="h-3.5 w-3.5" />
            Expediente activo
          </span>
          <span className="rounded-full border border-slate-200 bg-white/70 px-2.5 py-1 text-[10px] font-bold text-slate-500">
            Próxima acción: revisar historia
          </span>
        </div>

        {/* Details grid - 2 columns */}
        <div className="grid grid-cols-2 gap-y-3 gap-x-4 py-4 border-t border-b border-slate-100 text-xs text-slate-500 mb-4">
          <div>
            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Sexo</span>
            <span className="capitalize font-semibold text-slate-700">{sexo}</span>
          </div>
          <div>
            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Edad</span>
            <span className="font-semibold text-slate-700 flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              {getAge(fechaNacimiento)}
            </span>
          </div>
          <div className="col-span-2">
            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Propietario</span>
            <span className="font-semibold text-slate-700 flex items-center gap-1.5">
              <User className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              {propietario.nombre}
            </span>
          </div>
          <div className="col-span-2" onClick={(e) => e.preventDefault()}>
            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Teléfono</span>
            <a 
              href={`tel:${propietario.telefono}`}
              onClick={(e) => e.stopPropagation()}
              className="font-semibold text-[#0F6E56] hover:underline flex items-center gap-1.5"
            >
              <Phone className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              {propietario.telefono}
            </a>
          </div>
        </div>
      </div>

      {/* Action link */}
      <div
        className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--accent-soft)] py-3 text-xs font-black text-[var(--accent-strong)] transition-all group-hover:bg-[var(--accent)] group-hover:text-white"
      >
        Ver Expediente Completo
        <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
      </div>
    </div>
  );
};

export default PacienteCard;
export { PacienteCard };
