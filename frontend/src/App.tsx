import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './hooks/useAuth';
import { AdminVetModeProvider } from './hooks/useAdminVetMode';
import ProtectedRoute from './components/ProtectedRoute';
import RoleRoute from './components/RoleRoute';
import SubscriptionRoute from './components/SubscriptionRoute';
import ClinicalRoute from './components/ClinicalRoute';
import BrigadasRoute from './components/BrigadasRoute';
import Layout from './components/Layout';
import { UIProviders } from './components/ui/Primitives';

// Cliente de TanStack Query: cache de estado-servidor para la app (reintentos suaves,
// staleTime razonable). El estado UI ligero se maneja con hooks/Zustand donde haga falta.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000, refetchOnWindowFocus: false },
  },
});

import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Pacientes from './pages/Pacientes';
import NuevosPaciente from './pages/NuevosPaciente';
import DetallePaciente from './pages/DetallePaciente';
import NuevaConsulta from './pages/NuevaConsulta';
import NuevaConsultaRapida from './pages/NuevaConsultaRapida';
import DetalleConsulta from './pages/DetalleConsulta';
import Perfil from './pages/Perfil';
import Ajustes from './pages/Ajustes';
import Agenda from './pages/Agenda';
import Vacunas from './pages/Vacunas';
import Brigadas from './pages/Brigadas';
import ComoFunciona from './pages/ComoFunciona';
import Invitacion from './pages/Invitacion';
import AdminEntidad from './pages/AdminEntidad';
import SuperAdmin from './pages/SuperAdmin';
import Suscripcion from './pages/Suscripcion';
import AdminVeterinaria from './pages/AdminVeterinaria';
import Notificaciones from './pages/Notificaciones';
import DocumentosClinicos from './pages/DocumentosClinicos';
import { NotFound } from './pages/RouteFallback';

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <UIProviders>
        <BrowserRouter>
          <AuthProvider>
            <AdminVetModeProvider>
              <Routes>
                {/* Public Routes */}
                <Route path="/login" element={<Login />} />

                {/* Protected Routes */}
                <Route element={<ProtectedRoute />}>
                  <Route element={<Layout />}>
                    <Route path="/" element={<Dashboard />} />
                    <Route element={<ClinicalRoute />}>
                      <Route path="/pacientes" element={<Pacientes />} />
                      <Route path="/pacientes/nuevo" element={<NuevosPaciente />} />
                      <Route path="/consultas/nueva-rapida" element={<NuevaConsultaRapida />} />
                      <Route path="/pacientes/:id" element={<DetallePaciente />} />
                      <Route path="/pacientes/:pacienteId/consultas/nueva" element={<NuevaConsulta />} />
                      <Route path="/pacientes/:pacienteId/consultas/:consultaId" element={<DetalleConsulta />} />
                      <Route path="/agenda" element={<Agenda />} />
                      <Route path="/vacunas" element={<Vacunas />} />
                      <Route path="/documentos" element={<DocumentosClinicos />} />
                    </Route>
                    <Route element={<BrigadasRoute />}>
                      <Route path="/brigadas" element={<Brigadas />} />
                    </Route>
                    <Route path="/perfil" element={<Perfil />} />
                    <Route path="/ajustes" element={<Ajustes />} />
                    <Route path="/notificaciones" element={<Notificaciones />} />
                    <Route path="/como-funciona" element={<ComoFunciona />} />
                    <Route path="/invitacion" element={<Invitacion />} />
                    <Route element={<SubscriptionRoute />}>
                      <Route path="/suscripcion" element={<Suscripcion />} />
                      <Route path="/mi-plan" element={<Suscripcion />} />
                      <Route path="/plan" element={<Suscripcion />} />
                    </Route>
                    {/* Dashboards por rol (guard jerarquico) */}
                    <Route element={<RoleRoute min="admin_entidad" />}>
                      <Route path="/entidad" element={<AdminEntidad />} />
                    </Route>
                    <Route element={<RoleRoute min="admin_veterinaria" />}>
                      <Route path="/veterinaria" element={<AdminVeterinaria />} />
                    </Route>
                    <Route element={<RoleRoute min="superadmin" />}>
                      <Route path="/admin" element={<SuperAdmin />} />
                      <Route path="/planes" element={<SuperAdmin />} />
                      <Route path="/suscripciones" element={<SuperAdmin />} />
                      <Route path="/auditoria" element={<SuperAdmin />} />
                      <Route path="/configuracion" element={<SuperAdmin />} />
                    </Route>
                    <Route path="*" element={<NotFound />} />
                  </Route>
                </Route>
              </Routes>
            </AdminVetModeProvider>
          </AuthProvider>
        </BrowserRouter>
      </UIProviders>
    </QueryClientProvider>
  );
}

export default App;
