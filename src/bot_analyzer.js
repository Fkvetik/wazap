/**
 * Motor de análise de funil do chatbot
 * Avalia bot_log e gera sugestões reais aplicáveis às decisões e mensagens
 */

const { getDB } = require('./db')

// ── Helpers ────────────────────────────────────────────────────

function normText(s) {
  return String(s || '').toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ').trim()
}

// Extrai palavras relevantes de um texto (remove stopwords comuns)
const STOPWORDS = new Set([
  'a','o','e','de','do','da','em','no','na','os','as','um','uma','que','se','por',
  'com','para','eu','me','meu','minha','sim','nao','nao','ok','oi','olá','ola',
  'bom','dia','tarde','noite','tudo','bem','mais','mas','pois','isso','aqui','ali',
  'só','so','já','ja','né','ne','aí','ai','lá','la','tá','ta','vou','foi','fui',
  'tem','ter','ser','está','esta','esse','essa','este','esta','isso','aquilo',
])

function extractKeywords(text) {
  return normText(text)
    .split(/\s+/)
    .filter(w => w.length > 3 && !STOPWORDS.has(w))
}

// Agrupa textos similares por palavras-chave compartilhadas
function clusterTexts(texts) {
  const freq = {}
  for (const t of texts) {
    for (const w of extractKeywords(t)) {
      freq[w] = (freq[w] || 0) + 1
    }
  }
  // Retorna palavras que aparecem em ≥2 mensagens, ordenadas por frequência
  return Object.entries(freq)
    .filter(([, c]) => c >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([w, c]) => ({ word: w, count: c }))
}

// Verifica se uma palavra já existe nas keywords de alguma decisão do estágio
function wordAlreadyCovered(word, stage, decisions) {
  for (const d of decisions) {
    if (d.stage !== stage && d.stage !== 'QUALQUER') continue
    const kws = String(d.keywords || '').toLowerCase()
    if (kws.includes(word)) return true
  }
  return false
}

// ── Análise específica por telefone ───────────────────────────

function analyzePhone(phone) {
  const db = getDB()

  const logs = db.prepare(`
    SELECT * FROM bot_log WHERE phone = ? ORDER BY created_at ASC
  `).all(phone)

  if (!logs.length) return { found: false }

  const state = db.prepare(`SELECT * FROM bot_state WHERE phone = ?`).get(phone)
  const queueRow = db.prepare(`SELECT name FROM queue WHERE phone = ? LIMIT 1`).get(phone)

  const timeline = logs.map(l => ({
    ts:        l.created_at,
    stage:     l.stage,
    text:      l.text_recv,
    intent:    l.intent,
    nextStage: l.next_stage,
    fallback:  !!l.was_fallback,
    audio:     !!l.is_audio,
  }))

  const fallbacks = logs.filter(l => l.was_fallback)
  const stuck = logs.filter(l => l.stage === l.next_stage && !l.was_fallback && l.intent !== 'ACK_NEUTRO')

  const decisions = db.prepare(`SELECT * FROM bot_decisions WHERE active = 1`).all()

  const suggestions = []

  // Sugestões baseadas em fallbacks desse lead
  for (const fb of fallbacks) {
    if (!fb.text_recv || fb.text_recv === '[AUDIO]') continue
    const words = extractKeywords(fb.text_recv)
    if (!words.length) continue

    // Descobre qual seria a intenção mais próxima para o estágio
    const stageDecisions = decisions.filter(d =>
      (d.stage === fb.stage || d.stage === 'QUALQUER') && d.intent !== 'FALLBACK'
    )

    // Encontra decisão com maior sobreposição de palavras-chave
    let bestMatch = null
    let bestScore = 0
    for (const d of stageDecisions) {
      const dKws = normText(d.keywords).split(',').map(k => k.trim())
      let score = 0
      for (const w of words) {
        if (dKws.some(k => k.includes(w) || w.includes(k))) score++
      }
      if (score > bestScore) { bestScore = score; bestMatch = d }
    }

    if (bestMatch && bestScore > 0) {
      const newWords = words.filter(w => !wordAlreadyCovered(w, fb.stage, decisions))
      if (newWords.length) {
        suggestions.push({
          type: 'ADD_KEYWORDS',
          severity: 'medium',
          description: `Lead disse "${fb.text_recv.slice(0,60)}" no estágio ${fb.stage} e caiu em FALLBACK. Palavras próximas existem na intenção "${bestMatch.intent}".`,
          action: `Adicionar às keywords da intenção "${bestMatch.intent}" (estágio ${bestMatch.stage}): ${newWords.slice(0,4).join(', ')}`,
          decisionId: bestMatch.id,
          currentKeywords: bestMatch.keywords,
          addKeywords: newWords.slice(0, 4).join(','),
        })
      }
    } else {
      // Não encontrou match — sugere nova regra
      if (words.length >= 2) {
        suggestions.push({
          type: 'NEW_DECISION',
          severity: 'high',
          description: `Lead disse "${fb.text_recv.slice(0,60)}" no estágio ${fb.stage} mas nenhuma regra captou.`,
          action: `Criar nova regra no estágio ${fb.stage} com keywords: ${words.slice(0,5).join(', ')}`,
          suggestedDecision: {
            stage: fb.stage,
            intent: 'DUVIDA_' + (words[0] || 'GERAL').toUpperCase(),
            keywords: words.slice(0, 5).join(','),
            msg_ids: '',
            next_stage: 'MESMO',
            priority: 80,
          }
        })
      }
    }
  }

  // Sugestão se lead ficou preso em estágio muito tempo
  if (stuck.length >= 2) {
    const stuckStage = stuck[0].stage
    suggestions.push({
      type: 'STUCK_STAGE',
      severity: 'low',
      description: `Lead ficou em loop no estágio ${stuckStage} — respondeu ${stuck.length} vezes sem avançar.`,
      action: `Revisar as mensagens do estágio ${stuckStage} — pode estar faltando uma CTA mais clara ou o lead não entendeu o que fazer.`,
    })
  }

  return {
    found: true,
    phone,
    name:       queueRow?.name || '',
    state,
    timeline,
    fallbackCount: fallbacks.length,
    totalMessages: logs.length,
    suggestions,
  }
}

// ── Análise geral do funil ─────────────────────────────────────

function analyzeGeneral() {
  const db = getDB()
  const decisions = db.prepare(`SELECT * FROM bot_decisions WHERE active = 1`).all()

  const totalLogs = db.prepare(`SELECT COUNT(*) as c FROM bot_log`).get()?.c || 0
  if (!totalLogs) {
    return { empty: true, message: 'Ainda não há conversas registradas. O log começa a partir de agora.' }
  }

  // ── 1. Taxa de fallback por estágio
  const fallbackByStage = db.prepare(`
    SELECT stage, COUNT(*) as total,
           SUM(was_fallback) as fallbacks
    FROM bot_log
    GROUP BY stage
    ORDER BY fallbacks DESC
  `).all()

  // ── 2. Textos que caíram em fallback (não reconhecidos)
  const fallbackTexts = db.prepare(`
    SELECT text_recv, stage, COUNT(*) as freq
    FROM bot_log
    WHERE was_fallback = 1 AND text_recv != '' AND text_recv != '[AUDIO]'
    GROUP BY text_recv, stage
    ORDER BY freq DESC
    LIMIT 50
  `).all()

  // ── 3. Conversas por destino final
  const outcomes = db.prepare(`
    SELECT
      SUM(CASE WHEN humano=1 THEN 1 ELSE 0 END)  as humano,
      SUM(CASE WHEN blocked=1 AND humano=0 THEN 1 ELSE 0 END) as negativa,
      SUM(CASE WHEN blocked=0 AND humano=0 THEN 1 ELSE 0 END) as ativo
    FROM bot_state
  `).get()

  // ── 4. Estágios onde leads abandonam (último estágio antes de blocked/NEG)
  const dropStages = db.prepare(`
    SELECT last_intent, stage, COUNT(*) as total
    FROM bot_state
    WHERE blocked = 1 AND humano = 0
    GROUP BY last_intent, stage
    ORDER BY total DESC
    LIMIT 10
  `).all()

  // ── 5. Intenções mais acionadas (para detectar o que mais preocupa os leads)
  const topIntents = db.prepare(`
    SELECT intent, stage, COUNT(*) as total
    FROM bot_log
    WHERE intent NOT LIKE '%FALLBACK%' AND intent NOT LIKE '%PADRAO%'
    GROUP BY intent, stage
    ORDER BY total DESC
    LIMIT 15
  `).all()

  // ── Gera sugestões ─────────────────────────────────────────

  const suggestions = []

  // Sugestão A: estágios com alta taxa de fallback
  for (const row of fallbackByStage) {
    if (!row.total) continue
    const rate = Math.round((row.fallbacks / row.total) * 100)
    if (rate >= 20 && row.fallbacks >= 3) {
      suggestions.push({
        type: 'HIGH_FALLBACK_STAGE',
        severity: rate >= 40 ? 'high' : 'medium',
        description: `Estágio ${row.stage}: ${rate}% das mensagens (${row.fallbacks}/${row.total}) caíram em FALLBACK — não foram reconhecidas por nenhuma regra.`,
        action: 'Revisar keywords das decisões desse estágio ou criar novas regras para capturar os textos abaixo.',
      })
    }
  }

  // Sugestão B: palavras recorrentes não reconhecidas → adicionar a decisões existentes
  const fallbacksByStageBucket = {}
  for (const row of fallbackTexts) {
    if (!fallbacksByStageBucket[row.stage]) fallbacksByStageBucket[row.stage] = []
    fallbacksByStageBucket[row.stage].push(row.text_recv)
  }

  for (const [stage, texts] of Object.entries(fallbacksByStageBucket)) {
    const clusters = clusterTexts(texts)
    for (const { word, count } of clusters) {
      if (wordAlreadyCovered(word, stage, decisions)) continue

      // Procura decisão mais adequada para receber essa keyword
      const stageDecisions = decisions.filter(d =>
        (d.stage === stage || d.stage === 'QUALQUER') &&
        !['FALLBACK','OPT_OUT','NEGATIVA','HUMANO','AUDIO'].includes(d.intent)
      )

      // Tenta casar pelo tema da palavra
      const TEMA_MAP = {
        salari: 'DUVIDA_SALARIO', comissao: 'DUVIDA_SALARIO', ganho: 'DUVIDA_SALARIO', pagamento: 'DUVIDA_SALARIO',
        horari: 'DUVIDA_ROTINA', carga: 'DUVIDA_ROTINA', plantao: 'DUVIDA_ROTINA', expediente: 'DUVIDA_ROTINA',
        creci: 'DUVIDA_EXPERIENCIA_CRECI', registro: 'DUVIDA_EXPERIENCIA_CRECI', experiencia: 'DUVIDA_EXPERIENCIA_CRECI',
        local: 'DUVIDA_LOCAL', cidade: 'DUVIDA_LOCAL', regiao: 'DUVIDA_LOCAL', bairro: 'DUVIDA_LOCAL',
        empresa: 'DUVIDA_EMPRESA_ATUACAO', cargo: 'DUVIDA_EMPRESA_ATUACAO', funcao: 'DUVIDA_EMPRESA_ATUACAO',
        golpe: 'DUVIDA_CONFIANCA', verdade: 'DUVIDA_CONFIANCA', confiar: 'DUVIDA_CONFIANCA',
        parceri: 'DUVIDA_PARCEIRO_INDICACAO', indicacao: 'DUVIDA_PARCEIRO_INDICACAO',
        mcmv: 'DUVIDA_MCMV', habitacional: 'DUVIDA_MCMV',
      }

      let targetIntent = null
      for (const [prefix, intent] of Object.entries(TEMA_MAP)) {
        if (word.startsWith(prefix)) { targetIntent = intent; break }
      }

      const targetDecision = stageDecisions.find(d =>
        targetIntent ? d.intent === targetIntent : d.intent === 'DUVIDA_GERAL'
      ) || stageDecisions.find(d => d.intent === 'DUVIDA_GERAL')

      if (targetDecision) {
        suggestions.push({
          type: 'ADD_KEYWORDS',
          severity: 'medium',
          description: `A palavra "${word}" apareceu ${count}x em fallbacks no estágio ${stage} mas não está em nenhuma regra.`,
          action: `Adicionar "${word}" às keywords da intenção "${targetDecision.intent}" (estágio ${targetDecision.stage}).`,
          decisionId: targetDecision.id,
          currentKeywords: targetDecision.keywords,
          addKeywords: word,
        })
      } else {
        suggestions.push({
          type: 'NEW_DECISION',
          severity: 'high',
          description: `A palavra "${word}" apareceu ${count}x em fallbacks no estágio ${stage} e não existe regra adequada para capturá-la.`,
          action: `Criar nova regra no estágio ${stage} para capturar mensagens com "${word}".`,
          suggestedDecision: {
            stage,
            intent: 'DUVIDA_' + word.toUpperCase().slice(0, 20),
            keywords: word,
            msg_ids: '',
            next_stage: 'MESMO',
            priority: 80,
          }
        })
      }
    }
  }

  // Sugestão C: intenções muito acionadas que não têm resposta específica
  const INTENTS_WITH_SPECIFIC_MSG = new Set([
    'DUVIDA_SALARIO','DUVIDA_ROTINA','DUVIDA_LOCAL','DUVIDA_EXPERIENCIA_CRECI',
    'DUVIDA_EMPRESA_ATUACAO','DUVIDA_CONFIANCA','DUVIDA_PARCEIRO_INDICACAO',
    'DUVIDA_MCMV','JA_ATUANDO_IMOBILIARIA'
  ])
  for (const row of topIntents) {
    if (row.total >= 5 && !INTENTS_WITH_SPECIFIC_MSG.has(row.intent)) {
      const dec = decisions.find(d => d.intent === row.intent && (d.stage === row.stage || d.stage === 'QUALQUER'))
      if (dec && !dec.msg_ids.match(/MSG_DUVIDA|MSG_JA_/)) {
        suggestions.push({
          type: 'MISSING_SPECIFIC_MSG',
          severity: 'low',
          description: `A intenção "${row.intent}" foi acionada ${row.total}x no estágio ${row.stage} mas não tem uma mensagem de resposta específica — usa o bloco padrão do estágio.`,
          action: `Considerar criar uma MSG_${row.intent} com resposta direta para essa dúvida, melhorando a experiência do lead.`,
        })
      }
    }
  }

  // Sugestão D: leads que abandonam em estágio específico
  for (const row of dropStages.slice(0, 3)) {
    if (row.total >= 3) {
      suggestions.push({
        type: 'DROP_STAGE',
        severity: 'medium',
        description: `${row.total} leads saíram como negativa após a intenção "${row.last_intent}" no estágio "${row.stage}".`,
        action: `Revisar o que o bot responde após "${row.last_intent}" nesse estágio — pode ser que a mensagem esteja afastando leads que ainda tinham interesse.`,
      })
    }
  }

  // Sugestão E: alinhamento CTA → Keywords (sempre roda, não depende de logs)
  const ctaIssues = analyzeCTAAlignment()
  suggestions.push(...ctaIssues)

  // ── Remove duplicatas de sugestões (mesmo decisionId + addKeywords)
  const seen = new Set()
  const uniqueSuggestions = suggestions.filter(s => {
    const key = `${s.type}|${s.decisionId || ''}|${s.addKeywords || s.action?.slice(0,40) || ''}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  return {
    empty: false,
    stats: {
      totalMessages: totalLogs,
      outcomes,
      fallbackByStage,
      topIntents,
      dropStages,
    },
    suggestions: uniqueSuggestions,
  }
}

// Análise de alinhamento puro (sem necessidade de logs)
function analyzeCTAOnly() {
  const issues = analyzeCTAAlignment()
  return {
    empty: issues.length === 0,
    message: issues.length === 0 ? 'Todas as CTAs das mensagens estão cobertas pelas keywords das decisões.' : null,
    stats: null,
    suggestions: issues,
  }
}

// ── Análise de alinhamento CTA → Keywords ─────────────────────
//
// Verifica se o que o bot pede ao lead no final de cada estágio
// está coberto pelas keywords das decisões que AVANÇAM o funil.
// Ex: mensagem diz "responda com TENHO INTERESSE" mas a decisão
// só tem "quero seguir" → lead cai em FALLBACK mesmo obedecendo.

function analyzeCTAAlignment() {
  const db = getDB()
  const decisions = db.prepare(`SELECT * FROM bot_decisions WHERE active = 1 ORDER BY priority DESC`).all()
  const messages  = db.prepare(`SELECT * FROM bot_messages`).all()
  const msgMap    = {}
  for (const m of messages) msgMap[m.msg_id] = m

  // Estágios lineares do funil — ordem importa
  const STAGES = ['WEBHOOK','INFO2','COMPLEMENTO','AGENDAMENTO']

  // Decisões que avançam o funil (advances=1 OU muda de estágio)
  function getAdvancingDecisions(stage) {
    return decisions.filter(d =>
      (d.stage === stage) &&
      d.active &&
      !['FALLBACK','OPT_OUT','NEGATIVA','NEGATIVA_FORTE','NEGATIVA_EDUCADA',
        'DECLINIO','PAUSA_COMERCIAL','HUMANO','AUDIO','LIDERANCA_CONTRATANTE',
        'ACK_NEUTRO'].includes(d.intent) &&
      (d.advances === 1 || (d.next_stage && d.next_stage !== 'MESMO' && d.next_stage !== stage))
    )
  }

  // Extrai frases CTA explícitas de um texto de mensagem
  // Captura padrões como: "responda com X", "pode dizer X", "escolha X",
  // "responda X", palavras entre aspas/itálico, listas com •/1️⃣/números
  function extractCTAPhrases(text) {
    const t = normText(text)
    const phrases = new Set()

    // Padrão: "responda com/apenas X" / "pode responder X" / "escreva X"
    const cmdPatterns = [
      /responda(?:\s+com)?\s+[""']?([^""'\n,\.]{3,40})[""']?/gi,
      /pode\s+(?:responder|dizer|escrever|digitar)\s+[""']?([^""'\n,\.]{3,40})[""']?/gi,
      /(?:diga|escreva|digite)\s+[""']?([^""'\n,\.]{3,40})[""']?/gi,
      /(?:escolha|informe|selecione)\s+[""']?([^""'\n,\.]{3,40})[""']?/gi,
    ]
    for (const pat of cmdPatterns) {
      let m
      while ((m = pat.exec(text)) !== null) {
        phrases.add(normText(m[1]))
      }
    }

    // Itens numerados (1️⃣ 2️⃣ 1. 2.) SÓ se o texto contiver verbo de instrução
    // Bullets com • são informativos — NÃO extrair como CTA
    const hasInstruction = /responda|escolha|informe|selecione|digit|escreva|pode responder/i.test(text)
    if (hasInstruction) {
      const lines = text.split('\n')
      for (const line of lines) {
        // Ignora linhas que começam com • (bullet informativo)
        if (line.trim().startsWith('•') || line.trim().startsWith('-')) continue
        const clean = normText(line).replace(/^[\d1️⃣2️⃣✅\*]+[\.\)]\s*/, '').trim()
        // Só aceita itens numerados explícitos (1. / 1️⃣ / 2.)
        if (clean.length >= 4 && clean.length <= 50 && line.match(/^[\s]*[1-9][\.⃣\)]|^[\s]*[1-9️⃣]/)) {
          phrases.add(clean)
        }
      }
    }

    // Palavras entre aspas
    const quoted = [...text.matchAll(/[""']([\w\s]{3,30})[""']/g)]
    for (const q of quoted) phrases.add(normText(q[1]))

    return [...phrases].filter(p => p.length >= 3)
  }

  // Verifica se uma frase CTA está coberta pelas keywords de uma decisão
  function ctaCovered(ctaPhrase, keywordsStr) {
    const kws = String(keywordsStr || '').split(',').map(k => normText(k.trim())).filter(Boolean)
    const ctaNorm = normText(ctaPhrase)
    for (const kw of kws) {
      if (kw === '*') return true
      // Verifica se existe sobreposição significativa
      if (ctaNorm.includes(kw) || kw.includes(ctaNorm)) return true
      // Verifica palavras em comum
      const ctaWords = ctaNorm.split(' ').filter(w => w.length > 3)
      const kwWords  = kw.split(' ').filter(w => w.length > 3)
      const shared   = ctaWords.filter(w => kwWords.some(k => k.includes(w) || w.includes(k)))
      if (shared.length >= Math.min(ctaWords.length, 2)) return true
    }
    return false
  }

  const issues = []

  for (const stage of STAGES) {
    const advDecisions = getAdvancingDecisions(stage)
    if (!advDecisions.length) continue

    // Pega a última mensagem de cada conjunto de msg_ids nesse estágio
    // (a CTA fica na última mensagem do bloco)
    const ctaMessages = new Set()
    for (const d of advDecisions) {
      const ids = String(d.msg_ids || '').split(',').map(s => s.trim()).filter(Boolean)
      if (ids.length) ctaMessages.add(ids[ids.length - 1])  // última mensagem do bloco
    }

    // Também pega as mensagens de padrão/fallback do estágio (o que o lead vê em geral)
    const padrao = decisions.find(d => d.stage === stage && d.intent.includes('PADRAO'))
    if (padrao) {
      const ids = String(padrao.msg_ids || '').split(',').map(s => s.trim()).filter(Boolean)
      if (ids.length) ctaMessages.add(ids[ids.length - 1])
    }

    for (const msgId of ctaMessages) {
      const msg = msgMap[msgId]
      if (!msg || !msg.text) continue

      // Ignora mensagens internas (são para o humano, não para o lead)
      if (msg.internal) continue

      // Mensagens com slots de agendamento não devem ser analisadas como CTA de avanço
      // (as datas são variáveis dinâmicas, não keywords fixas)
      if (/\{slot_[12]_texto\}/i.test(msg.text)) continue

      // Remove demais variáveis não resolvidas
      const resolvedText = msg.text.replace(/\{[^}]+\}/g, '')

      const ctaPhrases = extractCTAPhrases(resolvedText)
      if (!ctaPhrases.length) continue

      // Verifica cada frase CTA contra TODAS as keywords de decisões que avançam
      const allAdvKeywords = advDecisions.map(d => d.keywords).join(',')

      const uncovered = ctaPhrases.filter(phrase => !ctaCovered(phrase, allAdvKeywords))

      if (uncovered.length) {
        // Para cada frase não coberta, tenta encontrar a melhor decisão para receber o keyword
        for (const phrase of uncovered) {
          // Qual decisão de avanço tem mais semelhança?
          let bestDec = advDecisions[0]
          let bestScore = 0
          for (const d of advDecisions) {
            const kws = String(d.keywords).split(',').map(k => normText(k.trim()))
            const phraseWords = normText(phrase).split(' ')
            const score = phraseWords.filter(w => kws.some(k => k.includes(w))).length
            if (score > bestScore) { bestScore = score; bestDec = d }
          }

          issues.push({
            type:     'CTA_KEYWORD_MISMATCH',
            severity: 'high',
            stage,
            msgId,
            ctaPhrase:  phrase,
            description: `Estágio ${stage}: a mensagem "${msgId}" instrui o lead a responder "${phrase}", mas essa resposta não está coberta pelas keywords das decisões que avançam o funil.`,
            action:      `Adicionar "${phrase}" às keywords da intenção "${bestDec.intent}" (estágio ${bestDec.stage}) para garantir que o lead avance quando seguir a instrução.`,
            decisionId:       bestDec.id,
            currentKeywords:  bestDec.keywords,
            addKeywords:      phrase,
          })
        }
      }
    }
  }

  return issues
}

// ── Aplica uma sugestão ────────────────────────────────────────

function applySuggestion(suggestion) {
  const db = getDB()

  if (suggestion.type === 'ADD_KEYWORDS') {
    const dec = db.prepare(`SELECT * FROM bot_decisions WHERE id = ?`).get(suggestion.decisionId)
    if (!dec) throw new Error('Decisão não encontrada')

    const existing = String(dec.keywords || '').split(',').map(k => k.trim()).filter(Boolean)
    const toAdd    = String(suggestion.addKeywords || '').split(',').map(k => k.trim()).filter(Boolean)
    const merged   = [...new Set([...existing, ...toAdd])].join(',')

    db.prepare(`UPDATE bot_decisions SET keywords = ? WHERE id = ?`).run(merged, dec.id)
    return { ok: true, message: `Keywords atualizadas na intenção "${dec.intent}"` }
  }

  if (suggestion.type === 'NEW_DECISION') {
    const d = suggestion.suggestedDecision
    if (!d) throw new Error('Dados da decisão ausentes')
    const r = db.prepare(`
      INSERT INTO bot_decisions (priority,stage,intent,keywords,msg_ids,next_stage,advances,finalizes,human,active)
      VALUES (?,?,?,?,?,?,0,0,0,1)
    `).run(d.priority || 80, d.stage, d.intent, d.keywords, d.msg_ids || '', d.next_stage || 'MESMO')
    return { ok: true, message: `Nova regra criada: "${d.intent}" no estágio ${d.stage}`, id: r.lastInsertRowid }
  }

  // Outros tipos (HIGH_FALLBACK_STAGE, DROP_STAGE, etc.) são informativos — não têm ação automática
  throw new Error('Este tipo de sugestão não tem aplicação automática — requer ajuste manual.')
}

module.exports = { analyzePhone, analyzeGeneral, analyzeCTAOnly, applySuggestion }
