import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWebSocket } from './useWebSocket';
import { TicketDisplay } from './TicketDisplay';
import { TicketMenu } from './TicketMenu';
import { MediaSettingsModal } from './MediaSettingsModal';
import { Ticket } from './types';

const API_KEY_STORAGE_KEY = 'apiToken';
const DEMO_UNLOCK_TAPS = 5;
const DEMO_UNLOCK_MAX_GAP_MS = 1200;

interface MediaStatus {
  volume: number;
  announcementVolume: number;
  volumeLocked: boolean;
  playing: boolean;
  forceVideo: boolean;
}

export const DisplayScreen: React.FC = () => {
  const navigate = useNavigate();
  const { socket, tickets, isConnected } = useWebSocket();
  const [isLoading, setIsLoading] = useState(false);
  const [menuTicket, setMenuTicket] = useState<Ticket | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [demoEnabled, setDemoEnabled] = useState(false);
  const [demoAutoRunning, setDemoAutoRunning] = useState(false);
  const [demoBusy, setDemoBusy] = useState(false);
  const [demoError, setDemoError] = useState<string | null>(null);
  const [demoUnlockProgress, setDemoUnlockProgress] = useState(0);
  const [recallNotice, setRecallNotice] = useState<string | null>(null);
  const [media, setMedia] = useState<MediaStatus>({
    volume: 0.45,
    announcementVolume: 1,
    volumeLocked: false,
    playing: true,
    forceVideo: false,
  });
  const [mediaBusy, setMediaBusy] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const demoTapCount = useRef(0);
  const lastDemoTapAt = useRef(0);
  const demoTapResetTimer = useRef<number | null>(null);
  const recallNoticeTimer = useRef<number | null>(null);

  const apiKey = localStorage.getItem(API_KEY_STORAGE_KEY)?.trim() || '';

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    fetch('/api/demo/status')
      .then(async (response) => {
        if (!response.ok) throw new Error('デモモード状態を取得できませんでした');
        return response.json();
      })
      .then((data) => {
        setDemoEnabled(data.enabled === true);
        setDemoAutoRunning(data.autoRunning === true);
      })
      .catch((error) => {
        console.warn('Failed to load demo status:', error);
        setDemoEnabled(false);
      });

    fetch('/api/media/status')
      .then(async (response) => {
        if (!response.ok) throw new Error('BGM設定を取得できませんでした');
        return response.json();
      })
      .then((data) => {
        setMedia({
          volume: typeof data.volume === 'number' ? data.volume : 0.45,
          announcementVolume: typeof data.announcementVolume === 'number' ? data.announcementVolume : 1,
          volumeLocked: data.volumeLocked === true,
          playing: data.playing !== false,
          forceVideo: data.forceVideo === true,
        });
      })
      .catch((error) => {
        console.warn('Failed to load media status:', error);
        setMediaError('BGM設定を取得できませんでした');
      });
  }, []);

  useEffect(() => {
    if (!socket) return;

    const handleDemoStatus = (data: { enabled?: boolean; autoRunning?: boolean }) => {
      if (typeof data.enabled === 'boolean') {
        setDemoEnabled(data.enabled);
        if (data.enabled) {
          demoTapCount.current = 0;
          setDemoUnlockProgress(0);
        }
      }
      if (typeof data.autoRunning === 'boolean') setDemoAutoRunning(data.autoRunning);
    };

    const handleMediaStatus = (data: MediaStatus) => {
      setMedia(data);
      setMediaError(null);
    };

    socket.on('demo:status', handleDemoStatus);
    socket.on('media:status', handleMediaStatus);
    return () => {
      socket.off('demo:status', handleDemoStatus);
      socket.off('media:status', handleMediaStatus);
    };
  }, [socket]);

  useEffect(() => {
    return () => {
      if (demoTapResetTimer.current !== null) window.clearTimeout(demoTapResetTimer.current);
      if (recallNoticeTimer.current !== null) window.clearTimeout(recallNoticeTimer.current);
    };
  }, []);

  const activeCount = useMemo(
    () => tickets.filter((ticket) => ticket.status === 'preparing' || ticket.status === 'calling').length,
    [tickets]
  );

  const congestion = useMemo(() => {
    if (activeCount <= 2) return { label: '余裕あり', background: '#dcfce7', badge: '#166534', critical: false };
    if (activeCount <= 5) return { label: '少し混雑', background: '#fef9c3', badge: '#854d0e', critical: false };
    if (activeCount <= 9) return { label: '混雑中', background: '#fee2e2', badge: '#b91c1c', critical: false };
    return { label: 'かなり混雑', background: '#fecaca', badge: '#991b1b', critical: true };
  }, [activeCount]);

  const showRecallNotice = (message: string) => {
    setRecallNotice(message);
    if (recallNoticeTimer.current !== null) window.clearTimeout(recallNoticeTimer.current);
    recallNoticeTimer.current = window.setTimeout(() => {
      setRecallNotice(null);
      recallNoticeTimer.current = null;
    }, 3500);
  };

  const handleStatusChange = async (ticketId: string, newStatus: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/tickets/${encodeURIComponent(ticketId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!response.ok) throw new Error('Failed to update ticket');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (ticketId: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/tickets/${encodeURIComponent(ticketId)}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete ticket');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRecall = async (ticketId: string, updateCalledAt: boolean) => {
    if (!apiKey) {
      window.alert('再呼び出しにはAPIキーが必要です。先に「伝票入力へ」からAPIキーを設定してください。');
      return;
    }

    try {
      const response = await fetch(`/api/tickets/${encodeURIComponent(ticketId)}/recall`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ updateCalledAt }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || '再呼び出しに失敗しました');
      setMenuTicket(null);
      showRecallNotice(`🔊 ${ticketId}番を再呼び出ししました`);
    } catch (error) {
      const message = error instanceof Error ? error.message : '再呼び出しに失敗しました';
      console.error('Recall failed:', error);
      window.alert(message);
    }
  };

  const handleMenuMove = (ticketId: string, status: 'preparing' | 'calling') => {
    setMenuTicket(null);
    handleStatusChange(ticketId, status).catch((err) => console.error('Error moving ticket:', err));
  };

  const handleMenuDelete = (ticketId: string) => {
    setMenuTicket(null);
    handleDelete(ticketId).catch((err) => console.error('Error deleting ticket:', err));
  };

  const mediaRequest = async (patch: Partial<MediaStatus>) => {
    if (!apiKey) {
      setMediaError('APIキー未設定です。「伝票入力へ」からAPIキーを設定してください。');
      return;
    }

    setMediaBusy(true);
    setMediaError(null);
    try {
      const response = await fetch('/api/media/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify(patch),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'BGM設定の変更に失敗しました');
      setMedia({
        volume: data.volume,
        announcementVolume: data.announcementVolume,
        volumeLocked: data.volumeLocked === true,
        playing: data.playing,
        forceVideo: data.forceVideo,
      });
    } catch (error) {
      setMediaError(error instanceof Error ? error.message : 'BGM設定の変更に失敗しました');
    } finally {
      setMediaBusy(false);
    }
  };

  const togglePlayback = () => {
    if (media.playing) {
      void mediaRequest({ playing: false, forceVideo: false });
    } else {
      void mediaRequest({ playing: true });
    }
  };

  const demoRequest = async (path: string, options: { method?: string; body?: unknown } = {}) => {
    if (!apiKey) {
      setDemoError('APIキー未設定です。「伝票入力へ」からAPIキーを設定してください。');
      return null;
    }

    setDemoBusy(true);
    setDemoError(null);
    try {
      const response = await fetch(path, {
        method: options.method || 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'デモ操作に失敗しました');
      if (typeof data.enabled === 'boolean') setDemoEnabled(data.enabled);
      if (typeof data.autoRunning === 'boolean') setDemoAutoRunning(data.autoRunning);
      return data;
    } catch (error) {
      setDemoError(error instanceof Error ? error.message : 'デモ操作に失敗しました');
      return null;
    } finally {
      setDemoBusy(false);
    }
  };

  const disableDemoMode = () => {
    if (!demoEnabled) return;
    if (!apiKey) {
      setDemoError('APIキー未設定です。「伝票入力へ」からAPIキーを設定してください。');
      return;
    }

    const message = demoAutoRunning
      ? 'デモモードをOFFにします。自動進行も停止します。デモ伝票は削除されません。よろしいですか？'
      : 'デモモードをOFFにします。デモ伝票は削除されません。よろしいですか？';
    if (!window.confirm(message)) return;

    demoTapCount.current = 0;
    setDemoUnlockProgress(0);
    void demoRequest('/api/demo/enabled', { body: { enabled: false } });
  };

  const handleHeaderTap = (event: React.MouseEvent<HTMLElement>) => {
    if (demoEnabled || demoBusy) return;
    const target = event.target as HTMLElement;
    if (target.closest('button, a, input, select, textarea, [role="button"]')) return;

    const currentTime = Date.now();
    if (lastDemoTapAt.current === 0 || currentTime - lastDemoTapAt.current > DEMO_UNLOCK_MAX_GAP_MS) {
      demoTapCount.current = 1;
    } else {
      demoTapCount.current += 1;
    }

    lastDemoTapAt.current = currentTime;
    setDemoUnlockProgress(demoTapCount.current);

    if (demoTapResetTimer.current !== null) window.clearTimeout(demoTapResetTimer.current);

    if (demoTapCount.current >= DEMO_UNLOCK_TAPS) {
      demoTapCount.current = 0;
      lastDemoTapAt.current = 0;
      setDemoUnlockProgress(0);

      if (!apiKey) {
        window.alert('デモモードをONにするにはAPIキーが必要です。「伝票入力へ」から設定してください。');
        return;
      }

      void demoRequest('/api/demo/enabled', { body: { enabled: true } });
      return;
    }

    demoTapResetTimer.current = window.setTimeout(() => {
      demoTapCount.current = 0;
      lastDemoTapAt.current = 0;
      setDemoUnlockProgress(0);
      demoTapResetTimer.current = null;
    }, DEMO_UNLOCK_MAX_GAP_MS);
  };

  const addDemoTickets = (count: number) => void demoRequest('/api/demo/tickets', { body: { count } });
  const toggleDemoAuto = () => void demoRequest(demoAutoRunning ? '/api/demo/auto/stop' : '/api/demo/auto/start');
  const deleteDemoTickets = () => {
    if (!window.confirm('デモ用の伝票だけをすべて削除します。よろしいですか？')) return;
    void demoRequest('/api/demo/tickets', { method: 'DELETE' });
  };

  const mediaStateLabel = !media.playing
    ? '停止中'
    : media.forceVideo
      ? '映像固定'
      : activeCount === 0
        ? '待機映像'
        : '番号表示';

  return (
    <div className={congestion.critical ? 'congestion-critical staff-app' : 'staff-app'} style={{ ...styles.app, backgroundColor: congestion.background }}>
      <header
        className="staff-header"
        style={styles.header}
        onClick={handleHeaderTap}
        title={!demoEnabled ? 'デモモードを有効化するにはヘッダーを5回連続タップ' : undefined}
      >
        <div className="staff-title-area" style={styles.titleArea}>
          <div style={styles.titleLine}>
            <h1 style={styles.title}>伝票表示</h1>
            <div style={{ ...styles.congestionBadge, color: congestion.badge, backgroundColor: 'rgba(255,255,255,0.94)' }}>
              {activeCount}件・{congestion.label}
            </div>
            <div style={{ ...styles.modeBadge, backgroundColor: demoEnabled ? '#7c3aed' : '#15803d' }}>
              {demoEnabled ? '🧪 DEMO' : '● 本番'}
            </div>
            {!demoEnabled && demoUnlockProgress > 0 && <div style={styles.unlockProgress}>DEMO {demoUnlockProgress}/{DEMO_UNLOCK_TAPS}</div>}
            {recallNotice && <div style={styles.recallNotice}>{recallNotice}</div>}
          </div>
          {mediaError && <div style={styles.headerError}>{mediaError}</div>}
        </div>

        <div className="staff-header-actions" style={styles.headerActions}>
          <div className="staff-media-actions" style={styles.mediaActions}>
            <span style={styles.mediaStateBadge}>{mediaStateLabel}</span>
            <button
              type="button"
              className="kp-btn"
              style={{ ...styles.actionButton, ...(media.playing ? styles.stopButton : styles.playButton) }}
              disabled={mediaBusy}
              onClick={togglePlayback}
            >
              {media.playing ? '■ BGM' : '▶ BGM'}
            </button>
            <button
              type="button"
              className="kp-btn"
              style={{ ...styles.actionButton, ...(media.forceVideo ? styles.forceActiveButton : styles.forceButton) }}
              disabled={mediaBusy || !media.playing}
              onClick={() => void mediaRequest({ forceVideo: !media.forceVideo })}
            >
              {media.forceVideo ? '映像解除' : '▶ 映像'}
            </button>
            <button
              type="button"
              className="kp-btn"
              style={styles.settingsButton}
              onClick={() => setSettingsOpen(true)}
            >
              ⚙ 詳細{media.volumeLocked ? ' 🔒' : ''}
            </button>
          </div>

          <button type="button" className="kp-btn" style={styles.navButton} onClick={() => navigate('/number-input')}>伝票入力</button>
          <div style={styles.connectionStatus}>
            <span className={`status-dot ${isConnected ? 'status-dot--on' : 'status-dot--off'}`} />
            {isConnected ? '接続中' : '再接続中'}
          </div>
        </div>
      </header>

      {demoEnabled && (
        <div style={styles.demoBar}>
          <div style={styles.demoTitleWrap}>
            <button
              type="button"
              className="kp-btn"
              style={{ ...styles.demoModeToggle, backgroundColor: '#7c3aed' }}
              disabled={demoBusy || !apiKey}
              onClick={disableDemoMode}
              title={apiKey ? 'デモモードをOFF' : 'APIキーを設定してください'}
            >
              🧪 DEMO ON
              <span style={styles.demoToggleHint}>OFFにする</span>
            </button>
            <span style={styles.demoHelp}>{apiKey ? 'APIキー設定済み' : 'APIキー未設定'}{demoAutoRunning ? ' ・ 自動進行中' : ''}</span>
          </div>

          <div style={styles.demoActions}>
            <button className="kp-btn" style={styles.demoButton} disabled={demoBusy || !apiKey} onClick={() => addDemoTickets(1)}>＋ ランダム1件</button>
            <button className="kp-btn" style={styles.demoButton} disabled={demoBusy || !apiKey} onClick={() => addDemoTickets(10)}>＋ 10件追加</button>
            <button
              className="kp-btn"
              style={{ ...styles.demoButton, ...(demoAutoRunning ? styles.demoStopButton : styles.demoStartButton) }}
              disabled={demoBusy || !apiKey}
              onClick={toggleDemoAuto}
            >
              {demoAutoRunning ? '■ 自動進行停止' : '▶ 自動進行開始'}
            </button>
            <button className="kp-btn" style={{ ...styles.demoButton, ...styles.demoDeleteButton }} disabled={demoBusy || !apiKey} onClick={deleteDemoTickets}>デモデータ削除</button>
          </div>
          {demoError && <div style={styles.demoError}>{demoError}</div>}
        </div>
      )}

      <div className="display-main" style={styles.mainContent}>
        <TicketDisplay tickets={tickets} status="preparing" onStatusChange={handleStatusChange} onLongPress={setMenuTicket} isLoading={isLoading} now={now} />
        <TicketDisplay tickets={tickets} status="calling" onStatusChange={handleStatusChange} onLongPress={setMenuTicket} isLoading={isLoading} now={now} />
      </div>

      {menuTicket && (
        <TicketMenu
          ticket={menuTicket}
          onMove={handleMenuMove}
          onRecall={(ticketId, updateCalledAt) => { void handleRecall(ticketId, updateCalledAt); }}
          onDelete={handleMenuDelete}
          onClose={() => setMenuTicket(null)}
        />
      )}

      {settingsOpen && (
        <MediaSettingsModal
          bgmVolume={media.volume}
          announcementVolume={media.announcementVolume}
          volumeLocked={media.volumeLocked}
          busy={mediaBusy}
          onChange={(patch) => { void mediaRequest(patch); }}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  app: { height: '100vh', display: 'flex', flexDirection: 'column', transition: 'background-color 0.35s ease' },
  header: { background: 'var(--header-bg)', color: 'white', padding: '9px 14px', boxShadow: 'var(--shadow-md)', zIndex: 2 },
  titleArea: { minWidth: 0 },
  titleLine: { display: 'flex', alignItems: 'center', gap: '7px', flexWrap: 'wrap' },
  title: { margin: 0, fontSize: '20px', fontWeight: 900, letterSpacing: '0.03em', whiteSpace: 'nowrap' },
  congestionBadge: { padding: '5px 9px', borderRadius: '999px', fontSize: '11px', fontWeight: 900, boxShadow: '0 1px 4px rgba(0,0,0,0.16)', whiteSpace: 'nowrap' },
  modeBadge: { padding: '5px 8px', borderRadius: '999px', color: '#fff', fontSize: '10px', fontWeight: 900, letterSpacing: '0.03em', whiteSpace: 'nowrap' },
  unlockProgress: { padding: '5px 8px', borderRadius: '999px', backgroundColor: 'rgba(124,58,237,0.9)', color: '#fff', fontSize: '10px', fontWeight: 900, whiteSpace: 'nowrap' },
  recallNotice: { padding: '5px 9px', borderRadius: '999px', backgroundColor: 'rgba(245,158,11,0.95)', color: '#fff', fontSize: '11px', fontWeight: 900, whiteSpace: 'nowrap' },
  headerError: { marginTop: '3px', color: '#fecaca', fontSize: '10px', fontWeight: 800 },
  headerActions: { minWidth: 0 },
  mediaActions: { display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 },
  mediaStateBadge: { padding: '5px 8px', borderRadius: '999px', backgroundColor: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.16)', color: '#cbd5e1', fontSize: '10px', fontWeight: 800, whiteSpace: 'nowrap' },
  actionButton: { minHeight: '42px', padding: '8px 10px', borderRadius: '10px', border: '1px solid #475569', fontSize: '11px', fontWeight: 900, cursor: 'pointer', whiteSpace: 'nowrap' },
  stopButton: { color: '#fecaca', backgroundColor: '#450a0a', borderColor: '#7f1d1d' },
  playButton: { color: '#bbf7d0', backgroundColor: '#052e16', borderColor: '#166534' },
  forceButton: { color: '#dbeafe', backgroundColor: '#172554', borderColor: '#1d4ed8' },
  forceActiveButton: { color: '#fff7ed', backgroundColor: '#7c2d12', borderColor: '#ea580c' },
  settingsButton: { minHeight: '42px', padding: '8px 10px', borderRadius: '10px', border: '1px solid #64748b', backgroundColor: '#334155', color: '#fff', fontSize: '11px', fontWeight: 900, cursor: 'pointer', whiteSpace: 'nowrap' },
  navButton: { minHeight: '42px', border: '1px solid rgba(255,255,255,0.35)', background: 'rgba(255,255,255,0.12)', color: '#fff', borderRadius: '10px', padding: '8px 11px', fontSize: '12px', fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap' },
  connectionStatus: { fontSize: '11px', fontWeight: 700, display: 'flex', alignItems: 'center', color: 'rgba(255,255,255,0.88)', whiteSpace: 'nowrap' },
  demoBar: { minHeight: '58px', padding: '9px 18px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', backgroundColor: 'rgba(255,255,255,0.92)', borderBottom: '1px solid rgba(148,163,184,0.35)', boxShadow: '0 2px 8px rgba(15,23,42,0.06)', zIndex: 1 },
  demoTitleWrap: { display: 'flex', alignItems: 'center', gap: '9px', flexWrap: 'wrap' },
  demoModeToggle: { border: 'none', padding: '7px 10px', borderRadius: '999px', color: '#fff', fontSize: '12px', fontWeight: 900, letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '7px', cursor: 'pointer' },
  demoToggleHint: { padding: '2px 6px', borderRadius: '999px', backgroundColor: 'rgba(255,255,255,0.2)', fontSize: '10px', letterSpacing: 0 },
  demoHelp: { color: 'var(--text-muted)', fontSize: '12px', fontWeight: 700 },
  demoActions: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' },
  demoButton: { padding: '8px 11px', borderRadius: '9px', border: '1px solid #cbd5e1', backgroundColor: '#fff', color: '#334155', fontSize: '12px', fontWeight: 800, cursor: 'pointer' },
  demoStartButton: { color: '#166534', borderColor: '#86efac', backgroundColor: '#f0fdf4' },
  demoStopButton: { color: '#9a3412', borderColor: '#fdba74', backgroundColor: '#fff7ed' },
  demoDeleteButton: { color: '#b91c1c', borderColor: '#fecaca', backgroundColor: '#fff1f2' },
  demoError: { color: '#b91c1c', fontSize: '12px', fontWeight: 800 },
  mainContent: { flex: 1, minHeight: 0, display: 'flex', gap: '20px', padding: '20px', overflow: 'hidden' },
};