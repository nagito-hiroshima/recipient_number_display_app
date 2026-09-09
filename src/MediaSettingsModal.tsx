import React from 'react';

interface MediaSettingsModalProps {
  bgmVolume: number;
  announcementVolume: number;
  volumeLocked: boolean;
  busy: boolean;
  onChange: (patch: { volume?: number; announcementVolume?: number; volumeLocked?: boolean }) => void;
  onClose: () => void;
}

const clamp = (value: number) => Math.max(0, Math.min(1, Math.round(value * 100) / 100));

interface VolumeControlProps {
  title: string;
  description: string;
  value: number;
  busy: boolean;
  locked: boolean;
  onChange: (value: number) => void;
}

const VolumeControl: React.FC<VolumeControlProps> = ({
  title,
  description,
  value,
  busy,
  locked,
  onChange,
}) => {
  const percent = Math.round(value * 100);
  const presets = [0, 0.25, 0.5, 0.75, 1];

  return (
    <section style={styles.volumeSection}>
      <div style={styles.sectionHeader}>
        <div>
          <h3 style={styles.sectionTitle}>{title}</h3>
          <p style={styles.sectionDescription}>{description}</p>
        </div>
        <div style={styles.valueBadge}>{percent}%</div>
      </div>

      <div style={styles.adjustRow}>
        <button
          type="button"
          className="kp-btn"
          style={styles.adjustButton}
          disabled={busy || locked || value <= 0}
          onClick={() => onChange(clamp(value - 0.1))}
        >
          −10%
        </button>
        <button
          type="button"
          className="kp-btn"
          style={styles.adjustButton}
          disabled={busy || locked || value >= 1}
          onClick={() => onChange(clamp(value + 0.1))}
        >
          ＋10%
        </button>
      </div>

      <div style={styles.presetRow}>
        {presets.map((preset) => (
          <button
            key={preset}
            type="button"
            className="kp-btn"
            style={{
              ...styles.presetButton,
              ...(Math.abs(value - preset) < 0.001 ? styles.presetButtonActive : {}),
            }}
            disabled={busy || locked}
            onClick={() => onChange(preset)}
          >
            {preset === 0 ? '消音' : `${Math.round(preset * 100)}%`}
          </button>
        ))}
      </div>
    </section>
  );
};

export const MediaSettingsModal: React.FC<MediaSettingsModalProps> = ({
  bgmVolume,
  announcementVolume,
  volumeLocked,
  busy,
  onChange,
  onClose,
}) => {
  return (
    <div style={styles.overlay} role="presentation" onClick={onClose}>
      <div
        style={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-label="BGM・アナウンス詳細設定"
        onClick={(event) => event.stopPropagation()}
      >
        <div style={styles.modalHeader}>
          <div>
            <div style={styles.eyebrow}>AUDIO SETTINGS</div>
            <h2 style={styles.modalTitle}>BGM・アナウンス詳細設定</h2>
          </div>
          <button type="button" className="kp-btn" style={styles.closeButton} onClick={onClose}>✕</button>
        </div>

        <button
          type="button"
          className="kp-btn"
          style={{ ...styles.lockButton, ...(volumeLocked ? styles.lockButtonActive : {}) }}
          disabled={busy}
          onClick={() => onChange({ volumeLocked: !volumeLocked })}
        >
          <span style={styles.lockIcon}>{volumeLocked ? '🔒' : '🔓'}</span>
          <span>
            <strong>{volumeLocked ? '音量ロック中' : '音量ロック解除中'}</strong>
            <small style={styles.lockHelp}>
              {volumeLocked ? '誤操作防止のため音量変更を禁止しています' : 'BGM・アナウンス音量を変更できます'}
            </small>
          </span>
        </button>

        <VolumeControl
          title="BGM音量"
          description="MVの通常再生音量です。アナウンス中はここから自動的に小さくなります。"
          value={bgmVolume}
          busy={busy}
          locked={volumeLocked}
          onChange={(volume) => onChange({ volume })}
        />

        <VolumeControl
          title="アナウンス音量"
          description="呼び出しチャイムと番号読み上げの音量です。"
          value={announcementVolume}
          busy={busy}
          locked={volumeLocked}
          onChange={(value) => onChange({ announcementVolume: value })}
        />

        <div style={styles.footerNote}>設定は /display にリアルタイム反映され、サーバー再起動後も保持されます。</div>
      </div>
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  overlay: {
    position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '22px', backgroundColor: 'rgba(2,6,23,0.72)', backdropFilter: 'blur(4px)',
  },
  modal: {
    width: 'min(720px, 96vw)', maxHeight: '92vh', overflowY: 'auto', padding: '22px', borderRadius: '22px',
    backgroundColor: '#fff', color: '#0f172a', boxShadow: '0 24px 80px rgba(0,0,0,0.38)',
  },
  modalHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '18px', marginBottom: '16px' },
  eyebrow: { fontSize: '10px', fontWeight: 900, letterSpacing: '0.18em', color: '#64748b' },
  modalTitle: { margin: '3px 0 0', fontSize: '24px', fontWeight: 900 },
  closeButton: { width: '50px', height: '50px', borderRadius: '14px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', fontSize: '20px', fontWeight: 900, cursor: 'pointer' },
  lockButton: {
    width: '100%', minHeight: '68px', marginBottom: '16px', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '12px',
    textAlign: 'left', borderRadius: '16px', border: '2px solid #cbd5e1', backgroundColor: '#f8fafc', color: '#334155', cursor: 'pointer',
  },
  lockButtonActive: { borderColor: '#f59e0b', backgroundColor: '#fffbeb', color: '#92400e' },
  lockIcon: { fontSize: '28px' },
  lockHelp: { display: 'block', marginTop: '3px', fontSize: '12px', fontWeight: 700, opacity: 0.78 },
  volumeSection: { padding: '16px', marginTop: '14px', border: '1px solid #e2e8f0', borderRadius: '18px', backgroundColor: '#f8fafc' },
  sectionHeader: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '14px' },
  sectionTitle: { margin: 0, fontSize: '19px', fontWeight: 900 },
  sectionDescription: { margin: '4px 0 0', color: '#64748b', fontSize: '12px', fontWeight: 600, lineHeight: 1.45 },
  valueBadge: { minWidth: '76px', padding: '10px 12px', borderRadius: '12px', textAlign: 'center', backgroundColor: '#0f172a', color: '#fff', fontSize: '20px', fontWeight: 900, fontVariantNumeric: 'tabular-nums' },
  adjustRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '14px' },
  adjustButton: { minHeight: '54px', borderRadius: '14px', border: '1px solid #94a3b8', backgroundColor: '#fff', color: '#0f172a', fontSize: '17px', fontWeight: 900, cursor: 'pointer' },
  presetRow: { display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: '8px', marginTop: '10px' },
  presetButton: { minHeight: '48px', borderRadius: '12px', border: '1px solid #cbd5e1', backgroundColor: '#fff', color: '#334155', fontSize: '13px', fontWeight: 900, cursor: 'pointer' },
  presetButtonActive: { backgroundColor: '#dbeafe', color: '#1d4ed8', borderColor: '#60a5fa' },
  footerNote: { marginTop: '16px', paddingTop: '12px', borderTop: '1px solid #e2e8f0', color: '#64748b', fontSize: '11px', fontWeight: 700, textAlign: 'center' },
};
