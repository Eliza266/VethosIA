import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { usePacientes } from '../hooks/usePacientes';
import { useAuth } from '../hooks/useAuth';
import { useMe } from '../features/tenant/hooks';
import { storage } from '../services/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { buildPatientPhotoStoragePath } from '../lib/patientPhotoStorage';
import type { Paciente, Propietario } from '../types';
import { Save, AlertCircle } from 'lucide-react';
import { PageHeader } from '../components/ui/Primitives';

const NuevosPaciente: React.FC = () => {
  const { agregarPaciente, actualizarPaciente, error: apiError } = usePacientes();
  const { user } = useAuth();
  const { data: me } = useMe();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    nombre: '',
    especie: 'perro' as Paciente['especie'],
    raza: '',
    fechaNacimiento: '',
    sexo: 'macho' as Paciente['sexo'],
    estadoReproductivo: 'entero' as Paciente['estadoReproductivo'],
    notasGenerales: '',
    color: '',
    chip: '',
    propietarioNombre: '',
    propietarioTelefono: '',
    propietarioWhatsapp: '',
    propietarioEmail: '',
  });

  const [fotoFile, setFotoFile] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);

  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleFotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setFotoFile(file);
      setFotoPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Validate inputs
    if (!form.nombre.trim()) {
      setFormError('El nombre de la mascota es obligatorio.');
      return;
    }
    if (!form.propietarioNombre.trim()) {
      setFormError('El nombre del propietario es obligatorio.');
      return;
    }
    if (!form.propietarioTelefono.trim()) {
      setFormError('El teléfono del propietario es obligatorio.');
      return;
    }

    setIsSubmitting(true);

    const propietario: Propietario = {
      nombre: form.propietarioNombre.trim(),
      telefono: form.propietarioTelefono.trim(),
      email: form.propietarioEmail.trim() || undefined,
      whatsapp: form.propietarioWhatsapp.trim() || undefined,
    };

    const nuevoPaciente: Omit<Paciente, 'veterinarioId' | 'creadoEn'> = {
      nombre: form.nombre.trim(),
      especie: form.especie,
      raza: form.raza.trim() || undefined,
      fechaNacimiento: form.fechaNacimiento || undefined,
      sexo: form.sexo,
      estadoReproductivo: form.estadoReproductivo,
      propietario,
      notasGenerales: form.notasGenerales.trim() || undefined,
      color: form.color.trim() || undefined,
      chip: form.chip.trim() || undefined,
    };

    try {
      const docId = await agregarPaciente(nuevoPaciente);
      if (docId) {
        if (fotoFile && user) {
          const orgId = me?.orgId;
          if (!orgId) {
            setFormError(
              'No se pudo subir la foto: tu cuenta no tiene organización asignada. El paciente se guardó sin imagen.',
            );
            navigate(`/pacientes/${docId}`);
            return;
          }
          const fotoPath = buildPatientPhotoStoragePath(orgId, docId, fotoFile);
          const storageRef = ref(storage, fotoPath);
          const uploadResult = await uploadBytes(storageRef, fotoFile);
          const fotoUrl = await getDownloadURL(uploadResult.ref);
          const fotoGuardada = await actualizarPaciente(docId, { foto: fotoUrl });
          if (!fotoGuardada) {
            setFormError(
              'La foto se subió pero no se pudo guardar en el expediente. Intenta editar el paciente más tarde.',
            );
            return;
          }
        }
        navigate(`/pacientes/${docId}`);
      } else {
        setFormError('No se pudo guardar el paciente. Verifica tu conexión.');
      }
    } catch (err) {
      console.error('Error submitting form:', err);
      setFormError('Ocurrió un error inesperado al registrar el paciente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      <PageHeader
        breadcrumbs={[{ label: 'Pacientes', to: '/pacientes' }, { label: 'Nuevo paciente' }]}
        title="Nuevo Paciente"
        description="Crea el expediente clínico de un nuevo paciente."
      />

      {/* Error Displays */}
      {(formError || apiError) && (
        <div className="flex items-start gap-2 bg-red-50 text-red-700 text-sm p-4 rounded-xl border border-red-100">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <span>{formError || apiError}</span>
        </div>
      )}

      {/* Main Form */}
      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left Side: Pet Profile */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-5">
          <h2 className="text-base font-bold text-slate-800 border-b border-slate-50 pb-2 flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-teal-50 text-xs text-accent">🐾</span>
            Datos del Paciente
          </h2>

          <div className="space-y-4">
            {/* Photo upload */}
            <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <div className="h-16 w-16 rounded-full bg-accent/5 border border-accent/10 flex items-center justify-center overflow-hidden shrink-0">
                {fotoPreview ? (
                  <img src={fotoPreview} alt="Mascota" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-2xl">📸</span>
                )}
              </div>
              <div className="space-y-1">
                <span className="block text-xs font-bold text-slate-700">Foto del Paciente</span>
                <label className="inline-block px-3 py-1.5 bg-white border border-slate-200 hover:border-slate-300 text-slate-600 hover:text-slate-800 text-[11px] font-bold rounded-lg cursor-pointer transition-all">
                  Subir Imagen
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFotoChange}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            <div>
              <label htmlFor="nombre" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                Nombre de la Mascota <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="nombre"
                name="nombre"
                value={form.nombre}
                onChange={handleChange}
                placeholder="Ej. Firulais, Lola"
                className="w-full px-3.5 py-2.5 text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-xl focus:border-accent focus:ring-1 focus:ring-accent focus:bg-white outline-none transition-all"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="especie" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  Especie
                </label>
                <select
                  id="especie"
                  name="especie"
                  value={form.especie}
                  onChange={handleChange}
                  className="w-full px-3 py-2.5 text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-xl focus:border-accent focus:ring-1 focus:ring-accent focus:bg-white outline-none transition-all"
                >
                  <option value="perro">🐶 Perro</option>
                  <option value="gato">🐱 Gato</option>
                  <option value="ave">🦜 Ave</option>
                  <option value="reptil">🦎 Reptil</option>
                  <option value="otro">🐾 Otro</option>
                </select>
              </div>

              <div>
                <label htmlFor="raza" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  Raza
                </label>
                <input
                  type="text"
                  id="raza"
                  name="raza"
                  value={form.raza}
                  onChange={handleChange}
                  placeholder="Ej. Golden, Mestizo"
                  className="w-full px-3.5 py-2.5 text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-xl focus:border-accent focus:ring-1 focus:ring-accent focus:bg-white outline-none transition-all"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="color" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  Color / Pelaje
                </label>
                <input
                  type="text"
                  id="color"
                  name="color"
                  value={form.color}
                  onChange={handleChange}
                  placeholder="Ej. Blanco y negro, Atigrado"
                  className="w-full px-3.5 py-2.5 text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-xl focus:border-accent focus:ring-1 focus:ring-accent focus:bg-white outline-none transition-all"
                />
              </div>

              <div>
                <label htmlFor="chip" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  N° de Chip (Opcional)
                </label>
                <input
                  type="text"
                  id="chip"
                  name="chip"
                  value={form.chip}
                  onChange={handleChange}
                  placeholder="Ej. 981020000..."
                  className="w-full px-3.5 py-2.5 text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-xl focus:border-accent focus:ring-1 focus:ring-accent focus:bg-white outline-none transition-all"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="sexo" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  Sexo
                </label>
                <select
                  id="sexo"
                  name="sexo"
                  value={form.sexo}
                  onChange={handleChange}
                  className="w-full px-3 py-2.5 text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-xl focus:border-accent focus:ring-1 focus:ring-accent focus:bg-white outline-none transition-all"
                >
                  <option value="macho">Macho</option>
                  <option value="hembra">Hembra</option>
                </select>
              </div>

              <div>
                <label htmlFor="estadoReproductivo" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  ¿Castrado?
                </label>
                <select
                  id="estadoReproductivo"
                  name="estadoReproductivo"
                  value={form.estadoReproductivo === 'entero' ? 'entero' : 'esterilizado'}
                  onChange={handleChange}
                  className="w-full px-3 py-2.5 text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-xl focus:border-accent focus:ring-1 focus:ring-accent focus:bg-white outline-none transition-all"
                >
                  <option value="esterilizado">Sí</option>
                  <option value="entero">No</option>
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="fechaNacimiento" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                Fecha de Nacimiento
              </label>
              <input
                type="date"
                id="fechaNacimiento"
                name="fechaNacimiento"
                value={form.fechaNacimiento}
                onChange={handleChange}
                className="w-full px-3.5 py-2.5 text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-xl focus:border-accent focus:ring-1 focus:ring-accent focus:bg-white outline-none transition-all"
              />
            </div>

            <div>
              <label htmlFor="notasGenerales" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                Notas Generales / Alergias
              </label>
              <textarea
                id="notasGenerales"
                name="notasGenerales"
                value={form.notasGenerales}
                onChange={handleChange}
                rows={3}
                placeholder="Alergias conocidas, condiciones previas, etc."
                className="w-full px-3.5 py-2.5 text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-xl focus:border-accent focus:ring-1 focus:ring-accent focus:bg-white outline-none transition-all resize-none"
              />
            </div>
          </div>
        </div>

        {/* Right Side: Owner Profile */}
        <div className="flex flex-col gap-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-5">
            <h2 className="text-base font-bold text-slate-800 border-b border-slate-50 pb-2 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-50 text-xs text-indigo-600">👤</span>
              Datos del Propietario
            </h2>

            <div className="space-y-4">
              <div>
                <label htmlFor="propietarioNombre" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  Nombre Completo <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="propietarioNombre"
                  name="propietarioNombre"
                  value={form.propietarioNombre}
                  onChange={handleChange}
                  placeholder="Ej. Juan Pérez"
                  className="w-full px-3.5 py-2.5 text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-xl focus:border-accent focus:ring-1 focus:ring-accent focus:bg-white outline-none transition-all"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="propietarioTelefono" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                    Teléfono <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    id="propietarioTelefono"
                    name="propietarioTelefono"
                    value={form.propietarioTelefono}
                    onChange={handleChange}
                    placeholder="Ej. 3001234567"
                    className="w-full px-3.5 py-2.5 text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-xl focus:border-accent focus:ring-1 focus:ring-accent focus:bg-white outline-none transition-all"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="propietarioWhatsapp" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                    WhatsApp (Opcional)
                  </label>
                  <input
                    type="tel"
                    id="propietarioWhatsapp"
                    name="propietarioWhatsapp"
                    value={form.propietarioWhatsapp}
                    onChange={handleChange}
                    placeholder="Ej. 3001234567"
                    className="w-full px-3.5 py-2.5 text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-xl focus:border-accent focus:ring-1 focus:ring-accent focus:bg-white outline-none transition-all"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="propietarioEmail" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  Correo Electrónico (Opcional)
                </label>
                <input
                  type="email"
                  id="propietarioEmail"
                  name="propietarioEmail"
                  value={form.propietarioEmail}
                  onChange={handleChange}
                  placeholder="Ej. juan.perez@email.com"
                  className="w-full px-3.5 py-2.5 text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-xl focus:border-accent focus:ring-1 focus:ring-accent focus:bg-white outline-none transition-all"
                />
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-4">
            <Link
              to="/pacientes"
              className="flex-1 py-3 text-center text-sm font-bold text-slate-500 border border-slate-200 bg-white hover:bg-slate-50 rounded-xl transition-colors"
            >
              Cancelar
            </Link>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 flex items-center justify-center gap-2 py-3 text-sm font-bold text-white bg-accent hover:bg-accent-strong rounded-xl shadow-md shadow-accent/10 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {isSubmitting ? 'Guardando...' : 'Guardar Paciente'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default NuevosPaciente;
export { NuevosPaciente };
