/**
 * Banco SQLite via sql.js (puro JavaScript — sem compilação nativa)
 * Expõe a mesma API síncrona do better-sqlite3 para o resto do código.
 */

const path = require('path')
const fs   = require('fs')

const DB_PATH = path.join(__dirname, '..', 'data', 'wazap.db')

let wrapper = null   // instância do SqlJsWrapper

// ─── Wrapper compatível com better-sqlite3 ─────────────────────

class SqlJsWrapper {
  constructor(db) {
    this._db  = db        // instância sql.js Database
    this._path = DB_PATH
  }

  pragma(stmt) {
    this._db.run(`PRAGMA ${stmt}`)
  }

  exec(sql) {
    this._db.run(sql)
    this._save()
  }

  // Retorna objeto com .run(), .get(), .all() — igual ao better-sqlite3
  prepare(sql) {
    const self = this
    return {
      run(...args) {
        self._db.run(sql, flattenArgs(args))
        // busca rowid ANTES do _save() para não perder o contexto
        const rowidRes = self._db.exec('SELECT last_insert_rowid()')
        const rawId = rowidRes[0]?.values[0][0] ?? null
        const rowid = rawId !== null ? Number(rawId) : null
        const changes = self._db.getRowsModified()
        self._save()
        return { lastInsertRowid: rowid, changes }
      },
      get(...args) {
        const stmt = self._db.prepare(sql)
        stmt.bind(flattenArgs(args))
        const row = stmt.step() ? stmt.getAsObject() : undefined
        stmt.free()
        return row
      },
      all(...args) {
        const stmt = self._db.prepare(sql)
        stmt.bind(flattenArgs(args))
        const rows = []
        while (stmt.step()) rows.push(stmt.getAsObject())
        stmt.free()
        return rows
      }
    }
  }

  // Recebe função que usa stmt.run() em loop — executa dentro de uma transação
  transaction(fn) {
    const self = this
    return function(items) {
      self._inTx = true
      self._db.run('BEGIN')
      try {
        fn(items)
        self._db.run('COMMIT')
      } catch (e) {
        try { self._db.run('ROLLBACK') } catch (_) {}
        self._inTx = false
        throw e
      }
      self._inTx = false
      self._save()
    }
  }

  // Persiste o banco em disco (ignorado dentro de transaction para não quebrar o BEGIN/COMMIT)
  _save() {
    if (this._inTx) return
    try {
      const data = this._db.export()
      fs.writeFileSync(this._path, Buffer.from(data))
    } catch (_) {}
  }
}

// sql.js retorna objetos com chave Integer64; normaliza para número JS
function flattenArgs(args) {
  if (args.length === 1 && Array.isArray(args[0])) return args[0]
  return args
}

// ─── Inicialização (async por causa do sql.js) ──────────────────

async function initDB() {
  const initSqlJs = require('sql.js')
  const SQL = await initSqlJs()

  // Carrega banco existente ou cria novo
  let db
  if (fs.existsSync(DB_PATH)) {
    const buf = fs.readFileSync(DB_PATH)
    db = new SQL.Database(buf)
  } else {
    db = new SQL.Database()
  }

  wrapper = new SqlJsWrapper(db)

  wrapper._db.run(`PRAGMA journal_mode = WAL`)
  wrapper._db.run(`PRAGMA foreign_keys = ON`)

  wrapper._db.run(`
    CREATE TABLE IF NOT EXISTS instances (
      id          TEXT PRIMARY KEY,
      user_id     INTEGER DEFAULT 1,
      phone       TEXT DEFAULT '',
      status      TEXT DEFAULT 'disconnected',
      banned      INTEGER DEFAULT 0,
      sent_today  INTEGER DEFAULT 0,
      last_reset  TEXT DEFAULT (date('now')),
      created_at  TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS campaigns (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     INTEGER DEFAULT 1,
      name        TEXT NOT NULL,
      status      TEXT DEFAULT 'paused',
      message     TEXT NOT NULL,
      media_path  TEXT,
      media_type  TEXT,
      delay_min   INTEGER DEFAULT 8,
      delay_max   INTEGER DEFAULT 25,
      hour_start  INTEGER DEFAULT 8,
      hour_end    INTEGER DEFAULT 20,
      daily_limit INTEGER DEFAULT 200,
      rotation    TEXT DEFAULT 'round-robin',
      created_at  TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS queue (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id  INTEGER NOT NULL,
      phone        TEXT NOT NULL,
      name         TEXT DEFAULT '',
      vars         TEXT DEFAULT '{}',
      status       TEXT DEFAULT 'pending',
      instance_id  TEXT,
      attempts     INTEGER DEFAULT 0,
      sent_at      TEXT,
      error        TEXT,
      created_at   TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS logs (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id INTEGER,
      instance_id TEXT,
      phone       TEXT,
      status      TEXT,
      message     TEXT,
      created_at  TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_queue_status  ON queue(status, campaign_id);
    CREATE INDEX IF NOT EXISTS idx_logs_campaign ON logs(campaign_id);

    CREATE TABLE IF NOT EXISTS templates (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      template_id    TEXT UNIQUE NOT NULL,
      account        TEXT DEFAULT '',
      project        TEXT DEFAULT '',
      active         INTEGER DEFAULT 1,
      campaign_group TEXT DEFAULT '',
      type           TEXT DEFAULT 'text',
      title          TEXT DEFAULT '',
      message        TEXT NOT NULL,
      media_path     TEXT DEFAULT '',
      order_seq      INTEGER DEFAULT 0,
      notes          TEXT DEFAULT '',
      created_at     TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_templates_group ON templates(campaign_group);

    CREATE TABLE IF NOT EXISTS users (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      username      TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name          TEXT NOT NULL,
      role          TEXT DEFAULT 'operator',
      active        INTEGER DEFAULT 1,
      last_login    TEXT,
      created_at    TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT DEFAULT ''
    );

    INSERT OR IGNORE INTO settings (key, value) VALUES ('operador', 'Ana');
    INSERT OR IGNORE INTO settings (key, value) VALUES ('conta',    'CONTA_RHIMOB');
    INSERT OR IGNORE INTO settings (key, value) VALUES ('projeto',  'KAZA_A');

    CREATE TABLE IF NOT EXISTS bot_decisions (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    INTEGER DEFAULT 1,
      priority   REAL    DEFAULT 10,
      stage      TEXT    NOT NULL,
      intent     TEXT    NOT NULL,
      keywords   TEXT    DEFAULT '',
      msg_ids    TEXT    DEFAULT '',
      next_stage TEXT    DEFAULT 'MESMO',
      advances   INTEGER DEFAULT 0,
      finalizes  INTEGER DEFAULT 0,
      human      INTEGER DEFAULT 0,
      active     INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS bot_messages (
      id       INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id  INTEGER DEFAULT 1,
      msg_id   TEXT    NOT NULL,
      type     TEXT    DEFAULT 'text',
      text     TEXT    NOT NULL,
      url      TEXT    DEFAULT '',
      internal INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS bot_state (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id        INTEGER DEFAULT 1,
      phone          TEXT    NOT NULL,
      stage          TEXT DEFAULT 'WEBHOOK',
      blocked        INTEGER DEFAULT 0,
      humano         INTEGER DEFAULT 0,
      last_intent    TEXT DEFAULT '',
      fallback_count INTEGER DEFAULT 0,
      trava_ate      TEXT DEFAULT '',
      updated_at     TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS bot_log (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     INTEGER DEFAULT 1,
      phone       TEXT    NOT NULL,
      stage       TEXT    NOT NULL,
      text_recv   TEXT    DEFAULT '',
      is_audio    INTEGER DEFAULT 0,
      intent      TEXT    DEFAULT '',
      decision_id INTEGER DEFAULT 0,
      next_stage  TEXT    DEFAULT '',
      was_fallback INTEGER DEFAULT 0,
      created_at  TEXT    DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_bot_log_phone   ON bot_log(phone);
    CREATE INDEX IF NOT EXISTS idx_bot_log_stage   ON bot_log(stage);
    CREATE INDEX IF NOT EXISTS idx_bot_log_intent  ON bot_log(intent);
    CREATE INDEX IF NOT EXISTS idx_bot_log_ts      ON bot_log(created_at);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_bot_messages_user_msg ON bot_messages(user_id, msg_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_bot_state_user_phone  ON bot_state(user_id, phone);

    CREATE TABLE IF NOT EXISTS kanban_columns (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    INTEGER NOT NULL,
      name       TEXT    NOT NULL,
      color      TEXT    DEFAULT '#3498db',
      position   INTEGER DEFAULT 0,
      created_at TEXT    DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS kanban_cards (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     INTEGER NOT NULL,
      column_id   INTEGER NOT NULL,
      phone       TEXT    DEFAULT '',
      name        TEXT    DEFAULT '',
      notes       TEXT    DEFAULT '',
      tags        TEXT    DEFAULT '',
      source      TEXT    DEFAULT '',
      position    INTEGER DEFAULT 0,
      created_at  TEXT    DEFAULT (datetime('now')),
      updated_at  TEXT    DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_kanban_cards_col ON kanban_cards(column_id);
    CREATE INDEX IF NOT EXISTS idx_kanban_cards_usr ON kanban_cards(user_id);

    INSERT OR IGNORE INTO settings (key, value) VALUES ('bot_ativo',            'NAO');
    INSERT OR IGNORE INTO settings (key, value) VALUES ('bot_humano_phone',     '');
    INSERT OR IGNORE INTO settings (key, value) VALUES ('bot_humano_nome',      'Marcela');
    INSERT OR IGNORE INTO settings (key, value) VALUES ('bot_operation_name',   'RHIMOB | Corretor CRECI | Grupo Kaza');
    INSERT OR IGNORE INTO settings (key, value) VALUES ('bot_slot_1_dia',       'TERCA');
    INSERT OR IGNORE INTO settings (key, value) VALUES ('bot_slot_1_hora',      '10:00');
    INSERT OR IGNORE INTO settings (key, value) VALUES ('bot_slot_2_dia',       'TERCA');
    INSERT OR IGNORE INTO settings (key, value) VALUES ('bot_slot_2_hora',      '14:00');
    INSERT OR IGNORE INTO settings (key, value) VALUES ('bot_site_vagas_url',   'https://www.rhimob.com.br/vagas');
    INSERT OR IGNORE INTO settings (key, value) VALUES ('bot_site_empresa_url', 'https://www.rhimob.com.br');
  `)

  // Cria usuário admin padrão se não existir
  await seedAdmin(wrapper)

  // Semeia templates de abordagem se banco estiver vazio
  const { seedTemplates } = require('./seeds')
  seedTemplates(wrapper)

  const { seedBotData } = require('./chatbot_data')
  seedBotData(wrapper)

  wrapper._save()
  return wrapper
}

async function seedAdmin(db) {
  const exists = db.prepare(`SELECT id FROM users WHERE username = 'admin'`).get()
  if (exists) return
  const bcrypt = require('bcryptjs')
  const hash   = await bcrypt.hash('wazap123', 10)
  db.prepare(`INSERT INTO users (username, password_hash, name, role) VALUES ('admin', ?, 'Administrador', 'admin')`).run(hash)
  console.log('👤 Usuário admin criado — senha padrão: wazap123  (troque após o primeiro login!)')
}

function getDB() {
  if (!wrapper) throw new Error('Banco não inicializado. Aguarde initDB().')
  return wrapper
}

function resetDailyCounters() {
  const db = getDB()
  // sql.js não tem date() nativo igual ao SQLite padrão, então comparamos via JS
  const today = new Date().toISOString().slice(0, 10)
  db.prepare(`
    UPDATE instances SET sent_today = 0, last_reset = ?
    WHERE last_reset < ?
  `).run(today, today)
}

module.exports = { initDB, getDB, resetDailyCounters }
