import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';

const DATA_DIR = path.resolve(__dirname, '../../data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const UPLOADS_DIR = path.resolve(DATA_DIR, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const DB_PATH = path.resolve(DATA_DIR, 'smartnotes.db');

export class DatabaseService {
  private db: sqlite3.Database;

  constructor(customPath?: string) {
    const finalPath = customPath || DB_PATH;
    this.db = new sqlite3.Database(finalPath);
    this.initSchema();
  }

  private initSchema() {
    this.db.serialize(() => {
      // Users table
      this.db.run(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          email TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          display_name TEXT NOT NULL,
          created_at INTEGER NOT NULL
        )
      `);

      // Items table (Folders & Notes with child-note support)
      this.db.run(`
        CREATE TABLE IF NOT EXISTS items (
          id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          kind TEXT NOT NULL,
          parent_id TEXT,
          title TEXT NOT NULL,
          content_html TEXT,
          plain_text TEXT,
          is_pinned INTEGER NOT NULL DEFAULT 0,
          is_deleted INTEGER NOT NULL DEFAULT 0,
          order_index INTEGER NOT NULL DEFAULT 0,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          deleted_at INTEGER,
          version INTEGER NOT NULL DEFAULT 1,
          asset_ids_json TEXT NOT NULL DEFAULT '[]',
          media_annotations_json TEXT NOT NULL DEFAULT '[]',
          PRIMARY KEY (id, user_id),
          FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        )
      `);

      // Assets table (Separate binary storage)
      this.db.run(`
        CREATE TABLE IF NOT EXISTS assets (
          id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          sha256 TEXT NOT NULL,
          mime_type TEXT NOT NULL,
          byte_length INTEGER NOT NULL,
          filename TEXT NOT NULL,
          storage_path TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          PRIMARY KEY (id, user_id),
          FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        )
      `);

      // Sync Revisions tracker
      this.db.run(`
        CREATE TABLE IF NOT EXISTS sync_revisions (
          revision INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id TEXT NOT NULL,
          item_id TEXT NOT NULL,
          timestamp INTEGER NOT NULL
        )
      `);

      this.db.run(`CREATE INDEX IF NOT EXISTS idx_items_user_updated ON items(user_id, updated_at)`);
      this.db.run(`CREATE INDEX IF NOT EXISTS idx_sync_rev_user ON sync_revisions(user_id, revision)`);
    });
  }

  public run(sql: string, params: any[] = []): Promise<{ lastID: number; changes: number }> {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  }

  public get<T = any>(sql: string, params: any[] = []): Promise<T | undefined> {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row as T);
      });
    });
  }

  public all<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve((rows || []) as T[]);
      });
    });
  }

  public close(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
}

export const dbService = new DatabaseService();
export { UPLOADS_DIR, DATA_DIR };

