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

if (!API_TOKEN) {
  console.error('Error: API_TOKEN is not set in .env file');
  process.exit(1);
}

const SQUARE_WEBHOOK_SIGNATURE_KEY = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY;
const SQUARE_WEBHOOK_URL = process.env.SQUARE_WEBHOOK_URL;

app.use(cros());
// 署名検証のためWebhookの生ボディを保持する
app.use(
  express.json({
    verify: (req: Request & { rawBody?: Buffer }, _res, buf) => {
      req.rawBody = buf;
    },
  })
);
app.use(express.static('dist/client'));

// Bearer token authentication middleware
function authenticateToken(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized - Missing token' });
  }

  if (token !== API_TOKEN) {
    return res.status(403).json({ error: 'Forbidden - Invalid token' });
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

function broadcastUpdate(message: WebSocketMessage) {
  io.emit('ticket:update', message);
}

io.on('connection', (socket: Socket) => {
  console.log('New client connected:', socket.id);

  try {
    const tickets = db.getAllTickets();
    socket.emit('init', {
      type: 'init',
      data: tickets,
    } as WebSocketMessage);
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

// API endpoints
app.post('/api/tickets', authenticateToken, (req, res) => {
  try {
    const { id } = req.body;
    if (!id) {
      return res.status(400).json({ error: 'Ticket ID is required' });
    }

    // 既存チケットをチェック
    const existingTickets = db.getAllTickets();
    const exists = existingTickets.some((t) => t.id === id);

    if (exists) {
      return res.status(409).json({ error: `伝票番号 ${id} は既に存在します` });
    }

    const ticket = db.createTicket(id);
    broadcastUpdate({
      type: 'ticket:created',
      data: ticket,
    });

    res.json(ticket);
  } catch (err) {
    console.error('Error creating ticket:', err);
    res.status(500).json({ error: 'Failed to create ticket' });
  }
});

app.get('/api/tickets', authenticateToken, (req, res) => {
  try {
    const tickets = db.getAllTickets();
    res.json(tickets);
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

    const ticket = db.updateTicketStatus(id, status);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    broadcastUpdate({
      type: 'ticket:updated',
      data: ticket,
    });

    res.json(ticket);
  } catch (err) {
    console.error('Error updating ticket:', err);
    res.status(500).json({ error: 'Failed to update ticket' });
  }
});

app.delete('/api/tickets/:id', (req, res) => {
  try {
    const { id } = req.params;
    db.deleteTicket(id);

    broadcastUpdate({
      type: 'ticket:deleted',
      data: { id } as any,
    });

    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting ticket:', err);
    res.status(500).json({ error: 'Failed to delete ticket' });
  }
});

// Square Webhook: 決済完了（payment.updated / payment.created）で伝票を自動発行
app.post('/api/square/webhook', async (req: Request & { rawBody?: Buffer }, res) => {
  // Square は受信確認のため、内部エラーでも基本的に 200 を返す
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

    // 決済イベントのみ処理
    if (eventType !== 'payment.updated' && eventType !== 'payment.created') {
      return res.status(200).json({ ignored: true, reason: `event ${eventType}` });
    }

    const payment = event?.data?.object?.payment;
    const orderId: string | undefined = payment?.order_id;

    // 決済が完了していない、または注文IDが無い場合はスキップ
    if (payment?.status !== 'COMPLETED') {
      return res
        .status(200)
        .json({ ignored: true, reason: `payment status ${payment?.status}` });
    }
    if (!orderId) {
      return res.status(200).json({ ignored: true, reason: 'no order_id' });
    }

    // 同じ注文から既に発行済みなら何もしない（冪等性）
    const existing = db.getTicketBySourceOrderId(orderId);
    if (existing) {
      return res.status(200).json({ ignored: true, reason: 'already issued', ticket: existing });
    }

    // 注文を取得して伝票番号を決定
    const order = await retrieveOrder(orderId);
    if (!order) {
      console.warn(`Square webhook: order ${orderId} not found`);
      return res.status(200).json({ ignored: true, reason: 'order not found' });
    }

    // 表示番号が他の有効な伝票と衝突する場合は枝番を付与
    let displayId = resolveTicketNumber(order);
    if (db.hasTicket(displayId)) {
      let suffix = 2;
      while (db.hasTicket(`${displayId}-${suffix}`)) suffix++;
      displayId = `${displayId}-${suffix}`;
    }

    const ticket = db.createTicket(displayId, orderId);
    broadcastUpdate({ type: 'ticket:created', data: ticket });

    console.log(`Square webhook: issued ticket ${displayId} for order ${orderId}`);
    res.status(200).json({ success: true, ticket });
  } catch (err) {
    console.error('Error handling Square webhook:', err);
    // 200 以外を返すと Square がリトライするため、サーバー障害は 500 で通知
    res.status(500).json({ error: 'Failed to handle webhook' });
  }
});

// SPA フォールバック: API以外のGETはReactアプリのindex.htmlを返す
// （/display や /number-input などのクライアントルートを直接開けるようにする）
app.get('*', (req, res) => {
  res.sendFile(path.resolve('dist/client/index.html'));
});

// Initialize database and start server
db.initialize()
  .then(() => {
    server.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
      console.log(`Socket.IO ready`);
    });
  })
  .catch((err) => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  });

process.on('SIGINT', () => {
  console.log('Shutting down...');
  db.close();
  server.close();
  process.exit(0);
});