import React, { useCallback, useState, useRef, useEffect } from 'react';
import { Mic, Square, AlertCircle, RefreshCw, FileText, CheckCircle } from 'lucide-react';
import { pickSupportedAudioMime } from '../lib/audioMime';
import { getErrorMessage } from '../lib/errors';

interface AudioRecorderProps {
  onAudioRecorded: (blobs: Blob[]) => void;
  isProcessing?: boolean;
  onManualFallback?: () => void;
}

const BLOQUE_MAX_MS = 15 * 60 * 1000;
const BLOQUE_AVISO_MS = 12 * 60 * 1000;

const AudioRecorder: React.FC<AudioRecorderProps> = ({
  onAudioRecorded,
  isProcessing = false,
  onManualFallback,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const [segments, setSegments] = useState<Blob[]>([]);
  const [segmentDurations, setSegmentDurations] = useState<number[]>([]);
  const [isBlockClosed, setIsBlockClosed] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  // Espejo de `seconds` en un ref: onstop es un closure y `seconds` quedaria viejo;
  // leemos secondsRef.current para registrar la duracion REAL del bloque al cerrarlo.
  const secondsRef = useRef(0);

  const maxSeconds = BLOQUE_MAX_MS / 1000;
  const avisoSeconds = BLOQUE_AVISO_MS / 1000;

  const startTimer = () => {
    setSeconds(0);
    secondsRef.current = 0;
    timerRef.current = window.setInterval(() => {
      setSeconds((prev) => {
        const next = prev + 1;
        secondsRef.current = next;
        return next;
      });
    }, 1000);
  };

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      stopTimer();
    };
  }, [stopTimer]);

  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const startRecording = async () => {
    setError(null);
    setIsBlockClosed(false);
    audioChunksRef.current = [];

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Tu navegador no soporta la grabación de audio.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
      });

      const mimeType = pickSupportedAudioMime();
      const VOICE_BITRATE = 32_000;
      const options: MediaRecorderOptions = mimeType
        ? { mimeType, audioBitsPerSecond: VOICE_BITRATE }
        : { audioBitsPerSecond: VOICE_BITRATE };
      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType || 'audio/webm' });
        setSegments((prev) => [...prev, audioBlob]);
        setSegmentDurations((prev) => [...prev, secondsRef.current]);
        setIsBlockClosed(true);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start(250);
      setIsRecording(true);
      startTimer();
    } catch (err: unknown) {
      console.error('Microphone error:', err);
      onManualFallback?.();
      setError(getErrorMessage(err, 'No se pudo acceder al micrófono. Por favor otorga los permisos necesarios.'));
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      stopTimer();
    }
  };

  // Auto cut off block when max seconds is reached
  useEffect(() => {
    if (isRecording && seconds >= maxSeconds) {
      stopRecording();
    }
  }, [seconds, isRecording, maxSeconds]);

  const handleFinish = () => {
    if (segments.length > 0) {
      onAudioRecorded(segments);
    }
  };

  const currentBlockNum = segments.length + (isRecording ? 1 : 0);

  return (
    <div className="flex flex-col items-center justify-center p-6 bg-white border border-slate-100 rounded-2xl shadow-sm max-w-md mx-auto w-full">
      <h3 className="text-lg font-bold text-slate-800 mb-2">Grabar Consulta</h3>
      <p className="text-sm text-slate-500 text-center mb-6">
        Graba el audio de la consulta en bloques de hasta 15 minutos. Al finalizar, la IA unirá y estructurará la nota SOAP.
      </p>

      {error && (
        <div className="mb-4 flex w-full flex-col gap-3 rounded-lg bg-red-50 p-3 text-xs text-red-700">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
          {onManualFallback && (
            <button
              type="button"
              onClick={onManualFallback}
              className="inline-flex w-fit items-center gap-2 rounded-lg bg-white px-3 py-2 text-xs font-bold text-red-700 ring-1 ring-red-100 transition hover:bg-red-100"
            >
              <FileText className="h-4 w-4" />
              Usar consulta manual
            </button>
          )}
        </div>
      )}

      {isRecording ? (
        <div className="flex flex-col items-center gap-4 w-full">
          <div className="relative flex items-center justify-center h-20 w-20">
            <span className="absolute animate-ping inline-flex h-16 w-16 rounded-full bg-red-400 opacity-30"></span>
            <button
              onClick={stopRecording}
              className="relative flex items-center justify-center h-16 w-16 rounded-full bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-600/20 transition-transform active:scale-95"
              title="Detener grabación"
            >
              <Square className="h-6 w-6 fill-white" />
            </button>
          </div>
          
          <div className="text-2xl font-bold text-slate-800 tracking-wider">
            {formatTime(seconds)}
          </div>
          
          <span className="text-xs font-semibold text-red-500 uppercase tracking-widest animate-pulse">
            Grabando Bloque {currentBlockNum}...
          </span>

          {seconds >= avisoSeconds && (
            <div className="text-amber-700 bg-amber-50 border border-amber-100 rounded-lg p-2 text-xs font-semibold text-center w-full animate-pulse">
              Faltan 3 min para cerrar el bloque (máx 15 min)
            </div>
          )}
        </div>
      ) : isProcessing ? (
        <div className="flex flex-col items-center gap-4 py-3">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent/10 text-accent">
            <RefreshCw className="h-8 w-8 animate-spin" />
          </div>
          <div className="text-center">
            <div className="text-sm font-bold text-slate-800">Procesando audio con IA...</div>
            <div className="text-xs text-slate-500 mt-1">Transcribiendo y estructurando SOAP. Puede demorar unos segundos.</div>
          </div>
        </div>
      ) : isBlockClosed ? (
        <div className="flex flex-col items-center gap-4 w-full">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
            <CheckCircle className="h-6 w-6" />
          </div>
          <div className="text-center">
            <div className="text-sm font-bold text-slate-800">
              Bloque {segments.length} grabado ({formatTime(segmentDurations[segments.length - 1] ?? 0)})
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Puedes grabar otro bloque si la consulta continúa, o finalizar y procesar todo.
            </p>
          </div>

          <div className="flex flex-col gap-2 w-full mt-2">
            <button
              onClick={startRecording}
              className="w-full inline-flex justify-center items-center gap-2 rounded-lg bg-slate-100 hover:bg-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 transition"
            >
              Grabar siguiente bloque
            </button>
            <button
              onClick={handleFinish}
              className="w-full inline-flex justify-center items-center gap-2 rounded-lg bg-accent hover:bg-accent-strong px-4 py-2.5 text-sm font-bold text-white transition shadow-lg shadow-accent/10"
            >
              Finalizar y procesar
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={startRecording}
          disabled={isProcessing}
          className="flex h-16 w-16 items-center justify-center rounded-full bg-accent hover:bg-accent-strong text-white shadow-lg shadow-accent/20 transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
          title="Iniciar grabación"
        >
          <Mic className="h-7 w-7" />
        </button>
      )}

      {/* List of recorded blocks */}
      {segments.length > 0 && !isProcessing && (
        <div className="w-full mt-6 pt-4 border-t border-slate-100">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Bloques grabados:</h4>
          <ul className="space-y-1.5 w-full max-h-36 overflow-y-auto">
            {segments.map((_, index) => (
              <li key={index} className="flex justify-between items-center text-xs text-slate-600 bg-slate-50 border border-slate-100 rounded-lg p-2.5">
                <span className="font-semibold text-slate-700">Bloque {index + 1}</span>
                <span className="font-mono text-slate-500">{formatTime(segmentDurations[index] ?? 0)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!isRecording && !isProcessing && !isBlockClosed && (
        <div className="mt-4 flex flex-col items-center gap-3">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
            Hacer clic para iniciar
          </span>
          {onManualFallback && (
            <button
              type="button"
              onClick={onManualFallback}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 transition hover:border-accent hover:text-accent"
            >
              <FileText className="h-4 w-4" />
              Consulta manual
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default AudioRecorder;
export { AudioRecorder };
