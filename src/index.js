/**
 * Wazap — Disparador WhatsApp com Baileys
 * Entrada principal: inicializa banco, instâncias e servidor web
 */

const { initDB } = require('./db')
const { startServer } = require('./api')
const { instanceManager, setIncomingHandler } = require('./whatsapp')
const { handleIncoming, setInstanceManager } = require('./chatbot')

const PORT = process.env.PORT || 3000

async function main() {
  console.log('🚀 Iniciando Wazap...')

  // Inicializa banco SQLite (sql.js é async na inicialização)
  await initDB()
  console.log('✅ Banco de dados pronto')

  // Inicializa gerenciador de instâncias (restaura sessões salvas)
  await instanceManager.restoreInstances()
  console.log('✅ Instâncias restauradas')

  // Inicia servidor HTTP + Socket.IO
  startServer(PORT)
  console.log(`✅ Painel disponível em http://localhost:${PORT}`)

  // Cabeia chatbot: injeta instanceManager e registra listener de mensagens recebidas
  setInstanceManager(instanceManager)
  setIncomingHandler(handleIncoming)
  console.log('✅ Chatbot corretor ativado')

  // Inicia motor de disparo em background
  const { startSenderLoop } = require('./sender')
  startSenderLoop()
  console.log('✅ Motor de disparo iniciado')
}

main().catch(err => {
  console.error('❌ Erro fatal:', err)
  process.exit(1)
})
