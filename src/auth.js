/**
 * Autenticação — sessões, middleware e rotas de login/logout/usuários
 */

const bcrypt  = require('bcryptjs')
const { getDB } = require('./db')
const { seedBotDataForUser } = require('./chatbot_data')

// ─── Middleware: protege todas as rotas ────────────────────────
function requireAuth(req, res, next) {
  if (req.session?.userId) return next()
  if (req.path.startsWith('/api/')) return res.status(401).json({ error: 'Não autenticado' })
  res.redirect('/login.html')
}

// ─── Middleware: apenas admin ──────────────────────────────────
function requireAdmin(req, res, next) {
  if (req.session?.role === 'admin') return next()
  res.status(403).json({ error: 'Acesso restrito ao administrador' })
}

// ─── Rotas de autenticação ─────────────────────────────────────
function registerAuthRoutes(app) {

  // Login
  app.post('/auth/login', async (req, res) => {
    const { username, password } = req.body
    if (!username || !password) return res.status(400).json({ error: 'Preencha usuário e senha' })

    const db   = getDB()
    const user = db.prepare(`SELECT * FROM users WHERE username = ? AND active = 1`).get(username.trim())

    if (!user) return res.status(401).json({ error: 'Usuário ou senha incorretos' })

    const ok = await bcrypt.compare(password, user.password_hash)
    if (!ok) return res.status(401).json({ error: 'Usuário ou senha incorretos' })

    req.session.userId   = user.id
    req.session.username = user.username
    req.session.name     = user.name
    req.session.company  = user.company || ''
    req.session.role     = user.role

    // Atualiza último acesso
    db.prepare(`UPDATE users SET last_login = datetime('now') WHERE id = ?`).run(user.id)

    res.json({ ok: true, name: user.name, company: user.company || '', role: user.role })
  })

  // Logout
  app.post('/auth/logout', (req, res) => {
    req.session.destroy(() => res.json({ ok: true }))
  })

  // Quem sou eu (usado pelo frontend para carregar nome/role)
  app.get('/auth/me', (req, res) => {
    if (!req.session?.userId) return res.status(401).json({ error: 'Não autenticado' })
    res.json({
      id:       req.session.userId,
      username: req.session.username,
      name:     req.session.name,
      company:  req.session.company || '',
      role:     req.session.role
    })
  })

  // ── Gerenciamento de usuários (admin) ──

  // Lista usuários
  app.get('/api/users', requireAdmin, (req, res) => {
    const rows = getDB().prepare(
      `SELECT id, username, name, company, role, active, last_login, created_at FROM users ORDER BY id`
    ).all()
    res.json(rows)
  })

  // Cria usuário
  app.post('/api/users', requireAdmin, async (req, res) => {
    const { username, password, name, company = '', role = 'operator' } = req.body
    if (!username || !password || !name)
      return res.status(400).json({ error: 'username, password e name são obrigatórios' })

    const hash = await bcrypt.hash(password, 10)
    try {
      const db = getDB()
      const r  = db.prepare(
        `INSERT INTO users (username, password_hash, name, company, role) VALUES (?, ?, ?, ?, ?)`
      ).run(username.trim(), hash, name.trim(), company.trim(), role)
      const newId = Number(r.lastInsertRowid)
      // Semeia funil padrão para o novo usuário
      seedBotDataForUser(db, newId)
      res.json({ ok: true, id: newId })
    } catch (e) {
      res.status(400).json({ error: 'Usuário já existe' })
    }
  })

  // Atualiza usuário
  app.put('/api/users/:id', requireAdmin, async (req, res) => {
    const { name, company = '', role, active, password } = req.body
    const db = getDB()

    if (password) {
      const hash = await bcrypt.hash(password, 10)
      db.prepare(`UPDATE users SET name=?, company=?, role=?, active=?, password_hash=? WHERE id=?`)
        .run(name, company, role, active, hash, req.params.id)
    } else {
      db.prepare(`UPDATE users SET name=?, company=?, role=?, active=? WHERE id=?`)
        .run(name, company, role, active, req.params.id)
    }
    res.json({ ok: true })
  })

  // Atualiza perfil (o próprio usuário)
  app.put('/api/profile', async (req, res) => {
    const { name, company } = req.body
    if (!name) return res.status(400).json({ error: 'Nome obrigatório' })
    const db = getDB()
    db.prepare(`UPDATE users SET name=?, company=? WHERE id=?`)
      .run(name.trim(), (company || '').trim(), req.session.userId)
    req.session.name    = name.trim()
    req.session.company = (company || '').trim()
    res.json({ ok: true })
  })

  // Remove usuário (não pode remover a si mesmo)
  app.delete('/api/users/:id', requireAdmin, (req, res) => {
    if (Number(req.params.id) === req.session.userId)
      return res.status(400).json({ error: 'Você não pode remover seu próprio usuário' })
    getDB().prepare(`DELETE FROM users WHERE id = ?`).run(req.params.id)
    res.json({ ok: true })
  })

  // Troca de senha (o próprio usuário)
  app.post('/api/users/change-password', async (req, res) => {
    const { current, newPassword } = req.body
    const db   = getDB()
    const user = db.prepare(`SELECT * FROM users WHERE id = ?`).get(req.session.userId)
    const ok   = await bcrypt.compare(current, user.password_hash)
    if (!ok) return res.status(401).json({ error: 'Senha atual incorreta' })
    const hash = await bcrypt.hash(newPassword, 10)
    db.prepare(`UPDATE users SET password_hash = ? WHERE id = ?`).run(hash, req.session.userId)
    res.json({ ok: true })
  })
}

module.exports = { requireAuth, requireAdmin, registerAuthRoutes }
