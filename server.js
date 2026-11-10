const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

// Cargar variables de entorno (soporta ejecución directa o desde raíz)
const rootEnv = path.join(__dirname, '..', '..', '.env');
const localEnv = path.join(__dirname, '.env');
if (fs.existsSync(localEnv)) {
  require('dotenv').config({ path: localEnv });
} else if (fs.existsSync(rootEnv)) {
  require('dotenv').config({ path: rootEnv });
} else {
  require('dotenv').config();
}

const app = express();
const PORT = process.env.PORT_SILPHY || 3003;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Rutas de archivos de datos
const DB_PATH = path.join(__dirname, 'db.json');
const PROMPT_PATH = path.join(__dirname, 'PROMPT_ENTRENAMIENTO.md');
const MEMORIA_PATH = path.join(__dirname, 'memoria', 'MEMORIA_ACTIVIDAD.md');
const CHAT_HISTORY_PATH = path.join(__dirname, 'memoria', 'chat_history.json');
const ROOT_DB_PATH = path.join(__dirname, '..', '..', 'database.json');
const RUDY_DB_PATH = path.join(__dirname, '..', '01_rudy_jefe', 'db.json');

// Cliente Gemini AI
let aiClient = null;
let geminiAvailable = false;
const apiKey = process.env.GEMINI_API_KEY;

if (apiKey && apiKey.trim().length > 10) {
  try {
    const { GoogleGenAI } = require('@google/genai');
    aiClient = new GoogleGenAI({ apiKey: apiKey.trim() });
    geminiAvailable = true;
    console.log('✨ [Silphy AI] Conexión establecida con Gemini API.');
  } catch (err) {
    console.warn('⚠️ [Silphy AI] Error inicializando Gemini:', err.message);
  }
}

// Helpers de lectura / escritura
function loadDB() {
  try {
    return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  } catch (e) {
    return { debts: [], finances: {}, transfers: [], receivables: [] };
  }
}

function saveDB(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8');
  syncWithRootDB(data);
}

function loadMemory() {
  try {
    return fs.readFileSync(MEMORIA_PATH, 'utf8');
  } catch (e) {
    return '';
  }
}

function appendMemory(note) {
  try {
    const time = new Date().toLocaleString('es-AR', { timeZone: 'America/Argentina/Catamarca' });
    const entry = `\n- **[${time}] Carga Semanal:** ${note}`;
    fs.appendFileSync(MEMORIA_PATH, entry, 'utf8');
  } catch (e) {
    console.error('Error guardando en memoria:', e);
  }
}

function loadPrompt() {
  try {
    return fs.readFileSync(PROMPT_PATH, 'utf8');
  } catch (e) {
    return 'Sos Silphy, líder de finanzas y tesorería de Electronicat.';
  }
}

// Historial persistente de conversación del Chatbot
function loadChatHistory() {
  try {
    if (fs.existsSync(CHAT_HISTORY_PATH)) {
      return JSON.parse(fs.readFileSync(CHAT_HISTORY_PATH, 'utf8'));
    }
  } catch (err) {
    console.warn('Error leyendo chat_history.json:', err.message);
  }
  return [];
}

function saveChatHistory(history) {
  try {
    fs.writeFileSync(CHAT_HISTORY_PATH, JSON.stringify(history, null, 2), 'utf8');
  } catch (err) {
    console.warn('Error guardando chat_history.json:', err.message);
  }
}

function appendToChatHistory(messageObj) {
  const history = loadChatHistory();
  history.push(messageObj);
  // Mantener los últimos 150 mensajes para ligereza
  if (history.length > 150) history.splice(0, history.length - 150);
  saveChatHistory(history);
}

// Sincronización con database.json central
function syncWithRootDB(localData) {
  try {
    if (fs.existsSync(ROOT_DB_PATH)) {
      const rootDB = JSON.parse(fs.readFileSync(ROOT_DB_PATH, 'utf8'));
      if (localData.finances) {
        rootDB.finances = rootDB.finances || {};
        rootDB.finances.totalCash = localData.finances.cashAvailable || rootDB.finances.totalCash;
        rootDB.finances.rescueMode = localData.finances.rescueMode !== undefined ? localData.finances.rescueMode : rootDB.finances.rescueMode;
      }
      fs.writeFileSync(ROOT_DB_PATH, JSON.stringify(rootDB, null, 2), 'utf8');
    }
  } catch (err) {
    console.warn('Nota: Sincronización con database.json raíz omitida:', err.message);
  }
}

// ==========================================
// LÓGICA DE REGISTRO FINANCIERO ATÓMICO
// ==========================================
function executeMovementRecord(dbData, { type, amount, concept, client, destination, debtId, receivableId }) {
  const numAmount = Number(amount);
  if (isNaN(numAmount) || numAmount <= 0) return null;

  dbData.finances = dbData.finances || {};
  dbData.transfers = dbData.transfers || [];
  dbData.debts = dbData.debts || [];
  dbData.receivables = dbData.receivables || [];

  const today = new Date().toISOString().split('T')[0];
  const txId = `tx_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  let auditNote = '';
  let updatedReceivable = null;
  let updatedDebt = null;

  if (type === 'ingreso') {
    dbData.finances.cashAvailable = (Number(dbData.finances.cashAvailable) || 0) + numAmount;

    // Vinculación y descuento automático de cuentas por cobrar (clientes que nos debían)
    let targetRec = null;
    if (receivableId) {
      targetRec = dbData.receivables.find(r => r.id === receivableId);
    }
    if (!targetRec && client) {
      const cLow = client.toLowerCase().trim();
      targetRec = dbData.receivables.find(r => {
        const rName = (r.clientName || '').toLowerCase();
        return rName.includes(cLow) || cLow.includes(rName) ||
               (cLow.includes('ancasti') && rName.includes('ancasti')) ||
               (cLow.includes('montmartre') && rName.includes('montmartre')) ||
               (cLow.includes('juventud') && rName.includes('juventud'));
      });
    }

    if (targetRec) {
      const prevAmount = Number(targetRec.amount) || 0;
      targetRec.amount = Math.max(0, prevAmount - numAmount);
      if (targetRec.amount === 0) {
        targetRec.concept = `✓ Cobro total liquidado ($${numAmount.toLocaleString('es-AR')})`;
      } else {
        targetRec.concept = `Cobro parcial $${numAmount.toLocaleString('es-AR')} acreditado (Saldo: $${targetRec.amount.toLocaleString('es-AR')})`;
      }
      updatedReceivable = { id: targetRec.id, name: targetRec.clientName, remaining: targetRec.amount };
      auditNote += ` [Cobranza Actualizada]: ${targetRec.clientName} restó $${numAmount.toLocaleString('es-AR')}. Saldo pendiente: $${targetRec.amount.toLocaleString('es-AR')}.`;
    }

    dbData.transfers.push({
      id: txId,
      date: today,
      type: 'ingreso',
      amount: numAmount,
      client: client || (targetRec ? targetRec.clientName : 'Cliente Taller'),
      concept: concept || 'Cobro / Ingreso de fondos',
      destination: destination || 'Cuenta Empresa / Caja'
    });
    auditNote += ` Ingreso de $${numAmount.toLocaleString('es-AR')} de ${client || 'Cliente'}. Nueva caja: $${dbData.finances.cashAvailable.toLocaleString('es-AR')}.`;

  } else if (type === 'egreso' || type === 'pago_deuda') {
    dbData.finances.cashAvailable = Math.max(0, (Number(dbData.finances.cashAvailable) || 0) - numAmount);

    // Vinculación y actualización automática de deudas de la empresa (solo si es pago de deuda o se especificó debtId)
    let targetDebt = null;
    if (debtId) {
      targetDebt = dbData.debts.find(d => d.id === debtId);
    }
    if (!targetDebt && (type === 'pago_deuda' || (concept && /pago|deuda|cuota|cancel/i.test(concept))) && (client || concept)) {
      const searchTerms = ` ${client || ''} ${concept || ''} `.toLowerCase();
      targetDebt = dbData.debts.find(d => {
        const dName = (d.creditor || '').toLowerCase();
        const dCat = (d.category || '').toLowerCase();
        const dId = (d.id || '').toLowerCase();
        return (
          searchTerms.includes(dName) || dName.includes((client || '').toLowerCase()) ||
          (searchTerms.includes('luz') && (dId.includes('luz') || dCat.includes('luz'))) ||
          (searchTerms.includes('antonella') && dId.includes('antonella')) ||
          ((searchTerms.includes('zapatilla') || searchTerms.includes('san juan')) && dId.includes('san_juan')) ||
          ((searchTerms.includes('monotributo') || searchTerms.includes('arca')) && dId.includes('monotributo')) ||
          ((searchTerms.includes('mercado pago') || /\bmp\b/.test(searchTerms)) && dId.includes('mp')) ||
          (searchTerms.includes('macro') && dId.includes('macro')) ||
          (searchTerms.includes('credicuotas') && dId.includes('credicuotas')) ||
          (searchTerms.includes('kiosko') && dId.includes('kiosko'))
        );
      });
    }

    if (targetDebt) {
      targetDebt.paidThisMonth = true;
      targetDebt.totalAmount = Math.max(0, (Number(targetDebt.totalAmount) || 0) - numAmount);
      targetDebt.actionRequired = targetDebt.totalAmount === 0 
        ? `Cancelado totalmente ($${numAmount.toLocaleString('es-AR')})` 
        : `Cuota de $${numAmount.toLocaleString('es-AR')} pagada. Saldo restante: $${targetDebt.totalAmount.toLocaleString('es-AR')}`;
      updatedDebt = { id: targetDebt.id, creditor: targetDebt.creditor, remaining: targetDebt.totalAmount };
      auditNote += ` [Deuda Actualizada]: ${targetDebt.creditor} pagó $${numAmount.toLocaleString('es-AR')}. Saldo restante: $${targetDebt.totalAmount.toLocaleString('es-AR')}.`;
    }

    dbData.transfers.push({
      id: txId,
      date: today,
      type: 'egreso',
      amount: numAmount,
      client: client || (targetDebt ? targetDebt.creditor : 'Proveedor / Acreedor'),
      concept: concept || (targetDebt ? `Pago a ${targetDebt.creditor}` : 'Gasto operativo / Repuestos'),
      destination: targetDebt ? 'Pago Deuda' : (destination || 'Gasto Taller')
    });
    auditNote += ` Egreso de $${numAmount.toLocaleString('es-AR')}. Nueva caja: $${dbData.finances.cashAvailable.toLocaleString('es-AR')}.`;

  } else if (type === 'cuenta_cobrar') {
    dbData.receivables.push({
      id: `rec_${Date.now()}`,
      clientName: client || 'Cliente',
      concept: concept || 'Trabajo por entregar',
      amount: numAmount,
      date: 'Semana en curso'
    });
    auditNote = `Nueva cuenta por cobrar: $${numAmount.toLocaleString('es-AR')} de ${client} (${concept}).`;
  }

  return {
    txId,
    auditNote,
    updatedReceivable,
    updatedDebt,
    newCash: dbData.finances.cashAvailable
  };
}

// ==========================================
// ROUTER & ENDPOINTS DE LA API
// ==========================================
const router = express.Router();

// Lector de directivas emitidas por Rudy Greyrat (CEO) o el Bus Inter-Agente
function loadDirectivesForSilphy() {
  const directives = [];
  try {
    if (fs.existsSync(RUDY_DB_PATH)) {
      const rudyDB = JSON.parse(fs.readFileSync(RUDY_DB_PATH, 'utf8'));
      const list = rudyDB.recentDirectives || [];
      list.filter(d => {
        const t = (d.targetAgent || '').toLowerCase();
        return t === 'ag_silphy' || t === 'silphy' || t === 'all' || t === 'todos';
      }).forEach(d => directives.push({
        id: d.id,
        source: d.author || 'Rudy Greyrat (CEO)',
        date: d.date,
        directive: d.directive,
        status: d.status || 'activa'
      }));
    }
  } catch (err) {
    console.warn('Error leyendo directivas de Rudy:', err.message);
  }

  try {
    if (fs.existsSync(ROOT_DB_PATH)) {
      const rootDB = JSON.parse(fs.readFileSync(ROOT_DB_PATH, 'utf8'));
      const msgs = rootDB.agentMessages || [];
      msgs.filter(m => {
        const t = (m.toAgentId || '').toLowerCase();
        return (t === 'ag_silphy' || t === 'all') && m.type === 'directiva';
      }).forEach(m => directives.push({
        id: m.id,
        source: m.fromAgentId,
        date: m.timestamp || m.dateFormatted,
        directive: m.subject + (m.body ? `: ${m.body}` : ''),
        status: m.status || 'activa'
      }));
    }
  } catch (err) {
    console.warn('Error leyendo bus para Silphy:', err.message);
  }

  return directives;
}

// 1. Estado y datos financieros
router.get('/status', (req, res) => {
  const dbData = loadDB();
  const memory = loadMemory();
  const directives = loadDirectivesForSilphy();
  res.json({
    ok: true,
    data: dbData,
    memorySnippet: memory.slice(-1500),
    directives
  });
});

// 2. Historial persistente del Chatbot
router.get('/chat-history', (req, res) => {
  const history = loadChatHistory();
  res.json({ ok: true, history });
});

router.delete('/chat-history', (req, res) => {
  saveChatHistory([]);
  res.json({ ok: true, message: 'Historial de chat borrado.' });
});

// 3. Chat con Silphy (Conversacional + Auto-registro Directo)
router.post('/chat', async (req, res) => {
  const { message, userName = 'Ale' } = req.body;
  if (!message || !message.trim()) {
    return res.status(400).json({ error: 'Mensaje requerido' });
  }

  const userTime = new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

  // Guardar mensaje del usuario en el historial permanente
  appendToChatHistory({
    id: `msg_u_${Date.now()}`,
    sender: userName,
    text: message.trim(),
    type: 'user',
    time: userTime
  });

  const dbData = loadDB();
  const systemPrompt = loadPrompt();
  const memory = loadMemory();

  // Resumen financiero vivo para inyectar al contexto
  const totalReceivables = (dbData.receivables || []).reduce((acc, r) => acc + (Number(r.amount) || 0), 0);
  const receivablesListPrompt = (dbData.receivables || []).map(r => `  - ID: "${r.id}" | Cliente: "${r.clientName}" | Saldo pendiente: $${Number(r.amount).toLocaleString('es-AR')} | Detalle: ${r.concept}`).join('\n');
  const debtsListPrompt = (dbData.debts || []).map(d => `  - ID: "${d.id}" | Acreedor: "${d.creditor}" | Total: $${Number(d.totalAmount).toLocaleString('es-AR')} | Cuota: $${Number(d.monthlyQuota).toLocaleString('es-AR')} | Pagado este mes: ${d.paidThisMonth ? 'SI' : 'NO'}`).join('\n');

  const directives = loadDirectivesForSilphy();
  const directivesPrompt = directives.length > 0
    ? directives.map(d => `  - [${d.source}]: "${d.directive}" (Estado: ${d.status}, Fecha: ${d.date})`).join('\n')
    : '  (Ninguna directiva pendiente registrada)';

  const contextData = `
INFORMACIÓN FINANCIERA VIVA DEL TALLER (Catamarca):
- Caja disponible actual: $${Number(dbData.finances?.cashAvailable || 0).toLocaleString('es-AR')} ARS
- Modo actual: ${dbData.finances?.rescueMode ? 'MODO RESCATE (30% Deuda, 25% Operación taller, 30% Socios, 10% Patrimonio, 5% Inversión)' : 'MODO NORMAL'}
- Directivas recibidas de Rudy Greyrat (CEO):
${directivesPrompt}
- Cuentas por cobrar pendientes (Clientes que nos deben):
${receivablesListPrompt || '  (Ninguna pendiente)'}
- Deudas y compromisos de la empresa (Acreedores a quienes debemos):
${debtsListPrompt || '  (Ninguna pendiente)'}
- Últimos movimientos registrados: ${(dbData.transfers || []).slice(-4).map(t => `${t.date}: ${t.type} de $${t.amount} (${t.concept})`).join(' | ')}
`;

  const instruction = `
${systemPrompt}

MEMORIA HISTÓRICA RECIENTE:
${memory.slice(-1200)}

${contextData}

INSTRUCCIÓN DE INTERACCIÓN HUMANA:
- Estás manteniendo una charla 1 a 1 con ${userName} (tu socio/amigo y líder en el taller de Electronicat).
- Tu tono es dulce, cercano, empático y paciente (sos Sylphiette), pero a la vez sos quirúgicamente rigurosa e inflexible con los números, costos y cobros.
- DIRECTIVAS DE RUDEUS / RUDY: Si ${userName} te pregunta si recibiste o conocés alguna directiva de Rudy (o Rudeus), confirmáselo abiertamente mencionándole con exactitud qué directiva recibiste de él, la fecha, si está activa o cumplida y cómo afecta a los números del taller.
- Si ${userName} te cuenta novedades de la semana (por ejemplo: "cobramos tanto", "gastamos tanto en insumos", "pagamos tal boleta", "quedó pendiente el cobro de tal cliente"), escuchalo como una compañera de confianza, analizá el impacto en la caja y los cubos de rescate, y brindale tu consejo u opinión sincera.
- Si detectás uno o más movimientos concretos en lo que te dijo (ingresos, egresos, cancelación de deuda o nuevo cobro a favor), además de tu respuesta en lenguaje natural, añade AL FINAL de tu respuesta un bloque JSON con la etiqueta exacta \`\`\`financial_action ... \`\`\` para que el sistema procese y aplique los cambios DIRECTAMENTE a la base de datos:
\`\`\`financial_action
{
  "detected": true,
  "summary": "Resumen corto",
  "movements": [
    {
      "type": "ingreso" | "egreso" | "pago_deuda" | "cuenta_cobrar",
      "amount": 0,
      "client": "Nombre del cliente o proveedor",
      "concept": "Detalle",
      "receivableId": "Si es un cobro a un cliente de la lista de cuentas por cobrar, poné su ID exacto (ej: rec_ancasti_60k, rec_molmatre_750k) para descontar su deuda con nosotros",
      "debtId": "Si estamos pagando una deuda de la empresa, poné su ID exacto (ej: debt_luz, debt_antonella, debt_zapatillas_san_juan, debt_monotributo, debt_mp) para descontar el saldo"
    }
  ]
}
\`\`\`
Si no hay movimientos para registrar, NO incluyas ese bloque, solo responde la charla con naturalidad.
`;

  let replyText = '';
  let detectedAction = null;

  if (geminiAvailable && aiClient) {
    try {
      const response = await aiClient.models.generateContent({
        model: process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite',
        contents: `${instruction}\n\nMENSAJE DE ${userName.toUpperCase()}:\n"${message.trim()}"`
      });
      replyText = response.text || '';
    } catch (e) {
      console.warn('⚠️ [Silphy Gemini Fallback]:', e.message);
    }
  }

  // Fallback heurístico si Gemini no responde
  if (!replyText) {
    const lower = message.toLowerCase();
    if (lower.includes('caja') || lower.includes('plata') || lower.includes('saldo')) {
      replyText = `Hola ${userName}, tenemos en caja $${Number(dbData.finances?.cashAvailable || 0).toLocaleString('es-AR')}. Acordate de que bajo el esquema de rescate, cada peso que entra lo distribuimos: 30% a deudas prioritarias y 25% a insumos del taller.`;
    } else if (lower.includes('cobramos') || lower.includes('ingreso') || lower.includes('adelanto')) {
      replyText = `¡Qué buena noticia ${userName}! Contame exactamente el monto y de qué cliente o trabajo fue, así lo registro en el libro diario y recalculamos los fondos de socios y repuestos.`;
    } else if (lower.includes('deuda') || lower.includes('luz') || lower.includes('antonella')) {
      replyText = `Recordá ${userName} que nuestra prioridad número uno es la boleta de luz de $150.000 para que el taller no se frene, y la cuota de Antonella.`;
    } else {
      replyText = `Hola ${userName}, acá estoy atenta a los números de Electronicat. Contame tranquilo cómo fue tu semana.`;
    }
  }

  // Extraer bloque financial_action si existe
  const actionMatch = replyText.match(/```financial_action\s*([\s\S]*?)\s*```/);
  if (actionMatch) {
    try {
      detectedAction = JSON.parse(actionMatch[1]);
      replyText = replyText.replace(/```financial_action[\s\S]*?```/, '').trim();
    } catch (err) {
      console.warn('Error parseando financial_action:', err.message);
    }
  }

  // AUTO-REGISTRO INMEDIATO Y PERSISTENTE
  const autoRecordedMovements = [];
  if (detectedAction && detectedAction.movements && detectedAction.movements.length > 0) {
    for (const mov of detectedAction.movements) {
      const recordResult = executeMovementRecord(dbData, mov);
      if (recordResult) {
        autoRecordedMovements.push({ ...mov, ...recordResult });
        appendMemory(recordResult.auditNote);
      }
    }
    // Guardar en db.json inmediatamente
    saveDB(dbData);
  }

  const silphyTime = new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

  // Guardar respuesta de Silphy en el historial permanente
  appendToChatHistory({
    id: `msg_s_${Date.now()}`,
    sender: 'Silphy',
    text: replyText,
    type: 'silphy',
    time: silphyTime,
    autoRecorded: autoRecordedMovements.length > 0 ? autoRecordedMovements : null
  });

  res.json({
    ok: true,
    reply: replyText,
    action: detectedAction,
    autoRecorded: autoRecordedMovements,
    updatedCash: dbData.finances?.cashAvailable,
    timestamp: new Date().toISOString()
  });
});

// 4. Cargar movimientos manualmente desde el modal
router.post('/record-movement', (req, res) => {
  const dbData = loadDB();
  const recordResult = executeMovementRecord(dbData, req.body);

  if (!recordResult) {
    return res.status(400).json({ error: 'Monto inválido o datos incompletos' });
  }

  if (req.body.customNote) {
    recordResult.auditNote += ` Nota: ${req.body.customNote}`;
  }

  // Guardar en db.json y memoria
  saveDB(dbData);
  appendMemory(recordResult.auditNote);

  res.json({
    ok: true,
    message: 'Movimiento registrado con éxito por Silphy',
    updatedCash: dbData.finances.cashAvailable,
    auditNote: recordResult.auditNote
  });
});

// 5. Pagar una deuda directamente desde la Ventana de Pagos
router.post('/pay-debt', (req, res) => {
  const { debtId, amount, customNote } = req.body;
  const dbData = loadDB();
  const debt = (dbData.debts || []).find(d => d.id === debtId);
  if (!debt) {
    return res.status(404).json({ error: 'Deuda no encontrada' });
  }

  const payAmount = Number(amount) || Number(debt.monthlyQuota || debt.totalAmount);
  const recordResult = executeMovementRecord(dbData, {
    type: 'pago_deuda',
    amount: payAmount,
    concept: `Pago de cuota/compromiso: ${debt.creditor}`,
    client: debt.creditor,
    debtId: debt.id,
    destination: 'Pago Deuda'
  });

  if (!recordResult) {
    return res.status(400).json({ error: 'No se pudo procesar el pago' });
  }

  if (customNote) {
    recordResult.auditNote += ` Nota: ${customNote}`;
  }

  saveDB(dbData);
  appendMemory(recordResult.auditNote);

  res.json({
    ok: true,
    message: `Pago registrado: $${payAmount.toLocaleString('es-AR')} a ${debt.creditor}`,
    debt,
    newCash: dbData.finances.cashAvailable
  });
});

// Registrar router en la app express de Silphy
app.use('/api', router);

// Exportar para integración con el servidor central
module.exports = { app, router, executeMovementRecord, loadDB, saveDB };

// Iniciar servidor standalone si se ejecuta directamente
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`\n======================================================`);
    console.log(`   💚 SILPHY FINANZAS — ASISTENTE CONTABLE 24/7`);
    console.log(`   📍 Interfaz Web: http://localhost:${PORT}`);
    console.log(`   👤 Auto-Persistencia de Chat y Movimientos Activa`);
    console.log(`======================================================\n`);
  });
}
