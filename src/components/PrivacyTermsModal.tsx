import React, { useState } from 'react';
import { ShieldCheck, Lock, Trash2, X, Check, ExternalLink } from 'lucide-react';
import { triggerHaptic } from '../lib/native-device';

interface PrivacyTermsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onWipeData: () => void;
}

export const PrivacyTermsModal: React.FC<PrivacyTermsModalProps> = ({ isOpen, onClose, onWipeData }) => {
  const [activeTab, setActiveTab] = useState<'privacy' | 'terms'>('privacy');
  const [confirmWipe, setConfirmWipe] = useState(false);

  if (!isOpen) return null;

  const handleWipe = () => {
    triggerHaptic('warning');
    if (!confirmWipe) {
      setConfirmWipe(true);
    } else {
      onWipeData();
      setConfirmWipe(false);
      onClose();
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-card animate-slide-up" style={{ maxWidth: 640 }}>
        {/* Header */}
        <div className="modal-header">
          <div className="flex items-center gap-8">
            <ShieldCheck style={{ width: 20, height: 20, color: 'var(--accent-lime)' }} />
            <h3 className="font-display">Legal, Privacy & Data Control</h3>
          </div>
          <button className="btn-icon" onClick={onClose} style={{ padding: 8 }}>
            <X style={{ width: 18, height: 18 }} />
          </button>
        </div>

        {/* Tab switch */}
        <div className="flex gap-8 mb-20">
          <button
            className={`chip flex-1 ${activeTab === 'privacy' ? 'selected selected-lime' : ''}`}
            onClick={() => setActiveTab('privacy')}
            style={{ textAlign: 'center' }}
          >
            Privacy Policy
          </button>
          <button
            className={`chip flex-1 ${activeTab === 'terms' ? 'selected selected-lime' : ''}`}
            onClick={() => setActiveTab('terms')}
            style={{ textAlign: 'center' }}
          >
            Terms of Service
          </button>
        </div>

        {/* Content Area */}
        <div
          style={{
            maxHeight: 280,
            overflowY: 'auto',
            background: 'var(--bg-glass)',
            padding: 16,
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-glass)',
            fontSize: 13,
            lineHeight: 1.65,
            color: 'var(--text-secondary)',
            marginBottom: 24,
          }}
        >
          {activeTab === 'privacy' ? (
            <div>
              <h4 className="font-display text-primary mb-8" style={{ fontSize: 15 }}>1. Zero-Knowledge Privacy Commitment</h4>
              <p className="mb-12">
                EXTROVELA is built on the philosophy of privacy. Your personal reflections, photos, and voice notes are stored securely on your device. We do not sell your personal experience data to third parties.
              </p>
              <h4 className="font-display text-primary mb-8" style={{ fontSize: 15 }}>2. Location & GPS Usage</h4>
              <p className="mb-12">
                Location data is used solely on-device to reveal your exploration Fog of War map and contextualize nearby viewpoints and experiences. Exact coordinate history is never publicly shared.
              </p>
              <h4 className="font-display text-primary mb-8" style={{ fontSize: 15 }}>3. Camera & Microphone Permissions</h4>
              <p className="mb-12">
                The camera and microphone are accessed only when you explicitly tap to take a memory photo or record an audio note.
              </p>
              <h4 className="font-display text-primary mb-8" style={{ fontSize: 15 }}>4. Right to Erasure (App Store 5.1.1)</h4>
              <p>
                You hold 100% control over your data. You may permanently erase all memories, streak history, and preferences at any time using the one-click wipe button below.
              </p>
            </div>
          ) : (
            <div>
              <h4 className="font-display text-primary mb-8" style={{ fontSize: 15 }}>1. Acceptance of Terms</h4>
              <p className="mb-12">
                By accessing or using EXTROVELA, you agree to participate in real-world experiences responsibly, mindfully, and safely.
              </p>
              <h4 className="font-display text-primary mb-8" style={{ fontSize: 15 }}>2. Personal Safety & Real-World Discretion</h4>
              <p className="mb-12">
                EXTROVELA quests are suggestions for exploration. You are solely responsible for ensuring your physical safety, respecting local laws, private property boundaries, and situational weather conditions.
              </p>
              <h4 className="font-display text-primary mb-8" style={{ fontSize: 15 }}>3. Anti-Productivity Philosophy</h4>
              <p>
                EXTROVELA is designed for personal presence and real-world connection, not competitive gamification or digital distraction.
              </p>
            </div>
          )}
        </div>

        {/* Mandatory App Store Data Wipe & Account Reset */}
        <div style={{ padding: 16, borderRadius: 'var(--radius-md)', background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.25)', marginBottom: 20 }}>
          <div className="flex items-center justify-between" style={{ flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h4 className="font-display" style={{ fontSize: 14, color: 'var(--accent-sunset)' }}>Data Control & Reset</h4>
              <p className="text-secondary text-xs">Permanently erase all local memories, streaks, and cache.</p>
            </div>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleWipe}
              style={{ background: 'var(--accent-sunset)', fontSize: 11, padding: '8px 14px' }}
            >
              <Trash2 style={{ width: 13, height: 13 }} />
              <span>{confirmWipe ? 'Confirm: Wipe Everything' : 'Wipe All Data'}</span>
            </button>
          </div>
        </div>

        {/* Close */}
        <div className="flex justify-end">
          <button className="btn btn-glass" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
