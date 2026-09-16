import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';

const API_KEY_STORAGE_KEY = 'apiToken';
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

type ProjectionKind = 'none' | 'text' | 'image';
type ProjectionTheme = 'prepare' | 'sale' | 'closed' | 'info';

interface ProjectionState {
  active: boolean;
  kind: ProjectionKind;
  title: string;
  subtitle: string;
  imageDataUrl: string | null;
  theme: ProjectionTheme;
  updatedAt: string | null;
}

const EMPTY_PROJECTION: ProjectionState = {
  active: false,
  kind: 'none',
  title: '',
  subtitle: '',
  imageDataUrl: null,
  theme: 'info',
  updatedAt: null,
};

const PRESETS: Array<{ title: string; subtitle: string; theme: ProjectionTheme; icon: string }> = [
  { title: '準備中', subtitle: 'ただいま営業開始に向けて準備しております', theme: 'prepare', icon: '🛠️' },
  { title: 'タイムセール中', subtitle: 'ただいまお得なタイムセールを実施中！', theme: 'sale', icon: '🔥' },
  { title: '本日終了', subtitle: '本日の営業は終了しました。ありがとうございました。', theme: 'closed', icon: '🌙' },
];

function getSocketUrl(): string {
  const isLocalVite =
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') &&
    window.location.port === '5173';
  return isLocalVite ? 'http://localhost:3000' : window.location.origin;
}

export const ProjectionRuntime: React.FC = () => {
  const location = useLocation();
  const [projection, setProjection] = useState<ProjectionState>(EMPTY_PROJECTION);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customTitle, setCustomTitle] = useState('');
  const [customSubtitle, setCustomSubtitle] = useState('');
  const [customTheme, setCustomTheme] = useState<ProjectionTheme>('info');
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [imageName, setImageName] = useState('');

  useEffect(() => {
    let socket: Socket | null = null;
    let cancelled = false;

    fetch('/api/projection/status')
      .then((response) => response.json())
      .then((data) => {
        if (!cancelled) setProjection(data as ProjectionState);
      })
      .catch((err) => console.warn('Projection status could not be loaded:', err));

    socket = io(getSocketUrl(), {
      reconnection: true,
      reconnectionAttempts: Infinity,
      transports: ['websocket', 'polling'],
    });
    socket.on('projection:status', (data: ProjectionState) => {
      setProjection(data);
      setError(null);
    });

    return () => {
      cancelled = true;
      socket?.close();
    };
  }, []);

  const themeStyle = useMemo(() => {
    switch (projection.theme) {
      case 'prepare':
        return { background: 'linear-gradient(135deg, #451a03 0%, #92400e 48%, #f59e0b 100%)', accent: '#fde68a' };
      case 'sale':
        return { background: 'linear-gradient(135deg, #7f1d1d 0%, #dc2626 52%, #f97316 100%)', accent: '#ffedd5' };
      case 'closed':
        return { background: 'linear-gradient(135deg, #020617 0%, #1e293b 52%, #475569 100%)', accent: '#cbd5e1' };
      default:
        return { background: 'linear-gradient(135deg, #172554 0%, #1d4ed8 52%, #0ea5e9 100%)', accent: '#dbeafe' };
    }
  }, [projection.theme]);

  const authenticatedRequest = async (path: string, body?: unknown) => {
    const token = localStorage.getItem(API_KEY_STORAGE_KEY)?.trim() || '';
    if (!token) {
      throw new Error('APIキーが未登録です。先に / の「APIキー登録」から登録してください。');
    }

    const response = await fetch(path, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || '投影操作に失敗しました');
    return data as ProjectionState;
  };

  const showText = async (title: string, subtitle: string, theme: ProjectionTheme) => {
    setBusy(true);
    setError(null);
    try {
      const data = await authenticatedRequest('/api/projection/show', {
        kind: 'text',
        title,
        subtitle,
        theme,
      });
      setProjection(data);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : '投影操作に失敗しました');
    } finally {
      setBusy(false);
    }
  };

  const showImage = async () => {
    if (!imageDataUrl) return;
    setBusy(true);
    setError(null);
    try {
      const data = await authenticatedRequest('/api/projection/show', {
        kind: 'image',
        imageDataUrl,
        title: imageName,
        theme: 'info',
      });
      setProjection(data);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : '画像の投影に失敗しました');
    } finally {
      setBusy(false);
    }
  };

  const clearProjection = async () => {
    setBusy(true);
    setError(null);
    try {
      const data = await authenticatedRequest('/api/projection/clear');
      setProjection(data);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : '投影解除に失敗しました');
    } finally {
      setBusy(false);
    }
  };

  const handleImage = (file: File | undefined) => {
    setError(null);
    setImageDataUrl(null);
    setImageName('');
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('画像ファイルを選択してください。');
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setError('画像は4MB以下にしてください。');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setImageDataUrl(reader.result);
        setImageName(file.name);
      }
    };
    reader.onerror = () => setError('画像を読み込めませんでした。');
    reader.readAsDataURL(file);
  };

  if (location.pathname === '/display') {
    if (!projection.active) return null;

    return (
      <div style={{ ...styles.displayOverlay, background: projection.kind === 'image' ? '#000' : themeStyle.background }}>
        {projection.kind === 'image' && projection.imageDataUrl ? (
          <img src={projection.imageDataUrl} alt="一時投影素材" style={styles.projectedImage} />
        ) : (
          <div style={styles.messageWrap}>
            <div style={{ ...styles.messageEyebrow, color: themeStyle.accent }}>肉巻き横丁 INFORMATION</div>
            <div style={styles.messageTitle}>{projection.title}</div>
            {projection.subtitle && <div style={styles.messageSubtitle}>{projection.subtitle}</div>}
          </div>
        )}
      </div>
    );
  }

  if (location.pathname !== '/') return null;

  return (
    <>
      <button
        type="button"
        className="kp-btn"
        style={{ ...styles.floatingButton, ...(projection.active ? styles.floatingButtonActive : {}) }}
        onClick={() => setOpen(true)}
      >
        📺 {projection.active ? '投影中' : 'ディスプレイ投影'}
      </button>

      {open && (
        <div style={styles.overlay} role="presentation" onClick={() => !busy && setOpen(false)}>
          <div style={styles.modal} role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div>
                <div style={styles.eyebrow}>DISPLAY CAST</div>
                <h2 style={styles.modalTitle}>ディスプレイへ投影</h2>
                <p style={styles.description}>/display を一時的に全面表示へ切り替えます。解除すると最新の番号表示へ戻ります。</p>
              </div>
              <button type="button" className="kp-btn" style={styles.closeButton} disabled={busy} onClick={() => setOpen(false)}>✕</button>
            </div>

            {projection.active && (
              <div style={styles.activeBanner}>
                <span>● 現在投影中</span>
                <strong>{projection.kind === 'image' ? projection.title || '画像' : projection.title}</strong>
                <button type="button" className="kp-btn" style={styles.clearButton} disabled={busy} onClick={() => void clearProjection()}>投影を解除</button>
              </div>
            )}

            <section style={styles.section}>
              <h3 style={styles.sectionTitle}>すぐに表示</h3>
              <div style={styles.presetGrid}>
                {PRESETS.map((preset) => (
                  <button
                    key={preset.title}
                    type="button"
                    className="kp-btn"
                    style={styles.presetButton}
                    disabled={busy}
                    onClick={() => void showText(preset.title, preset.subtitle, preset.theme)}
                  >
                    <span style={styles.presetIcon}>{preset.icon}</span>
                    <strong>{preset.title}</strong>
                    <small>{preset.subtitle}</small>
                  </button>
                ))}
              </div>
            </section>

            <section style={styles.section}>
              <h3 style={styles.sectionTitle}>自由メッセージ</h3>
              <input
                className="text-input"
                value={customTitle}
                onChange={(event) => setCustomTitle(event.target.value)}
                placeholder="大きく表示する文字（例：まもなく販売再開）"
                maxLength={120}
                style={styles.textInput}
              />
              <textarea
                value={customSubtitle}
                onChange={(event) => setCustomSubtitle(event.target.value)}
                placeholder="補足メッセージ（任意）"
                maxLength={240}
                style={styles.textArea}
              />
              <div style={styles.customRow}>
                <select value={customTheme} onChange={(event) => setCustomTheme(event.target.value as ProjectionTheme)} style={styles.select}>
                  <option value="info">青・お知らせ</option>
                  <option value="prepare">黄・準備/注意</option>
                  <option value="sale">赤・セール/強調</option>
                  <option value="closed">黒・終了/案内</option>
                </select>
                <button
                  type="button"
                  className="kp-btn"
                  style={styles.primaryButton}
                  disabled={busy || !customTitle.trim()}
                  onClick={() => void showText(customTitle.trim(), customSubtitle.trim(), customTheme)}
                >
                  この文字を投影
                </button>
              </div>
            </section>

            <section style={styles.section}>
              <h3 style={styles.sectionTitle}>画像を一時投影</h3>
              <p style={styles.help}>PNG / JPEG / WebP / GIFなど。最大4MB。画像は一時データで、サーバー再起動後には残りません。</p>
              <input type="file" accept="image/*" onChange={(event) => handleImage(event.target.files?.[0])} style={styles.fileInput} />
              {imageDataUrl && (
                <div style={styles.imagePreviewWrap}>
                  <img src={imageDataUrl} alt="投影プレビュー" style={styles.imagePreview} />
                  <button type="button" className="kp-btn" style={styles.primaryButton} disabled={busy} onClick={() => void showImage()}>
                    この画像を投影
                  </button>
                </div>
              )}
            </section>

            {error && <div style={styles.error}>{error}</div>}
          </div>
        </div>
      )}
    </>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  floatingButton: {
    position: 'fixed', right: '18px', bottom: '18px', zIndex: 900, minHeight: '48px', padding: '10px 16px',
    borderRadius: '14px', border: '1px solid #60a5fa', backgroundColor: '#172554', color: '#fff',
    fontSize: '13px', fontWeight: 900, boxShadow: '0 10px 28px rgba(15,23,42,0.28)', cursor: 'pointer',
  },
  floatingButtonActive: { backgroundColor: '#9f0b0d', borderColor: '#fca5a5', boxShadow: '0 0 0 4px rgba(239,68,68,0.18), 0 10px 28px rgba(15,23,42,0.3)' },
  overlay: { position: 'fixed', inset: 0, zIndex: 1300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', backgroundColor: 'rgba(2,6,23,0.76)', backdropFilter: 'blur(5px)' },
  modal: { width: 'min(920px, 97vw)', maxHeight: '94vh', overflowY: 'auto', padding: '22px', borderRadius: '22px', backgroundColor: '#fff', color: '#0f172a', boxShadow: '0 28px 90px rgba(0,0,0,0.42)' },
  modalHeader: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' },
  eyebrow: { fontSize: '10px', fontWeight: 900, letterSpacing: '0.18em', color: '#64748b' },
  modalTitle: { margin: '3px 0 0', fontSize: '26px', fontWeight: 950 },
  description: { margin: '7px 0 0', color: '#64748b', fontSize: '12px', fontWeight: 650, lineHeight: 1.5 },
  closeButton: { width: '48px', height: '48px', flex: '0 0 auto', borderRadius: '14px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', fontSize: '18px', fontWeight: 900, cursor: 'pointer' },
  activeBanner: { marginTop: '16px', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', borderRadius: '14px', backgroundColor: '#fff1f2', border: '1px solid #fecdd3', color: '#9f1239', fontSize: '12px', fontWeight: 800 },
  clearButton: { marginLeft: 'auto', padding: '8px 12px', borderRadius: '10px', border: '1px solid #fda4af', backgroundColor: '#fff', color: '#be123c', fontWeight: 900, cursor: 'pointer' },
  section: { marginTop: '18px', paddingTop: '16px', borderTop: '1px solid #e2e8f0' },
  sectionTitle: { margin: '0 0 10px', fontSize: '17px', fontWeight: 900 },
  presetGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '10px' },
  presetButton: { minHeight: '122px', padding: '13px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center', gap: '4px', borderRadius: '15px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', color: '#0f172a', textAlign: 'left', cursor: 'pointer' },
  presetIcon: { fontSize: '25px' },
  textInput: { width: '100%', boxSizing: 'border-box', padding: '12px 13px', border: '1px solid #cbd5e1', borderRadius: '12px', fontSize: '15px', fontWeight: 800 },
  textArea: { width: '100%', minHeight: '74px', boxSizing: 'border-box', marginTop: '8px', padding: '12px 13px', resize: 'vertical', border: '1px solid #cbd5e1', borderRadius: '12px', fontFamily: 'inherit', fontSize: '14px' },
  customRow: { marginTop: '8px', display: 'grid', gridTemplateColumns: 'minmax(170px, .6fr) 1fr', gap: '8px' },
  select: { minHeight: '46px', padding: '8px 10px', borderRadius: '11px', border: '1px solid #cbd5e1', backgroundColor: '#fff', fontWeight: 800 },
  primaryButton: { minHeight: '46px', padding: '9px 14px', borderRadius: '11px', border: 'none', backgroundColor: '#2563eb', color: '#fff', fontSize: '13px', fontWeight: 900, cursor: 'pointer' },
  help: { margin: '0 0 9px', color: '#64748b', fontSize: '12px', fontWeight: 650 },
  fileInput: { width: '100%', padding: '11px', boxSizing: 'border-box', border: '1px dashed #94a3b8', borderRadius: '12px', backgroundColor: '#f8fafc' },
  imagePreviewWrap: { marginTop: '10px', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 180px', gap: '10px', alignItems: 'center' },
  imagePreview: { width: '100%', maxHeight: '210px', objectFit: 'contain', borderRadius: '12px', backgroundColor: '#020617' },
  error: { marginTop: '14px', padding: '11px 13px', borderRadius: '12px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', fontSize: '12px', fontWeight: 800 },
  displayOverlay: { position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', color: '#fff' },
  projectedImage: { width: '100%', height: '100%', objectFit: 'contain', backgroundColor: '#000' },
  messageWrap: { width: 'min(1400px, 90vw)', padding: '6vw', textAlign: 'center' },
  messageEyebrow: { marginBottom: '3vh', fontSize: 'clamp(14px, 1.5vw, 28px)', fontWeight: 900, letterSpacing: '0.2em' },
  messageTitle: { fontSize: 'clamp(72px, 11vw, 190px)', lineHeight: 1.05, fontWeight: 950, letterSpacing: '0.04em', textShadow: '0 8px 34px rgba(0,0,0,0.28)' },
  messageSubtitle: { maxWidth: '1100px', margin: '4vh auto 0', fontSize: 'clamp(24px, 3.2vw, 58px)', lineHeight: 1.35, fontWeight: 800, textShadow: '0 4px 20px rgba(0,0,0,0.22)' },
};
