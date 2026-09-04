import fs from 'fs';
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
          completed_at DATETIME,
          source_order_id TEXT,
          from_mobile INTEGER NOT NULL DEFAULT 0,
          demo INTEGER NOT NULL DEFAULT 0
        )
      `);
    }

    // 既存DBに列が無ければ追加（マイグレーション）
    this.ensureColumn('source_order_id', 'TEXT');
    this.ensureColumn('from_mobile', 'INTEGER NOT NULL DEFAULT 0');
    this.ensureColumn('demo', 'INTEGER NOT NULL DEFAULT 0');

    // アプリ全体の設定を保存するテーブル。
    // デモモードのWeb ON/OFFなど、再起動後も維持したい設定に利用する。
    this.db!.run(`
      CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    `);
    this.save();
  }

  private ensureColumn(name: string, type: string): void {
    if (!this.db) return;
    const stmt = this.db.prepare('PRAGMA table_info(tickets)');
    let exists = false;
    while (stmt.step()) {
      const row = stmt.getAsObject();
      if (row.name === name) exists = true;
    }
    stmt.free();
    if (!exists) {
      this.db.run(`ALTER TABLE tickets ADD COLUMN ${name} ${type}`);
      this.save();
    }
  }

  private save(): void {
    if (!this.db) return;
    const data = this.db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  }

  getSetting(key: string): string | null {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare('SELECT value FROM app_settings WHERE key = ?');
    stmt.bind([key]);
    if (stmt.step()) {
      const row = stmt.getAsObject();
      stmt.free();
      return typeof row.value === 'string' ? row.value : String(row.value);
    }
    stmt.free();
    return null;
  }

  setSetting(key: string, value: string): void {
    if (!this.db) throw new Error('Database not initialized');

    this.db.run(
      'INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)',
      [key, value]
    );
    this.save();
  }

  private rowToTicket(row: Record<string, any>): Ticket {
    return {
      id: row.id as string,
      status: row.status as Ticket['status'],
      createdAt: new Date(row.created_at as string),
      calledAt: row.called_at ? new Date(row.called_at as string) : undefined,
      completedAt: row.completed_at ? new Date(row.completed_at as string) : undefined,
      fromMobile: !!row.from_mobile,
      demo: !!row.demo,
    };
  }

  createTicket(
    id: string,
    sourceOrderId?: string,
    fromMobile = false,
    demo = false
  ): Ticket {
    if (!this.db) throw new Error('Database not initialized');

    this.db.run(
      'INSERT INTO tickets (id, status, source_order_id, from_mobile, demo) VALUES (?, ?, ?, ?, ?)',
      [id, 'preparing', sourceOrderId ?? null, fromMobile ? 1 : 0, demo ? 1 : 0]
    );
    this.save();

    return {
      id,
      status: 'preparing',
      createdAt: new Date(),
      fromMobile,
      demo,
    };
  }

  // 指定したSquare注文IDから発行済みのチケットを返す（重複発行防止用）
  getTicketBySourceOrderId(sourceOrderId: string): Ticket | null {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare('SELECT * FROM tickets WHERE source_order_id = ?');
    stmt.bind([sourceOrderId]);

    if (stmt.step()) {
      const ticket = this.rowToTicket(stmt.getAsObject());
      stmt.free();
      return ticket;
    }
    stmt.free();
    return null;
  }

  getTicket(id: string): Ticket | null {
    if (!this.db) throw new Error('Database not initialized');
    const stmt = this.db.prepare('SELECT * FROM tickets WHERE id = ?');
    stmt.bind([id]);
    if (stmt.step()) {
      const ticket = this.rowToTicket(stmt.getAsObject());
      stmt.free();
      return ticket;
    }
    stmt.free();
    return null;
  }

  hasTicket(id: string): boolean {
    if (!this.db) throw new Error('Database not initialized');
    const stmt = this.db.prepare('SELECT 1 FROM tickets WHERE id = ?');
    stmt.bind([id]);
    const found = stmt.step();
    stmt.free();
    return found;
  }

  getAllTickets(): Ticket[] {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare(`
      SELECT * FROM tickets
      ORDER BY COALESCE(completed_at, called_at, created_at) ASC
    `);
    const tickets: Ticket[] = [];

    while (stmt.step()) {
      tickets.push(this.rowToTicket(stmt.getAsObject()));
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
    return this.getTicket(id);
  }

  recallTicket(id: string, updateCalledAt = false): Ticket | null {
    if (!this.db) throw new Error('Database not initialized');

    const ticket = this.getTicket(id);
    if (!ticket || ticket.status !== 'calling') return null;

    if (updateCalledAt) {
      this.db.run('UPDATE tickets SET called_at = ? WHERE id = ?', [
        new Date().toISOString(),
        id,
      ]);
      this.save();
    }

    return this.getTicket(id);
  }

  deleteTicket(id: string): void {
    if (!this.db) throw new Error('Database not initialized');

    this.db.run('DELETE FROM tickets WHERE id = ?', [id]);
    this.save();
  }

  deleteDemoTickets(): string[] {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare('SELECT id FROM tickets WHERE demo = 1');
    const ids: string[] = [];
    while (stmt.step()) {
      const row = stmt.getAsObject();
      ids.push(row.id as string);
    }
    stmt.free();

    this.db.run('DELETE FROM tickets WHERE demo = 1');
    this.save();
    return ids;
  }

  close(): void {
    if (this.db) {
      this.db.close();
    }
  }
}
