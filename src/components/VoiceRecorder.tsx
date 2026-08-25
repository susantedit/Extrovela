import React, { useState, useRef } from 'react';
import { Mic, Square, Play, Pause, Trash2, Check } from 'lucide-react';
import { triggerHaptic } from '../lib/native-device';
import { useCustomAlert } from '../context/CustomAlertContext';

interface VoiceRecorderProps {
  onAudioSaved: (audioBase64: string) => void;
  maxSeconds?: number;
}

export const VoiceRecorder: React.FC<VoiceRecorderProps> = ({ onAudioSaved, maxSeconds = 15 }) => {
  const { showAlert } = useCustomAlert();
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  const startRecording = async () => {
    try {
      triggerHaptic('medium');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = e => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          const base64data = reader.result as string;
          setAudioUrl(base64data);
          onAudioSaved(base64data);
        };

        // Stop all track streams
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);

      timerRef.current = setInterval(() => {
        setRecordingSeconds(prev => {
          if (prev >= maxSeconds - 1) {
            stopRecording();
            return maxSeconds;
          }
          return prev + 1;
        });
      }, 1000);
    } catch {
      showAlert({
        title: 'Microphone Permission Required',
        message: 'Please allow microphone access in your browser or device settings to record ambient sound notes.',
        type: 'warning',
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      triggerHaptic('success');
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(timerRef.current);
    }
  };

  const handlePlayPause = () => {
    if (!audioPlayerRef.current || !audioUrl) return;
    triggerHaptic('light');

    if (isPlaying) {
      audioPlayerRef.current.pause();
      setIsPlaying(false);
    } else {
      audioPlayerRef.current.play();
      setIsPlaying(true);
    }
  };

  const resetRecording = () => {
    triggerHaptic('light');
    setAudioUrl(null);
    setIsPlaying(false);
    setRecordingSeconds(0);
    onAudioSaved('');
  };

  return (
    <div
      style={{
        padding: 16,
        borderRadius: 16,
        backgroundColor: 'rgba(255, 255, 255, 0.04)',
        border: '1px solid var(--color-border)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 12,
      }}
    >
      {!audioUrl ? (
        <div style={{ textAlign: 'center', width: '100%' }}>
          <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 8, fontFamily: 'monospace' }}>
            {isRecording ? `RECORDING AMBIENT SOUND (00:${recordingSeconds < 10 ? '0' : ''}${recordingSeconds} / 00:${maxSeconds})` : 'RECORD 15s AMBIENT VOICE REFLECTION'}
          </div>

          <button
            onClick={isRecording ? stopRecording : startRecording}
            style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              backgroundColor: isRecording ? '#EF4444' : 'var(--color-accent)',
              border: 'none',
              color: isRecording ? '#FFF' : '#171813',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto',
              cursor: 'pointer',
              boxShadow: isRecording ? '0 0 20px rgba(239, 68, 68, 0.5)' : '0 4px 12px rgba(201, 154, 69, 0.3)',
              transition: 'transform 0.15s ease',
            }}
            title={isRecording ? 'Stop Recording' : 'Start Recording'}
          >
            {isRecording ? <Square size={24} /> : <Mic size={24} />}
          </button>
        </div>
      ) : (
        <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <audio
            ref={audioPlayerRef}
            src={audioUrl}
            onEnded={() => setIsPlaying(false)}
            style={{ display: 'none' }}
          />

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={handlePlayPause}
              style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                backgroundColor: 'var(--color-primary)',
                border: 'none',
                color: 'var(--color-text-inverse)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              {isPlaying ? <Pause size={18} /> : <Play size={18} />}
            </button>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-success)', fontFamily: 'monospace' }}>
              ✓ AMBIENT VOICE NOTE CAPTURED
            </span>
          </div>

          <button
            onClick={resetRecording}
            style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', padding: 4 }}
            title="Re-record"
          >
            <Trash2 size={16} />
          </button>
        </div>
      )}
    </div>
  );
};

export default VoiceRecorder;
