import express, { Express, Request, Response, NextFunction } from 'express';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import { TicketDatabase } from './database';
import cros from 'cors';
import { Ticket, WebSocketMessage } from './src/types';
import dotenv from 'dotenv';

dotenv.config();

const app: Express = express();
const PORT = 3000;
const API_TOKEN = process.env.API_TOKEN;

if (!API_TOKEN) {
  console.error('Error: API_TOKEN is not set in .env file');
  process.exit(1);
}

app.use(cros());
app.use(express.json());
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