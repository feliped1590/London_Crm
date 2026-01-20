import { useState, useEffect, useCallback, useRef, useMemo } from 'react';

interface SpeechRecognitionEvent {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent {
  error: string;
  message?: string;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

interface UseSpeechToTextReturn {
  transcript: string;
  isListening: boolean;
  isSupported: boolean;
  startListening: () => void;
  stopListening: () => void;
  resetTranscript: () => void;
  error: string | null;
}

export const useSpeechToText = (): UseSpeechToTextReturn => {
  const [transcript, setTranscript] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const finalTranscriptRef = useRef('');
  const isManualStopRef = useRef(false);
  const isListeningRef = useRef(false);

  const isSupported = useMemo(() => {
    return typeof window !== 'undefined' && 
      ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);
  }, []);

  useEffect(() => {
    if (!isSupported) return;

    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognitionAPI();

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'pt-BR';

    recognition.onstart = () => {
      setIsListening(true);
      isListeningRef.current = true;
      setError(null);
    };

    recognition.onend = () => {
      // Se não foi parada manual e ainda deveria estar gravando, reinicia
      if (!isManualStopRef.current && isListeningRef.current) {
        try {
          recognition.start();
        } catch (err) {
          setIsListening(false);
          isListeningRef.current = false;
        }
      } else {
        setIsListening(false);
        isListeningRef.current = false;
      }
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          // Resultado final: adiciona ao texto acumulado
          finalTranscriptRef.current += result[0].transcript;
        } else {
          // Resultado intermediário: apenas mostra temporariamente
          interimTranscript += result[0].transcript;
        }
      }

      // O transcript exibido é: texto final acumulado + texto intermediário atual
      setTranscript(finalTranscriptRef.current + interimTranscript);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      setIsListening(false);
      
      switch (event.error) {
        case 'not-allowed':
          setError('Permissão de microfone negada. Habilite nas configurações do navegador.');
          break;
        case 'no-speech':
          setError('Nenhuma fala detectada. Tente novamente.');
          break;
        case 'network':
          setError('Erro de rede. Verifique sua conexão.');
          break;
        case 'aborted':
          // User aborted, no need to show error
          break;
        default:
          setError(`Erro no reconhecimento de voz: ${event.error}`);
      }
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, [isSupported]);

  const startListening = useCallback(() => {
    if (!recognitionRef.current || isListening) return;
    
    isManualStopRef.current = false;
    setTranscript('');
    finalTranscriptRef.current = '';
    setError(null);
    
    try {
      recognitionRef.current.start();
    } catch (err) {
      // Recognition might already be started
      console.error('Error starting speech recognition:', err);
    }
  }, [isListening]);

  const stopListening = useCallback(() => {
    if (!recognitionRef.current || !isListening) return;
    
    isManualStopRef.current = true;
    
    try {
      recognitionRef.current.stop();
    } catch (err) {
      console.error('Error stopping speech recognition:', err);
    }
  }, [isListening]);

  const resetTranscript = useCallback(() => {
    setTranscript('');
    finalTranscriptRef.current = '';
    setError(null);
  }, []);

  return {
    transcript,
    isListening,
    isSupported,
    startListening,
    stopListening,
    resetTranscript,
    error,
  };
};
