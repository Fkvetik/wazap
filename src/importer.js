/**
 * Importador de contatos com mapeamento automático de colunas
 * Suporta dois formatos: Novos Talentos (Catho) e Corretores CRECI
 */

const { parse } = require('csv-parse/sync')
const fs = require('fs')
const { google } = require('googleapis')

// ─── Mapeamento Novos Talentos (Catho) ─────────────────────────
// Colunas esperadas: Curriculo, NomeCompleto, PrimeiroNome, Telefone1, Whatsapp,
//                   Cidade, EstadoUF, Bairro, Cargo, ProfissaoOuCargo, ...
function mapNovosTalentos(row) {
  const phone = clean(row.Whatsapp || row.Telefone1 || row.Telefone2 || row.Tel2 || '')
  if (!phone || phone.length < 10) return null

  const primeiroNome = row.PrimeiroNome || primeiroNomeDe(row.NomeCompleto || '')
  const cidade       = row.Cidade || row.RegiaoCidade || ''
  const bairro       = row.Bairro || ''
  const cargo        = row.ProfissaoOuCargo || row.Cargo || ''

  return {
    phone,
    name: row.NomeCompleto || primeiroNome,
    vars: JSON.stringify({
      primeiro_nome:  primeiroNome,
      nome:           row.NomeCompleto || primeiroNome,
      cidade_fallback: cidade,
      bairro_frase:   bairro,   // usado como "da região {bairro_frase}"
      cargo,
      estado:         row.EstadoUF || '',
      email:          row.Email || '',
      origem:         row.Origem || 'Catho',
      // saudacao e operador são injetados em runtime pelo sender
    })
  }
}

// ─── Mapeamento Corretores CRECI ────────────────────────────────
// Colunas esperadas: KEY, CIDADE, Nome, CRECI, RHI_IG_TELEFONE_WA,
//                   RHI_IG_CARGO, RHI_IG_USERNAME, ...
function mapCorretor(row) {
  const phone = clean(
    row.RHI_IG_TELEFONE_WA ||
    row.Telefone || row.Whatsapp ||
    row.telefone || row.whatsapp || ''
  )
  if (!phone || phone.length < 10) return null

  const nomeCompleto  = row.Nome || row.RHI_IG_NOME_PERFIL || ''
  const primeiroNome  = primeiroNomeDe(nomeCompleto)
  const cidade        = row.CIDADE || row.Cidade || ''
  const creci         = row.CRECI || ''
  const cargo         = row.RHI_IG_CARGO || row.RHI_IG_CARGO_RAW || 'Corretor(a)'

  return {
    phone,
    name: nomeCompleto || primeiroNome,
    vars: JSON.stringify({
      primeiro_nome:   primeiroNome,
      nome:            nomeCompleto,
      cidade_fallback: cidade,
      bairro_frase:    '',
      creci_frase:     creci ? ` (CRECI ${creci})` : '',
      cargo,
      creci_num:       creci,
      instagram:       row.RHI_IG_USERNAME || '',
      // saudacao e operador injetados em runtime
    })
  }
}

// ─── Mapeamento CORRETOR_SP_META (CRECI direto com Celular) ────
// Colunas: DataExtracao, Cidade, CRECI, Nome, Situacao, Celular, ...
function mapCorretorMeta(row) {
  const phone = clean(row.Celular || row.celular || '')
  if (!phone || phone.length < 10) return null

  // Filtra inativos
  const situacao = (row.Situacao || row.situacao || '').toLowerCase()
  if (situacao && situacao !== 'ativo') return null

  const nomeCompleto = row.Nome || row.nome || ''
  const primeiroNome = primeiroNomeDe(nomeCompleto)
  const cidade       = row.Cidade || row.cidade || row.AbaTelefone || ''
  const creci        = row.CRECI  || row.creci  || ''

  return {
    phone,
    name: nomeCompleto,
    vars: JSON.stringify({
      primeiro_nome:   primeiroNome,
      nome:            nomeCompleto,
      cidade_fallback: cidade,
      bairro_frase:    '',
      creci_frase:     creci ? ` (CRECI ${creci})` : '',
      creci_num:       creci,
      cargo:           'Corretor(a) de Imóveis',
      instagram:       '',
      situacao:        row.Situacao || '',
    })
  }
}

// ─── Detecta qual formato é o CSV ──────────────────────────────
function detectFormat(headers) {
  const h = headers.map(x => x.toLowerCase())
  if (h.includes('curriculo') || h.includes('primeironome') || h.includes('curriculoid')) {
    return 'talentos'
  }
  // CORRETOR_SP_META: tem 'celular' e 'situacao' e 'creci'
  if (h.includes('celular') && h.includes('situacao') && h.includes('creci')) {
    return 'corretor_meta'
  }
  if (h.includes('creci') || h.includes('rhi_ig_status') || h.includes('key')) {
    return 'creci'
  }
  return 'generic'
}

// ─── Import genérico (CSV simples com telefone + colunas livres) ─
function mapGeneric(row, headers) {
  const phoneKey = headers.find(h =>
    ['telefone','phone','numero','number','whatsapp'].includes(h.toLowerCase())
  )
  if (!phoneKey) return null
  const phone = clean(row[phoneKey] || '')
  if (!phone || phone.length < 10) return null

  const nameKey = headers.find(h => ['nome','name'].includes(h.toLowerCase()))
  const name = nameKey ? (row[nameKey] || '') : ''

  const vars = {}
  for (const h of headers) {
    if (h !== phoneKey && h !== nameKey) vars[h.toLowerCase()] = row[h] || ''
  }
  return { phone, name, vars: JSON.stringify(vars) }
}

// ─── Entrada principal ─────────────────────────────────────────
function importCSV(filePath, forceFormat = null) {
  const content = fs.readFileSync(filePath, 'utf-8')

  // Detecta separador: tab ou vírgula
  const firstLine = content.split('\n')[0]
  const sep = firstLine.split('\t').length > firstLine.split(',').length ? '\t' : ','

  const records = parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    delimiter: sep,
    relax_column_count: true
  })

  if (!records.length) return []

  const headers = Object.keys(records[0])
  const fmt = forceFormat || detectFormat(headers)

  const contacts = []
  for (const row of records) {
    let mapped = null
    if (fmt === 'talentos')       mapped = mapNovosTalentos(row)
    else if (fmt === 'creci')     mapped = mapCorretor(row)
    else if (fmt === 'corretor_meta') mapped = mapCorretorMeta(row)
    else mapped = mapGeneric(row, headers)

    if (mapped) contacts.push(mapped)
  }

  return { contacts, format: fmt, total: records.length, mapped: contacts.length }
}

async function importGoogleSheets(sheetId, range = 'A1:Z2000', credentialPath = null, forceFormat = null) {
  let auth

  if (credentialPath && fs.existsSync(credentialPath)) {
    const creds = JSON.parse(fs.readFileSync(credentialPath, 'utf-8'))
    auth = new google.auth.GoogleAuth({
      credentials: creds,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
    })
  } else {
    auth = new google.auth.GoogleAuth({ scopes: [] })
  }

  const sheets  = google.sheets({ version: 'v4', auth })
  const response = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range })
  const rows = response.data.values || []
  if (rows.length < 2) return { contacts: [], format: 'unknown', total: 0, mapped: 0 }

  const headers = rows[0].map(h => h.trim())
  const fmt     = forceFormat || detectFormat(headers)

  const contacts = []
  for (const row of rows.slice(1)) {
    const obj = {}
    headers.forEach((h, i) => { obj[h] = row[i] || '' })

    let mapped = null
    if (fmt === 'talentos')           mapped = mapNovosTalentos(obj)
    else if (fmt === 'creci')         mapped = mapCorretor(obj)
    else if (fmt === 'corretor_meta') mapped = mapCorretorMeta(obj)
    else mapped = mapGeneric(obj, headers)

    if (mapped) contacts.push(mapped)
  }

  return { contacts, format: fmt, total: rows.length - 1, mapped: contacts.length }
}

// ─── Helpers ───────────────────────────────────────────────────

// Remove não-dígitos e garante DDI 55 para números brasileiros
function clean(val) {
  let n = String(val || '').replace(/\D/g, '').replace(/^0+/, '')
  if (!n) return ''
  // 10 dígitos = DDD(2) + número(8) → add 55
  // 11 dígitos = DDD(2) + 9 + número(8) → add 55
  if (n.length === 10 || n.length === 11) n = '55' + n
  // 12 ou 13 = já tem DDI (ex: 5511...)
  return n
}

function primeiroNomeDe(nomeCompleto) {
  return (nomeCompleto || '').trim().split(/\s+/)[0] || ''
}

module.exports = { importCSV, importGoogleSheets }
