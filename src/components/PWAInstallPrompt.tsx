import React, { useState, useEffect } from 'react';
import { Download, X, Smartphone } from 'lucide-react';
import { triggerHaptic } from '../lib/native-device';

export const PWAInstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);

      // Check if user already dismissed in this session
      const dismissed = sessionStorage.getItem('extrovela_pwa_dismissed');
      if (!dismissed) {
        setIsVisible(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    triggerHaptic('success');
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsVisible(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    triggerHaptic('light');
    sessionStorage.setItem('extrovela_pwa_dismissed', 'true');
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div
      className="animate-slide-up"
      style={{
        position: 'fixed',
        bottom: 84,
        left: 20,
        right: 20,
        maxWidth: 420,
        margin: '0 auto',
        zIndex: 990,
        backgroundColor: 'rgba(23, 24, 19, 0.95)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(201, 154, 69, 0.4)',
        borderRadius: 20,
        padding: '14px 18px',
        boxShadow: '0 16px 40px rgba(0,0,0,0.6)',
        color: '#F6F1E7',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            backgroundColor: 'rgba(201, 154, 69, 0.2)',
            border: '1px solid #C99A45',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#C99A45',
            flexShrink: 0,
          }}
        >
          <Smartphone size={20} />
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#F6F1E7' }}>Install EXTROVELA App</div>
          <div style={{ fontSize: 11, color: 'rgba(246, 241, 231, 0.7)' }}>Add to your Home Screen for instant offline access.</div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        <button
          onClick={handleInstall}
          style={{
            backgroundColor: 'var(--color-accent)',
            color: '#171813',
            border: 'none',
            borderRadius: 10,
            padding: '8px 14px',
            fontSize: 12,
            fontWeight: 800,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <Download size={14} />
          <span>INSTALL</span>
        </button>

        <button
          onClick={handleDismiss}
          style={{ background: 'none', border: 'none', color: 'rgba(246, 241, 231, 0.5)', cursor: 'pointer', padding: 6 }}
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
};

export default PWAInstallPrompt;
