import React, { useCallback, useState, useRef, useEffect } from 'react';
import { Mic, Square, AlertCircle, RefreshCw, FileText } from 'lucide-react';
import { pickSupportedAudioMime } from '../lib/audioMime';
import { getErrorMessage } from '../lib/errors';

interface AudioRecorderProps {
  onAudioRecorded: (blob: Blob) => void;
  isProcessing?: boolean;
  onManualFallback?: () => void;
}

const AudioRecorder: React.FC<AudioRecorderProps> = ({
  onAudioRecorded,
  isProcessing = false,
  onManualFallback,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  const startTimer = () => {
    setSeconds(0);
    timerRef.current = window.setInterval(() => {
      setSeconds((prev) => prev + 1);
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
    audioChunksRef.current = [];

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Tu navegador no soporta la grabación de audio.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // mimeType real soportado por ESTE navegador (webm/ogg/mp4 segun corresponda).
      const mimeType = pickSupportedAudioMime();
      const options = mimeType ? { mimeType } : undefined;
      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType || 'audio/webm' });
        onAudioRecorded(audioBlob);
        
        // Stop all tracks to release microphone
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start(250); // Capture data chunks every 250ms
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

  return (
    <div className="flex flex-col items-center justify-center p-6 bg-white border border-slate-100 rounded-2xl shadow-sm max-w-md mx-auto">
      <h3 className="text-lg font-bold text-slate-800 mb-2">Grabar Consulta</h3>
      <p className="text-sm text-slate-500 text-center mb-6">
        Graba el audio de la consulta con el dueño de la mascota. Al finalizar, la IA transcribirá y estructurará la nota SOAP de forma automática.
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
        <div className="flex flex-col items-center gap-4">
          {/* Pulsing visual indicator */}
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
            Grabando Audio...
          </span>
        </div>
      ) : isProcessing ? (
        <div className="flex flex-col items-center gap-4 py-3">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#0F6E56]/10 text-[#0F6E56]">
            <RefreshCw className="h-8 w-8 animate-spin" />
          </div>
          <div className="text-center">
            <div className="text-sm font-bold text-slate-800">Procesando audio con IA...</div>
            <div className="text-xs text-slate-500 mt-1">Transcribiendo y estructurando SOAP. Puede demorar unos segundos.</div>
          </div>
        </div>
      ) : (
        <button
          onClick={startRecording}
          disabled={isProcessing}
          className="flex h-16 w-16 items-center justify-center rounded-full bg-[#0F6E56] hover:bg-[#0c5945] text-white shadow-lg shadow-[#0F6E56]/20 transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
          title="Iniciar grabación"
        >
          <Mic className="h-7 w-7" />
        </button>
      )}

      {!isRecording && !isProcessing && (
        <div className="mt-4 flex flex-col items-center gap-3">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
            Hacer clic para iniciar
          </span>
          {onManualFallback && (
            <button
              type="button"
              onClick={onManualFallback}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 transition hover:border-[#0F6E56] hover:text-[#0F6E56]"
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
