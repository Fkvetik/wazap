/**
 * Seed — templates de abordagem pré-carregados no banco
 * Chamado automaticamente no initDB se a tabela estiver vazia
 */

const TEMPLATES = [
  // ── NOVOS TALENTOS (Catho) ────────────────────────────────────
  {
    template_id: 'CATHO_NT_01', account: 'CONTA_RHIMOB', project: 'KAZA_A',
    active: 1, campaign_group: 'CATHO_NOVOS_TALENTOS', type: 'text', order_seq: 1,
    title: 'Catho — regional leve',
    notes: 'Contato leve sem pressão.',
    message: '{saudacao}, {primeiro_nome}. Tudo bem. Aqui é o {operador}. Encontramos seu cadastro pela Catho em um levantamento de perfis da região {bairro_frase} em {cidade_fallback}. Estou deixando este contato registrado por aqui caso continue aberto(a) a oportunidades profissionais atualmente.'
  },
  {
    template_id: 'CATHO_NT_02', account: 'CONTA_RHIMOB', project: 'KAZA_A',
    active: 1, campaign_group: 'CATHO_NOVOS_TALENTOS', type: 'text', order_seq: 2,
    title: 'Catho — perfil localizado',
    notes: 'Alta naturalidade.',
    message: '{saudacao}, {primeiro_nome}. Aqui é o {operador}. Seu perfil apareceu pela Catho em uma busca regional próxima de {bairro_frase} em {cidade_fallback}. Resolvi deixar uma mensagem por aqui caso ainda faça sentido conversar sobre novas possibilidades profissionais.'
  },
  {
    template_id: 'CATHO_NT_03', account: 'CONTA_RHIMOB', project: 'KAZA_A',
    active: 1, campaign_group: 'CATHO_NOVOS_TALENTOS', type: 'text', order_seq: 3,
    title: 'Catho — abordagem humana',
    notes: 'Sem aparência automática.',
    message: '{saudacao}, {primeiro_nome}. Tudo bem. Encontramos seu cadastro pela Catho durante um levantamento de pessoas da região {bairro_frase} em {cidade_fallback}. Deixo este canal aberto por aqui caso continue disponível para novas oportunidades de trabalho.'
  },
  {
    template_id: 'CATHO_NT_04', account: 'CONTA_RHIMOB', project: 'KAZA_A',
    active: 1, campaign_group: 'CATHO_NOVOS_TALENTOS', type: 'text', order_seq: 4,
    title: 'Catho — discreta profissional',
    notes: 'Muito discreta.',
    message: '{saudacao}, {primeiro_nome}. Aqui é o {operador}. Seu perfil da Catho apareceu em uma triagem regional que estamos organizando em {cidade_fallback}, principalmente próximo de {bairro_frase}. Achei válido deixar uma mensagem por aqui.'
  },
  {
    template_id: 'CATHO_NT_05', account: 'CONTA_RHIMOB', project: 'KAZA_A',
    active: 1, campaign_group: 'CATHO_NOVOS_TALENTOS', type: 'text', order_seq: 5,
    title: 'Catho — contato natural',
    notes: 'Excelente para reduzir resistência.',
    message: '{saudacao}, {primeiro_nome}. Tudo bem. Vi seu cadastro pela Catho relacionado à região {bairro_frase} em {cidade_fallback} e resolvi falar rapidamente por aqui. Caso ainda esteja aberto(a) a oportunidades profissionais, fico à disposição.'
  },
  {
    template_id: 'CATHO_NT_06', account: 'CONTA_RHIMOB', project: 'KAZA_A',
    active: 1, campaign_group: 'CATHO_NOVOS_TALENTOS', type: 'text', order_seq: 6,
    title: 'Catho — busca regional',
    notes: 'Sensação de contato legítimo.',
    message: '{saudacao}, {primeiro_nome}. Aqui é o {operador}. Encontramos seu perfil pela Catho em um levantamento regional realizado em {cidade_fallback}, com foco em perfis próximos de {bairro_frase}. Estou deixando este contato registrado por aqui.'
  },
  {
    template_id: 'CATHO_NT_07', account: 'CONTA_RHIMOB', project: 'KAZA_A',
    active: 1, campaign_group: 'CATHO_NOVOS_TALENTOS', type: 'text', order_seq: 7,
    title: 'Catho — proximidade leve',
    notes: 'Tom moderno e limpo.',
    message: '{saudacao}, {primeiro_nome}. Tudo bem? Seu cadastro apareceu pela Catho em uma busca de perfis próximos da região {bairro_frase} em {cidade_fallback}. Resolvi deixar uma mensagem por aqui caso continue avaliando novas oportunidades profissionais.'
  },
  {
    template_id: 'CATHO_NT_08', account: 'CONTA_RHIMOB', project: 'KAZA_A',
    active: 1, campaign_group: 'CATHO_NOVOS_TALENTOS', type: 'text', order_seq: 8,
    title: 'Catho — validação implícita',
    notes: 'CTA passivo e elegante.',
    message: '{saudacao}, {primeiro_nome}. Aqui é o {operador}. Seu perfil foi localizado pela Catho durante um levantamento regional em {cidade_fallback}, principalmente próximo de {bairro_frase}. Deixo este canal aberto por aqui caso ainda faça sentido conversar sobre trabalho atualmente.'
  },

  // ── CORRETORES CRECI ──────────────────────────────────────────
  {
    template_id: 'CRECI_01', account: 'CONTA_RHIMOB', project: 'KAZA_A',
    active: 1, campaign_group: 'CORRETORES_CRECI', type: 'text', order_seq: 1,
    title: 'CRECI — validação discreta',
    notes: 'Abordagem neutra e humana.',
    message: '{saudacao}, {primeiro_nome}. Tudo bem? Aqui é o {operador}. Estou fazendo um levantamento de profissionais do mercado imobiliário em {cidade_fallback} e seu contato apareceu nessa busca. Queria apenas confirmar se você segue atuando na região atualmente.'
  },
  {
    template_id: 'CRECI_02', account: 'CONTA_RHIMOB', project: 'KAZA_A',
    active: 1, campaign_group: 'CORRETORES_CRECI', type: 'text', order_seq: 2,
    title: 'CRECI — contato localizado',
    notes: 'Usa CRECI sem parecer oferta.',
    message: '{saudacao}, {primeiro_nome}. Aqui é o {operador}. Vim pelo Instagram, seu contato apareceu em uma pesquisa relacionada ao mercado imobiliário em {cidade_fallback}{creci_frase}. Antes de avançar por aqui, queria confirmar se você ainda atua nesse mercado atualmente.'
  },
  {
    template_id: 'CRECI_03', account: 'CONTA_RHIMOB', project: 'KAZA_A',
    active: 1, campaign_group: 'CORRETORES_CRECI', type: 'text', order_seq: 3,
    title: 'CRECI — busca regional',
    notes: 'Texto simples e natural.',
    message: '{saudacao}, {primeiro_nome}. Tudo bem? Estava organizando alguns contatos ligados ao mercado imobiliário em {cidade_fallback} e encontrei seu telefone nesse processo. Você segue ativo(a) na região hoje?'
  },
  {
    template_id: 'CRECI_04', account: 'CONTA_RHIMOB', project: 'KAZA_A',
    active: 1, campaign_group: 'CORRETORES_CRECI', type: 'text', order_seq: 4,
    title: 'CRECI — confirmação leve',
    notes: 'Sem aparência comercial.',
    message: '{saudacao}, {primeiro_nome}. Aqui é o {operador}. Vi seu contato vinculado ao mercado imobiliário em {cidade_fallback} e resolvi falar rapidamente por aqui. Queria apenas confirmar se você continua atuando nesse segmento atualmente.'
  },
  {
    template_id: 'CRECI_05', account: 'CONTA_RHIMOB', project: 'KAZA_A',
    active: 1, campaign_group: 'CORRETORES_CRECI', type: 'text', order_seq: 5,
    title: 'CRECI — abordagem curta',
    notes: 'Versão mais curta.',
    message: '{saudacao}, {primeiro_nome}. Tudo bem? Seu contato apareceu em uma busca relacionada ao mercado imobiliário em {cidade_fallback}. Você ainda atua nessa área hoje?'
  },
  {
    template_id: 'CRECI_06', account: 'CONTA_RHIMOB', project: 'KAZA_A',
    active: 1, campaign_group: 'CORRETORES_CRECI', type: 'text', order_seq: 6,
    title: 'CRECI — cargo discreto',
    notes: 'Usa {cargo} naturalmente.',
    message: '{saudacao}, {primeiro_nome}. Aqui é o {operador}. Estou atualizando alguns contatos de profissionais de {cargo} em {cidade_fallback} e encontrei seu número nesse levantamento. Você segue ativo(a) nessa área atualmente?'
  },
  {
    template_id: 'CRECI_07', account: 'CONTA_RHIMOB', project: 'KAZA_A',
    active: 1, campaign_group: 'CORRETORES_CRECI', type: 'text', order_seq: 7,
    title: 'CRECI — tom humano',
    notes: 'Mais leve e pessoal.',
    message: '{saudacao}, {primeiro_nome}. Tudo bem? Cheguei até seu contato através de uma busca ligada ao mercado imobiliário em {cidade_fallback}. Só queria confirmar rapidamente se você ainda atua nesse mercado hoje.'
  },
  {
    template_id: 'CRECI_08', account: 'CONTA_RHIMOB', project: 'KAZA_A',
    active: 1, campaign_group: 'CORRETORES_CRECI', type: 'text', order_seq: 8,
    title: 'CRECI — validação profissional',
    notes: 'Passa legitimidade sem parecer venda.',
    message: '{saudacao}, {primeiro_nome}. Aqui é o {operador}. Estou revisando alguns contatos profissionais ligados ao mercado imobiliário em {cidade_fallback} e seu nome apareceu nesse levantamento. Você continua ativo(a) no setor atualmente?'
  },
  {
    template_id: 'CRECI_09', account: 'CONTA_RHIMOB', project: 'KAZA_A',
    active: 1, campaign_group: 'CORRETORES_CRECI', type: 'text', order_seq: 9,
    title: 'CRECI — contato natural',
    notes: 'CTA muito fácil de responder.',
    message: '{saudacao}, {primeiro_nome}. Tudo bem? Encontrei seu contato em um levantamento relacionado ao mercado imobiliário em {cidade_fallback} e queria confirmar uma informação rapidamente: você segue atuando na área hoje?'
  },
  {
    template_id: 'CRECI_10', account: 'CONTA_RHIMOB', project: 'KAZA_A',
    active: 1, campaign_group: 'CORRETORES_CRECI', type: 'text', order_seq: 10,
    title: 'CRECI — máxima discrição',
    notes: 'Mínima resistência psicológica.',
    message: '{saudacao}, {primeiro_nome}. Aqui é o {operador}. Seu contato apareceu durante uma busca de profissionais ligados ao mercado imobiliário em {cidade_fallback}. Antes de continuar por aqui, queria apenas confirmar se você ainda atua nesse mercado atualmente.'
  }
]

function seedTemplates(db) {
  const count = db.prepare(`SELECT COUNT(*) as c FROM templates`).get()
  if (count && count.c > 0) return  // já semeado

  const stmt = db.prepare(`
    INSERT OR IGNORE INTO templates
      (template_id, account, project, active, campaign_group, type, title, message, order_seq, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  const insertAll = db.transaction(items => {
    for (const t of items) {
      stmt.run(t.template_id, t.account, t.project, t.active, t.campaign_group,
               t.type, t.title, t.message, t.order_seq, t.notes)
    }
  })
  insertAll(TEMPLATES)
  console.log(`✅ ${TEMPLATES.length} templates de abordagem carregados`)
}

module.exports = { seedTemplates }
