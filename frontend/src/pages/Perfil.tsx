import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import { db, auth, storage } from '../services/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { updatePassword } from 'firebase/auth';
import { Phone, User, Mail, Save, CheckCircle, AlertCircle, MapPin, Building2, IdCard, MessageCircle, type LucideIcon } from 'lucide-react';
import { getErrorMessage } from '../lib/errors';
import { getFeatureFlags } from '../lib/featureFlags';
import { actualizarMe, obtenerMe } from '../features/tenant/api';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useQueryClient } from '@tanstack/react-query';

const extensionFromFile = (file: File): string => {
  const type = file.type.startsWith('image/') ? file.type.split('/')[1]?.toLowerCase() : '';
  if (type === 'jpeg') return 'jpg';
  const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'heic', 'heif']);
  if (type && IMAGE_EXTENSIONS.has(type)) return type;
  return 'jpg';
};

interface VetFields {
  nombre: string;
  telefono: string;
  whatsapp: string;
  ciudad: string;
  sede: string;
  veterinaria: string;
  matriculaProfesional: string;
  foto?: string;
}

interface VetFieldConfig {
  field: Exclude<keyof VetFields, 'nombre' | 'foto'>;
  label: string;
  Icon: LucideIcon;
  placeholder: string;
  type: React.HTMLInputTypeAttribute;
}

const CONTACT_FIELDS: VetFieldConfig[] = [
  { field: 'telefono', label: 'Teléfono', Icon: Phone, placeholder: '+57 300 123 4567', type: 'tel' },
  { field: 'whatsapp', label: 'WhatsApp', Icon: MessageCircle, placeholder: '+57 300 123 4567', type: 'tel' },
];

const CLINICAL_FIELDS: VetFieldConfig[] = [
  { field: 'veterinaria', label: 'Nombre de la Clínica / Veterinaria', Icon: Building2, placeholder: 'Ej. Clínica Veterinaria Amigos', type: 'text' },
  { field: 'sede', label: 'Sede / Sucursal', Icon: Building2, placeholder: 'Ej. Sede Norte', type: 'text' },
  { field: 'ciudad', label: 'Ciudad', Icon: MapPin, placeholder: 'Ej. Bogotá', type: 'text' },
  { field: 'matriculaProfesional', label: 'Matrícula Profesional', Icon: IdCard, placeholder: 'Ej. 12345-COL', type: 'text' },
];

const Perfil: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [fields, setFields] = useState<VetFields>({
    nombre: '',
    telefono: '',
    whatsapp: '',
    ciudad: '',
    sede: '',
    veterinaria: '',
    matriculaProfesional: '',
    foto: '',
  });
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [nuevaContrasena, setNuevaContrasena] = useState('');
  const [confirmarContrasena, setConfirmarContrasena] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [fotoFile, setFotoFile] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFotoClick = () => {
    fileInputRef.current?.click();
  };

  const handleFotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFotoFile(file);
      setFotoPreview(URL.createObjectURL(file));
    }
  };

  useEffect(() => {
    const fetchVetData = async () => {
      if (!user) return;
      try {
        if (getFeatureFlags().useApiCRUD) {
          const me = await obtenerMe();
          setIsSuperAdmin(me.rol === 'superadmin' || me.role === 'superadmin');
          setFields({
            nombre: me.nombre || '',
            telefono: me.telefono || '',
            whatsapp: me.whatsapp || '',
            ciudad: me.ciudad || '',
            sede: me.sede || '',
            veterinaria: me.veterinaria || '',
            matriculaProfesional: me.matriculaProfesional || '',
            foto: me.foto || '',
          });
        } else {
          const docRef = doc(db, 'veterinarios', user.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            setFields({
              nombre: data.nombre || user.nombre || '',
              telefono: data.telefono || '',
              whatsapp: data.whatsapp || '',
              ciudad: data.ciudad || '',
              sede: data.sede || '',
              veterinaria: data.veterinaria || '',
              matriculaProfesional: data.matriculaProfesional || '',
              foto: data.foto || user.foto || '',
            });
          } else {
            setFields({
              nombre: user.nombre || '',
              telefono: '',
              whatsapp: '',
              ciudad: '',
              sede: '',
              veterinaria: '',
              matriculaProfesional: '',
              foto: user.foto || '',
            });
          }
        }
      } catch (error) {
        console.error('Error fetching veterinarian data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchVetData();
  }, [user]);

  const handleChange = (field: keyof VetFields, value: string) => {
    setFields((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    setStatus(null);
    try {
      if (nuevaContrasena) {
        if (nuevaContrasena !== confirmarContrasena) {
          setStatus({ type: 'error', message: 'Las contraseñas no coinciden.' });
          setSaving(false);
          return;
        }
        if (nuevaContrasena.length < 6) {
          setStatus({ type: 'error', message: 'La contraseña debe tener al menos 6 caracteres.' });
          setSaving(false);
          return;
        }
        const currentUser = auth.currentUser;
        if (currentUser) {
          await updatePassword(currentUser, nuevaContrasena);
          setNuevaContrasena('');
          setConfirmarContrasena('');
        }
      }

      let currentFotoUrl = fields.foto || user.foto || null;
      if (fotoFile) {
        const ext = extensionFromFile(fotoFile);
        const storagePath = `fotos-veterinarios/${user.uid}/foto.${ext}`;
        const storageRef = ref(storage, storagePath);
        const uploadResult = await uploadBytes(storageRef, fotoFile);
        currentFotoUrl = await getDownloadURL(uploadResult.ref);
      }

      // Solo actualizamos campos de perfil si no es superadmin
      if (!isSuperAdmin) {
        const updatePayload = {
          nombre: fields.nombre.trim(),
          foto: currentFotoUrl,
          telefono: fields.telefono,
          whatsapp: fields.whatsapp,
          ciudad: fields.ciudad,
          sede: fields.sede,
          veterinaria: fields.veterinaria,
          matriculaProfesional: fields.matriculaProfesional,
        };
        if (getFeatureFlags().useApiCRUD) {
          await actualizarMe(updatePayload);
        } else {
          const docRef = doc(db, 'veterinarios', user.uid);
          await setDoc(docRef, {
            uid: user.uid,
            email: user.email,
            ...updatePayload,
          }, { merge: true });
        }
      }

      setStatus({ type: 'success', message: '¡Perfil actualizado con éxito!' });
      queryClient.invalidateQueries({ queryKey: ['me'] });
      setTimeout(() => {
        window.location.reload();
      }, 800);
    } catch (error: unknown) {
      console.error('Error saving changes:', error);
      setStatus({ type: 'error', message: getErrorMessage(error, 'Error al guardar los cambios.') });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-accent border-t-transparent"></div>
          <p className="text-sm font-semibold text-slate-500 animate-pulse">Cargando perfil...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-md mx-auto text-center py-12 bg-white rounded-2xl border border-slate-100 p-8 shadow-sm">
        <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <h3 className="text-lg font-bold text-slate-800 mb-2">Usuario no autenticado</h3>
        <p className="text-sm text-slate-500 mb-6">Inicia sesión para ver tu perfil.</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in py-6">
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        {/* Header background decoration */}
        <div className="h-32 bg-gradient-to-r from-accent to-[#148F70]"></div>
        
        <div className="p-8 pt-0 relative">
          {/* Avatar positioning */}
          <div className="flex flex-col sm:flex-row items-center sm:items-end gap-5 -mt-16 mb-8">
            <div className="relative group">
              {fotoPreview || fields.foto || user.foto ? (
                <img
                  src={fotoPreview || fields.foto || user.foto || undefined}
                  alt={fields.nombre || user.nombre}
                  className="h-28 w-28 rounded-full object-cover ring-4 ring-white shadow-md bg-white"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="flex h-28 w-28 items-center justify-center rounded-full bg-slate-100 text-slate-400 ring-4 ring-white shadow-md">
                  <User className="h-12 w-12" />
                </div>
              )}
              {!isSuperAdmin && (
                <button
                  type="button"
                  onClick={handleFotoClick}
                  className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer animate-fade-in"
                  title="Cambiar foto de perfil"
                >
                  <span className="text-xs font-bold">Cambiar</span>
                </button>
              )}
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFotoChange}
                accept="image/*"
                className="hidden"
              />
            </div>
            <div className="text-center sm:text-left pb-1">
              <h1 className="text-2xl font-extrabold text-slate-800">{fields.nombre || user.nombre}</h1>
              <p className="text-sm font-semibold text-accent">
                {isSuperAdmin ? 'Super Administrador' : 'Médico Veterinario'}
              </p>
              {!isSuperAdmin && fields.matriculaProfesional && (
                <p className="text-xs text-slate-400 mt-0.5">Mat. Prof. {fields.matriculaProfesional}</p>
              )}
            </div>
          </div>

          {status && (
            <div className={`flex items-start gap-2.5 p-4 rounded-xl text-sm mb-6 ${
              status.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-100' : 'bg-red-50 text-red-800 border border-red-100'
            }`}>
              {status.type === 'success' ? <CheckCircle className="h-5 w-5 shrink-0" /> : <AlertCircle className="h-5 w-5 shrink-0" />}
              <span className="font-medium">{status.message}</span>
            </div>
          )}

          <form onSubmit={handleSave} className="space-y-6">
            {/* Identity */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Nombre Completo</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <User className="h-4 w-4" />
                  </div>
                  <input
                    type="text"
                    value={isSuperAdmin ? user.nombre : fields.nombre}
                    disabled={isSuperAdmin}
                    onChange={(e) => handleChange('nombre', e.target.value)}
                    required={!isSuperAdmin}
                    className={`block w-full pl-10 pr-3 py-2.5 border rounded-xl text-sm outline-none transition-shadow ${
                      isSuperAdmin
                        ? 'bg-slate-50 border border-slate-200 text-slate-500 cursor-not-allowed'
                        : 'border-slate-200 text-slate-800 focus:border-accent focus:ring-1 focus:ring-accent'
                    }`}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Correo Electrónico</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Mail className="h-4 w-4" />
                  </div>
                  <input type="email" value={user.email} disabled
                    className="block w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-500 cursor-not-allowed outline-none" />
                </div>
              </div>
            </div>

            {isSuperAdmin ? (
              /* Cambiar Contraseña */
              <div className="border-t border-slate-100 pt-5">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Cambiar Contraseña</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Nueva Contraseña</label>
                    <input
                      type="password"
                      placeholder="Mínimo 6 caracteres"
                      value={nuevaContrasena}
                      onChange={(e) => setNuevaContrasena(e.target.value)}
                      className="block w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-shadow"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Confirmar Nueva Contraseña</label>
                    <input
                      type="password"
                      placeholder="Repite la contraseña"
                      value={confirmarContrasena}
                      onChange={(e) => setConfirmarContrasena(e.target.value)}
                      className="block w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-shadow"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <>
                {/* Divider */}
                <div className="border-t border-slate-100 pt-5">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Información de Contacto</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    {CONTACT_FIELDS.map(({ field, label, Icon, placeholder, type }) => (
                      <div key={field}>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">{label}</label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                            <Icon className="h-4 w-4" />
                          </div>
                          <input
                            type={type}
                            placeholder={placeholder}
                            value={fields[field]}
                            onChange={(e) => handleChange(field as keyof VetFields, e.target.value)}
                            className="block w-full pl-10 pr-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-shadow"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Clinical Info */}
                <div className="border-t border-slate-100 pt-5">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Información Clínica</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    {CLINICAL_FIELDS.map(({ field, label, Icon, placeholder, type }) => (
                      <div key={field}>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">{label}</label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                            <Icon className="h-4 w-4" />
                          </div>
                          <input
                            type={type}
                            placeholder={placeholder}
                            value={fields[field]}
                            onChange={(e) => handleChange(field as keyof VetFields, e.target.value)}
                            className="block w-full pl-10 pr-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-shadow"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            <div className="flex justify-end pt-4">
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 rounded-xl bg-accent hover:bg-accent-strong px-5 py-3 text-sm font-bold text-white shadow-md shadow-accent/10 transition-all disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                {saving ? 'Guardando cambios...' : 'Guardar cambios'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Perfil;
export { Perfil };
