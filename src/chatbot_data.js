/**
 * Dados do chatbot corretor — DECISOES e MENSAGENS
 * Portado do motor RHIMOB_CORRETOR_LINEAR_V3
 *
 * Estrutura DECISIONS: [priority, stage, intent, keywords_csv, msg_ids_csv, next_stage, advances, finalizes, human, active]
 */

const DECISIONS = [
  // ── QUALQUER estágio ────────────────────────────────────────
  [100,'QUALQUER','OPT_OUT','parar,sair,remover,não quero receber,nao quero receber,cancelar contato,me remove,retirar meu contato,não me chame mais,nao me chame mais,excluir meu número,excluir meu numero','MSG_OPT_OUT','NEG',0,1,0,1],
  [99,'QUALQUER','DECLINIO','declinar,vou declinar,prefiro declinar,declino,vou recusar,prefiro recusar,recusar,não vou seguir,nao vou seguir,não quero seguir,nao quero seguir,pode encerrar,pode finalizar,vamos encerrar,vamos finalizar,encerra por favor,finaliza por favor','MSG_NEGATIVA_GERAL','NEG',0,1,0,1],
  [98.7,'QUALQUER','PAUSA_COMERCIAL','estou viajando,vou pensar,vou analisar,depois vejo,talvez depois,me chama depois,no momento não,no momento nao,neste momento não,neste momento nao,não tenho interesse agora,nao tenho interesse agora,agora não,agora nao,por enquanto não,vou olhar,vou ver,vou verificar,vou dar uma olhada,vejo depois,vejo com calma,volto depois,volto a te chamar,volto a te contatar,retorno depois,te retorno depois,te respondo depois,posteriormente,obrigado pela atenção,obrigada pela atenção,falo com você depois,falo com voce depois,qualquer coisa retorno,assim que eu olhar,é longe,muito longe,não estou atuando,não vou conseguir seguir','MSG_PAUSA_COMERCIAL','MESMO',0,0,0,1],
  [98,'QUALQUER','NEGATIVA_FORTE','não tenho interesse,nao tenho interesse,sem interesse,não quero,nao quero,não é pra mim,nao e pra mim,vou passar,prefiro passar,dispenso,não faz sentido,nao faz sentido,não estou interessado,nao estou interessado,não estou interessada,nao estou interessada,não me interessa,nao me interessa,não tenho interesse mesmo,nao tenho interesse mesmo,não quero participar,nao quero participar,não busco vaga,nao busco vaga,não estou buscando,nao estou buscando,tchau,encerra,encerrar por aqui','MSG_NEGATIVA_GERAL','NEG',0,1,0,1],
  [97,'QUALQUER','NEGATIVA_EDUCADA','não obrigado,nao obrigado,obrigado mas não,obrigado mas nao,agradeço mas não,agradeco mas nao,valeu mas não,valeu mas nao,obrigado não,obrigado nao,obrigada não,obrigada nao,agradeço não,agradeco nao','MSG_NEGATIVA_GERAL','NEG',0,1,0,1],
  [95,'QUALQUER','HUMANO','humano,atendente,falar com atendente,falar com uma pessoa,pessoa real,me liga,ligação,ligacao,pode me ligar,quero falar com alguém,quero falar com alguem,prefiro falar com alguém,prefiro falar com alguem,alguém me chama,alguem me chama','MSG_HUMANO_AVISO_CLIENTE,MSG_HUMANO_INTERNO','HUMANO',0,0,1,1],
  [94,'QUALQUER','AUDIO','[AUDIO]','MSG_AUDIO_GERAL','MESMO',0,0,0,1],
  [93,'QUALQUER','LIDERANCA_CONTRATANTE','sou gerente,gerente de vendas,sou gerente de vendas,gerente comercial,sou coordenador,sou coordenadora,coordenador de vendas,coordenadora de vendas,sou gestor,sou gestora,gestor comercial,gestora comercial,sou diretor,sou diretora,diretor comercial,diretora comercial,sou dono de imobiliária,sou dono de imobiliaria,sou dona de imobiliária,sou dona de imobiliaria,dono de imobiliária,dono de imobiliaria,dona de imobiliária,dona de imobiliaria,proprietário de imobiliária,proprietario de imobiliaria,tenho imobiliária,tenho imobiliaria,minha imobiliária,minha imobiliaria,administro uma imobiliária,administro uma imobiliaria,sou incorporador,sou incorporadora,incorporador,incorporadora,tenho incorporadora,minha incorporadora,sou dono de construtora,sou dona de construtora,lidero equipe,lidero uma equipe,tenho equipe de corretores,tenho equipe comercial,preciso contratar,preciso de corretores,contratar corretores,busco corretores,quero contratar','MSG_LIDERANCA_CONTRATANTE,MSG_LIDERANCA_CONTRATANTE_02,MSG_LIDERANCA_CONTRATANTE_INTERNO','HUMANO',0,0,1,1],

  // ── WEBHOOK ─────────────────────────────────────────────────
  [91,'WEBHOOK','DUVIDA_EMPRESA_ATUACAO','empresa,cargo,função,funcao,atuação,atuacao,atividade,trabalho,o que vou fazer,qual cargo,qual função,qual funcao,sobre a empresa,sobre o cargo,sobre a atuação,sobre a atuacao,informações sobre a empresa,informacoes sobre a empresa','MSG_WEBHOOK_01,MSG_WEBHOOK_02,MSG_WEBHOOK_03','INFO2',1,0,0,1],
  [90,'WEBHOOK','DUVIDA_PARCEIRO_INDICACAO','parceria,parceiro,indicação,indicacao,indicar,afiliado,comissão por indicação,comissao por indicacao,ganhar indicando,tenho indicação,tenho indicacao,imobiliaria parceira,construtora parceira','MSG_WEBHOOK_01,MSG_WEBHOOK_02,MSG_WEBHOOK_03','INFO2',1,0,0,1],
  [89,'WEBHOOK','DUVIDA_MCMV','minha casa minha vida,mcmv,habitacional,programa habitacional,imóvel popular,imovel popular,casa verde,habitação,habitacao','MSG_WEBHOOK_01,MSG_WEBHOOK_02,MSG_WEBHOOK_03','INFO2',1,0,0,1],
  [88,'WEBHOOK','DUVIDA_SALARIO','salário,salario,ganho,ganhos,comissão,comissao,pagamento,remuneração,remuneracao,ajuda de custo,fixo,quanto ganha,quanto paga,tem salário,tem salario','MSG_WEBHOOK_01,MSG_WEBHOOK_02,MSG_WEBHOOK_03','INFO2',1,0,0,1],
  [87,'WEBHOOK','DUVIDA_ROTINA','horário,horario,carga horária,carga horaria,escala,plantão,plantao,turno,expediente,presencial,remoto,home office,rotina','MSG_WEBHOOK_01,MSG_WEBHOOK_02,MSG_WEBHOOK_03','INFO2',1,0,0,1],
  [86,'WEBHOOK','DUVIDA_LOCAL','local,endereço,endereco,onde,cidade,bairro,região,regiao,perto,qual cidade,qual local,fica onde','MSG_WEBHOOK_01,MSG_WEBHOOK_02,MSG_WEBHOOK_03','INFO2',1,0,0,1],
  [85,'WEBHOOK','DUVIDA_EXPERIENCIA_CRECI','experiência,experiencia,precisa experiência,precisa experiencia,sem experiência,sem experiencia,creci,precisa creci,creci ativo,não tenho creci,nao tenho creci','MSG_WEBHOOK_01,MSG_WEBHOOK_02,MSG_WEBHOOK_03','INFO2',1,0,0,1],
  [84,'WEBHOOK','DUVIDA_CONFIANCA','quem é você,quem e voce,quem são vocês,quem sao voces,quem é a rhimob,quem e a rhimob,site,instagram,é golpe,e golpe,golpe,é verdade,e verdade,confiável,confiavel,é confiável,e confiavel,posso confiar','MSG_WEBHOOK_01,MSG_WEBHOOK_02,MSG_WEBHOOK_03','INFO2',1,0,0,1],
  [83,'WEBHOOK','JA_ATUANDO_IMOBILIARIA','já sou associado,ja sou associado,já sou associada,ja sou associada,sou associado,sou associada,já trabalho em imobiliária,ja trabalho em imobiliaria,trabalho em imobiliária,trabalho em imobiliaria,já atuo,ja atuo,já sou corretor,ja sou corretor,sou corretor ativo,sou corretora ativa,estou em plantão,estou em plantao,faço parte de uma imobiliária,faco parte de uma imobiliaria,estou vinculado,estou vinculada','MSG_WEBHOOK_01,MSG_WEBHOOK_02,MSG_WEBHOOK_03','INFO2',1,0,0,1],
  [82,'WEBHOOK','DUVIDA_GERAL','não entendi,nao entendi,não ficou claro,nao ficou claro,como funciona,funciona como,me explica melhor,explica melhor,como seria,qual proposta,do que se trata,qual oportunidade,que vaga,quais vagas,me dar mais informações,me dar mais informacoes,mais informações,mais informacoes','MSG_WEBHOOK_01,MSG_WEBHOOK_02,MSG_WEBHOOK_03','INFO2',1,0,0,1],
  [20,'WEBHOOK','CONTINUACAO','sim,quero,tenho interesse,pode mandar,pode ser,ok,claro,me explica,quero saber,manda,continue,pode seguir,pode continuar,pode prosseguir,segue,faz sentido,entendi,quero ver,me manda,pode enviar','MSG_WEBHOOK_01,MSG_WEBHOOK_02,MSG_WEBHOOK_03','INFO2',1,0,0,1],
  [17,'WEBHOOK','ENTRADA_PADRAO','*','MSG_WEBHOOK_01,MSG_WEBHOOK_02,MSG_WEBHOOK_03','INFO2',1,0,0,1],

  // ── INFO2 ────────────────────────────────────────────────────
  [91,'INFO2','DUVIDA_EMPRESA_ATUACAO','empresa,cargo,função,funcao,atuação,atuacao,atividade,trabalho,o que vou fazer,qual cargo,qual função,qual funcao,sobre a empresa,sobre o cargo,sobre a atuação,sobre a atuacao,informações sobre a empresa,informacoes sobre a empresa','MSG_DUVIDA_EMPRESA_ATUACAO,MSG_INFO2_01,MSG_INFO2_02,MSG_INFO2_03','COMPLEMENTO',1,0,0,1],
  [90,'INFO2','DUVIDA_PARCEIRO_INDICACAO','parceria,parceiro,indicação,indicacao,indicar,afiliado,comissão por indicação,comissao por indicacao,ganhar indicando,tenho indicação,tenho indicacao','MSG_DUVIDA_PARCEIRO_INDICACAO,MSG_INFO2_01,MSG_INFO2_02,MSG_INFO2_03','COMPLEMENTO',1,0,0,1],
  [89,'INFO2','DUVIDA_MCMV','minha casa minha vida,mcmv,habitacional,programa habitacional,imóvel popular,imovel popular,casa verde,habitação,habitacao','MSG_DUVIDA_MCMV,MSG_INFO2_01,MSG_INFO2_02,MSG_INFO2_03','COMPLEMENTO',1,0,0,1],
  [88,'INFO2','DUVIDA_SALARIO','salário,salario,ganho,ganhos,comissão,comissao,pagamento,remuneração,remuneracao,ajuda de custo,fixo,quanto ganha,quanto paga,tem salário,tem salario','MSG_DUVIDA_SALARIO,MSG_INFO2_01,MSG_INFO2_02,MSG_INFO2_03','COMPLEMENTO',1,0,0,1],
  [87,'INFO2','DUVIDA_ROTINA','horário,horario,carga horária,carga horaria,escala,plantão,plantao,turno,expediente,presencial,remoto,home office,rotina','MSG_DUVIDA_ROTINA,MSG_INFO2_01,MSG_INFO2_02,MSG_INFO2_03','COMPLEMENTO',1,0,0,1],
  [86,'INFO2','DUVIDA_LOCAL','local,endereço,endereco,onde,cidade,bairro,região,regiao,perto,qual cidade,qual local,fica onde','MSG_DUVIDA_LOCAL,MSG_INFO2_01,MSG_INFO2_02,MSG_INFO2_03','COMPLEMENTO',1,0,0,1],
  [85,'INFO2','DUVIDA_EXPERIENCIA_CRECI','experiência,experiencia,precisa experiência,precisa experiencia,sem experiência,sem experiencia,creci,precisa creci,creci ativo,não tenho creci,nao tenho creci','MSG_DUVIDA_EXPERIENCIA_CRECI,MSG_INFO2_01,MSG_INFO2_02,MSG_INFO2_03','COMPLEMENTO',1,0,0,1],
  [84,'INFO2','DUVIDA_CONFIANCA','quem é você,quem e voce,quem são vocês,quem sao voces,quem é a rhimob,quem e a rhimob,site,instagram,é golpe,e golpe,golpe,é verdade,e verdade,confiável,confiavel,é confiável,e confiavel,posso confiar','MSG_DUVIDA_CONFIANCA,MSG_INFO2_01,MSG_INFO2_02,MSG_INFO2_03','COMPLEMENTO',1,0,0,1],
  [83,'INFO2','JA_ATUANDO_IMOBILIARIA','já sou associado,ja sou associado,já sou associada,ja sou associada,sou associado,sou associada,já trabalho em imobiliária,ja trabalho em imobiliaria,trabalho em imobiliária,trabalho em imobiliaria,já atuo,ja atuo,já sou corretor,ja sou corretor,sou corretor ativo,sou corretora ativa','MSG_JA_ATUANDO_IMOBILIARIA,MSG_INFO2_01,MSG_INFO2_02,MSG_INFO2_03','COMPLEMENTO',1,0,0,1],
  [82,'INFO2','DUVIDA_GERAL','não entendi,nao entendi,não ficou claro,nao ficou claro,como funciona,funciona como,me explica melhor,explica melhor,como seria,qual proposta,do que se trata,qual oportunidade,que vaga,quais vagas,mais informações,mais informacoes','MSG_DUVIDA_GERAL,MSG_INFO2_01,MSG_INFO2_02,MSG_INFO2_03','COMPLEMENTO',1,0,0,1],
  [21,'INFO2','ACK_NEUTRO','ok,certo,entendi,perfeito,beleza,show,combinado,obrigado,obrigada,valeu,tá bom,ta bom','MSG_ACK_NEUTRO','MESMO',0,0,0,1],
  [19,'INFO2','CONTINUACAO','sim,quero,tenho interesse,pode mandar,pode ser,claro,me explica,quero saber,manda,continue,pode seguir,pode continuar,pode prosseguir,segue,quero conversar,quero agendar,podemos agendar,pode marcar,quero seguir,tenho interesse em seguir,quero avançar,quero avancar,pode enviar','MSG_INFO2_01,MSG_INFO2_02,MSG_INFO2_03','COMPLEMENTO',1,0,0,1],
  [16,'INFO2','INFO2_PADRAO','*','MSG_INFO2_01,MSG_INFO2_02,MSG_INFO2_03','COMPLEMENTO',1,0,0,1],

  // ── COMPLEMENTO ─────────────────────────────────────────────
  [91,'COMPLEMENTO','DUVIDA_EMPRESA_ATUACAO','empresa,cargo,função,funcao,atuação,atuacao,atividade,trabalho,o que vou fazer,qual cargo,qual função,qual funcao,sobre a empresa,sobre o cargo,sobre a atuação,sobre a atuacao','MSG_DUVIDA_EMPRESA_ATUACAO,MSG_COMPLEMENTO_01,MSG_COMPLEMENTO_02,MSG_COMPLEMENTO_03','AGENDAMENTO',1,0,0,1],
  [90,'COMPLEMENTO','DUVIDA_PARCEIRO_INDICACAO','parceria,parceiro,indicação,indicacao,indicar,afiliado,comissão por indicação,comissao por indicacao,ganhar indicando,tenho indicação,tenho indicacao','MSG_DUVIDA_PARCEIRO_INDICACAO,MSG_COMPLEMENTO_01,MSG_COMPLEMENTO_02,MSG_COMPLEMENTO_03','AGENDAMENTO',1,0,0,1],
  [89,'COMPLEMENTO','DUVIDA_MCMV','minha casa minha vida,mcmv,habitacional,programa habitacional,imóvel popular,imovel popular,casa verde,habitação,habitacao','MSG_DUVIDA_MCMV,MSG_COMPLEMENTO_01,MSG_COMPLEMENTO_02,MSG_COMPLEMENTO_03','AGENDAMENTO',1,0,0,1],
  [88,'COMPLEMENTO','DUVIDA_SALARIO','salário,salario,ganho,ganhos,comissão,comissao,pagamento,remuneração,remuneracao,ajuda de custo,fixo,quanto ganha,quanto paga,tem salário,tem salario','MSG_DUVIDA_SALARIO,MSG_COMPLEMENTO_01,MSG_COMPLEMENTO_02,MSG_COMPLEMENTO_03','AGENDAMENTO',1,0,0,1],
  [87,'COMPLEMENTO','DUVIDA_ROTINA','horário,horario,carga horária,carga horaria,escala,plantão,plantao,turno,expediente,presencial,remoto,home office,rotina','MSG_DUVIDA_ROTINA,MSG_COMPLEMENTO_01,MSG_COMPLEMENTO_02,MSG_COMPLEMENTO_03','AGENDAMENTO',1,0,0,1],
  [86,'COMPLEMENTO','DUVIDA_LOCAL','local,endereço,endereco,onde,cidade,bairro,região,regiao,perto,qual cidade,qual local,fica onde','MSG_DUVIDA_LOCAL,MSG_COMPLEMENTO_01,MSG_COMPLEMENTO_02,MSG_COMPLEMENTO_03','AGENDAMENTO',1,0,0,1],
  [85,'COMPLEMENTO','DUVIDA_EXPERIENCIA_CRECI','experiência,experiencia,precisa experiência,precisa experiencia,sem experiência,sem experiencia,creci,precisa creci,creci ativo,não tenho creci,nao tenho creci','MSG_DUVIDA_EXPERIENCIA_CRECI,MSG_COMPLEMENTO_01,MSG_COMPLEMENTO_02,MSG_COMPLEMENTO_03','AGENDAMENTO',1,0,0,1],
  [84,'COMPLEMENTO','DUVIDA_CONFIANCA','quem é você,quem e voce,quem são vocês,quem sao voces,quem é a rhimob,quem e a rhimob,site,instagram,é golpe,e golpe,golpe,é verdade,e verdade,confiável,confiavel,é confiável,e confiavel,posso confiar','MSG_DUVIDA_CONFIANCA,MSG_COMPLEMENTO_01,MSG_COMPLEMENTO_02,MSG_COMPLEMENTO_03','AGENDAMENTO',1,0,0,1],
  [83,'COMPLEMENTO','JA_ATUANDO_IMOBILIARIA','já sou associado,ja sou associado,já sou associada,ja sou associada,sou associado,sou associada,já trabalho em imobiliária,ja trabalho em imobiliaria,trabalho em imobiliária,trabalho em imobiliaria,já atuo,ja atuo,já sou corretor,ja sou corretor,sou corretor ativo,sou corretora ativa','MSG_JA_ATUANDO_IMOBILIARIA,MSG_COMPLEMENTO_01,MSG_COMPLEMENTO_02,MSG_COMPLEMENTO_03','AGENDAMENTO',1,0,0,1],
  [82,'COMPLEMENTO','DUVIDA_GERAL','não entendi,nao entendi,não ficou claro,nao ficou claro,como funciona,funciona como,me explica melhor,explica melhor,como seria,qual proposta,do que se trata,qual oportunidade,que vaga,quais vagas,mais informações,mais informacoes','MSG_DUVIDA_GERAL,MSG_COMPLEMENTO_01,MSG_COMPLEMENTO_02,MSG_COMPLEMENTO_03','AGENDAMENTO',1,0,0,1],
  [21,'COMPLEMENTO','ACK_NEUTRO','ok,certo,entendi,perfeito,beleza,show,combinado,obrigado,obrigada,valeu,tá bom,ta bom','MSG_ACK_NEUTRO','MESMO',0,0,0,1],
  [18,'COMPLEMENTO','CONTINUACAO','sim,quero,tenho interesse,pode mandar,pode ser,claro,me explica,quero saber,manda,continue,pode seguir,pode continuar,pode prosseguir,segue,quero conversar,quero agendar,podemos agendar,pode marcar,quero seguir,tenho interesse em seguir,quero avançar,quero avancar,pode enviar','MSG_COMPLEMENTO_01,MSG_COMPLEMENTO_02,MSG_COMPLEMENTO_03','AGENDAMENTO',1,0,0,1],
  [15,'COMPLEMENTO','COMPLEMENTO_PADRAO','*','MSG_COMPLEMENTO_01,MSG_COMPLEMENTO_02,MSG_COMPLEMENTO_03','AGENDAMENTO',1,0,0,1],

  // ── AGENDAMENTO ──────────────────────────────────────────────
  [70,'AGENDAMENTO','NEGATIVA','não,nao,não quero,nao quero,desistir,encerrar,pode encerrar','MSG_NEGATIVA_GERAL','NEG',0,1,0,1],
  [69,'AGENDAMENTO','SLOT_1','primeira opção,primeira opcao,primeiro horário,primeiro horario,slot 1,horário 1,horario 1,opção 1,opcao 1,EXATO:1,EXATO:um,opção um,opcao um,primeira,a primeira,escolho a primeira,quero a primeira,pode ser a primeira,prefiro a primeira,fico com a primeira,terça,terca,terça-feira,terca-feira,10:00,10h,10hs,10h00,horário das 10,horario das 10,opção número 1,opcao numero 1,número 1,numero 1,vou no primeiro,vou na primeira,esse primeiro,essa primeira,pode ser terça,pode ser terca,prefiro terça,prefiro terca','MSG_AGENDAMENTO_SLOT1_CLIENTE,MSG_AGENDAMENTO_SLOT1_INTERNO','HUMANO',0,0,1,1],
  [68,'AGENDAMENTO','SLOT_2','segunda opção,segunda opcao,segundo horário,segundo horario,slot 2,horário 2,horario 2,opção 2,opcao 2,EXATO:2,EXATO:dois,opção dois,opcao dois,segunda,a segunda,escolho a segunda,quero a segunda,pode ser a segunda,prefiro a segunda,fico com a segunda,14:00,14h,14hs,14h00,horário das 14,horario das 14,opção número 2,opcao numero 2,número 2,numero 2,vou no segundo,vou na segunda,esse segundo,essa segunda,quinta,quinta-feira,qui,pode ser quinta,prefiro quinta','MSG_AGENDAMENTO_SLOT2_CLIENTE,MSG_AGENDAMENTO_SLOT2_INTERNO','HUMANO',0,0,1,1],
  [67,'AGENDAMENTO','SEM_ENCAIXE','nenhum dos dois,nenhum deles,nenhum horario,nenhum horário,não consigo nesses horários,nao consigo nesses horarios,outro horario,outro horário,preciso de outro horário,nenhum funciona,nenhuma funciona,nenhum desses horários','MSG_AGENDAMENTO_SEM_ENCAIXE_CLIENTE,MSG_AGENDAMENTO_SEM_ENCAIXE_INTERNO','HUMANO',0,0,1,1],
  [66,'AGENDAMENTO','DUVIDA_AGENDAMENTO','salário,salario,ganho,ganhos,comissão,comissao,pagamento,remuneração,remuneracao,ajuda de custo,fixo,horário,horario,escala,plantão,plantao,local,endereço,endereco,onde,cidade,bairro,região,regiao,empresa,cargo,função,funcao,atuação,atuacao,como funciona,não entendi,nao entendi,me explica,duvida,dúvida','MSG_AGENDAMENTO_DUVIDA_CLIENTE,MSG_AGENDAMENTO_ESCOLHA_HORARIO','AGENDAMENTO',0,0,0,1],
  [65,'AGENDAMENTO','INTERESSE','sim,quero,tenho interesse,pode seguir,pode continuar,vamos,quero conversar,quero agendar,podemos agendar,pode marcar','MSG_AGENDAMENTO_ESCOLHA_HORARIO','AGENDAMENTO',0,0,0,1],
  [64,'AGENDAMENTO','ACK_NEUTRO','ok,certo,entendi,perfeito,beleza,show,combinado,obrigado,obrigada,valeu,tá bom,ta bom','MSG_AGENDAMENTO_ESCOLHA_HORARIO','AGENDAMENTO',0,0,0,1],
  [14,'AGENDAMENTO','AGENDAMENTO_FALLBACK','*','MSG_AGENDAMENTO_ESCOLHA_HORARIO','AGENDAMENTO',0,0,0,1],

  // ── Fallback global ──────────────────────────────────────────
  [10,'QUALQUER','FALLBACK','*','MSG_FALLBACK_GERAL','MESMO',0,0,0,1],
]

// Estrutura MESSAGES: { type: 'text'|'video', text: '...', url?: '...', internal?: true }
const MESSAGES = {
  MSG_OPT_OUT: { type:'text', text:'Tudo bem. Vou encerrar por aqui e não sigo com novos contatos.\n\nObrigado pelo retorno.' },
  MSG_NEGATIVA_GERAL: { type:'text', text:'Sem problema. Obrigado por me responder.\n\nVou encerrar por aqui e desejo sucesso na sua atuação no mercado imobiliário.\n\nSe conhecer alguém que esteja avaliando oportunidades, pode compartilhar nosso site:\n{site_vagas_url}' },
  MSG_PAUSA_COMERCIAL: { type:'text', text:'Vou deixar o caminho aqui para você ver com calma quando fizer sentido:\n\n{site_vagas_url}\n\nQuando quiser retomar, pode me chamar por aqui.' },
  MSG_AUDIO_GERAL: { type:'text', text:'No momento não consigo ouvir áudio por aqui.\n\nPode me mandar em texto, por favor?' },
  MSG_HUMANO_AVISO_CLIENTE: { type:'text', text:'Vou direcionar sua mensagem para uma pessoa do atendimento te ajudar melhor.' },
  MSG_HUMANO_INTERNO: { type:'text', internal:true, text:'[Atendimento humano - {operation_name}]\n\n👤 Nome: {nome}\n📞 Telefone: +{telefone}\n📍 Estágio: {estagio}\n🎯 Intenção: {intencao}\n\n💬 Mensagem recebida:\n{texto}' },
  MSG_FALLBACK_GERAL: { type:'text', text:'Ok. Vou seguir de forma objetiva para você não perder tempo.\n\nSe não fizer sentido, é só me avisar que eu encerro por aqui.' },

  MSG_DUVIDA_EMPRESA_ATUACAO: { type:'text', text:'Claro. A RHIMOB conecta profissionais e lideranças do mercado imobiliário a oportunidades, operações e empresas do setor.\n\nA atuação pode variar conforme o perfil:\n• lançamentos;\n• Minha Casa Minha Vida;\n• alto padrão;\n• terceiros;\n• locação;\n• captação;\n• atendimento comercial;\n• liderança;\n• apoio à contratação.' },
  MSG_DUVIDA_SALARIO: { type:'text', text:'Sobre ganhos, no mercado imobiliário o formato varia bastante.\n\nExistem operações com comissão, ajuda de custo, premiação e outros modelos. Em vendas imobiliárias, a comissão costuma ficar em torno de 2,5% a 3,5% sobre o valor do imóvel, conforme a empresa e a operação.' },
  MSG_DUVIDA_ROTINA: { type:'text', text:'Sobre rotina, depende da operação.\n\nPode envolver plantão, atendimento de leads, visitas, captação, relacionamento com clientes, imobiliárias, construtoras ou incorporadoras.\n\nAlgumas frentes são presenciais e outras podem ter dinâmica híbrida, conforme a empresa.' },
  MSG_DUVIDA_LOCAL: { type:'text', text:'Sobre local, as oportunidades variam por cidade, bairro, região e tipo de operação.\n\nO ideal é olhar o site e depois alinhar com o responsável qual frente combina melhor com sua região e disponibilidade.' },
  MSG_DUVIDA_EXPERIENCIA_CRECI: { type:'text', text:'Para algumas oportunidades, o CRECI ativo e alguma vivência comercial ajudam bastante.\n\nEm outras, a empresa pode avaliar perfil, postura comercial, disponibilidade e abertura para treinamento. O melhor encaixe depende da operação.' },
  MSG_DUVIDA_CONFIANCA: { type:'text', text:'Pode validar com calma.\n\nA RHIMOB atua com recrutamento e inteligência comercial para o mercado imobiliário. Eu não vou pedir dados sensíveis por aqui; o caminho principal é o site oficial, onde ficam as vagas e os canais corretos.' },
  MSG_DUVIDA_PARCEIRO_INDICACAO: { type:'text', text:'Também existe possibilidade de parceria ou indicação, dependendo do caso.\n\nSe você conhece gestores, imobiliárias, incorporadoras ou corretores que precisam contratar melhor, isso pode virar uma conversa comercial com a RHIMOB.' },
  MSG_DUVIDA_MCMV: { type:'text', text:'Temos frentes que podem envolver Minha Casa Minha Vida e outras operações imobiliárias, dependendo da empresa, da região e do momento da vaga.\n\nO ideal é alinhar seu perfil para direcionar para a operação correta.' },
  MSG_DUVIDA_GERAL: { type:'text', text:'Vou te explicar de forma simples.\n\nÉ uma triagem de oportunidades e possibilidades comerciais no mercado imobiliário. Primeiro você entende as frentes abertas e depois, se fizer sentido, é direcionado para o responsável certo.' },
  MSG_JA_ATUANDO_IMOBILIARIA: { type:'text', text:'Entendi. Muitos corretores que falam comigo já estão em alguma operação e só avaliam uma mudança se fizer sentido.\n\nMesmo assim, pode valer olhar as oportunidades e comparar:\n• região;\n• produto;\n• comissão;\n• ajuda de custo;\n• roletas;\n• estrutura comercial.' },

  MSG_WEBHOOK_01: { type:'text', text:'{primeiro_nome}, vou te contextualizar rapidamente.\n\nAtuamos conectando profissionais ao mercado imobiliário em São Paulo e seu contato chegou até nós dentro desse mapeamento.\n\nInicialmente queria te apresentar uma frente ligada ao Grupo Kaza, com foco em operação digital e alto padrão.' },
  MSG_WEBHOOK_02: { type:'text', text:'📍Atuação na região dos Jardins — São Paulo.\n\nHoje existem frentes em:\n• lançamentos\n• locação\n• terceiros\n• carteira de imóveis\n\nModelo comissionado e operação mais flexível, sem rotina pesada de plantão.' },
  MSG_WEBHOOK_03: { type:'text', text:'Se fizer sentido para você, eu sigo com mais detalhes sobre a empresa, vídeo institucional, rotina, ganhos e próximos passos.' },

  MSG_INFO2_01: { type:'text', text:'🏢 O Grupo Kaza é uma rede imobiliária com atuação em São Paulo, São José dos Campos, Jacareí e Orlando, com foco em lançamentos imobiliários de médio e alto padrão.\n\nA estrutura conta com:\n• carteira ativa de clientes;\n• geração de leads;\n• CRM e tecnologia;\n• suporte comercial;\n• parcerias com construtoras;\n• portfólio de terceiros;\n• ferramentas para potencializar a atuação do corretor.' },
  MSG_INFO2_02: { type:'video', text:'🎥 Vou te deixar um vídeo rápido da estrutura do Grupo Kaza em São Paulo.\n\nA operação trabalha com incorporadoras e produtos ligados ao médio e alto padrão.', url:'https://res.cloudinary.com/dvflrvhd7/video/upload/v1778697515/WhatsApp_Video_2026-05-13_at_15.17.33_rburys.mp4' },
  MSG_INFO2_03: { type:'text', text:'🚀 O que a operação oferece hoje:\n\n• comissão a partir de 30%\n• leads recorrentes\n• CRM e suporte comercial\n• carteira de terceiros\n• operação digital\n• parcerias estratégicas\n\nOs detalhes completos da operação são alinhados diretamente com o responsável da equipe.\n\nSe fizer sentido, posso seguir.' },

  MSG_COMPLEMENTO_01: { type:'text', text:'O próximo passo seria uma conversa rápida com alguém da operação para entender melhor seu perfil e apresentar a estrutura com mais clareza.' },
  MSG_COMPLEMENTO_02: { type:'text', text:'Nessa conversa você consegue entender melhor:\n\n• ganhos\n• rotina\n• região\n• produto\n• operação\n• suporte\n• próximos passos' },
  MSG_COMPLEMENTO_03: { type:'text', text:'Consigo te deixar pré-agendado em uma das opções:\n\n1️⃣ {slot_1_texto}\n2️⃣ {slot_2_texto}\n\nQual fica melhor para você?\n\nVocê pode responder com primeira opção, segunda opção ou dizer que nenhum dos dois funciona.' },

  MSG_AGENDAMENTO_SLOT1_CLIENTE: { type:'text', text:'Perfeito.\n\nVou registrar sua preferência por {slot_1_texto}.\n\nAinda não está confirmado: {humano_nome} vai validar e confirmar o próximo passo com você.' },
  MSG_AGENDAMENTO_SLOT2_CLIENTE: { type:'text', text:'Perfeito.\n\nVou registrar sua preferência por {slot_2_texto}.\n\nAinda não está confirmado: {humano_nome} vai validar e confirmar o próximo passo com você.' },
  MSG_AGENDAMENTO_SEM_ENCAIXE_CLIENTE: { type:'text', text:'Sem problema.\n\nVou avisar o responsável que esses horários não funcionaram para você. {humano_nome} vai chamar você para ajustar um dia e horário melhor.' },
  MSG_AGENDAMENTO_DUVIDA_CLIENTE: { type:'text', text:'Entendi.\n\nPara eu encaminhar corretamente, preciso que você escolha uma das opções de horário abaixo ou me diga que nenhum dos dois funciona.' },
  MSG_AGENDAMENTO_ESCOLHA_HORARIO: { type:'text', text:'Para eu encaminhar corretamente, me diga qual opção funciona melhor:\n\n1️⃣ {slot_1_texto}\n2️⃣ {slot_2_texto}\n\nVocê pode responder com primeira opção, segunda opção, 1, 2 ou dizer que nenhum dos dois funciona.' },
  MSG_AGENDAMENTO_SLOT1_INTERNO: { type:'text', internal:true, text:'[Pré-agendamento - {operation_name}]\n\n✅ Lead escolheu a 1ª opção.\n⚠️ Ainda não confirmado.\n\n👤 Nome: {nome}\n📞 Telefone: +{telefone}\n\n🕒 Preferência: {slot_1_texto}\n\n💬 Mensagem: {texto}\n\nAção: confirmar com o lead.' },
  MSG_AGENDAMENTO_SLOT2_INTERNO: { type:'text', internal:true, text:'[Pré-agendamento - {operation_name}]\n\n✅ Lead escolheu a 2ª opção.\n⚠️ Ainda não confirmado.\n\n👤 Nome: {nome}\n📞 Telefone: +{telefone}\n\n🕒 Preferência: {slot_2_texto}\n\n💬 Mensagem: {texto}\n\nAção: confirmar com o lead.' },
  MSG_AGENDAMENTO_SEM_ENCAIXE_INTERNO: { type:'text', internal:true, text:'[Agendamento sem encaixe - {operation_name}]\n\n👤 Nome: {nome}\n📞 Telefone: +{telefone}\n\nLead demonstrou interesse, mas nenhum horário funcionou.\n\n💬 Mensagem: {texto}\n\nAção: entrar em contato para oferecer novo horário.' },

  MSG_ACK_NEUTRO: { type:'text', text:'Perfeito. Fique à vontade para olhar com calma. Quando fizer sentido, me chama por aqui que eu te direciono melhor.' },
  MSG_LIDERANCA_CONTRATANTE: { type:'text', text:'Que legal. Nesse caso, faz sentido eu me apresentar também pelo lado institucional da RHIMOB.\n\nAlém de oportunidades para corretores, apoiamos imobiliárias, incorporadoras e lideranças comerciais na atração, seleção e organização de profissionais para operação.' },
  MSG_LIDERANCA_CONTRATANTE_02: { type:'text', text:'Se em algum momento você precisar contratar corretores, SDRs, atendimento, gerentes, formar equipe comercial ou reforçar uma operação imobiliária, pode contar com a gente.\n\nVou deixar nosso site:\n{site_empresa_url}' },
  MSG_LIDERANCA_CONTRATANTE_INTERNO: { type:'text', internal:true, text:'[Lead liderança/contratante - {operation_name}]\n\n👤 Nome: {nome}\n📞 Telefone: +{telefone}\n📍 Estágio: {estagio}\n🎯 Intenção: {intencao}\n\n💬 Mensagem: {texto}\n\nPriorizar abordagem comercial RHIMOB.' },
}

// Semeia funil padrão para um userId específico (chamado ao criar usuário)
function seedBotDataForUser(db, userId) {
  const existD = db.prepare(`SELECT COUNT(*) as c FROM bot_decisions WHERE user_id = ?`).get(userId)
  if (existD.c === 0) {
    const ins = db.prepare(`
      INSERT INTO bot_decisions (user_id, priority, stage, intent, keywords, msg_ids, next_stage, advances, finalizes, human, active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    const insertAll = db.transaction(rows => { for (const r of rows) ins.run(userId, ...r) })
    insertAll(DECISIONS)
  }

  const existM = db.prepare(`SELECT COUNT(*) as c FROM bot_messages WHERE user_id = ?`).get(userId)
  if (existM.c === 0) {
    const ins = db.prepare(`
      INSERT INTO bot_messages (user_id, msg_id, type, text, url, internal)
      VALUES (?, ?, ?, ?, ?, ?)
    `)
    const insertAll = db.transaction(rows => { for (const r of rows) ins.run(userId, ...r) })
    const rows = Object.entries(MESSAGES).map(([id, m]) =>
      [id, m.type || 'text', m.text || '', m.url || '', m.internal ? 1 : 0]
    )
    insertAll(rows)
  }
}

// Seed inicial (admin user_id=1) — chamado na inicialização do banco
function seedBotData(db) {
  const existD = db.prepare(`SELECT COUNT(*) as c FROM bot_decisions WHERE user_id = 1`).get()
  if (existD.c === 0) {
    seedBotDataForUser(db, 1)
    console.log(`✅ Bot: ${DECISIONS.length} decisões + ${Object.keys(MESSAGES).length} mensagens carregadas para admin`)
  }
}

module.exports = { DECISIONS, MESSAGES, seedBotData, seedBotDataForUser }
