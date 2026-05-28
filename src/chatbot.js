/**
 * Motor de chatbot corretor — RHIMOB_CORRETOR_LINEAR_V3 portado para Baileys
 * Fluxo: WEBHOOK → INFO2 → COMPLEMENTO → AGENDAMENTO → HUMANO/NEG
 */

const https = require('https')
const http  = require('http')
const { getDB } = require('./db')
// Referência ao instanceManager injetada via setInstanceManager (evita circular dep)
let _im = null
function setInstanceManager(im) { _im = im }

// ── Normalização ──────────────────────────────────────────────

function normText(s) {
  return String(s || '').toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ').trim()
}

function normKey(s) {
  return String(s == null ? '' : s).trim().toUpperCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
}

// ── Keyword matching ──────────────────────────────────────────

function keywordMatches(normT, rawKeyword) {
  const raw = String(rawKeyword || '').trim()
  if (!raw) return false

  // EXATO: match exato normalizado
  if (/^EXATO:/i.test(raw)) {
    const expected = normText(raw.replace(/^EXATO\s*:/i, ''))
    return normT === expected
  }

  const kw = normText(raw)
  if (!kw) return false
  return normT.includes(kw)
}

// ── Decision finder (lê do banco) ────────────────────────────

function findDecision(stage, text, isAudio, userId) {
  const stageKey = normKey(stage)
  const normT    = normText(text || '')
  const uid      = userId || 1

  const rows = getDB().prepare(`
    SELECT * FROM bot_decisions
    WHERE user_id = ? AND active = 1 AND (stage = 'QUALQUER' OR stage = ?)
    ORDER BY priority DESC
  `).all(uid, stageKey)

  for (const d of rows) {
    const intent = normKey(d.intent)
    const rawKw  = String(d.keywords || '').trim()

    if (intent === 'AUDIO' && isAudio) return d
    if (rawKw === '*') return d

    const words = rawKw.split(',').map(w => w.trim()).filter(Boolean)
    for (const w of words) {
      if (keywordMatches(normT, w)) return d
    }
  }

  return { priority:10, stage:'QUALQUER', intent:'FALLBACK_INTERNO', keywords:'*',
    msg_ids:'MSG_HUMANO_AVISO_CLIENTE,MSG_HUMANO_INTERNO',
    next_stage:'HUMANO', advances:0, finalizes:0, human:1, active:1 }
}

// ── Slot text ─────────────────────────────────────────────────

function buildSlotText(cfg, slotNum) {
  const key  = `bot_slot_${slotNum}`
  const dia  = normKey(cfg[`${key}_dia`]  || (slotNum === 1 ? 'TERCA' : 'QUINTA'))
  const hora = String(cfg[`${key}_hora`]  || (slotNum === 1 ? '10:00' : '14:00'))

  const dayMap = { DOMINGO:0, SEGUNDA:1, TERCA:2, QUARTA:3, QUINTA:4, SEXTA:5, SABADO:6 }
  const want = dayMap[dia] ?? (slotNum === 1 ? 2 : 4)

  const now = new Date()
  const candidate = new Date(now)
  const [h, m] = hora.split(':').map(Number)
  candidate.setHours(h || 10, m || 0, 0, 0)

  let delta = want - candidate.getDay()
  if (delta < 0) delta += 7
  candidate.setDate(candidate.getDate() + delta)

  // Se o slot é em menos de 1h, empurra para a próxima semana
  if ((candidate - now) / 3600000 < 1) candidate.setDate(candidate.getDate() + 7)

  const dayNames = ['domingo','segunda-feira','terça-feira','quarta-feira','quinta-feira','sexta-feira','sábado']
  const articles = ['no','na','na','na','na','na','no']
  const dayName = dayNames[candidate.getDay()]
  const article = articles[candidate.getDay()]
  const dateStr = candidate.toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit' })

  return `${article} ${dayName}, dia ${dateStr}, às ${hora}`
}

// ── Variáveis ─────────────────────────────────────────────────

function applyVars(text, vars) {
  let out = String(text || '')
  for (const [key, val] of Object.entries(vars)) {
    const v = String(val ?? '')
    out = out.split(`{${key}}`).join(v)
    out = out.split(`{${key.toUpperCase()}}`).join(v)
  }
  return out.replace(/\{[^}]+\}/g, '').trim()
}

// ── Estado da conversa ────────────────────────────────────────

function getState(phone, userId) {
  const uid = userId || 1
  return getDB().prepare(`SELECT * FROM bot_state WHERE user_id = ? AND phone = ?`).get(uid, phone) || null
}

function setState(phone, patch, userId) {
  const db  = getDB()
  const uid = userId || 1
  const exists = db.prepare(`SELECT phone FROM bot_state WHERE user_id = ? AND phone = ?`).get(uid, phone)
  if (!exists) {
    db.prepare(`
      INSERT INTO bot_state (user_id, phone, stage, blocked, humano, last_intent, fallback_count, trava_ate)
      VALUES (?, ?, 'WEBHOOK', 0, 0, '', 0, '')
    `).run(uid, phone)
  }
  const sets = Object.entries(patch).map(([k]) => `${k} = ?`).join(', ')
  db.prepare(`UPDATE bot_state SET ${sets}, updated_at = datetime('now') WHERE user_id = ? AND phone = ?`)
    .run(...Object.values(patch), uid, phone)
}

// ── Config do bot ─────────────────────────────────────────────

function getBotConfig(userId) {
  const uid  = userId || 1
  const base = `bot_cfg_${uid}_`
  // Primeiro tenta configurações específicas do usuário (prefixadas)
  const rows = getDB().prepare(`SELECT key, value FROM settings WHERE key LIKE ?`).all(base + '%')
  const cfg  = {}
  for (const r of rows) cfg[r.key.replace(base, 'bot_')] = r.value
  // Fallback: configurações globais (retrocompatibilidade com user_id=1)
  if (!Object.keys(cfg).length || uid === 1) {
    const global = getDB().prepare(`SELECT key, value FROM settings WHERE key LIKE 'bot_%' AND key NOT LIKE 'bot_cfg_%'`).all()
    for (const r of global) { if (!cfg[r.key]) cfg[r.key] = r.value }
  }
  return cfg
}

// ── Fetch de mídia por URL ────────────────────────────────────

function fetchBuffer(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http
    mod.get(url, res => {
      const chunks = []
      res.on('data', c => chunks.push(c))
      res.on('end', () => resolve(Buffer.concat(chunks)))
      res.on('error', reject)
    }).on('error', reject)
  })
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }
function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min }

// ── Envio das mensagens ───────────────────────────────────────

async function sendMessages(instanceId, toPhone, msgIdList, vars, userId) {
  const ids = String(msgIdList || '').split(',').map(s => s.trim()).filter(Boolean)
  const uid = userId || 1

  for (const msgId of ids) {
    const row = getDB().prepare(`SELECT * FROM bot_messages WHERE user_id = ? AND msg_id = ?`).get(uid, msgId)
    if (!row) { console.warn(`[Bot] MSG não encontrada: ${msgId}`); continue }
    const msg = { type: row.type || 'text', text: row.text || '', url: row.url || '', internal: !!row.internal }

    const isInternal = msg.internal === true
    const dest = isInternal ? vars.humano_phone : toPhone
    if (!dest) continue

    const text = applyVars(msg.text, vars)
    if (!text && msg.type !== 'video') continue

    // Simula digitação (só para mensagens ao lead, não internas)
    if (!isInternal && _im) {
      try { await _im.sendPresence(instanceId, toPhone, 'composing') } catch (_) {}
      await sleep(rand(2000, 4000) + Math.min(text.length * 25, 4000))
    } else {
      await sleep(500)
    }

    try {
      if (msg.type === 'video' && msg.url) {
        const buf = await fetchBuffer(msg.url)
        await _im.sendMessage(instanceId, dest, { video: buf, caption: text })
      } else {
        await _im.sendMessage(instanceId, dest, { text })
      }
      console.log(`[Bot] ✉ ${msgId} → ${dest}`)
    } catch (err) {
      console.error(`[Bot] Erro ao enviar ${msgId} → ${dest}:`, err.message)
    }

    await sleep(rand(1500, 3000))
  }
}

// ── Handler principal ─────────────────────────────────────────

async function handleIncoming(instanceId, phone, text, isAudio, leadName) {
  if (!_im) return

  const db = getDB()

  // Descobre qual usuário é dono desta instância
  const instRow = db.prepare(`SELECT user_id FROM instances WHERE id = ?`).get(instanceId)
  const userId  = instRow?.user_id || 1

  const cfg = getBotConfig(userId)
  const botModo = normKey(cfg.bot_modo || (normKey(cfg.bot_ativo) === 'SIM' ? 'COMPLETO' : 'OFF'))
  if (botModo === 'OFF') return

  // Só responde a leads que foram disparados por campanhas deste usuário
  const wasSent = db.prepare(
    `SELECT q.id FROM queue q
     JOIN campaigns c ON c.id = q.campaign_id
     WHERE q.phone = ? AND c.user_id = ? AND q.status IN ('sent','sending') LIMIT 1`
  ).get(phone, userId)
  if (!wasSent) return

  const state = getState(phone, userId)

  // Bloqueado (humano/neg/done) — não responde
  if (state && (state.blocked || state.humano)) return

  const stage = state?.stage || 'WEBHOOK'

  // Modo ENTRADA: só responde na primeira mensagem (estágio WEBHOOK ainda não iniciado)
  if (botModo === 'ENTRADA' && state) return

  // Trava de estágio — evita duplo disparo enquanto mensagens estão sendo enviadas
  if (state?.trava_ate) {
    const until = new Date(state.trava_ate)
    if (until > new Date()) {
      // Intenções críticas passam pela trava
      const BYPASS = ['OPT_OUT','HUMANO','NEGATIVA','NEGATIVA_FORTE','NEGATIVA_EDUCADA',
        'DECLINIO','PAUSA_COMERCIAL','SLOT_1','SLOT_2','SEM_ENCAIXE']
      const testD = findDecision(stage, text, isAudio, userId)
      if (!BYPASS.includes(normKey(testD[2]))) {
        console.log(`[Bot] Trava ativa até ${until.toISOString()} — ignorando msg de ${phone}`)
        return
      }
    }
  }

  const decision = findDecision(stage, text, isAudio, userId)
  const [, , intent, , msgIds, nextStageRaw, advances, finalizes, human] = decision

  // Resolve próximo estágio
  const nextStage = normKey(nextStageRaw) === 'MESMO' ? stage : (nextStageRaw || stage)
  const isBlocked = !!(finalizes || human || ['NEG','HUMANO','FINALIZADO'].includes(normKey(nextStage)))

  // Trava: 60s após avanço para evitar dupla resposta
  const advanced = advances || normKey(stage) !== normKey(nextStage)
  const travaAte = (advanced && !isBlocked)
    ? new Date(Date.now() + 60000).toISOString()
    : ''

  // Persiste novo estado ANTES de enviar (previne corrida)
  setState(phone, {
    stage:          nextStage,
    last_intent:    intent,
    blocked:        isBlocked ? 1 : 0,
    humano:         human ? 1 : 0,
    trava_ate:      travaAte,
    fallback_count: intent.includes('FALLBACK')
      ? (state?.fallback_count || 0) + 1
      : 0
  }, userId)

  console.log(`[Bot] ${phone} | ${stage} → ${nextStage} | ${intent}`)

  // Cria card no kanban quando lead chega ao agendamento/humano
  if (human && !state?.humano) {
    try {
      const firstCol = db.prepare(
        `SELECT id FROM kanban_columns WHERE user_id = ? ORDER BY position, id LIMIT 1`
      ).get(userId)
      if (firstCol) {
        const already = db.prepare(
          `SELECT id FROM kanban_cards WHERE user_id = ? AND phone = ?`
        ).get(userId, phone)
        if (!already) {
          const maxPos = db.prepare(
            `SELECT MAX(position) as p FROM kanban_cards WHERE column_id = ?`
          ).get(firstCol.id)?.p || 0
          db.prepare(`
            INSERT INTO kanban_cards (user_id, column_id, phone, name, source, position)
            VALUES (?, ?, ?, ?, ?, ?)
          `).run(userId, firstCol.id, phone, leadName || '', `bot:${stage}`, maxPos + 1)
        }
      }
    } catch (_) {}
  }

  // Registra no log para análise de funil
  try {
    getDB().prepare(`
      INSERT INTO bot_log (user_id, phone, stage, text_recv, is_audio, intent, decision_id, next_stage, was_fallback)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      userId, phone, stage,
      isAudio ? '[AUDIO]' : (text || ''),
      isAudio ? 1 : 0,
      intent,
      decision.id || 0,
      nextStage,
      intent.includes('FALLBACK') ? 1 : 0
    )
  } catch (_) {}

  // Monta variáveis para substituição
  const slot1 = buildSlotText(cfg, 1)
  const slot2 = buildSlotText(cfg, 2)
  const firstName = String(leadName || '').split(' ')[0] || ''

  const vars = {
    primeiro_nome:  firstName,
    nome:           leadName || '',
    telefone:       phone,
    estagio:        stage,
    intencao:       intent,
    texto:          text,
    operation_name: cfg.bot_operation_name || 'RHIMOB | Corretor CRECI | Grupo Kaza',
    humano_phone:   cfg.bot_humano_phone   || '',
    humano_nome:    cfg.bot_humano_nome    || 'Marcela',
    site_vagas_url: cfg.bot_site_vagas_url || 'https://www.rhimob.com.br/vagas',
    site_empresa_url: cfg.bot_site_empresa_url || 'https://www.rhimob.com.br',
    slot_1_texto:   slot1,
    slot_2_texto:   slot2,
  }

  // Envia em background para não bloquear o listener
  sendMessages(instanceId, phone, msgIds, vars, userId).catch(err =>
    console.error('[Bot] Erro no envio:', err.message)
  )
}

module.exports = { handleIncoming, setInstanceManager }
