// Barrel de componentes/infra reutilizables entre features. Por ahora reexporta
// lo que vive en components/ (no movimos los archivos fisicamente para no romper
// los imports relativos de las pages). Codigo nuevo: importar desde '@/shared'
// (o ruta relativa a shared/) en vez de cavar en components/.
export { default as Layout } from '../components/Layout';
export { default as Navbar } from '../components/Navbar';
export { default as ProtectedRoute } from '../components/ProtectedRoute';
export { default as AudioRecorder } from '../components/AudioRecorder';
export { default as SoapViewer } from '../components/SoapViewer';
export { default as PacienteCard } from '../components/PacienteCard';
