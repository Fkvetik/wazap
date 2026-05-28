/**
 * Motor de disparo — processa a fila com delay humano, rotação e janela horária
 */

const { instanceManager, sleep, randomBetween } = require('./whatsapp')
const { getDB, resetDailyCounters } = require('./db')
const { getIO } = require('./socket')
const path = require('path')
const fs = require('fs')

// Estado do loop de disparo
let running = true

async function startSenderLoop() {
  console.log('⚡ Loop de disparo iniciado')

  while (running) {
    try {
      resetDailyCounters()
      await processQueue()
    } catch (err) {
      console.error('Erro no loop de disparo:', err.message)
    }
    // Aguarda 3s antes de verificar a fila novamente
    await sleep(3000)
  }
}

async function processQueue() {
  const db = getDB()

  // Busca campanhas ativas
  const campaigns = db.prepare(`SELECT * FROM campaigns WHERE status = 'running'`).all()
  if (campaigns.length === 0) return

  for (const campaign of campaigns) {
    // Verifica janela horária
    const now = new Date()
    const hour = now.getHours()
    if (hour < campaign.hour_start || hour >= campaign.hour_end) continue

    // Pega próximo item da fila para esta campanha
    const item = db.prepare(`
      SELECT * FROM queue
      WHERE campaign_id = ? AND status = 'pending' AND attempts < 3
      ORDER BY id ASC LIMIT 1
    `).get(campaign.id)

    if (!item) {
      // Fila vazia: marca campanha como concluída
      const remaining = db.prepare(
        `SELECT COUNT(*) as c FROM queue WHERE campaign_id = ? AND status = 'pending'`
      ).get(campaign.id)
      if (remaining.c === 0) {
        db.prepare(`UPDATE campaigns SET status = 'done' WHERE id = ?`).run(campaign.id)
        emitCampaignUpdate(campaign.id)
      }
      continue
    }

    // Seleciona instância disponível
    const available = instanceManager.getAvailable(campaign.daily_limit)
    if (available.length === 0) continue

    const instanceId = pickInstance(available, campaign.rotation)

    // Marca como processando para evitar duplo envio
    db.prepare(`UPDATE queue SET status = 'sending', instance_id = ? WHERE id = ?`)
      .run(instanceId, item.id)

    // Processa em background para não bloquear o loop
    sendItem(campaign, item, instanceId).catch(() => {})

    // Delay humano entre disparos (delay_min/max estão em minutos)
    const delay = randomBetween(campaign.delay_min * 60 * 1000, campaign.delay_max * 60 * 1000)
    await sleep(delay)
  }
}

async function sendItem(campaign, item, instanceId) {
  const db = getDB()

  try {
    // Valida se número existe no WhatsApp
    const phone = sanitizePhone(item.phone)
    const valid = await instanceManager.validatePhone(instanceId, phone)

    if (!valid) {
      db.prepare(`UPDATE queue SET status = 'invalid', error = 'Número não existe no WhatsApp' WHERE id = ?`).run(item.id)
      logSend(campaign.id, instanceId, phone, 'invalid', 'Número inválido')
      emitQueueUpdate(campaign.id)
      return
    }

    // Monta mensagem com variáveis substituídas (inclui runtime: saudacao, operador)
    const vars = safeParseJSON(item.vars)
    vars.nome = vars.nome || item.name || ''
    vars.primeiro_nome = vars.primeiro_nome || vars.nome.split(' ')[0] || ''
    injectRuntimeVars(vars)
    const text = substituteVars(campaign.message, vars)

    // Monta payload conforme tipo de mídia
    const payload = buildPayload(text, campaign)

    // Envia
    await instanceManager.sendMessage(instanceId, phone, payload)

    db.prepare(`UPDATE queue SET status = 'sent', sent_at = datetime('now'), instance_id = ? WHERE id = ?`)
      .run(instanceId, item.id)
    logSend(campaign.id, instanceId, phone, 'sent', text.substring(0, 100))
    emitQueueUpdate(campaign.id)

  } catch (err) {
    const attempts = item.attempts + 1
    const newStatus = attempts >= 3 ? 'failed' : 'pending'

    db.prepare(`UPDATE queue SET status = ?, attempts = ?, error = ? WHERE id = ?`)
      .run(newStatus, attempts, err.message, item.id)
    logSend(campaign.id, instanceId, item.phone, 'error', err.message)
    emitQueueUpdate(campaign.id)

    // Se erro sugere ban, marca instância
    if (err.message?.includes('403') || err.message?.toLowerCase().includes('banned')) {
      db.prepare(`UPDATE instances SET status = 'banned', banned = 1 WHERE id = ?`).run(instanceId)
      getIO().emit('instance:update', { instanceId, event: 'banned' })
    }
  }
}

function buildPayload(text, campaign) {
  if (!campaign.media_path || !campaign.media_type) {
    return { text }
  }

  const mediaBuffer = fs.readFileSync(campaign.media_path)
  const filename = path.basename(campaign.media_path)

  const base = {
    caption: text,
    mimetype: getMimetype(campaign.media_type, filename)
  }

  if (campaign.media_type === 'image') {
    return { image: mediaBuffer, ...base }
  }
  if (campaign.media_type === 'audio') {
    return { audio: mediaBuffer, mimetype: 'audio/mp4', ptt: true }
  }
  if (campaign.media_type === 'document') {
    return { document: mediaBuffer, ...base, fileName: filename }
  }
  if (campaign.media_type === 'video') {
    return { video: mediaBuffer, ...base }
  }

  return { text }
}

function getMimetype(type, filename) {
  const ext = filename.split('.').pop().toLowerCase()
  const map = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
    mp4: 'video/mp4', pdf: 'application/pdf',
    mp3: 'audio/mpeg', ogg: 'audio/ogg', m4a: 'audio/mp4',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  }
  return map[ext] || 'application/octet-stream'
}

// Injeta variáveis de runtime (saudacao e operador) nas vars do contato
function injectRuntimeVars(vars) {
  // {saudacao} baseado no horário atual
  if (!vars.saudacao) {
    const h = new Date().getHours()
    if (h >= 5  && h < 12) vars.saudacao = 'Bom dia'
    else if (h >= 12 && h < 18) vars.saudacao = 'Boa tarde'
    else vars.saudacao = 'Boa noite'
  }

  // {operador} vem da configuração do sistema
  if (!vars.operador) {
    try {
      const setting = getDB().prepare(`SELECT value FROM settings WHERE key = 'operador'`).get()
      vars.operador = setting?.value || 'Ana'
    } catch (_) {
      vars.operador = 'Ana'
    }
  }

  return vars
}

// Substitui {variavel} na mensagem
function substituteVars(template, vars) {
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    // variáveis opcionais que podem ficar vazias (ex: creci_frase quando não tem CRECI)
    if (vars[key] === undefined) return ''
    return vars[key]
  })
}

// Escolhe instância por round-robin ou aleatório
const rrIndex = new Map()
function pickInstance(available, rotation) {
  if (rotation === 'random') {
    return available[Math.floor(Math.random() * available.length)]
  }
  // Round-robin
  const key = available.join(',')
  const i = (rrIndex.get(key) || 0) % available.length
  rrIndex.set(key, i + 1)
  return available[i]
}

// Remove caracteres não numéricos do telefone
function sanitizePhone(phone) {
  return phone.replace(/\D/g, '')
}

function safeParseJSON(str) {
  try { return JSON.parse(str) } catch (_) { return {} }
}

function logSend(campaignId, instanceId, phone, status, message) {
  try {
    getDB().prepare(`
      INSERT INTO logs (campaign_id, instance_id, phone, status, message)
      VALUES (?, ?, ?, ?, ?)
    `).run(campaignId, instanceId, phone, status, message)
  } catch (_) {}
}

function emitQueueUpdate(campaignId) {
  try {
    const db = getDB()
    const stats = db.prepare(`
      SELECT
        SUM(CASE WHEN status = 'sent'    THEN 1 ELSE 0 END) as sent,
        SUM(CASE WHEN status = 'pending' OR status = 'sending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'failed' OR status = 'invalid' THEN 1 ELSE 0 END) as failed,
        COUNT(*) as total
      FROM queue WHERE campaign_id = ?
    `).get(campaignId)
    getIO().emit('campaign:progress', { campaignId, ...stats })
  } catch (_) {}
}

function emitCampaignUpdate(campaignId) {
  try {
    getIO().emit('campaign:done', { campaignId })
  } catch (_) {}
}

function stopSenderLoop() { running = false }

module.exports = { startSenderLoop, stopSenderLoop }
