import React, { useEffect, useState } from 'react';

interface ApiKeyModalProps {
  value: string;
  onSave: (value: string) => void;
  onClose: () => void;
}

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ value, onSave, onClose }) => {
  const [draft, setDraft] = useState(value);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setDraft(value);
    setVisible(false);
  }, [value]);

  const trimmed = draft.trim();
  const isExisting = value.trim().length > 0;

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!trimmed) return;
    onSave(trimmed);
  };

  return (
    <div style={styles.overlay} role="presentation" onClick={onClose}>
      <form
        style={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-label="APIキー設定"
        onClick={(event) => event.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <div style={styles.header}>
          <div>
            <div style={styles.eyebrow}>AUTHENTICATION</div>
            <h2 style={styles.title}>APIキー{isExisting ? '変更' : '登録'}</h2>
          </div>
          <button type="button" className="kp-btn" style={styles.closeButton} onClick={onClose}>✕</button>
        </div>

        <p style={styles.description}>
          デモ操作・再呼び出し・BGM設定などに使用します。この端末のブラウザ内に保存されます。
        </p>

        <label style={styles.label} htmlFor="api-key-modal-input">APIキー</label>
        <div style={styles.inputRow}>
          <input
            id="api-key-modal-input"
            className="text-input"
            type={visible ? 'text' : 'password'}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="APIキーを入力"
            autoComplete="off"
            autoFocus
            style={styles.input}
          />
          <button
            type="button"
            className="kp-btn"
            style={styles.revealButton}
            onClick={() => setVisible((current) => !current)}
          >
            {visible ? '🙈 隠す' : '👁 表示'}
          </button>
        </div>

        {isExisting && (
          <div style={styles.currentStatus}>
            <span style={styles.statusDot}>●</span>
            現在APIキーが登録されています。値を確認する場合は「表示」を押してください。
          </div>
        )}

        <div style={styles.actions}>
          <button type="button" className="kp-btn" style={styles.cancelButton} onClick={onClose}>キャンセル</button>
          <button type="submit" className="kp-btn" style={styles.saveButton} disabled={!trimmed}>
            {isExisting ? '変更を保存' : 'APIキーを登録'}
          </button>
        </div>
      </form>
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  overlay: {
    position: 'fixed', inset: 0, zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '20px', backgroundColor: 'rgba(2,6,23,0.72)', backdropFilter: 'blur(4px)',
  },
  modal: {
    width: 'min(620px, 96vw)', padding: '22px', borderRadius: '22px', backgroundColor: '#fff', color: '#0f172a',
    boxShadow: '0 24px 80px rgba(0,0,0,0.38)',
  },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' },
  eyebrow: { fontSize: '10px', fontWeight: 900, letterSpacing: '0.18em', color: '#64748b' },
  title: { margin: '3px 0 0', fontSize: '24px', fontWeight: 900 },
  closeButton: { width: '48px', height: '48px', borderRadius: '14px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', fontSize: '18px', fontWeight: 900, cursor: 'pointer' },
  description: { margin: '16px 0', color: '#64748b', fontSize: '13px', fontWeight: 650, lineHeight: 1.55 },
  label: { display: 'block', marginBottom: '7px', fontSize: '13px', fontWeight: 900 },
  inputRow: { display: 'flex', gap: '9px', alignItems: 'stretch' },
  input: { flex: 1, minWidth: 0, padding: '13px 14px', border: '2px solid #cbd5e1', borderRadius: '13px', fontSize: '16px', fontFamily: 'monospace', outline: 'none' },
  revealButton: { minWidth: '96px', padding: '10px 13px', borderRadius: '13px', border: '1px solid #94a3b8', backgroundColor: '#f8fafc', color: '#0f172a', fontSize: '13px', fontWeight: 900, cursor: 'pointer' },
  currentStatus: { marginTop: '11px', padding: '10px 12px', borderRadius: '12px', backgroundColor: '#f0fdf4', color: '#166534', fontSize: '12px', fontWeight: 750, lineHeight: 1.45 },
  statusDot: { marginRight: '7px', color: '#16a34a' },
  actions: { display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: '10px', marginTop: '20px' },
  cancelButton: { minHeight: '50px', borderRadius: '13px', border: '1px solid #cbd5e1', backgroundColor: '#fff', color: '#334155', fontSize: '14px', fontWeight: 900, cursor: 'pointer' },
  saveButton: { minHeight: '50px', borderRadius: '13px', border: 'none', backgroundColor: '#2563eb', color: '#fff', fontSize: '14px', fontWeight: 900, cursor: 'pointer' },
};
