/**
 * Módulo Socket.IO — compartilha instância entre api.js, whatsapp.js e sender.js
 */

let io = null

function setIO(ioInstance) { io = ioInstance }
function getIO() {
  if (!io) throw new Error('Socket.IO não inicializado')
  return io
}

module.exports = { setIO, getIO }
