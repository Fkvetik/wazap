/**
 * Gerenciador de instâncias Baileys — conecta múltiplos números simultaneamente
 */

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  isJidBroadcast
} = require('@whiskeysockets/baileys')
const pino = require('pino')
const path = require('path')
const fs = require('fs')
const { getDB } = require('./db')
const { getIO } = require('./socket')

const SESSIONS_DIR = path.join(__dirname, '..', 'data', 'sessions')

// Callback injetado pelo index.js para evitar dependência circular
let _incomingHandler = null
function setIncomingHandler(fn) { _incomingHandler = fn }
if (!fs.existsSync(SESSIONS_DIR)) fs.mkdirSync(SESSIONS_DIR, { recursive: true })

// Logger silencioso para não poluir o terminal
const logger = pino({ level: 'silent' })

// Map em memória: instanceId -> socket Baileys
const sockets = new Map()

// Map temporário: instanceId -> qrCode (base64 PNG)
const qrCodes = new Map()

async function createInstance(instanceId) {
  const sessionPath = path.join(SESSIONS_DIR, instanceId)
  if (!fs.existsSync(sessionPath)) fs.mkdirSync(sessionPath, { recursive: true })

  const { state, saveCreds } = await useMultiFileAuthState(sessionPath)
  const { version } = await fetchLatestBaileysVersion()

  const sock = makeWASocket({
    version,
    logger,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger)
    },
    printQRInTerminal: false,
    generateHighQualityLinkPreview: false,
    // Ignora mensagens de broadcast para não processar lixo
    shouldIgnoreJid: jid => isJidBroadcast(jid)
  })

  // Salva credenciais a cada atualização
  sock.ev.on('creds.update', saveCreds)

  // Eventos de conexão
  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update

    if (qr) {
      // Converte QR para imagem base64 e emite via Socket.IO
      const QRCode = require('qrcode')
      const qrBase64 = await QRCode.toDataURL(qr)
      qrCodes.set(instanceId, qrBase64)
      emitStatus(instanceId, 'qr', { qr: qrBase64 })
    }

    if (connection === 'open') {
      const phone = sock.user?.id?.split(':')[0] || ''
      qrCodes.delete(instanceId)
      sockets.set(instanceId, sock)
      updateInstanceDB(instanceId, { status: 'connected', phone, banned: 0 })
      emitStatus(instanceId, 'connected', { phone })
      console.log(`✅ Instância [${instanceId}] conectada — ${phone}`)
    }

    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode
      const errMsg = lastDisconnect?.error?.message || ''

      // Log detalhado para diagnóstico
      console.log(`🔌 Instância [${instanceId}] desconectou — code: ${code} | msg: ${errMsg}`)

      // 401 = deslogado pelo usuário ou sessão expirada — não reconecta
      if (code === DisconnectReason.loggedOut) {
        console.log(`🚫 Instância [${instanceId}] deslogada (401)`)
        updateInstanceDB(instanceId, { status: 'disconnected', banned: 0 })
        emitStatus(instanceId, 'disconnected', {})
        sockets.delete(instanceId)
        return
      }

      // 403 = ban CONFIRMADO — só marca como banido se a mensagem indicar explicitamente
      // (evita falsos positivos em falhas de rede ou protocolo)
      if (code === DisconnectReason.forbidden) {
        const isBan = errMsg.toLowerCase().includes('ban')
          || errMsg.toLowerCase().includes('blocked')
          || errMsg.toLowerCase().includes('forbidden')
        if (isBan) {
          console.log(`⛔ Instância [${instanceId}] BANIDA (403 + mensagem de ban)`)
          updateInstanceDB(instanceId, { status: 'banned', banned: 1 })
          emitStatus(instanceId, 'banned', {})
          sockets.delete(instanceId)
          return
        }
        // 403 sem mensagem de ban = falha de protocolo → reconecta
        console.log(`⚠️  Instância [${instanceId}] 403 sem ban confirmado, reconectando...`)
      }

      // 515 = restart necessário pelo servidor do WhatsApp
      if (code === DisconnectReason.restartRequired) {
        console.log(`🔄 Instância [${instanceId}] restart solicitado pelo WA, reconectando...`)
      }

      // Qualquer outro código: reconecta automaticamente em 5s
      updateInstanceDB(instanceId, { status: 'reconnecting' })
      emitStatus(instanceId, 'reconnecting', {})
      sockets.delete(instanceId)
      setTimeout(() => createInstance(instanceId), 5000)
    }
  })

  // Listener de mensagens recebidas (para o chatbot)
  sock.ev.on('messages.upsert', ({ messages, type }) => {
    if (type !== 'notify') return
    for (const msg of messages) {
      if (msg.key?.fromMe) continue                          // ignora próprias mensagens
      if (msg.key?.remoteJid?.endsWith('@g.us')) continue    // ignora grupos

      const phone    = (msg.key.remoteJid || '').replace('@s.whatsapp.net', '')
      const isAudio  = !!(msg.message?.audioMessage || msg.message?.pttMessage)
      const text     = isAudio ? '[AUDIO]'
        : (msg.message?.conversation
          || msg.message?.extendedTextMessage?.text
          || msg.message?.imageMessage?.caption
          || msg.message?.videoMessage?.caption
          || '')
      const leadName = msg.pushName || ''

      if (!phone) continue

      // Passa para o chatbot (callback injetado pelo index.js)
      if (_incomingHandler) {
        _incomingHandler(instanceId, phone, text, isAudio, leadName).catch(() => {})
      }
    }
  })

  return sock
}

function updateInstanceDB(instanceId, fields) {
  try {
    const db = getDB()
    const sets = Object.entries(fields).map(([k]) => `${k} = ?`).join(', ')
    const vals = Object.values(fields)
    db.prepare(`UPDATE instances SET ${sets} WHERE id = ?`).run(...vals, instanceId)
  } catch (_) {}
}

function emitStatus(instanceId, event, data) {
  try {
    const io = getIO()
    io.emit('instance:update', { instanceId, event, ...data })
  } catch (_) {}
}

// Envia mensagem com retry interno (retorna true/false)
async function sendMessage(instanceId, phone, payload) {
  const sock = sockets.get(instanceId)
  if (!sock) throw new Error(`Instância ${instanceId} não está conectada`)

  // Formato JID do WhatsApp
  const jid = phone.includes('@') ? phone : `${phone}@s.whatsapp.net`

  // Simula digitação antes de enviar (anti-ban)
  await sock.sendPresenceUpdate('composing', jid)
  await sleep(randomBetween(1500, 3500))
  await sock.sendPresenceUpdate('paused', jid)

  await sock.sendMessage(jid, payload)

  // Incrementa contador diário
  const db = getDB()
  db.prepare(`UPDATE instances SET sent_today = sent_today + 1 WHERE id = ?`).run(instanceId)

  return true
}

// Verifica se número existe no WhatsApp antes de enviar
async function validatePhone(instanceId, phone) {
  const sock = sockets.get(instanceId)
  if (!sock) return false
  try {
    const jid = `${phone}@s.whatsapp.net`
    const [result] = await sock.onWhatsApp(jid)
    return result?.exists === true
  } catch (_) {
    return false
  }
}

const instanceManager = {
  // Restaura instâncias salvas no banco ao iniciar
  async restoreInstances() {
    const db = getDB()
    const rows = db.prepare(`SELECT id FROM instances WHERE banned = 0`).all()
    for (const row of rows) {
      updateInstanceDB(row.id, { status: 'connecting' })
      await createInstance(row.id)
      await sleep(1500)
    }
  },

  // Adiciona nova instância
  async addInstance(instanceId) {
    const db = getDB()
    const exists = db.prepare(`SELECT id FROM instances WHERE id = ?`).get(instanceId)
    if (!exists) {
      db.prepare(`INSERT INTO instances (id, status) VALUES (?, 'connecting')`).run(instanceId)
    }
    return createInstance(instanceId)
  },

  // Remove instância (desconecta e apaga sessão)
  async removeInstance(instanceId) {
    const sock = sockets.get(instanceId)
    if (sock) {
      try { await sock.logout() } catch (_) {}
      sockets.delete(instanceId)
    }
    const db = getDB()
    db.prepare(`DELETE FROM instances WHERE id = ?`).run(instanceId)
    const sessionPath = path.join(SESSIONS_DIR, instanceId)
    fs.rmSync(sessionPath, { recursive: true, force: true })
  },

  getQR(instanceId) { return qrCodes.get(instanceId) || null },
  getSockets() { return sockets },
  sendMessage,
  validatePhone,

  async sendPresence(instanceId, phone, presence) {
    const sock = sockets.get(instanceId)
    if (!sock) return
    const jid = phone.includes('@') ? phone : `${phone}@s.whatsapp.net`
    await sock.sendPresenceUpdate(presence, jid)
  },

  // Retorna instâncias disponíveis (conectadas e não banidas e dentro do limite diário)
  getAvailable(campaignDailyLimit) {
    const db = getDB()
    return db.prepare(`
      SELECT id FROM instances
      WHERE status = 'connected'
        AND banned = 0
        AND sent_today < ?
    `).all(campaignDailyLimit).map(r => r.id)
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }
function randomBetween(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min }

module.exports = { instanceManager, sleep, randomBetween, setIncomingHandler }
