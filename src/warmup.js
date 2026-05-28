/**
 * Módulo de Aquecimento — RHImob Wazap
 * Gerencia o aquecimento de chips via Evolution API
 * Chips se comunicam entre si + roteiro de mídias RHImob
 */

const path = require('path')
const fs   = require('fs')
const { getDB } = require('./db')

const EVO_URL     = process.env.EVO_URL     || 'http://localhost:8080'
const EVO_API_KEY = process.env.EVO_API_KEY || 'rhimob2024api'

// ─── Plano de aquecimento padrão (dias → msgs/dia) ─────────────────────────
const WARMUP_PLAN = [
  { day: 1,  msgs: 5,  media_chance: 0   },
  { day: 3,  msgs: 10, media_chance: 0.2 },
  { day: 5,  msgs: 18, media_chance: 0.3 },
  { day: 7,  msgs: 30, media_chance: 0.4 },
  { day: 10, msgs: 50, media_chance: 0.5 },
  { day: 14, msgs: 80, media_chance: 0.5 },
  { day: 21, msgs: 120, media_chance: 0.6 },
]

// Textos de conversa para aquecimento (parecem naturais)
const WARMUP_TEXTS = [
  // Apresentação RHImob
  'Olá! Somos da RHImob, especialistas em recrutamento imobiliário 🏠',
  'Oi! A RHImob conecta corretores de imóveis com as melhores oportunidades do mercado.',
  'Bom dia! Você conhece a RHImob? Trabalhamos com recrutamento no setor imobiliário 📋',
  // Conversas naturais
  'Tudo bem por aí? 😊',
  'Boa tarde! Como está o mercado imobiliário na sua região?',
  'Olá! Recebeu nosso material?',
  'Obrigado pelo contato! Ficamos à disposição.',
  'Oi! Qualquer dúvida, estamos aqui 👋',
  // Conteúdo imobiliário
  'Você sabia que a RHImob já ajudou mais de 500 corretores a encontrar novas oportunidades? 🎯',
  'O mercado imobiliário está aquecido! Aproveite as oportunidades. 🏡',
  'Quer saber mais sobre como a RHImob pode ajudar sua carreira?',
  'Acesse rhimob.com.br e conheça nossas vagas para corretores!',
  'Temos ótimas imobiliárias parceiras buscando profissionais como você!',
  'Sua experiência no mercado imobiliário é muito valiosa 💼',
  'Corretores CRECI têm prioridade em nosso processo de recrutamento!',
]

function getRandText() {
  return WARMUP_TEXTS[Math.floor(Math.random() * WARMUP_TEXTS.length)]
}

function getMsgsForDay(day) {
  let plan = WARMUP_PLAN[0]
  for (const p of WARMUP_PLAN) {
    if (day >= p.day) plan = p
  }
  return plan
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

// ─── Evolution API helpers ─────────────────────────────────────────────────

async function evoFetch(method, endpoint, body = null) {
  const { default: fetch } = await import('node-fetch').catch(() => ({ default: require('node-fetch') }))
  const opts = {
    method,
    headers: { 'apikey': EVO_API_KEY, 'Content-Type': 'application/json' },
  }
  if (body) opts.body = JSON.stringify(body)
  const res = await fetch(`${EVO_URL}${endpoint}`, opts)
  const text = await res.text()
  try { return JSON.parse(text) } catch { return { raw: text } }
}

async function sendText(instanceName, phone, text) {
  return evoFetch('POST', `/message/sendText/${instanceName}`, {
    number: phone,
    text,
    delay: Math.floor(Math.random() * 2000) + 500
  })
}

async function sendMedia(instanceName, phone, mediaUrl, caption, mediaType = 'image') {
  const typeMap = { image: 'image', video: 'video', document: 'document', pdf: 'document' }
  const type = typeMap[mediaType] || 'image'
  return evoFetch('POST', `/message/sendMedia/${instanceName}`, {
    number: phone,
    mediatype: type,
    media: mediaUrl,
    caption: caption || ''
  })
}

async function getInstanceStatus(instanceName) {
  try {
    const r = await evoFetch('GET', `/instance/connectionState/${instanceName}`)
    return r?.instance?.state || 'unknown'
  } catch { return 'unknown' }
}

// ─── Engine principal ──────────────────────────────────────────────────────

async function runWarmupCycle() {
  const db = getDB()

  // Atualiza dias de aquecimento (conta dias desde warmup_start)
  const instances = db.prepare(`
    SELECT * FROM warmup_instances WHERE status = 'warming'
  `).all()

  if (!instances.length) return

  const today = new Date().toISOString().slice(0, 10)

  for (const inst of instances) {
    // Calcula dias desde início
    const start    = new Date(inst.warmup_start)
    const now      = new Date()
    const daysDiff = Math.floor((now - start) / (1000 * 60 * 60 * 24)) + 1

    if (daysDiff !== inst.warmup_day) {
      db.prepare(`UPDATE warmup_instances SET warmup_day = ? WHERE id = ?`)
        .run(daysDiff, inst.id)
    }

    // Se chegou ao dia 21+, marca como pronto
    if (daysDiff >= 21) {
      db.prepare(`UPDATE warmup_instances SET status = 'ready' WHERE id = ?`)
        .run(inst.id)
      console.log(`🔥 Chip ${inst.id} aquecimento concluído — pronto para uso!`)
    }
  }

  // Pega instâncias ativas para aquecimento
  const warmingInstances = db.prepare(`
    SELECT * FROM warmup_instances WHERE status = 'warming' ORDER BY RANDOM()
  `).all()

  if (warmingInstances.length < 2) {
    console.log('⚠️ Warmup: precisa de pelo menos 2 instâncias para aquecer entre si')
    return
  }

  // Também inclui instâncias "ready" como destino (mais naturais para conversar)
  const allInstances = db.prepare(`
    SELECT * FROM warmup_instances WHERE status IN ('warming', 'ready')
  `).all()

  // Para cada instância aquecendo, envia mensagens para outras
  for (const fromInst of warmingInstances) {
    // Verifica se está conectada
    const connState = await getInstanceStatus(fromInst.evo_instance)
    if (!connState.includes('open') && connState !== 'open') {
      console.log(`⚠️ Warmup: instância ${fromInst.evo_instance} não conectada (${connState})`)
      continue
    }

    const plan = getMsgsForDay(fromInst.warmup_day)

    // Divide mensagens diárias ao longo do dia (por ciclo = msgs/6 ciclos diários)
    const msgsThisCycle = Math.ceil(plan.msgs / 6)

    // Seleciona destinos (excluindo a própria instância)
    const targets = allInstances.filter(i => i.id !== fromInst.id && i.phone)
    if (!targets.length) continue

    for (let m = 0; m < msgsThisCycle; m++) {
      const target = targets[Math.floor(Math.random() * targets.length)]

      // Decide se envia mídia ou texto
      const sendMediaMsg = Math.random() < plan.media_chance

      if (sendMediaMsg) {
        // Busca mídia disponível para o dia atual
        const media = db.prepare(`
          SELECT * FROM warmup_media
          WHERE active = 1 AND send_on_day <= ?
          ORDER BY RANDOM() LIMIT 1
        `).get(fromInst.warmup_day)

        if (media) {
          const mediaUrl = `${process.env.BASE_URL || 'http://localhost:3000'}/uploads/warmup/${media.filename}`
          await sendMedia(fromInst.evo_instance, target.phone, mediaUrl, media.caption, media.media_type)

          db.prepare(`INSERT INTO warmup_log (from_instance, to_instance, message, media_id, status) VALUES (?,?,?,?,?)`)
            .run(fromInst.id, target.id, `[mídia: ${media.original_name}]`, media.id, 'sent')
        } else {
          // Fallback: texto
          const text = getRandText()
          await sendText(fromInst.evo_instance, target.phone, text)
          db.prepare(`INSERT INTO warmup_log (from_instance, to_instance, message, status) VALUES (?,?,?,?)`)
            .run(fromInst.id, target.id, text, 'sent')
        }
      } else {
        const text = getRandText()
        await sendText(fromInst.evo_instance, target.phone, text)
        db.prepare(`INSERT INTO warmup_log (from_instance, to_instance, message, status) VALUES (?,?,?,?)`)
          .run(fromInst.id, target.id, text, 'sent')
      }

      // Delay humano entre mensagens (3-8 segundos)
      await sleep(3000 + Math.random() * 5000)
    }

    console.log(`🔥 Warmup ${fromInst.id} (Dia ${fromInst.warmup_day}): ${msgsThisCycle} msgs enviadas`)
  }
}

// ─── Inicia o loop de aquecimento ─────────────────────────────────────────

let warmupTimer = null

function startWarmupScheduler() {
  if (warmupTimer) return

  // Roda a cada 4 horas (6 ciclos por dia)
  const INTERVAL = 4 * 60 * 60 * 1000

  async function tick() {
    const hour = new Date().getHours()
    // Só aquece das 8h às 22h
    if (hour >= 8 && hour <= 22) {
      console.log(`🔥 Iniciando ciclo de aquecimento (${new Date().toLocaleTimeString()})`)
      try { await runWarmupCycle() }
      catch (e) { console.error('Erro no ciclo de aquecimento:', e.message) }
    }
    warmupTimer = setTimeout(tick, INTERVAL)
  }

  // Primeiro ciclo após 30 segundos (deixa o sistema subir)
  setTimeout(tick, 30000)
  console.log('🔥 Agendador de aquecimento iniciado (ciclos a cada 4h, 08h-22h)')
}

function stopWarmupScheduler() {
  if (warmupTimer) { clearTimeout(warmupTimer); warmupTimer = null }
}

module.exports = { startWarmupScheduler, stopWarmupScheduler, runWarmupCycle, sendText, sendMedia, getInstanceStatus, WARMUP_PLAN }
