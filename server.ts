import express, { Express, Request, Response, NextFunction } from 'express';
import path from 'path';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import { TicketDatabase } from './database';
import cros from 'cors';
import { Ticket, WebSocketMessage } from './src/types';
import dotenv from 'dotenv';
import { verifySquareSignature, retrieveOrder, resolveTicketNumber } from './square';

dotenv.config();

const app: Express = express();
const PORT = Number(process.env.PORT) || 3000;
const API_TOKEN = process.env.API_TOKEN;

const DEMO_MODE_DEFAULT_ENABLED =
  (process.env.DEMO_MODE_ENABLED || 'true').trim().toLowerCase() !== 'false';
let demoModeEnabled = DEMO_MODE_DEFAULT_ENABLED;

// /display のMV/BGM/アナウンス共通設定。DBに保存し、複数端末へSocket.IOで同期する。
let mediaVolume = 0.45;
let announcementVolume = 1;
let mediaVolumeLocked = false;
let mediaPlaying = true;
let forceVideo = false;

if (!API_TOKEN) {
  console.error('Error: API_TOKEN is not set in .env file');
  process.exit(1);
}

const SQUARE_WEBHOOK_SIGNATURE_KEY = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY;
const SQUARE_WEBHOOK_URL = process.env.SQUARE_WEBHOOK_URL;

app.use(cros());
app.use(
  express.json({
    verify: (req: Request & { rawBody?: Buffer }, _res, buf) => {
      req.rawBody = buf;
    },
  })
);
app.use(express.static('dist/client'));

function authenticateToken(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized - Missing token' });
  }

  if (token !== API_TOKEN) {
    return res.status(403).json({ error: 'Forbidden - Invalid token' });
  }

  next();
}

function requireDemoMode(_req: Request, res: Response, next: NextFunction) {
  if (!demoModeEnabled) {
    return res.status(403).json({ error: 'Demo mode is disabled' });
  }
  next();
}

const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

const db = new TicketDatabase();
let demoTimer: ReturnType<typeof setInterval> | null = null;

function broadcastUpdate(message: WebSocketMessage) {
  io.emit('ticket:update', message);
}

function broadcastDemoStatus() {
  io.emit('demo:status', {
    enabled: demoModeEnabled,
    autoRunning: demoTimer !== null,
  });
}

function getMediaStatus() {
  return {
    volume: mediaVolume,
    announcementVolume,
    volumeLocked: mediaVolumeLocked,
    playing: mediaPlaying,
    forceVideo,
  };
}

function broadcastMediaStatus() {
  io.emit('media:status', getMediaStatus());
}

function createRandomDemoTicket(): Ticket {
  for (let attempt = 0; attempt < 2000; attempt++) {
    const number = Math.floor(Math.random() * 900) + 100;
    const id = `D${number}`;
    if (!db.hasTicket(id)) {
      return db.createTicket(id, undefined, false, true);
    }
  }

  const fallback = `D${Date.now().toString().slice(-6)}`;
  return db.createTicket(fallback, undefined, false, true);
}

function runDemoStep(): void {
  try {
    const demoTickets = db.getAllTickets().filter((ticket) => ticket.demo);

    const calling = demoTickets.find((ticket) => ticket.status === 'calling');
    if (calling) {
      const completed = db.updateTicketStatus(calling.id, 'completed');
      if (completed) {
        broadcastUpdate({ type: 'ticket:updated', data: completed });
      }
    }

    const preparing = demoTickets.find((ticket) => ticket.status === 'preparing');
    if (preparing) {
      const called = db.updateTicketStatus(preparing.id, 'calling');
      if (called) {
        broadcastUpdate({ type: 'ticket:updated', data: called });
      }
    }
  } catch (error) {
    console.error('Demo auto progression failed:', error);
  }
}

function stopDemoAutoProgression(): void {
  if (demoTimer) {
    clearInterval(demoTimer);
    demoTimer = null;
  }
}

io.on('connection', (socket: Socket) => {
  console.log('New client connected:', socket.id);

  try {
    const tickets = db.getAllTickets();
    socket.emit('init', {
      type: 'init',
      data: tickets,
    } as WebSocketMessage);
    socket.emit('demo:status', {
      enabled: demoModeEnabled,
      autoRunning: demoTimer !== null,
    });
    socket.emit('media:status', getMediaStatus());
  } catch (err) {
    console.error('Error sending initial data:', err);
  }

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });

  socket.on('error', (err) => {
    console.error('Socket error:', err);
  });
});

// ------------------------------------------------------------------
// 伝票 API
// ------------------------------------------------------------------
app.post('/api/tickets', authenticateToken, (req, res) => {
  try {
    const { id } = req.body;
    if (!id) {
      return res.status(400).json({ error: 'Ticket ID is required' });
    }

    const existingTickets = db.getAllTickets();
    const exists = existingTickets.some((t) => t.id === id);

    if (exists) {
      return res.status(409).json({ error: `伝票番号 ${id} は既に存在します` });
    }

    const ticket = db.createTicket(id);
    broadcastUpdate({ type: 'ticket:created', data: ticket });
    res.json(ticket);
  } catch (err) {
    console.error('Error creating ticket:', err);
    res.status(500).json({ error: 'Failed to create ticket' });
  }
});

app.get('/api/tickets', authenticateToken, (req, res) => {
  try {
    res.json(db.getAllTickets());
  } catch (err) {
    console.error('Error fetching tickets:', err);
    res.status(500).json({ error: 'Failed to fetch tickets' });
  }
});

app.patch('/api/tickets/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['preparing', 'calling', 'completed'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const ticket = db.updateTicketStatus(
      id,
      status as 'preparing' | 'calling' | 'completed'
    );
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    broadcastUpdate({ type: 'ticket:updated', data: ticket });
    res.json(ticket);
  } catch (err) {
    console.error('Error updating ticket:', err);
    res.status(500).json({ error: 'Failed to update ticket' });
  }
});

app.post('/api/tickets/:id/recall', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    const updateCalledAt = req.body?.updateCalledAt === true;
    const current = db.getTicket(id);

    if (!current) {
      return res.status(404).json({ error: 'Ticket not found' });
    }
    if (current.status !== 'calling') {
      return res.status(409).json({ error: 'Ticket is not currently calling' });
    }

    const ticket = db.recallTicket(id, updateCalledAt);
    if (!ticket) {
      return res.status(409).json({ error: 'Ticket could not be recalled' });
    }

    const recallId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const recalledAt = new Date().toISOString();

    broadcastUpdate({ type: 'ticket:updated', data: ticket, recall: true });

    console.log(`Ticket recalled: ${ticket.id} (${recallId})`);
    res.json({ success: true, ticket, recallId, recalledAt });
  } catch (err) {
    console.error('Error recalling ticket:', err);
    res.status(500).json({ error: 'Failed to recall ticket' });
  }
});

app.delete('/api/tickets/:id', (req, res) => {
  try {
    const { id } = req.params;
    db.deleteTicket(id);
    broadcastUpdate({ type: 'ticket:deleted', data: { id } as any });
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting ticket:', err);
    res.status(500).json({ error: 'Failed to delete ticket' });
  }
});

// ------------------------------------------------------------------
// MV / BGM / アナウンス設定
// ------------------------------------------------------------------
app.get('/api/media/status', (_req, res) => {
  res.json(getMediaStatus());
});

app.post('/api/media/settings', authenticateToken, (req, res) => {
  try {
    const {
      volume,
      announcementVolume: requestedAnnouncementVolume,
      volumeLocked: requestedVolumeLocked,
      playing,
      forceVideo: requestedForceVideo,
    } = req.body ?? {};

    if (requestedVolumeLocked !== undefined && typeof requestedVolumeLocked !== 'boolean') {
      return res.status(400).json({ error: 'volumeLocked must be boolean' });
    }

    const isUnlocking = requestedVolumeLocked === false;
    if (
      mediaVolumeLocked &&
      !isUnlocking &&
      (volume !== undefined || requestedAnnouncementVolume !== undefined)
    ) {
      return res.status(423).json({ error: '音量がロックされています。詳細設定からロックを解除してください。' });
    }

    if (volume !== undefined) {
      const nextVolume = Number(volume);
      if (!Number.isFinite(nextVolume) || nextVolume < 0 || nextVolume > 1) {
        return res.status(400).json({ error: 'volume must be between 0 and 1' });
      }
      mediaVolume = nextVolume;
      db.setSetting('media_volume', String(mediaVolume));
    }

    if (requestedAnnouncementVolume !== undefined) {
      const nextAnnouncementVolume = Number(requestedAnnouncementVolume);
      if (!Number.isFinite(nextAnnouncementVolume) || nextAnnouncementVolume < 0 || nextAnnouncementVolume > 1) {
        return res.status(400).json({ error: 'announcementVolume must be between 0 and 1' });
      }
      announcementVolume = nextAnnouncementVolume;
      db.setSetting('announcement_volume', String(announcementVolume));
    }

    if (playing !== undefined) {
      if (typeof playing !== 'boolean') {
        return res.status(400).json({ error: 'playing must be boolean' });
      }
      mediaPlaying = playing;
      db.setSetting('media_playing', mediaPlaying ? 'true' : 'false');
    }

    if (requestedForceVideo !== undefined) {
      if (typeof requestedForceVideo !== 'boolean') {
        return res.status(400).json({ error: 'forceVideo must be boolean' });
      }
      forceVideo = requestedForceVideo;
      db.setSetting('force_video', forceVideo ? 'true' : 'false');
    }

    if (!mediaPlaying && forceVideo) {
      forceVideo = false;
      db.setSetting('force_video', 'false');
    }

    if (requestedVolumeLocked !== undefined) {
      mediaVolumeLocked = requestedVolumeLocked;
      db.setSetting('media_volume_locked', mediaVolumeLocked ? 'true' : 'false');
    }

    broadcastMediaStatus();
    res.json({ success: true, ...getMediaStatus() });
  } catch (err) {
    console.error('Error changing media settings:', err);
    res.status(500).json({ error: 'Failed to change media settings' });
  }
});

// mv.mp4 はリポジトリ直下にあるため、distとは別に明示配信する。
app.get('/mv.mp4', (_req, res) => {
  res.sendFile(path.resolve('mv.mp4'));
});

// ------------------------------------------------------------------
// デモモード
// ------------------------------------------------------------------
app.get('/api/demo/status', (_req, res) => {
  res.json({
    enabled: demoModeEnabled,
    autoRunning: demoTimer !== null,
  });
});

app.post('/api/demo/enabled', authenticateToken, (req, res) => {
  try {
    const enabled = req.body?.enabled;
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ error: 'enabled must be boolean' });
    }

    demoModeEnabled = enabled;
    db.setSetting('demo_mode_enabled', enabled ? 'true' : 'false');

    if (!demoModeEnabled) {
      stopDemoAutoProgression();
    }

    broadcastDemoStatus();
    res.json({
      success: true,
      enabled: demoModeEnabled,
      autoRunning: demoTimer !== null,
    });
  } catch (err) {
    console.error('Error changing demo mode:', err);
    res.status(500).json({ error: 'Failed to change demo mode' });
  }
});

app.post('/api/demo/tickets', authenticateToken, requireDemoMode, (req, res) => {
  try {
    const requested = Number(req.body?.count ?? 1);
    const count = Number.isFinite(requested)
      ? Math.max(1, Math.min(50, Math.floor(requested)))
      : 1;

    const created: Ticket[] = [];
    for (let i = 0; i < count; i++) {
      const ticket = createRandomDemoTicket();
      created.push(ticket);
      broadcastUpdate({ type: 'ticket:created', data: ticket });
    }

    res.json({ success: true, enabled: demoModeEnabled, tickets: created });
  } catch (err) {
    console.error('Error creating demo tickets:', err);
    res.status(500).json({ error: 'Failed to create demo tickets' });
  }
});

app.post('/api/demo/auto/start', authenticateToken, requireDemoMode, (_req, res) => {
  if (!demoTimer) {
    runDemoStep();
    demoTimer = setInterval(runDemoStep, 4000);
  }
  broadcastDemoStatus();
  res.json({ success: true, enabled: demoModeEnabled, autoRunning: true });
});

app.post('/api/demo/auto/stop', authenticateToken, requireDemoMode, (_req, res) => {
  stopDemoAutoProgression();
  broadcastDemoStatus();
  res.json({ success: true, enabled: demoModeEnabled, autoRunning: false });
});

app.delete('/api/demo/tickets', authenticateToken, requireDemoMode, (_req, res) => {
  try {
    stopDemoAutoProgression();
    const deletedIds = db.deleteDemoTickets();
    for (const id of deletedIds) {
      broadcastUpdate({ type: 'ticket:deleted', data: { id } as any });
    }
    broadcastDemoStatus();
    res.json({
      success: true,
      enabled: demoModeEnabled,
      deleted: deletedIds.length,
      autoRunning: false,
    });
  } catch (err) {
    console.error('Error deleting demo tickets:', err);
    res.status(500).json({ error: 'Failed to delete demo tickets' });
  }
});

// ------------------------------------------------------------------
// Square Webhook
// ------------------------------------------------------------------
app.post('/api/square/webhook', async (req: Request & { rawBody?: Buffer }, res) => {
  try {
    if (!SQUARE_WEBHOOK_SIGNATURE_KEY || !SQUARE_WEBHOOK_URL) {
      console.error('Square webhook env vars are not set');
      return res.status(500).json({ error: 'Square webhook not configured' });
    }

    const signature = req.headers['x-square-hmacsha256-signature'] as string | undefined;
    const rawBody = req.rawBody ?? Buffer.from(JSON.stringify(req.body));

    if (
      !verifySquareSignature(
        signature,
        rawBody,
        SQUARE_WEBHOOK_URL,
        SQUARE_WEBHOOK_SIGNATURE_KEY
      )
    ) {
      console.warn('Square webhook: invalid signature');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const event = req.body;
    const eventType: string = event?.type ?? '';

    if (eventType !== 'payment.updated' && eventType !== 'payment.created') {
      return res.status(200).json({ ignored: true, reason: `event ${eventType}` });
    }

    const payment = event?.data?.object?.payment;
    const orderId: string | undefined = payment?.order_id;

    if (payment?.status !== 'COMPLETED') {
      return res
        .status(200)
        .json({ ignored: true, reason: `payment status ${payment?.status}` });
    }
    if (!orderId) {
      return res.status(200).json({ ignored: true, reason: 'no order_id' });
    }

    const existing = db.getTicketBySourceOrderId(orderId);
    if (existing) {
      return res.status(200).json({ ignored: true, reason: 'already issued', ticket: existing });
    }

    const order = await retrieveOrder(orderId);
    if (!order) {
      console.warn(`Square webhook: order ${orderId} not found`);
      return res.status(200).json({ ignored: true, reason: 'order not found' });
    }

    let displayId = resolveTicketNumber(order, payment?.receipt_number);
    if (db.hasTicket(displayId)) {
      let suffix = 2;
      while (db.hasTicket(`${displayId}-${suffix}`)) suffix++;
      displayId = `${displayId}-${suffix}`;
    }

    const fromMobile = !!payment?.billing_address;
    const ticket = db.createTicket(displayId, orderId, fromMobile);
    broadcastUpdate({ type: 'ticket:created', data: ticket });

    console.log(`Square webhook: issued ticket ${displayId} for order ${orderId}`);
    res.status(200).json({ success: true, ticket });
  } catch (err) {
    console.error('Error handling Square webhook:', err);
    res.status(500).json({ error: 'Failed to handle webhook' });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.resolve('dist/client/index.html'));
});

db.initialize()
  .then(() => {
    const savedDemoMode = db.getSetting('demo_mode_enabled');
    if (savedDemoMode === 'true' || savedDemoMode === 'false') {
      demoModeEnabled = savedDemoMode === 'true';
    } else {
      demoModeEnabled = DEMO_MODE_DEFAULT_ENABLED;
      db.setSetting('demo_mode_enabled', demoModeEnabled ? 'true' : 'false');
    }

    const savedVolume = Number(db.getSetting('media_volume'));
    if (Number.isFinite(savedVolume) && savedVolume >= 0 && savedVolume <= 1) {
      mediaVolume = savedVolume;
    } else {
      db.setSetting('media_volume', String(mediaVolume));
    }

    const savedAnnouncementVolume = Number(db.getSetting('announcement_volume'));
    if (Number.isFinite(savedAnnouncementVolume) && savedAnnouncementVolume >= 0 && savedAnnouncementVolume <= 1) {
      announcementVolume = savedAnnouncementVolume;
    } else {
      db.setSetting('announcement_volume', String(announcementVolume));
    }

    const savedVolumeLocked = db.getSetting('media_volume_locked');
    if (savedVolumeLocked === 'true' || savedVolumeLocked === 'false') {
      mediaVolumeLocked = savedVolumeLocked === 'true';
    } else {
      db.setSetting('media_volume_locked', mediaVolumeLocked ? 'true' : 'false');
    }

    const savedPlaying = db.getSetting('media_playing');
    if (savedPlaying === 'true' || savedPlaying === 'false') {
      mediaPlaying = savedPlaying === 'true';
    } else {
      db.setSetting('media_playing', mediaPlaying ? 'true' : 'false');
    }

    const savedForceVideo = db.getSetting('force_video');
    if (savedForceVideo === 'true' || savedForceVideo === 'false') {
      forceVideo = savedForceVideo === 'true';
    } else {
      db.setSetting('force_video', forceVideo ? 'true' : 'false');
    }

    if (!mediaPlaying && forceVideo) {
      forceVideo = false;
      db.setSetting('force_video', 'false');
    }

    server.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
      console.log('Socket.IO ready');
      console.log(`Demo mode: ${demoModeEnabled ? 'enabled' : 'disabled'}`);
      console.log(
        `Media: ${mediaPlaying ? 'playing' : 'paused'}, BGM ${Math.round(mediaVolume * 100)}%, announcement ${Math.round(announcementVolume * 100)}%, volume lock ${mediaVolumeLocked ? 'on' : 'off'}`
      );
    });
  })
  .catch((err) => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  });

process.on('SIGINT', () => {
  console.log('Shutting down...');
  stopDemoAutoProgression();
  db.close();
  server.close();
  process.exit(0);
});