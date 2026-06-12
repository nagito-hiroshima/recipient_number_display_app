import fs from 'fs';
import path from 'path';
import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import { Ticket } from './src/types';

const DB_PATH = 'tickets.db';

export class TicketDatabase {
  private db: SqlJsDatabase | null = null;
  private sqlJs: any = null;

  async initialize(): Promise<void> {
    this.sqlJs = await initSqlJs();

    if (fs.existsSync(DB_PATH)) {
      const buffer = fs.readFileSync(DB_PATH);
      this.db = new this.sqlJs.Database(buffer);
    } else {
      this.db = new this.sqlJs.Database();
      this.db!.run(`
        CREATE TABLE tickets (
          id TEXT PRIMARY KEY,
          status TEXT NOT NULL DEFAULT 'preparing',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          called_at DATETIME,
          completed_at DATETIME
        )
      `);
      this.save();
    }
  }

  private save(): void {
    if (!this.db) return;
    const data = this.db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  }

  createTicket(id: string): Ticket {
    if (!this.db) throw new Error('Database not initialized');

    this.db.run('INSERT INTO tickets (id, status) VALUES (?, ?)', [id, 'preparing']);
    this.save();

    return {
      id,
      status: 'preparing',
      createdAt: new Date(),
    };
  }

  getAllTickets(): Ticket[] {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare(`
      SELECT * FROM tickets 
      ORDER BY COALESCE(completed_at, called_at, created_at) ASC
    `);
    const tickets: Ticket[] = [];

    while (stmt.step()) {
      const row = stmt.getAsObject();
      tickets.push({
        id: row.id as string,
        status: row.status as any,
        createdAt: new Date(row.created_at as string),
        calledAt: row.called_at ? new Date(row.called_at as string) : undefined,
        completedAt: row.completed_at ? new Date(row.completed_at as string) : undefined,
      });
    }
    stmt.free();

    return tickets;
  }

  updateTicketStatus(id: string, status: 'preparing' | 'calling' | 'completed'): Ticket | null {
    if (!this.db) throw new Error('Database not initialized');

    const now = new Date().toISOString();
    let sql = 'UPDATE tickets SET status = ?';
    const values: any[] = [status];

    if (status === 'calling') {
      sql += ', called_at = ?';
      values.push(now);
    }
    if (status === 'completed') {
      sql += ', completed_at = ?';
      values.push(now);
    }

    sql += ' WHERE id = ?';
    values.push(id);

    this.db.run(sql, values);
    this.save();

    const stmt = this.db.prepare('SELECT * FROM tickets WHERE id = ?');
    stmt.bind([id]);

    if (stmt.step()) {
      const row = stmt.getAsObject();
      stmt.free();

      return {
        id: row.id as string,
        status: row.status as any,
        createdAt: new Date(row.created_at as string),
        calledAt: row.called_at ? new Date(row.called_at as string) : undefined,
        completedAt: row.completed_at ? new Date(row.completed_at as string) : undefined,
      };
    }
    stmt.free();

    return null;
  }

  deleteTicket(id: string): void {
    if (!this.db) throw new Error('Database not initialized');

    this.db.run('DELETE FROM tickets WHERE id = ?', [id]);
    this.save();
  }

  close(): void {
    if (this.db) {
      this.db.close();
    }
  }
}

