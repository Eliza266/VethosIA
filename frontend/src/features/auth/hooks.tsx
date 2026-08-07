import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { User as FirebaseUser } from 'firebase/auth';
import {
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  sendEmailVerification,
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, googleProvider, db } from '../../lib/firebase';
import { toDate } from '../../lib/mappers';
import { setAuthErrorHandler, requestFreshIdToken } from '../../lib/apiClient';
import { isAxiosError } from 'axios';
import { stripUndefinedFields } from '../../lib/firestoreData';
import { getFeatureFlags } from '../../lib/featureFlags';
import { obtenerMe } from '../tenant/api';
import { meQueryKey, meQueryKeyRoot } from '../tenant/queryKeys';
import { displayUserLabel } from '../../lib/displayUser';
import type { Veterinario } from '../../types';

interface AuthContextType {
  user: Veterinario | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  accessDeniedMessage: string | null;
  loginWithGoogle: () => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  registerWithEmail: (email: string, password: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  // Usados por la pagina de registro publico (/registro): mientras el uid nuevo
  // todavia no tiene veterinaria/membresia asignada, /v1/me responderia 403 por la
  // whitelist y onAuthStateChanged cerraria la sesion solo. Estas dos funciones
  // pausan ese chequeo automatico mientras la pagina de registro aprovisiona la
  // cuenta via POST /v1/registro.
  beginSelfRegistration: () => Promise<import('firebase/auth').UserCredential>;
  beginSelfRegistrationWithGoogle: () => Promise<import('firebase/auth').UserCredential>;
  finishSelfRegistration: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const MSG_DENEGADO = 'Tu cuenta no tiene acceso a Vethos AI. Contacta al administrador.';
const MSG_NO_VERIFICABLE =
  'No pudimos verificar tu acceso en este momento. Intenta de nuevo más tarde o contacta al administrador.';

const mapMeToVeterinario = (me: Awaited<ReturnType<typeof obtenerMe>>): Veterinario => ({
  uid: me.uid,
  nombre: displayUserLabel({ nombre: me.nombre, email: me.email }),
  email: me.email ?? '',
  foto: me.foto ?? undefined,
  telefono: me.telefono ?? undefined,
  whatsapp: me.whatsapp ?? undefined,
  ciudad: me.ciudad ?? undefined,
  sede: me.sede ?? undefined,
  veterinaria: me.veterinaria ?? undefined,
  matriculaProfesional: me.matriculaProfesional ?? undefined,
  creadoEn: new Date(),
});

const vetFromFirebaseUser = (fUser: FirebaseUser): Veterinario => ({
  uid: fUser.uid,
  nombre: fUser.displayName || 'Veterinario',
  email: fUser.email || '',
  foto: fUser.photoURL || undefined,
  creadoEn: new Date(),
});

const apiErrorMessage = (error: unknown): string | null => {
  if (!isAxiosError(error)) return null;
  const raw = error.response?.data?.message;
  if (typeof raw === 'string') return raw;
  if (Array.isArray(raw) && typeof raw[0] === 'string') return raw[0];
  return null;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = useQueryClient();
  const previousUidRef = useRef<string | null>(null);
  const suppressAutoMeFetchRef = useRef(false);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [user, setUser] = useState<Veterinario | null>(null);
  const [loading, setLoading] = useState(true);
  const [accessDeniedMessage, setAccessDeniedMessage] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fUser) => {
      setLoading(true);
      setAccessDeniedMessage(null);

      if (!fUser) {
        previousUidRef.current = null;
        queryClient.removeQueries({ queryKey: meQueryKeyRoot });
        setFirebaseUser(null);
        setUser(null);
        setLoading(false);
        return;
      }

      const uidChanged = previousUidRef.current !== fUser.uid;
      previousUidRef.current = fUser.uid;

      if (uidChanged) {
        setUser(null);
        requestFreshIdToken();
        await fUser.getIdToken(true);
        queryClient.removeQueries({ queryKey: meQueryKeyRoot });
      }

      setFirebaseUser(fUser);

      if (suppressAutoMeFetchRef.current) {
        // La pagina de registro publico esta aprovisionando la cuenta (POST
        // /v1/registro); todavia no hay veterinaria/membresia asignada, asi que
        // /v1/me responderia 403 y este efecto cerraria la sesion. Se espera a
        // que la pagina llame finishSelfRegistration().
        setLoading(false);
        return;
      }

      if (getFeatureFlags().useApiCRUD) {
        try {
          const me = await obtenerMe();
          queryClient.setQueryData(meQueryKey(me.uid), me);
          setUser(mapMeToVeterinario(me));
        } catch (error) {
          if (isAxiosError(error)) {
            const status = error.response?.status;
            if (status === 403) {
              setAccessDeniedMessage(apiErrorMessage(error) ?? MSG_DENEGADO);
              await signOut(auth);
              setFirebaseUser(null);
              setUser(null);
              setLoading(false);
              return;
            }
            if (status === 503) {
              setAccessDeniedMessage(apiErrorMessage(error) ?? MSG_NO_VERIFICABLE);
              await signOut(auth);
              setFirebaseUser(null);
              setUser(null);
              setLoading(false);
              return;
            }
          }
          console.error('Error cargando perfil vía /v1/me:', error);
          setUser(vetFromFirebaseUser(fUser));
        }
        setLoading(false);
        return;
      }

      // ── Verificacion de acceso (whitelist) legacy Firestore ──
      // OJO: esto es FAIL-CLOSED. Antes, si la lectura de la whitelist tiraba error
      // se dejaba pasar igual (fail-open "para dev"), lo cual es justo lo que un
      // atacante quiere. Ahora: si no podemos VERIFICAR el acceso, negamos.
      // Las reglas de verdad viven server-side (firestore.rules / API); esto es solo
      // una primera barrera de UX.
      try {
        const accesoSnap = await getDoc(doc(db, 'configuracion', 'acceso'));

        if (accesoSnap.exists()) {
          const data = accesoSnap.data();
          const emailsPermitidos: string[] = data.emailsPermitidos || [];
          // lista vacia = whitelist no configurada (no es un fallo de verificacion):
          // se permite entrar. Lista con elementos = se exige pertenecer.
          if (emailsPermitidos.length > 0 && !emailsPermitidos.includes(fUser.email || '')) {
            setAccessDeniedMessage(MSG_DENEGADO);
            await signOut(auth);
            setFirebaseUser(null);
            setUser(null);
            setLoading(false);
            return;
          }
        }
        // doc inexistente = sin whitelist configurada -> se permite (single-tenant inicial)
      } catch (error) {
        console.error('Error verificando whitelist de acceso:', error);
        // No pudimos leer la config: NO sabemos si tiene acceso => denegamos.
        setAccessDeniedMessage(MSG_NO_VERIFICABLE);
        await signOut(auth);
        setFirebaseUser(null);
        setUser(null);
        setLoading(false);
        return;
      }

      // ── Carga/creacion del doc de veterinario (legacy) ──
      const vetDocRef = doc(db, 'veterinarios', fUser.uid);
      try {
        const vetDocSnap = await getDoc(vetDocRef);
        if (vetDocSnap.exists()) {
          const data = vetDocSnap.data();
          setUser({
            uid: data.uid,
            nombre: data.nombre,
            email: data.email,
            foto: data.foto,
            creadoEn: toDate(data.creadoEn),
          });
        } else {
          const newVet: Veterinario = {
            uid: fUser.uid,
            nombre: fUser.displayName || 'Veterinario',
            email: fUser.email || '',
            foto: fUser.photoURL || undefined,
            creadoEn: new Date(),
          };
          await setDoc(vetDocRef, stripUndefinedFields(newVet));
          setUser(newVet);
        }
      } catch (error) {
        console.error('Error obteniendo/creando el registro de veterinario:', error);
        // El acceso YA quedo verificado arriba; aca solo cargamos el perfil. Si
        // Firestore falla, damos un estado minimo basado en Auth (no es un agujero
        // de seguridad: la identidad ya esta validada por Firebase Auth).
        setUser(vetFromFirebaseUser(fUser));
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [queryClient]);

  // Si la API responde 401 (sesion invalida/expirada), cerramos sesion para forzar
  // re-login. El 403 (sin permisos) no cierra sesion: es un problema de rol, no de identidad.
  useEffect(() => {
    setAuthErrorHandler((detail) => {
      if (detail.status === 401) {
        void signOut(auth);
      }
    });
    return () => setAuthErrorHandler(null);
  }, []);

  const refreshMeAfterSignIn = async (fUser: FirebaseUser) => {
    requestFreshIdToken();
    await fUser.getIdToken(true);
    await queryClient.invalidateQueries({ queryKey: meQueryKeyRoot });
  };

  const loginWithGoogle = async () => {
    setLoading(true);
    setAccessDeniedMessage(null);
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      await refreshMeAfterSignIn(cred.user);
    } catch (error) {
      console.error('Error logging in with Google:', error);
      setLoading(false);
      throw error;
    }
  };

  // Email + contraseña (PDF 07.A). El check de whitelist/perfil lo hace onAuthStateChanged.
  const loginWithEmail = async (email: string, password: string) => {
    setLoading(true);
    setAccessDeniedMessage(null);
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      await refreshMeAfterSignIn(cred.user);
    } catch (error) {
      setLoading(false);
      throw error;
    }
  };

  // Registro con verificacion de email (envia correo de verificacion).
  const registerWithEmail = async (email: string, password: string) => {
    setLoading(true);
    setAccessDeniedMessage(null);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      if (cred.user && !cred.user.emailVerified) {
        await sendEmailVerification(cred.user);
      }
    } catch (error) {
      setLoading(false);
      throw error;
    }
  };

  const resetPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  };

  const beginSelfRegistration = async (email: string, password: string) => {
    suppressAutoMeFetchRef.current = true;
    setLoading(true);
    setAccessDeniedMessage(null);
    try {
      return await createUserWithEmailAndPassword(auth, email, password);
    } catch (error) {
      suppressAutoMeFetchRef.current = false;
      setLoading(false);
      throw error;
    }
  };

  const beginSelfRegistrationWithGoogle = async () => {
    suppressAutoMeFetchRef.current = true;
    setLoading(true);
    setAccessDeniedMessage(null);
    try {
      return await signInWithPopup(auth, googleProvider);
    } catch (error) {
      suppressAutoMeFetchRef.current = false;
      setLoading(false);
      throw error;
    }
  };

  const finishSelfRegistration = async () => {
    suppressAutoMeFetchRef.current = false;
    const fUser = auth.currentUser;
    if (fUser) await refreshMeAfterSignIn(fUser);
    setLoading(false);
  };

  const logout = async () => {
    setLoading(true);
    try {
      queryClient.removeQueries({ queryKey: meQueryKeyRoot });
      setUser(null);
      setFirebaseUser(null);
      await signOut(auth);
    } catch (error) {
      console.error('Error logging out:', error);
      setLoading(false);
      throw error;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        firebaseUser,
        loading,
        accessDeniedMessage,
        loginWithGoogle,
        loginWithEmail,
        registerWithEmail,
        resetPassword,
        logout,
        beginSelfRegistration,
        beginSelfRegistrationWithGoogle,
        finishSelfRegistration,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth debe ser utilizado dentro de un AuthProvider');
  }
  return context;
};
