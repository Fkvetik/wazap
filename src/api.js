/**
 * Servidor Express + Socket.IO — rotas REST e painel web
 */

const express = require('express')
const http = require('http')
const { Server } = require('socket.io')
const fileUpload = require('express-fileupload')
const session = require('express-session')
const path = require('path')
const fs = require('fs')
const { setIO } = require('./socket')
const { getDB } = require('./db')
const { instanceManager } = require('./whatsapp')
const { importCSV, importGoogleSheets } = require('./importer')
const { requireAuth, registerAuthRoutes } = require('./auth')

const app = express()
const server = http.createServer(app)
const io = new Server(server)

setIO(io)

app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(fileUpload({ limits: { fileSize: 50 * 1024 * 1024 } }))

// Sessão
app.use(session({
  secret: process.env.SESSION_SECRET || 'wazap-secret-' + Math.random(),
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 8 * 60 * 60 * 1000 } // 8 horas
}))

// Arquivos públicos SEM autenticação: só login.html e assets de login
app.use('/login.html', express.static(path.join(__dirname, '..', 'public', 'login.html')))

// Registra rotas de auth (login/logout/me) — sem proteção
registerAuthRoutes(app)

// URL do túnel — pública (não precisa de auth)
app.get('/api/tunnel-url', (req, res) => {
  const urlFile = path.join(__dirname, '../logs/tunnel_url.txt')
  try {
    if (fs.existsSync(urlFile)) {
      const url = fs.readFileSync(urlFile, 'utf8').trim()
      return res.json({ url, active: true })
    }
  } catch (_) {}
  res.json({ url: null, active: false })
})

// Tudo a partir daqui exige login
app.use(requireAuth)
app.use(express.static(path.join(__dirname, '..', 'public')))

// Injeta userId em todas as requisições autenticadas
app.use((req, res, next) => { req.uid = req.session.userId || 1; next() })

// ─── INSTÂNCIAS ────────────────────────────────────────────────

// Lista instâncias do usuário
app.get('/api/instances', (req, res) => {
  const rows = getDB().prepare(`SELECT * FROM instances WHERE user_id = ? ORDER BY created_at`).all(req.uid)
  res.json(rows.map(r => ({ ...r, qr: instanceManager.getQR(r.id) || null })))
})

// Adiciona nova instância
app.post('/api/instances', async (req, res) => {
  const { id } = req.body
  if (!id || !/^[a-zA-Z0-9_-]+$/.test(id)) {
    return res.status(400).json({ error: 'ID inválido. Use apenas letras, números, _ e -' })
  }
  try {
    // Registra o user_id antes de criar
    getDB().prepare(`INSERT OR IGNORE INTO instances (id, user_id) VALUES (?, ?)`).run(id, req.uid)
    await instanceManager.addInstance(id)
    res.json({ ok: true, message: 'Instância criada. Aguarde o QR Code.' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Remove instância
app.delete('/api/instances/:id', async (req, res) => {
  try {
    await instanceManager.removeInstance(req.params.id)
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// QR Code de uma instância
app.get('/api/instances/:id/qr', (req, res) => {
  const qr = instanceManager.getQR(req.params.id)
  if (!qr) return res.status(404).json({ error: 'QR não disponível' })
  res.json({ qr })
})

// ─── CAMPANHAS ─────────────────────────────────────────────────

// Lista campanhas com estatísticas
app.get('/api/campaigns', (req, res) => {
  const rows = getDB().prepare(`
    SELECT c.*,
      (SELECT COUNT(*) FROM queue q WHERE q.campaign_id = c.id) as total,
      (SELECT COUNT(*) FROM queue q WHERE q.campaign_id = c.id AND q.status = 'sent') as sent,
      (SELECT COUNT(*) FROM queue q WHERE q.campaign_id = c.id AND q.status IN ('failed','invalid')) as failed,
      (SELECT COUNT(*) FROM queue q WHERE q.campaign_id = c.id AND q.status IN ('pending','sending')) as pending
    FROM campaigns c WHERE c.user_id = ? ORDER BY c.created_at DESC
  `).all(req.uid)
  res.json(rows)
})

// Cria campanha
app.post('/api/campaigns', (req, res) => {
  const {
    name, message,
    delay_min = 8, delay_max = 25,
    hour_start = 8, hour_end = 20,
    daily_limit = 200, rotation = 'round-robin'
  } = req.body

  if (!name || !message) return res.status(400).json({ error: 'name e message são obrigatórios' })

  const result = getDB().prepare(`
    INSERT INTO campaigns (user_id, name, message, delay_min, delay_max, hour_start, hour_end, daily_limit, rotation)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(req.uid, name, message, delay_min, delay_max, hour_start, hour_end, daily_limit, rotation)

  res.json({ ok: true, id: result.lastInsertRowid })
})

// Atualiza campanha
app.put('/api/campaigns/:id', (req, res) => {
  const db = getDB()
  const { name, message, delay_min, delay_max, hour_start, hour_end, daily_limit, rotation } = req.body
  db.prepare(`
    UPDATE campaigns SET name=?, message=?, delay_min=?, delay_max=?,
    hour_start=?, hour_end=?, daily_limit=?, rotation=? WHERE id=?
  `).run(name, message, delay_min, delay_max, hour_start, hour_end, daily_limit, rotation, req.params.id)
  res.json({ ok: true })
})

// Remove campanha
app.delete('/api/campaigns/:id', (req, res) => {
  getDB().prepare(`DELETE FROM campaigns WHERE id = ?`).run(req.params.id)
  res.json({ ok: true })
})

// Upload de mídia para campanha
app.post('/api/campaigns/:id/media', (req, res) => {
  if (!req.files?.media) return res.status(400).json({ error: 'Nenhum arquivo enviado' })

  const file = req.files.media
  const ext = path.extname(file.name).toLowerCase()
  const allowed = ['.jpg', '.jpeg', '.png', '.mp4', '.mp3', '.ogg', '.m4a', '.pdf', '.doc', '.docx']
  if (!allowed.includes(ext)) return res.status(400).json({ error: 'Tipo de arquivo não suportado' })

  const type = getMediaType(ext)
  const savePath = path.join(__dirname, '..', 'uploads', `${req.params.id}${ext}`)
  file.mv(savePath, err => {
    if (err) return res.status(500).json({ error: err.message })
    getDB().prepare(`UPDATE campaigns SET media_path = ?, media_type = ? WHERE id = ?`)
      .run(savePath, type, req.params.id)
    res.json({ ok: true, type })
  })
})

// ─── CONTROLE DE CAMPANHA ──────────────────────────────────────

app.post('/api/campaigns/:id/start', (req, res) => {
  getDB().prepare(`UPDATE campaigns SET status = 'running' WHERE id = ?`).run(req.params.id)
  io.emit('campaign:status', { campaignId: Number(req.params.id), status: 'running' })
  res.json({ ok: true })
})

app.post('/api/campaigns/:id/pause', (req, res) => {
  getDB().prepare(`UPDATE campaigns SET status = 'paused' WHERE id = ?`).run(req.params.id)
  io.emit('campaign:status', { campaignId: Number(req.params.id), status: 'paused' })
  res.json({ ok: true })
})

app.post('/api/campaigns/:id/stop', (req, res) => {
  const db = getDB()
  db.prepare(`UPDATE campaigns SET status = 'paused' WHERE id = ?`).run(req.params.id)
  // Volta itens "sending" para "pending" (não chegaram a ser confirmados)
  db.prepare(`UPDATE queue SET status = 'pending' WHERE campaign_id = ? AND status = 'sending'`).run(req.params.id)
  io.emit('campaign:status', { campaignId: Number(req.params.id), status: 'paused' })
  res.json({ ok: true })
})

// Reset: volta todos os erros para pending
app.post('/api/campaigns/:id/reset-failed', (req, res) => {
  getDB().prepare(`
    UPDATE queue SET status = 'pending', attempts = 0, error = NULL
    WHERE campaign_id = ? AND status IN ('failed','invalid')
  `).run(req.params.id)
  res.json({ ok: true })
})

// ─── IMPORTAÇÃO DE CONTATOS ────────────────────────────────────

// Upload CSV — detecta formato automaticamente (talentos ou creci)
app.post('/api/campaigns/:id/import/csv', async (req, res) => {
  if (!req.files?.csv) return res.status(400).json({ error: 'Arquivo CSV não enviado' })

  const fmt = req.body.format || null  // 'talentos' | 'creci' | null (auto)
  const tmpPath = path.join(__dirname, '..', 'uploads', `tmp_${Date.now()}.csv`)
  await req.files.csv.mv(tmpPath)

  try {
    const result = importCSV(tmpPath, fmt)
    insertContacts(Number(req.params.id), result.contacts)
    fs.unlinkSync(tmpPath)
    res.json({ ok: true, imported: result.mapped, total: result.total, format: result.format })
  } catch (err) {
    try { fs.unlinkSync(tmpPath) } catch (_) {}
    res.status(400).json({ error: err.message })
  }
})

// Importar do Google Sheets — detecta formato automaticamente
app.post('/api/campaigns/:id/import/sheets', async (req, res) => {
  const { sheetId, range = 'A1:Z2000', format = null } = req.body
  if (!sheetId) return res.status(400).json({ error: 'sheetId é obrigatório' })

  try {
    const credPath = path.join(__dirname, '..', 'data', 'google_credentials.json')
    const result = await importGoogleSheets(sheetId, range, fs.existsSync(credPath) ? credPath : null, format)
    insertContacts(Number(req.params.id), result.contacts)
    res.json({ ok: true, imported: result.mapped, total: result.total, format: result.format })
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

// ─── LOGS ──────────────────────────────────────────────────────

app.get('/api/campaigns/:id/logs', (req, res) => {
  const page = Number(req.query.page || 1)
  const limit = 100
  const offset = (page - 1) * limit
  const rows = getDB().prepare(`
    SELECT * FROM logs WHERE campaign_id = ?
    ORDER BY created_at DESC LIMIT ? OFFSET ?
  `).all(req.params.id, limit, offset)
  res.json(rows)
})

app.get('/api/logs', (req, res) => {
  const rows = getDB().prepare(
    `SELECT * FROM logs ORDER BY created_at DESC LIMIT 200`
  ).all()
  res.json(rows)
})

// ─── SETTINGS ──────────────────────────────────────────────────

app.get('/api/settings', (req, res) => {
  const rows = getDB().prepare(`SELECT key, value FROM settings`).all()
  const obj = {}
  rows.forEach(r => { obj[r.key] = r.value })
  res.json(obj)
})

app.post('/api/settings', (req, res) => {
  const db = getDB()
  for (const [key, value] of Object.entries(req.body)) {
    db.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`).run(key, String(value))
  }
  res.json({ ok: true })
})

// ─── CHATBOT ───────────────────────────────────────────────────

app.get('/api/bot/config', (req, res) => {
  // Lê config específica do usuário (prefixada) com fallback global
  const uid  = req.uid
  const base = `bot_cfg_${uid}_`
  const db   = getDB()
  const specific = db.prepare(`SELECT key, value FROM settings WHERE key LIKE ?`).all(base + '%')
  const global   = db.prepare(`SELECT key, value FROM settings WHERE key LIKE 'bot_%' AND key NOT LIKE 'bot_cfg_%'`).all()
  const obj  = {}
  for (const r of global)   obj[r.key] = r.value
  for (const r of specific) obj[r.key.replace(base, 'bot_')] = r.value
  res.json(obj)
})

app.post('/api/bot/config', (req, res) => {
  const db   = getDB()
  const base = `bot_cfg_${req.uid}_`
  for (const [key, value] of Object.entries(req.body)) {
    if (!key.startsWith('bot_')) continue
    const storeKey = req.uid === 1 ? key : base + key.replace(/^bot_/, '')
    db.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`).run(storeKey, String(value))
  }
  res.json({ ok: true })
})

app.get('/api/bot/states', (req, res) => {
  const page  = Number(req.query.page || 1)
  const limit = 50
  const offset = (page - 1) * limit
  const rows = getDB().prepare(
    `SELECT * FROM bot_state WHERE user_id = ? ORDER BY updated_at DESC LIMIT ? OFFSET ?`
  ).all(req.uid, limit, offset)
  res.json(rows)
})

app.delete('/api/bot/states/:phone', (req, res) => {
  getDB().prepare(`DELETE FROM bot_state WHERE user_id = ? AND phone = ?`).run(req.uid, req.params.phone)
  res.json({ ok: true })
})

// ─── BOT ANÁLISE DE FUNIL ──────────────────────────────────────

const { analyzePhone, analyzeGeneral, analyzeCTAOnly, applySuggestion } = require('./bot_analyzer')

app.get('/api/bot/analysis', (req, res) => {
  try {
    const { phone, mode } = req.query
    let result
    if (mode === 'cta')   result = analyzeCTAOnly()
    else if (phone)       result = analyzePhone(phone.trim())
    else                  result = analyzeGeneral()
    res.json(result)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.post('/api/bot/analysis/apply', (req, res) => {
  try {
    const result = applySuggestion(req.body)
    res.json(result)
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

app.get('/api/bot/log', (req, res) => {
  const { phone } = req.query
  const limit = 200
  const rows = phone
    ? getDB().prepare(`SELECT * FROM bot_log WHERE phone = ? ORDER BY created_at DESC LIMIT ?`).all(phone, limit)
    : getDB().prepare(`SELECT * FROM bot_log ORDER BY created_at DESC LIMIT ?`).all(limit)
  res.json(rows)
})

// ─── BOT DECISIONS ─────────────────────────────────────────────

app.get('/api/bot/decisions', (req, res) => {
  const rows = getDB().prepare(
    `SELECT * FROM bot_decisions WHERE user_id = ? ORDER BY priority DESC, id`
  ).all(req.uid)
  res.json(rows)
})

app.post('/api/bot/decisions', (req, res) => {
  const { priority=10, stage, intent, keywords='', msg_ids='', next_stage='MESMO', advances=0, finalizes=0, human=0, active=1 } = req.body
  if (!stage || !intent) return res.status(400).json({ error: 'stage e intent são obrigatórios' })
  const r = getDB().prepare(`
    INSERT INTO bot_decisions (user_id,priority,stage,intent,keywords,msg_ids,next_stage,advances,finalizes,human,active)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)
  `).run(req.uid, priority, stage.toUpperCase(), intent.toUpperCase(), keywords, msg_ids, next_stage.toUpperCase(), advances?1:0, finalizes?1:0, human?1:0, active?1:0)
  res.json({ ok: true, id: r.lastInsertRowid })
})

app.put('/api/bot/decisions/:id', (req, res) => {
  const { priority, stage, intent, keywords, msg_ids, next_stage, advances, finalizes, human, active } = req.body
  getDB().prepare(`
    UPDATE bot_decisions SET priority=?,stage=?,intent=?,keywords=?,msg_ids=?,next_stage=?,advances=?,finalizes=?,human=?,active=?
    WHERE id=? AND user_id=?
  `).run(priority, stage.toUpperCase(), intent.toUpperCase(), keywords, msg_ids, next_stage.toUpperCase(), advances?1:0, finalizes?1:0, human?1:0, active?1:0, req.params.id, req.uid)
  res.json({ ok: true })
})

app.delete('/api/bot/decisions/:id', (req, res) => {
  getDB().prepare(`DELETE FROM bot_decisions WHERE id = ? AND user_id = ?`).run(req.params.id, req.uid)
  res.json({ ok: true })
})

app.post('/api/bot/decisions/:id/toggle', (req, res) => {
  getDB().prepare(`UPDATE bot_decisions SET active = CASE WHEN active=1 THEN 0 ELSE 1 END WHERE id=? AND user_id=?`).run(req.params.id, req.uid)
  res.json({ ok: true })
})

// ─── BOT MESSAGES ──────────────────────────────────────────────

app.get('/api/bot/messages', (req, res) => {
  const rows = getDB().prepare(`SELECT * FROM bot_messages WHERE user_id = ? ORDER BY msg_id`).all(req.uid)
  res.json(rows)
})

app.post('/api/bot/messages', (req, res) => {
  const { msg_id, type='text', text, url='', internal=0 } = req.body
  if (!msg_id || !text) return res.status(400).json({ error: 'msg_id e text são obrigatórios' })
  try {
    const r = getDB().prepare(`INSERT INTO bot_messages (user_id,msg_id,type,text,url,internal) VALUES (?,?,?,?,?,?)`)
      .run(req.uid, msg_id.toUpperCase(), type, text, url, internal?1:0)
    res.json({ ok: true, id: r.lastInsertRowid })
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

app.put('/api/bot/messages/:msg_id', (req, res) => {
  const { type, text, url, internal } = req.body
  getDB().prepare(`UPDATE bot_messages SET type=?,text=?,url=?,internal=? WHERE user_id=? AND msg_id=?`)
    .run(type||'text', text||'', url||'', internal?1:0, req.uid, req.params.msg_id)
  res.json({ ok: true })
})

app.delete('/api/bot/messages/:msg_id', (req, res) => {
  getDB().prepare(`DELETE FROM bot_messages WHERE user_id=? AND msg_id=?`).run(req.uid, req.params.msg_id)
  res.json({ ok: true })
})

// ─── KANBAN ────────────────────────────────────────────────────

const DEFAULT_KANBAN_COLUMNS = [
  { name: 'Agendado',     color: '#f39c12' },
  { name: 'Entrevistado', color: '#3498db' },
  { name: 'Em avaliação', color: '#8e44ad' },
  { name: 'Contratado',   color: '#27ae60' },
  { name: 'Descartado',   color: '#7f8c8d' },
]

app.get('/api/kanban/columns', (req, res) => {
  const db = getDB()
  let cols = db.prepare(`SELECT * FROM kanban_columns WHERE user_id = ? ORDER BY position, id`).all(req.uid)

  // Semeia colunas padrão na primeira vez
  if (!cols.length) {
    const ins = db.prepare(`INSERT INTO kanban_columns (user_id,name,color,position) VALUES (?,?,?,?)`)
    DEFAULT_KANBAN_COLUMNS.forEach((c, i) => ins.run(req.uid, c.name, c.color, i))
    cols = db.prepare(`SELECT * FROM kanban_columns WHERE user_id = ? ORDER BY position, id`).all(req.uid)
  }

  const cards = db.prepare(`SELECT * FROM kanban_cards WHERE user_id = ? ORDER BY position, id`).all(req.uid)
  res.json({ columns: cols, cards })
})

app.post('/api/kanban/columns', (req, res) => {
  const { name, color = '#3498db' } = req.body
  if (!name) return res.status(400).json({ error: 'name obrigatório' })
  const maxPos = getDB().prepare(`SELECT MAX(position) as p FROM kanban_columns WHERE user_id = ?`).get(req.uid)?.p || 0
  const r = getDB().prepare(`INSERT INTO kanban_columns (user_id,name,color,position) VALUES (?,?,?,?)`).run(req.uid, name, color, maxPos + 1)
  res.json({ ok: true, id: r.lastInsertRowid })
})

app.put('/api/kanban/columns/:id', (req, res) => {
  const { name, color } = req.body
  getDB().prepare(`UPDATE kanban_columns SET name=?,color=? WHERE id=? AND user_id=?`).run(name, color||'#3498db', req.params.id, req.uid)
  res.json({ ok: true })
})

app.delete('/api/kanban/columns/:id', (req, res) => {
  getDB().prepare(`DELETE FROM kanban_cards   WHERE column_id=? AND user_id=?`).run(req.params.id, req.uid)
  getDB().prepare(`DELETE FROM kanban_columns WHERE id=? AND user_id=?`).run(req.params.id, req.uid)
  res.json({ ok: true })
})

app.post('/api/kanban/columns/reorder', (req, res) => {
  const { order } = req.body  // array de ids na nova ordem
  const db = getDB()
  const upd = db.transaction(ids => {
    ids.forEach((id, i) => db.prepare(`UPDATE kanban_columns SET position=? WHERE id=? AND user_id=?`).run(i, id, req.uid))
  })
  upd(order)
  res.json({ ok: true })
})

app.post('/api/kanban/cards', (req, res) => {
  const { column_id, phone='', name='', notes='', tags='', source='' } = req.body
  if (!column_id) return res.status(400).json({ error: 'column_id obrigatório' })
  const maxPos = getDB().prepare(`SELECT MAX(position) as p FROM kanban_cards WHERE column_id=?`).get(column_id)?.p || 0
  const r = getDB().prepare(`INSERT INTO kanban_cards (user_id,column_id,phone,name,notes,tags,source,position) VALUES (?,?,?,?,?,?,?,?)`)
    .run(req.uid, column_id, phone, name, notes, tags, source, maxPos + 1)
  res.json({ ok: true, id: r.lastInsertRowid })
})

app.put('/api/kanban/cards/:id', (req, res) => {
  const { column_id, phone, name, notes, tags, position } = req.body
  getDB().prepare(`UPDATE kanban_cards SET column_id=?,phone=?,name=?,notes=?,tags=?,position=?,updated_at=datetime('now') WHERE id=? AND user_id=?`)
    .run(column_id, phone||'', name||'', notes||'', tags||'', position||0, req.params.id, req.uid)
  res.json({ ok: true })
})

app.delete('/api/kanban/cards/:id', (req, res) => {
  getDB().prepare(`DELETE FROM kanban_cards WHERE id=? AND user_id=?`).run(req.params.id, req.uid)
  res.json({ ok: true })
})

// Move card para outra coluna (drag-drop)
app.post('/api/kanban/cards/:id/move', (req, res) => {
  const { column_id, position } = req.body
  getDB().prepare(`UPDATE kanban_cards SET column_id=?,position=?,updated_at=datetime('now') WHERE id=? AND user_id=?`)
    .run(column_id, position||0, req.params.id, req.uid)
  res.json({ ok: true })
})

// ─── TEMPLATES ─────────────────────────────────────────────────

// Lista templates (com filtro opcional por grupo)
app.get('/api/templates', (req, res) => {
  const { group } = req.query
  const db = getDB()
  const rows = group
    ? db.prepare(`SELECT * FROM templates WHERE campaign_group = ? ORDER BY order_seq, id`).all(group)
    : db.prepare(`SELECT * FROM templates ORDER BY campaign_group, order_seq, id`).all()
  res.json(rows)
})

// Lista grupos disponíveis
app.get('/api/templates/groups', (req, res) => {
  const rows = getDB().prepare(
    `SELECT DISTINCT campaign_group FROM templates WHERE campaign_group != '' ORDER BY campaign_group`
  ).all()
  res.json(rows.map(r => r.campaign_group))
})

// Cria template
app.post('/api/templates', (req, res) => {
  const { template_id, account, project, active, campaign_group, type, title, message, media_path, order_seq, notes } = req.body
  if (!template_id || !message) return res.status(400).json({ error: 'template_id e message são obrigatórios' })
  try {
    const r = getDB().prepare(`
      INSERT INTO templates (template_id, account, project, active, campaign_group, type, title, message, media_path, order_seq, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(template_id, account||'', project||'', active==null?1:active, campaign_group||'', type||'text', title||'', message, media_path||'', order_seq||0, notes||'')
    res.json({ ok: true, id: r.lastInsertRowid })
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

// Atualiza template
app.put('/api/templates/:id', (req, res) => {
  const { template_id, account, project, active, campaign_group, type, title, message, media_path, order_seq, notes } = req.body
  getDB().prepare(`
    UPDATE templates SET template_id=?, account=?, project=?, active=?, campaign_group=?,
    type=?, title=?, message=?, media_path=?, order_seq=?, notes=? WHERE id=?
  `).run(template_id, account||'', project||'', active==null?1:active, campaign_group||'', type||'text', title||'', message, media_path||'', order_seq||0, notes||'', req.params.id)
  res.json({ ok: true })
})

// Remove template
app.delete('/api/templates/:id', (req, res) => {
  getDB().prepare(`DELETE FROM templates WHERE id = ?`).run(req.params.id)
  res.json({ ok: true })
})

// Ativa/desativa template
app.post('/api/templates/:id/toggle', (req, res) => {
  getDB().prepare(`UPDATE templates SET active = CASE WHEN active=1 THEN 0 ELSE 1 END WHERE id = ?`).run(req.params.id)
  res.json({ ok: true })
})

// Import TSV/CSV da biblioteca
app.post('/api/templates/import', async (req, res) => {
  if (!req.files?.file) return res.status(400).json({ error: 'Arquivo não enviado' })
  const tmpPath = path.join(__dirname, '..', 'uploads', `tpl_${Date.now()}.tsv`)
  await req.files.file.mv(tmpPath)

  try {
    const content = fs.readFileSync(tmpPath, 'utf-8')
    fs.unlinkSync(tmpPath)

    // Detecta separador: tab ou vírgula
    const sep = content.includes('\t') ? '\t' : ','
    const lines = content.trim().split('\n').filter(l => l.trim())

    // Verifica se primeira linha é cabeçalho (contém letras, não parece dado)
    let dataLines = lines
    const firstCell = lines[0].split(sep)[0].trim()
    if (/^[a-zA-Z_]/.test(firstCell) && !firstCell.match(/^[A-Z]+_\d+$/)) {
      dataLines = lines.slice(1) // pula cabeçalho
    }

    const imported = []
    const skipped = []

    for (const line of dataLines) {
      const cols = line.split(sep).map(c => c.trim().replace(/^"|"$/g, ''))
      // Formato: template_id, account, project, active, campaign_group, order_num, type, title, message, media_path, order_seq, notes
      if (cols.length < 9) continue
      const [template_id, account, project, active_str, campaign_group, , type, title, message, media_path, order_seq, notes] = cols
      if (!template_id || !message) continue

      const active = active_str?.toUpperCase() === 'SIM' || active_str === '1' ? 1 : 0

      try {
        getDB().prepare(`
          INSERT OR REPLACE INTO templates (template_id, account, project, active, campaign_group, type, title, message, media_path, order_seq, notes)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(template_id, account||'', project||'', active, campaign_group||'', type||'text', title||'', message, media_path||'', Number(order_seq)||0, notes||'')
        imported.push(template_id)
      } catch (e) {
        skipped.push(template_id + ': ' + e.message)
      }
    }

    res.json({ ok: true, imported: imported.length, skipped })
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

// ─── ADMIN: PRÉ-UPLOAD CSV PARA USUÁRIO ────────────────────────
// Admin faz upload de CSV e cria campanha já pronta para o usuário

app.get('/api/admin/users-simple', (req, res) => {
  if (req.session?.role !== 'admin') return res.status(403).json({ error: 'Acesso restrito' })
  const rows = getDB().prepare(`SELECT id, name, username FROM users WHERE active = 1 ORDER BY name`).all()
  res.json(rows)
})

app.post('/api/admin/preload-csv', async (req, res) => {
  if (req.session?.role !== 'admin') return res.status(403).json({ error: 'Acesso restrito' })
  if (!req.files?.csv) return res.status(400).json({ error: 'Arquivo CSV não enviado' })

  const { target_user_id, campaign_name, message = 'Olá {primeiro_nome}!', format = null } = req.body
  if (!target_user_id || !campaign_name)
    return res.status(400).json({ error: 'target_user_id e campaign_name são obrigatórios' })

  const tmpPath = path.join(__dirname, '..', 'uploads', `preload_${Date.now()}.csv`)
  await req.files.csv.mv(tmpPath)

  try {
    const result = importCSV(tmpPath, format)
    fs.unlinkSync(tmpPath)

    if (!result.contacts?.length)
      return res.status(400).json({ error: 'Nenhum contato válido encontrado no arquivo' })

    const db = getDB()
    // Cria campanha para o usuário alvo
    const r = db.prepare(`
      INSERT INTO campaigns (user_id, name, message, delay_min, delay_max, hour_start, hour_end, daily_limit, rotation)
      VALUES (?, ?, ?, 20, 40, '08:00', '18:00', 200, 0)
    `).run(Number(target_user_id), campaign_name.trim(), message.trim())

    insertContacts(Number(r.lastInsertRowid), result.contacts)

    res.json({
      ok: true,
      campaign_id: Number(r.lastInsertRowid),
      total: result.total,
      imported: result.contacts.length,
      format: result.format
    })
  } catch (err) {
    try { fs.unlinkSync(tmpPath) } catch (_) {}
    res.status(500).json({ error: err.message })
  }
})

// Lista campanhas pré-carregadas (admin vê todas)
app.get('/api/admin/campaigns', (req, res) => {
  if (req.session?.role !== 'admin') return res.status(403).json({ error: 'Acesso restrito' })
  const rows = getDB().prepare(`
    SELECT c.*, u.name as user_name,
           (SELECT COUNT(*) FROM queue q WHERE q.campaign_id = c.id) as total_contacts,
           (SELECT COUNT(*) FROM queue q WHERE q.campaign_id = c.id AND q.status = 'sent') as sent
    FROM campaigns c
    JOIN users u ON u.id = c.user_id
    ORDER BY c.id DESC
  `).all()
  res.json(rows)
})

// ─── HELPERS ───────────────────────────────────────────────────

function insertContacts(campaignId, contacts) {
  const db = getDB()
  const stmt = db.prepare(`
    INSERT INTO queue (campaign_id, phone, name, vars) VALUES (?, ?, ?, ?)
  `)
  const insertMany = db.transaction(items => {
    for (const c of items) stmt.run(campaignId, c.phone, c.name, c.vars)
  })
  insertMany(contacts)
}

function getMediaType(ext) {
  if (['.jpg', '.jpeg', '.png'].includes(ext)) return 'image'
  if (['.mp4'].includes(ext)) return 'video'
  if (['.mp3', '.ogg', '.m4a'].includes(ext)) return 'audio'
  return 'document'
}

// Socket.IO: ao conectar envia estado atual
io.on('connection', (socket) => {
  const db = getDB()
  const instances = db.prepare(`SELECT * FROM instances`).all().map(r => ({
    ...r, qr: instanceManager.getQR(r.id) || null
  }))
  socket.emit('init', { instances })
})

function startServer(port) {
  server.listen(port, () => {
    console.log(`🌐 Servidor rodando em http://localhost:${port}`)
  })
}

module.exports = { startServer }
