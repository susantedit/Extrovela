import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle, Sparkles, X } from 'lucide-react';
import { triggerHaptic } from '../lib/native-device';

export type AlertType = 'info' | 'success' | 'warning' | 'danger' | 'error';

export interface AlertOptions {
  title?: string;
  message: string;
  type?: AlertType;
  buttonText?: string;
  onConfirm?: () => void;
}

export interface ConfirmOptions {
  title?: string;
  message: string;
  type?: AlertType;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
}

export interface ToastOptions {
  message: string;
  type?: AlertType;
  duration?: number;
}

interface ToastItem extends ToastOptions {
  id: string;
}

interface CustomAlertContextType {
  showAlert: (options: AlertOptions | string) => void;
  showConfirm: (options: ConfirmOptions | string) => Promise<boolean>;
  showToast: (options: ToastOptions | string) => void;
}

const CustomAlertContext = createContext<CustomAlertContextType | undefined>(undefined);

export const CustomAlertProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Alert dialog state
  const [alertState, setAlertState] = useState<{
    isOpen: boolean;
    title?: string;
    message: string;
    type: AlertType;
    buttonText: string;
    onConfirm?: () => void;
  }>({
    isOpen: false,
    message: '',
    type: 'info',
    buttonText: 'Got It',
  });

  // Confirm dialog state
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    title?: string;
    message: string;
    type: AlertType;
    confirmText: string;
    cancelText: string;
    destructive?: boolean;
  }>({
    isOpen: false,
    message: '',
    type: 'warning',
    confirmText: 'Confirm',
    cancelText: 'Cancel',
  });

  const confirmResolverRef = useRef<((value: boolean) => void) | null>(null);

  // Toast notifications state
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showAlert = useCallback((options: AlertOptions | string) => {
    triggerHaptic('light');
    if (typeof options === 'string') {
      setAlertState({
        isOpen: true,
        message: options,
        type: 'info',
        buttonText: 'Got It',
      });
    } else {
      setAlertState({
        isOpen: true,
        title: options.title,
        message: options.message,
        type: options.type || 'info',
        buttonText: options.buttonText || 'Got It',
        onConfirm: options.onConfirm,
      });
    }
  }, []);

  const showConfirm = useCallback((options: ConfirmOptions | string): Promise<boolean> => {
    triggerHaptic('medium');
    return new Promise(resolve => {
      confirmResolverRef.current = resolve;
      if (typeof options === 'string') {
        setConfirmState({
          isOpen: true,
          message: options,
          type: 'warning',
          confirmText: 'Confirm',
          cancelText: 'Cancel',
          destructive: false,
        });
      } else {
        setConfirmState({
          isOpen: true,
          title: options.title,
          message: options.message,
          type: options.type || (options.destructive ? 'danger' : 'warning'),
          confirmText: options.confirmText || 'Confirm',
          cancelText: options.cancelText || 'Cancel',
          destructive: options.destructive,
        });
      }
    });
  }, []);

  const showToast = useCallback((options: ToastOptions | string) => {
    triggerHaptic('light');
    const id = `toast_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const toast: ToastItem = typeof options === 'string'
      ? { id, message: options, type: 'info', duration: 3500 }
      : { id, message: options.message, type: options.type || 'info', duration: options.duration || 3500 };

    setToasts(prev => [...prev, toast]);

    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, toast.duration);
  }, []);

  const handleCloseAlert = () => {
    triggerHaptic('light');
    if (alertState.onConfirm) {
      alertState.onConfirm();
    }
    setAlertState(prev => ({ ...prev, isOpen: false }));
  };

  const handleConfirmResolve = (result: boolean) => {
    triggerHaptic(result ? 'medium' : 'light');
    if (confirmResolverRef.current) {
      confirmResolverRef.current(result);
      confirmResolverRef.current = null;
    }
    setConfirmState(prev => ({ ...prev, isOpen: false }));
  };

  const getIcon = (type: AlertType) => {
    switch (type) {
      case 'success':
        return <CheckCircle2 style={{ width: 28, height: 28, color: '#10B981' }} />;
      case 'warning':
        return <AlertTriangle style={{ width: 28, height: 28, color: '#F59E0B' }} />;
      case 'danger':
      case 'error':
        return <AlertCircle style={{ width: 28, height: 28, color: '#EF4444' }} />;
      case 'info':
      default:
        return <Sparkles style={{ width: 28, height: 28, color: 'var(--color-accent)' }} />;
    }
  };

  return (
    <CustomAlertContext.Provider value={{ showAlert, showConfirm, showToast }}>
      {children}

      {/* Custom Alert Modal */}
      {alertState.isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="modal-overlay"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            backgroundColor: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
          onClick={handleCloseAlert}
        >
          <div
            className="animate-slide-up"
            style={{
              width: '100%',
              maxWidth: 420,
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 24,
              padding: '28px 24px',
              boxShadow: '0 20px 48px rgba(0, 0, 0, 0.4)',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 16,
            }}
            onClick={e => e.stopPropagation()}
          >
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                backgroundColor: 'var(--color-surface-elevated)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
              }}
            >
              {getIcon(alertState.type)}
            </div>

            {alertState.title && (
              <h3
                style={{
                  fontSize: 18,
                  fontWeight: 800,
                  color: 'var(--color-text)',
                  margin: 0,
                }}
              >
                {alertState.title}
              </h3>
            )}

            <p
              style={{
                fontSize: 14,
                lineHeight: 1.6,
                color: 'var(--color-text-secondary)',
                margin: 0,
              }}
            >
              {alertState.message}
            </p>

            <button
              type="button"
              className="btn btn-primary"
              onClick={handleCloseAlert}
              style={{
                width: '100%',
                justifyContent: 'center',
                padding: '12px 20px',
                borderRadius: 14,
                fontWeight: 700,
                marginTop: 8,
              }}
            >
              {alertState.buttonText}
            </button>
          </div>
        </div>
      )}

      {/* Custom Confirmation Modal */}
      {confirmState.isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="modal-overlay"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            backgroundColor: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
          onClick={() => handleConfirmResolve(false)}
        >
          <div
            className="animate-slide-up"
            style={{
              width: '100%',
              maxWidth: 420,
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 24,
              padding: '28px 24px',
              boxShadow: '0 20px 48px rgba(0, 0, 0, 0.4)',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 16,
            }}
            onClick={e => e.stopPropagation()}
          >
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                backgroundColor: 'var(--color-surface-elevated)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
              }}
            >
              {getIcon(confirmState.type)}
            </div>

            <h3
              style={{
                fontSize: 18,
                fontWeight: 800,
                color: 'var(--color-text)',
                margin: 0,
              }}
            >
              {confirmState.title || (confirmState.destructive ? 'Confirm Deletion' : 'Confirm Action')}
            </h3>

            <p
              style={{
                fontSize: 14,
                lineHeight: 1.6,
                color: 'var(--color-text-secondary)',
                margin: 0,
              }}
            >
              {confirmState.message}
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, width: '100%', marginTop: 8 }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => handleConfirmResolve(false)}
                style={{
                  justifyContent: 'center',
                  padding: '12px 16px',
                  borderRadius: 14,
                  fontWeight: 600,
                }}
              >
                {confirmState.cancelText}
              </button>

              <button
                type="button"
                className="btn"
                onClick={() => handleConfirmResolve(true)}
                style={{
                  justifyContent: 'center',
                  padding: '12px 16px',
                  borderRadius: 14,
                  fontWeight: 700,
                  backgroundColor: confirmState.destructive || confirmState.type === 'danger' ? '#EF4444' : 'var(--color-accent)',
                  color: confirmState.destructive || confirmState.type === 'danger' ? '#FFFFFF' : '#08090D',
                }}
              >
                {confirmState.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Toast Container */}
      <div
        style={{
          position: 'fixed',
          top: 20,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 10000,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 8,
          pointerEvents: 'none',
          maxWidth: '90vw',
          width: 380,
        }}
      >
        {toasts.map(toast => (
          <div
            key={toast.id}
            className="animate-slide-down"
            style={{
              pointerEvents: 'auto',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '12px 16px',
              borderRadius: 16,
              backgroundColor: 'var(--color-surface-elevated)',
              border: '1px solid var(--color-border)',
              boxShadow: '0 8px 30px rgba(0,0,0,0.3)',
              color: 'var(--color-text)',
              fontSize: 13,
              fontWeight: 600,
              width: '100%',
            }}
          >
            {getIcon(toast.type || 'info')}
            <span style={{ flex: 1, lineHeight: 1.4 }}>{toast.message}</span>
            <button
              type="button"
              className="btn-icon"
              onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
              style={{ width: 22, height: 22, padding: 0 }}
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </CustomAlertContext.Provider>
  );
};

export const useCustomAlert = (): CustomAlertContextType => {
  const context = useContext(CustomAlertContext);
  if (!context) {
    throw new Error('useCustomAlert must be used within a CustomAlertProvider');
  }
  return context;
};
