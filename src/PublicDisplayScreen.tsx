import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useWebSocket } from './useWebSocket';
import { Ticket, WebSocketMessage } from './types';

interface MediaStatus {
  volume: number;
  playing: boolean;
  forceVideo: boolean;
}

let activeUtterance: SpeechSynthesisUtterance | null = null;

async function playCallChime(): Promise<void> {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;

    const context: AudioContext = new AudioContextClass();
    if (context.state === 'suspended') await context.resume();

    const playTone = (frequency: number, startAt: number, duration: number) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(frequency, startAt);
      gain.gain.setValueAtTime(0.0001, startAt);
      gain.gain.exponentialRampToValueAtTime(0.22, startAt + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(startAt);
      oscillator.stop(startAt + duration + 0.03);
    };

    const start = context.currentTime + 0.02;
    playTone(880, start, 0.22);
    playTone(659.25, start + 0.25, 0.34);
    window.setTimeout(() => void context.close(), 1000);
  } catch (error) {
    console.warn('Call chime could not be played:', error);
  }
}

function speakTicket(ticket: Ticket, isRecall = false): Promise<void> {
  return new Promise((resolve) => {
    if (!('speechSynthesis' in window)) {
      resolve();
      return;
    }

    try {
      const synth = window.speechSynthesis;
      synth.resume();

      const spokenNumber = ticket.demo ? ticket.id.replace(/^D/i, '') : ticket.id;
      const message = isRecall
        ? `再度お呼び出しします。番号 ${spokenNumber} のお客様、受け取り口までお越しください。`
        : `お待たせしました。番号 ${spokenNumber} のお客様、受け取り口までお越しください。`;

      const utterance = new SpeechSynthesisUtterance(message);
      activeUtterance = utterance;
      utterance.lang = 'ja-JP';
      utterance.rate = 0.95;
      utterance.pitch = 1;
      utterance.volume = 1;

      const japaneseVoice = synth
        .getVoices()
        .find((voice) => voice.lang.toLowerCase().startsWith('ja'));
      if (japaneseVoice) utterance.voice = japaneseVoice;

      utterance.onend = () => {
        if (activeUtterance === utterance) activeUtterance = null;
        resolve();
      };
      utterance.onerror = () => {
        if (activeUtterance === utterance) activeUtterance = null;
        resolve();
      };

      synth.speak(utterance);
    } catch (error) {
      console.warn('Ticket number could not be spoken:', error);
      resolve();
    }
  });
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function fadeVideoVolume(video: HTMLVideoElement, target: number, duration: number): Promise<void> {
  return new Promise((resolve) => {
    const startVolume = video.volume;
    const startedAt = performance.now();
    const clampedTarget = Math.max(0, Math.min(1, target));

    const step = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      video.volume = startVolume + (clampedTarget - startVolume) * progress;
      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        resolve();
      }
    };

    requestAnimationFrame(step);
  });
}

interface ReadOnlyPanelProps {
  tickets: Ticket[];
  status: 'preparing' | 'calling';
  highlightedTicketId: string | null;
}

const ReadOnlyPanel: React.FC<ReadOnlyPanelProps> = ({ tickets, status, highlightedTicketId }) => {
  const isCalling = status === 'calling';
  const filteredTickets = useMemo(
    () => tickets.filter((ticket) => ticket.status === status),
    [tickets, status]
  );

  return (
    <section style={{ ...styles.panel, ...(isCalling ? styles.callingPanel : styles.preparingPanel) }}>
      <div style={styles.panelHeader}>
        <div style={styles.panelTitleWrap}>
          <span style={styles.panelIcon}>{isCalling ? '🔔' : '🍳'}</span>
          <div>
            <div style={styles.panelEnglish}>{isCalling ? 'PLEASE PICK UP' : 'NOW COOKING'}</div>
            <h2 style={styles.panelTitle}>{isCalling ? 'お呼び出し中' : '調理中'}</h2>
          </div>
        </div>
        <div style={{ ...styles.countBadge, color: isCalling ? 'var(--calling-to)' : 'var(--primary)' }}>
          {filteredTickets.length}
        </div>
      </div>

      <div className="scroll-area" style={styles.ticketGrid}>
        {filteredTickets.length === 0 ? (
          <div style={styles.emptyState}>
            <span style={styles.emptyIcon}>{isCalling ? '🔔' : '🍳'}</span>
            <span>{isCalling ? '現在、お呼び出し中の番号はありません' : '現在、調理中の番号はありません'}</span>
          </div>
        ) : (
          filteredTickets.map((ticket) => {
            const backgroundImage = isCalling
              ? ticket.fromMobile
                ? 'linear-gradient(135deg, var(--calling-mobile-from), var(--calling-mobile-to))'
                : 'linear-gradient(135deg, var(--calling-from), var(--calling-to))'
              : ticket.fromMobile
                ? 'linear-gradient(135deg, var(--preparing-mobile-from), var(--preparing-mobile-to))'
                : 'linear-gradient(135deg, var(--preparing-from), var(--preparing-to))';
            const highlighted = isCalling && highlightedTicketId === ticket.id;

            return (
              <div
                key={ticket.id}
                className={`ticket-card${isCalling ? ' ticket-card--calling' : ''}${highlighted ? ' public-ticket-recalled' : ''}`}
                style={{ ...styles.ticketCard, backgroundImage }}
              >
                <div style={styles.badges}>
                  {ticket.demo && <span style={styles.demoBadge}>🧪 DEMO</span>}
                  {ticket.fromMobile && <span style={styles.mobileBadge}>📱 モバイル注文</span>}
                </div>
                <div style={styles.ticketNumber}>{ticket.id}</div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
};

export const PublicDisplayScreen: React.FC = () => {
  const { socket, tickets, isConnected } = useWebSocket();
  const [lastCalledNumber, setLastCalledNumber] = useState<string | null>(null);
  const [highlightedTicketId, setHighlightedTicketId] = useState<string | null>(null);
  const [media, setMedia] = useState<MediaStatus>({ volume: 0.45, playing: true, forceVideo: false });
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaRef = useRef(media);
  const highlightTimer = useRef<number | null>(null);
  const isDucking = useRef(false);
  const announcementQueue = useRef<Promise<void>>(Promise.resolve());

  const activeTickets = useMemo(
    () => tickets.filter((ticket) => ticket.status === 'preparing' || ticket.status === 'calling'),
    [tickets]
  );

  const showVideo = media.playing && (media.forceVideo || activeTickets.length === 0);

  useEffect(() => {
    mediaRef.current = media;
    const video = videoRef.current;
    if (!video) return;

    if (!isDucking.current) {
      video.volume = media.volume;
    }

    if (media.playing) {
      video.play()
        .then(() => setAutoplayBlocked(false))
        .catch(() => setAutoplayBlocked(true));
    } else {
      video.pause();
      setAutoplayBlocked(false);
    }
  }, [media]);

  useEffect(() => {
    fetch('/api/media/status')
      .then((response) => response.json())
      .then((data) => {
        setMedia({
          volume: typeof data.volume === 'number' ? data.volume : 0.45,
          playing: data.playing !== false,
          forceVideo: data.forceVideo === true,
        });
      })
      .catch((error) => console.warn('Failed to load media status:', error));
  }, []);

  useEffect(() => {
    if (!socket) return;

    const handleMediaStatus = (data: MediaStatus) => setMedia(data);
    socket.on('media:status', handleMediaStatus);

    const announce = async (ticket: Ticket, isRecall = false) => {
      setLastCalledNumber(ticket.id);
      setHighlightedTicketId(ticket.id);

      if (highlightTimer.current !== null) window.clearTimeout(highlightTimer.current);
      highlightTimer.current = window.setTimeout(() => {
        setHighlightedTicketId(null);
        highlightTimer.current = null;
      }, 5000);

      if (isRecall && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        window.speechSynthesis.resume();
      }

      const video = videoRef.current;
      const currentMedia = mediaRef.current;
      if (video && currentMedia.playing) {
        isDucking.current = true;
        await fadeVideoVolume(video, currentMedia.volume * 0.18, 650);
      }

      await playCallChime();
      await wait(700);
      await speakTicket(ticket, isRecall);
      await wait(200);

      if (video && mediaRef.current.playing) {
        await fadeVideoVolume(video, mediaRef.current.volume, 1200);
      }
      isDucking.current = false;
    };

    const handleTicketUpdate = (message: WebSocketMessage) => {
      if (Array.isArray(message.data)) return;
      const ticket = message.data as Ticket;
      if (message.type === 'ticket:updated' && ticket.status === 'calling') {
        announcementQueue.current = announcementQueue.current.then(() => announce(ticket, message.recall === true));
      }
    };

    socket.on('ticket:update', handleTicketUpdate);

    return () => {
      socket.off('media:status', handleMediaStatus);
      socket.off('ticket:update', handleTicketUpdate);
      if (highlightTimer.current !== null) window.clearTimeout(highlightTimer.current);
    };
  }, [socket]);

  const unlockPlayback = () => {
    const video = videoRef.current;
    if (!video || !media.playing) return;
    video.play()
      .then(() => setAutoplayBlocked(false))
      .catch(() => setAutoplayBlocked(true));
  };

  return (
    <div style={styles.screen} onClick={autoplayBlocked ? unlockPlayback : undefined}>
      <video
        ref={videoRef}
        src="/mv.mp4"
        loop
        playsInline
        preload="auto"
        style={{ ...styles.video, opacity: showVideo ? 1 : 0, pointerEvents: 'none' }}
      />

      {!showVideo && (
        <div style={styles.numberLayer}>
          <header style={styles.header}>
            <div>
              <div style={styles.headerEnglish}>ORDER PICKUP INFORMATION</div>
              <h1 style={styles.headerTitle}>受け取り番号 ご案内</h1>
            </div>
            <div style={styles.headerRight}>
              {lastCalledNumber && (
                <div style={styles.lastCalled}>
                  最終呼出 <strong style={styles.lastCalledNumber}>{lastCalledNumber}</strong>
                </div>
              )}
              <div style={styles.connectionStatus}>
                <span className={`status-dot ${isConnected ? 'status-dot--on' : 'status-dot--off'}`} />
                {isConnected ? 'リアルタイム更新中' : '再接続中...'}
              </div>
            </div>
          </header>

          <main className="public-display-main" style={styles.main}>
            <ReadOnlyPanel tickets={tickets} status="preparing" highlightedTicketId={highlightedTicketId} />
            <ReadOnlyPanel tickets={tickets} status="calling" highlightedTicketId={highlightedTicketId} />
          </main>

          <footer style={styles.footer}>
            お呼び出し中にご自身の番号が表示されましたら、受け取り口までお越しください。
          </footer>
        </div>
      )}

      {autoplayBlocked && media.playing && (
        <div style={styles.autoplayNotice}>🔊 画面を1回タップしてBGMを開始してください</div>
      )}
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  screen: { width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden', backgroundColor: '#000', color: 'var(--text)', userSelect: 'none' },
  video: { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', transition: 'opacity 0.45s ease' },
  numberLayer: { position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg)' },
  header: { minHeight: '94px', padding: '16px 30px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '24px', color: '#fff', background: 'var(--header-bg)', boxShadow: 'var(--shadow-md)', zIndex: 1 },
  headerEnglish: { marginBottom: '3px', fontSize: '11px', fontWeight: 800, letterSpacing: '0.18em', opacity: 0.68 },
  headerTitle: { margin: 0, fontSize: 'clamp(25px, 2.6vw, 40px)', fontWeight: 900, letterSpacing: '0.04em' },
  headerRight: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' },
  lastCalled: { fontSize: '14px', fontWeight: 700, color: 'rgba(255,255,255,0.92)' },
  lastCalledNumber: { marginLeft: '6px', fontSize: '20px', fontVariantNumeric: 'tabular-nums' },
  connectionStatus: { display: 'flex', alignItems: 'center', fontSize: '12px', fontWeight: 700, color: 'rgba(255,255,255,0.72)' },
  main: { flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px', padding: '18px' },
  panel: { minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-md)' },
  preparingPanel: { borderTop: '6px solid var(--primary)' },
  callingPanel: { borderTop: '6px solid var(--calling-to)' },
  panelHeader: { padding: '18px 22px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', borderBottom: '1px solid var(--border)' },
  panelTitleWrap: { display: 'flex', alignItems: 'center', gap: '12px' },
  panelIcon: { fontSize: '30px' },
  panelEnglish: { marginBottom: '2px', fontSize: '10px', fontWeight: 800, letterSpacing: '0.16em', color: 'var(--text-muted)' },
  panelTitle: { margin: 0, fontSize: 'clamp(24px, 2.4vw, 38px)', fontWeight: 900, letterSpacing: '0.03em' },
  countBadge: { minWidth: '58px', padding: '5px 15px', borderRadius: '999px', textAlign: 'center', fontSize: 'clamp(24px, 2.5vw, 38px)', lineHeight: 1, fontWeight: 900, backgroundColor: 'var(--surface-muted)', border: '1px solid var(--border)' },
  ticketGrid: { flex: 1, minHeight: 0, overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gridAutoRows: 'minmax(130px, max-content)', alignContent: 'start', gap: '14px', padding: '18px', pointerEvents: 'none' },
  ticketCard: { position: 'relative', minHeight: '130px', borderRadius: '18px', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 24px rgba(15,23,42,0.16)', overflow: 'hidden' },
  ticketNumber: { fontSize: 'clamp(52px, 6.8vw, 100px)', lineHeight: 1, fontWeight: 950, letterSpacing: '0.03em', textShadow: '0 3px 12px rgba(0,0,0,0.22)' },
  badges: { position: 'absolute', top: '10px', left: '10px', right: '10px', display: 'flex', gap: '6px', flexWrap: 'wrap' },
  demoBadge: { padding: '4px 7px', borderRadius: '999px', backgroundColor: 'rgba(76,29,149,0.9)', color: '#fff', fontSize: '10px', fontWeight: 900 },
  mobileBadge: { padding: '4px 7px', borderRadius: '999px', backgroundColor: 'rgba(15,23,42,0.62)', color: '#fff', fontSize: '10px', fontWeight: 900 },
  emptyState: { minHeight: '180px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px', color: 'var(--text-muted)', fontSize: '18px', fontWeight: 800 },
  emptyIcon: { fontSize: '42px', opacity: 0.7 },
  footer: { padding: '10px 20px 14px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px', fontWeight: 700 },
  autoplayNotice: { position: 'absolute', left: '50%', bottom: '26px', transform: 'translateX(-50%)', zIndex: 10, padding: '14px 20px', borderRadius: '14px', backgroundColor: 'rgba(15,23,42,0.92)', color: '#fff', fontSize: '16px', fontWeight: 900, boxShadow: '0 8px 28px rgba(0,0,0,0.35)' },
};
