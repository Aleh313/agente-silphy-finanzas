/**
 * Módulo Autónomo 24/7 y Comunicación para: Silphy (Sylphiette)
 * Rol: Líder Contable, Finanzas & Tesorería
 * Carpeta: agentes/03_silphy_contable/agente.js
 */
const fs = require('fs');
const path = require('path');
const MessageBus = require('../bus_comunicacion');

module.exports = {
  id: 'ag_silphy',
  name: 'Silphy (Sylphiette)',
  folder: '03_silphy_contable',
  role: 'Líder Contable, Finanzas & Tesorería',
  sector: 'admin',

  // Inicialización del agente al arrancar el servidor
  init(db, helpers) {
    console.log('🤖 [Agente Activo 24/7] Silphy (Sylphiette) inicializado con sus skills.');
    this.checkPendingMessages();
  },

  // Revisar mensajes entrantes dirigidos a este agente
  checkPendingMessages() {
    const unread = MessageBus.getMessagesForAgent(this.id, true);
    if (unread.length > 0) {
      console.log(`📬 [${this.name}] Tiene ${unread.length} mensajes pendientes en el bus.`);
      unread.forEach(msg => this.processIncomingMessage(msg));
    }
    return unread;
  },

  // Procesar mensaje entrante de otro agente
  processIncomingMessage(msg) {
    console.log(`📨 [${this.name}] Procesando mensaje de ${msg.fromAgentId}: "${msg.subject}"`);
    // Marcar como leído
    MessageBus.markAsRead(msg.id);
    return { ok: true, processed: msg.id };
  },

  // Enviar mensaje o directiva a otro agente
  sendMessage(toAgentId, subject, body, payload = {}, type = 'directiva') {
    return MessageBus.sendMessage({
      fromAgentId: this.id,
      toAgentId,
      type,
      subject,
      body,
      payload
    });
  },

  // Ejecución de tareas programadas o invocadas desde la UI
  async runTask(payload = {}, db = null) {
    return {
      ok: true,
      agentId: this.id,
      name: this.name,
      role: this.role,
      skills: ["Operaciones Contables & Facturación","Matemática Financiera & Runway","Pistas de Auditoría Firmadas"],
      timestamp: new Date().toISOString(),
      message: `[${this.name}] Tarea ejecutada con éxito bajo protocolo autónomo.`
    };
  }
};
