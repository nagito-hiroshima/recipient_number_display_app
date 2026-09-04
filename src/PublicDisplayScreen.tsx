import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useWebSocket } from './useWebSocket';
import { Ticket, WebSocketMessage } from './types';

let activeUtterance: SpeechSynthesisUtterance | null = null;

/** 外部音源不要の短い呼び出しチャイム */
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

/** ブラウザ標準の日本語音声で伝票番号を読み上げる */
function speakTicket(ticket: Ticket, isRecall = false): void {
  if (!('speechSynthesis' in window)) return;

  try {
    const synth = window.speechSynthesis;
    synth.resume();

    // デモ伝票は画面上では D123 のように区別するが、
    // 音声案内は本番と同じ文面・番号形式で読み上げる。
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
    };
    utterance.onerror = (event) => {
      console.warn('Ticket speech synthesis error:', event.error);
      if (activeUtterance === utterance) activeUtterance = null;
    };

    synth.speak(utterance);
  } catch (error) {
    console.warn('Ticket number could not be spoken:', error);
  }
}

interface ReadOnlyPanelProps {
  tickets: Ticket[];
  status: 'preparing' | 'calling';
  highlightedTicketId: string | null;
}

const ReadOnlyPanel: React.FC<ReadOnlyPanelProps> = ({
  tickets,
  status,
  highlightedTicketId,
}) => {
  const isCalling = status === 'calling';
  const filteredTickets = useMemo(
    () => tickets.filter((ticket) => ticket.status === status),
    [tickets, status]
  );

  return (
    <section
      style={{
        ...styles.panel,
        ...(isCalling ? styles.callingPanel : styles.preparingPanel),
      }}
    >
      <div style={styles.panelHeader}>
        <div style={styles.panelTitleWrap}>
          <span style={styles.panelIcon}>{isCalling ? '🔔' : '🍳'}</span>
          <div>
            <div style={styles.panelEnglish}>
              {isCalling ? 'PLEASE PICK UP' : 'NOW COOKING'}
            </div>
            <h2 style={styles.panelTitle}>
              {isCalling ? 'お呼び出し中' : '調理中'}
            </h2>
          </div>
        </div>
        <div
          style={{
            ...styles.countBadge,
            color: isCalling ? 'var(--calling-to)' : 'var(--primary)',
          }}
        >
          {filteredTickets.length}
        </div>
      </div>

      <div className="scroll-area" style={styles.ticketGrid}>
        {filteredTickets.length === 0 ? (
          <div style={styles.emptyState}>
            <span style={styles.emptyIcon}>{isCalling ? '🔔' : '🍳'}</span>
            <span>
              {isCalling
                ? '現在、お呼び出し中の番号はありません'
                : '現在、調理中の番号はありません'}
            </span>
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
                className={`ticket-card${isCalling ? ' ticket-card--calling' : ''}${
                  highlighted ? ' public-ticket-recalled' : ''
                }`}
                style={{ ...styles.ticketCard, backgroundImage }}
              >
                <div style={styles.badges}>
                  {ticket.demo && <span style={styles.demoBadge}>🧪 DEMO</span>}
                  {ticket.fromMobile && (
                    <span style={styles.mobileBadge}>📱 モバイル注文</span>
                  )}
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

/** お客様向け表示専用画面。操作機能・待ち時間表示は持たない。 */
export const PublicDisplayScreen: React.FC = () => {
  const { socket, tickets, isConnected } = useWebSocket();
  const [lastCalledNumber, setLastCalledNumber] = useState<string | null>(null);
  const [highlightedTicketId, setHighlightedTicketId] = useState<string | null>(null);
  const highlightTimer = useRef<number | null>(null);
  const speechTimer = useRef<number | null>(null);

  useEffect(() => {
    if (!socket) return;

    const announce = (ticket: Ticket, isRecall = false) => {
      setLastCalledNumber(ticket.id);
      setHighlightedTicketId(ticket.id);

      if (highlightTimer.current !== null) {
        window.clearTimeout(highlightTimer.current);
      }
      highlightTimer.current = window.setTimeout(() => {
        setHighlightedTicketId(null);
        highlightTimer.current = null;
      }, 5000);

      if (speechTimer.current !== null) {
        window.clearTimeout(speechTimer.current);
        speechTimer.current = null;
      }

      // 再呼び出し時だけ、以前の読み上げキューを一度だけ破棄する。
      // speakTicket 側では cancel しないため、二重 cancel による無音化を避ける。
      if (isRecall && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        window.speechSynthesis.resume();
      }

      void playCallChime();
      speechTimer.current = window.setTimeout(() => {
        speakTicket(ticket, isRecall);
        speechTimer.current = null;
      }, 700);
    };

    const handleTicketUpdate = (message: WebSocketMessage) => {
      if (Array.isArray(message.data)) return;
      const ticket = message.data as Ticket;

      // 通常呼び出しも再呼び出しも同じ ticket:updated 経路で処理する。
      // recall フラグが付いたときだけ読み上げ文言を「再度お呼び出しします」にする。
      if (message.type === 'ticket:updated' && ticket.status === 'calling') {
        announce(ticket, message.recall === true);
      }
    };

    socket.on('ticket:update', handleTicketUpdate);

    return () => {
      socket.off('ticket:update', handleTicketUpdate);
      if (highlightTimer.current !== null) {
        window.clearTimeout(highlightTimer.current);
        highlightTimer.current = null;
      }
      if (speechTimer.current !== null) {
        window.clearTimeout(speechTimer.current);
        speechTimer.current = null;
      }
    };
  }, [socket]);

  return (
    <div style={styles.screen}>
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
            <span
              className={`status-dot ${isConnected ? 'status-dot--on' : 'status-dot--off'}`}
            />
            {isConnected ? 'リアルタイム更新中' : '再接続中...'}
          </div>
        </div>
      </header>

      <main className="public-display-main" style={styles.main}>
        <ReadOnlyPanel
          tickets={tickets}
          status="preparing"
          highlightedTicketId={highlightedTicketId}
        />
        <ReadOnlyPanel
          tickets={tickets}
          status="calling"
          highlightedTicketId={highlightedTicketId}
        />
      </main>

      <footer style={styles.footer}>
        お呼び出し中にご自身の番号が表示されましたら、受け取り口までお越しください。
      </footer>
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  screen: {
    width: '100vw',
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    backgroundColor: 'var(--bg)',
    color: 'var(--text)',
    userSelect: 'none',
  },
  header: {
    minHeight: '94px',
    padding: '16px 30px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '24px',
    color: '#fff',
    background: 'var(--header-bg)',
    boxShadow: 'var(--shadow-md)',
    zIndex: 1,
  },
  headerEnglish: {
    marginBottom: '3px',
    fontSize: '11px',
    fontWeight: 800,
    letterSpacing: '0.18em',
    opacity: 0.68,
  },
  headerTitle: {
    margin: 0,
    fontSize: 'clamp(25px, 2.6vw, 40px)',
    fontWeight: 900,
    letterSpacing: '0.04em',
  },
  headerRight: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: '6px',
  },
  lastCalled: {
    fontSize: '14px',
    fontWeight: 700,
    color: 'rgba(255,255,255,0.92)',
  },
  lastCalledNumber: {
    marginLeft: '6px',
    fontSize: '20px',
    fontVariantNumeric: 'tabular-nums',
  },
  connectionStatus: {
    display: 'flex',
    alignItems: 'center',
    fontSize: '12px',
    fontWeight: 700,
    color: 'rgba(255,255,255,0.72)',
  },
  main: {
    flex: 1,
    minHeight: 0,
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '18px',
    padding: '18px',
  },
  panel: {
    minWidth: 0,
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    backgroundColor: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    boxShadow: 'var(--shadow-md)',
  },
  preparingPanel: { borderTop: '6px solid var(--primary)' },
  callingPanel: { borderTop: '6px solid var(--calling-to)' },
  panelHeader: {
    padding: '18px 22px 14px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '16px',
    borderBottom: '1px solid var(--border)',
  },
  panelTitleWrap: { display: 'flex', alignItems: 'center', gap: '12px' },
  panelIcon: { fontSize: '30px' },
  panelEnglish: {
    marginBottom: '2px',
    fontSize: '10px',
    fontWeight: 800,
    letterSpacing: '0.16em',
    color: 'var(--text-muted)',
  },
  panelTitle: {
    margin: 0,
    fontSize: 'clamp(24px, 2.4vw, 38px)',
    fontWeight: 900,
    letterSpacing: '0.03em',
  },
  countBadge: {
    minWidth: '58px',
    padding: '5px 15px',
    borderRadius: '999px',
    textAlign: 'center',
    fontSize: 'clamp(24px, 2.5vw, 38px)',
    lineHeight: 1,
    fontWeight: 900,
    backgroundColor: 'var(--surface-muted)',
    border: '1px solid var(--border)',
  },
  ticketGrid: {
    flex: 1,
    minHeight: 0,
    overflowY: 'auto',
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gridAutoRows: 'minmax(130px, max-content)',
    alignContent: 'start',
    gap: '14px',
    padding: '18px',
    pointerEvents: 'none',
  },
  ticketCard: {
    position: 'relative',
    minHeight: '130px',
    padding: '14px 12px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderRadius: 'var(--radius-md)',
    boxShadow: 'var(--shadow-md)',
  },
  badges: {
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: '6px',
    marginBottom: '8px',
  },
  ticketNumber: {
    maxWidth: '100%',
    color: '#fff',
    fontSize: 'clamp(42px, 5.4vw, 82px)',
    fontWeight: 900,
    lineHeight: 1,
    letterSpacing: '0.02em',
    textAlign: 'center',
    wordBreak: 'break-all',
    overflowWrap: 'anywhere',
    fontVariantNumeric: 'tabular-nums',
    textShadow: '0 3px 8px rgba(0,0,0,0.18)',
  },
  mobileBadge: {
    padding: '3px 10px',
    color: '#fff',
    backgroundColor: 'rgba(0,0,0,0.22)',
    borderRadius: '999px',
    fontSize: '12px',
    fontWeight: 800,
  },
  demoBadge: {
    padding: '3px 10px',
    color: '#fff',
    backgroundColor: 'rgba(15,23,42,0.5)',
    borderRadius: '999px',
    fontSize: '12px',
    fontWeight: 900,
    letterSpacing: '0.08em',
  },
  emptyState: {
    gridColumn: '1 / -1',
    minHeight: '220px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    textAlign: 'center',
    color: 'var(--text-muted)',
    fontSize: '18px',
    fontWeight: 600,
  },
  emptyIcon: { fontSize: '44px', opacity: 0.65 },
  footer: {
    padding: '10px 24px 12px',
    textAlign: 'center',
    color: 'var(--text-muted)',
    backgroundColor: 'var(--surface)',
    borderTop: '1px solid var(--border)',
    fontSize: '14px',
    fontWeight: 700,
    letterSpacing: '0.02em',
  },
};