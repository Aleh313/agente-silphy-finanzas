/**
 * Electronicat — Finanzas, Balances & Silphy
 * Dashboard Contable Integral + Chatbot Flotante + Ventana de Pagos & Métricas
 */

const API_BASE = '';

// Estado Global de la Aplicación
let financialData = {
  debts: [],
  finances: { cashAvailable: 0, rescueMode: true },
  transfers: [],
  receivables: []
};

let currentFilter = 'all';
let currentSearch = '';
let isChatOpen = false;
let unreadCount = 0;
let voiceEnabled = true;
let speechSynth = window.speechSynthesis;
let speechRecognition = null;
let isRecognizing = false;

// DOM Elements: Navegación y Vistas
const navTabs = document.querySelectorAll('.nav-tab');
const viewSections = document.querySelectorAll('.view-section');
const userSelect = document.getElementById('user-select');

// KPIs Balances
const kpiCash = document.getElementById('kpi-cash');
const kpiReceivables = document.getElementById('kpi-receivables');
const kpiReceivablesCount = document.getElementById('kpi-receivables-count');
const kpiExpenses = document.getElementById('kpi-expenses');
const kpiUrgentDebt = document.getElementById('kpi-urgent-debt');
const kpiUrgentHint = document.getElementById('kpi-urgent-hint');

// 5 Cubos Profit First
const barValDeuda = document.getElementById('bar-val-deuda');
const barValOperacion = document.getElementById('bar-val-operacion');
const barValSocios = document.getElementById('bar-val-socios');
const barValPatrimonio = document.getElementById('bar-val-patrimonio');
const barValInversion = document.getElementById('bar-val-inversion');
const urgentDebtsList = document.getElementById('urgent-debts-list');
const btnGoDeudas = document.getElementById('btn-go-deudas');

// Actividades Económicas (Tabla)
const activitiesTbody = document.getElementById('activities-tbody');
const activitiesSearch = document.getElementById('activities-search');
const filterBtns = document.querySelectorAll('.filter-btn');
const statTotalMovements = document.getElementById('stat-total-movements');
const statSumIncome = document.getElementById('stat-sum-income');
const statSumExpense = document.getElementById('stat-sum-expense');

// Deudas y Cobranzas Detalle
const detailedReceivablesList = document.getElementById('detailed-receivables-list');
const detailedDebtsList = document.getElementById('detailed-debts-list');
const sumReceivablesBadge = document.getElementById('sum-receivables-badge');
const sumDebtsBadge = document.getElementById('sum-debts-badge');

// Chat Flotante (Chat Head Messenger)
const silphyBubbleBtn = document.getElementById('silphy-bubble-btn');
const silphyUnreadBadge = document.getElementById('silphy-unread-badge');
const silphyPreviewToast = document.getElementById('silphy-preview-toast');
const toastPreviewText = document.getElementById('toast-preview-text');
const btnCloseToast = document.getElementById('btn-close-toast');
const silphyChatWindow = document.getElementById('silphy-chat-window');
const btnMinimizeChat = document.getElementById('btn-minimize-chat');
const btnCloseChat = document.getElementById('btn-close-chat');
const btnClearChat = document.getElementById('btn-clear-chat');
const btnToggleVoice = document.getElementById('btn-toggle-voice');
const voiceIcon = document.getElementById('voice-icon');
const chatThread = document.getElementById('chat-thread');
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');
const btnMic = document.getElementById('btn-mic');

// Modal Carga Semanal
const modal = document.getElementById('modal-carga-semana');
const btnOpenModal = document.getElementById('btn-open-modal');
const btnCloseModal = document.getElementById('btn-close-modal');
const btnCancelModal = document.getElementById('btn-cancel-modal');
const formRegistro = document.getElementById('form-registro-semanal');
const tabButtons = document.querySelectorAll('.tab-btn');
const formType = document.getElementById('form-type');
const groupClient = document.getElementById('group-client');
const groupDebtSelect = document.getElementById('group-debt-select');
const formDebtId = document.getElementById('form-debt-id');

// ==========================================
// 1. INICIALIZACIÓN
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
  // Cargar datos financieros
  await loadFinancialStatus();

  // Cargar historial de chat persistente
  await loadChatHistory();

  // Restaurar estado de ventana flotante si estaba abierta
  if (localStorage.getItem('silphy_chat_open') === 'true') {
    openChatWindow();
  }

  // Navegación de pestañas
  navTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetView = tab.getAttribute('data-view');
      switchView(targetView);
    });
  });

  const btnGoPagos = document.getElementById('btn-go-pagos');
  if (btnGoPagos) {
    btnGoPagos.addEventListener('click', () => {
      switchView('view-pagos');
    });
  }

  // Filtros de actividades
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.getAttribute('data-filter');
      renderActivitiesTable();
    });
  });

  if (activitiesSearch) {
    activitiesSearch.addEventListener('input', (e) => {
      currentSearch = e.target.value.toLowerCase().trim();
      renderActivitiesTable();
    });
  }

  // Inicializar componentes interactivos
  initFloatingChat();
  initMovementModal();
  initPayModal();
  initSpeechRecognition();

  // Polling suave cada 20 segundos para mantener sincronización
  setInterval(async () => {
    await loadFinancialStatus(false);
  }, 20000);
});

// ==========================================
// 2. NAVEGACIÓN Y VISTAS
// ==========================================
function switchView(viewId) {
  navTabs.forEach(tab => {
    if (tab.getAttribute('data-view') === viewId) {
      tab.classList.add('active');
    } else {
      tab.classList.remove('active');
    }
  });

  viewSections.forEach(sec => {
    if (sec.id === viewId) {
      sec.classList.add('active');
    } else {
      sec.classList.remove('active');
    }
  });

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Cargar estado financiero desde API
async function loadFinancialStatus(showErrors = true) {
  try {
    const res = await fetch(`${API_BASE}/api/status`);
    const json = await res.json();
    if (json.ok && json.data) {
      financialData = json.data;
      renderCeoDirective(json.directives);
      renderAllViews();
    }
  } catch (err) {
    if (showErrors) console.error('Error cargando estado financiero:', err);
  }
}

function renderCeoDirective(directives) {
  const strip = document.getElementById('ceo-directive-strip');
  const textEl = document.getElementById('ceo-directive-text');
  const statusEl = document.getElementById('ceo-directive-status');
  if (!strip || !directives || directives.length === 0) {
    if (strip) strip.style.display = 'none';
    return;
  }
  const latest = directives[0];
  if (textEl) textEl.textContent = `"${latest.directive}"`;
  if (statusEl) {
    statusEl.textContent = latest.status || 'Activa';
    statusEl.className = `directive-badge ${(latest.status || 'activa').toLowerCase()}`;
  }
  strip.style.display = 'flex';
}

function renderAllViews() {
  renderBalancesKPIs();
  renderPaymentsView();
  renderChartsAndProjections();
  renderActivitiesTable();
  renderDetailedDebtsAndReceivables();
}

function renderBalancesKPIs() {
  const cash = Number(financialData.finances?.cashAvailable || 0);
  if (kpiCash) kpiCash.textContent = `$${cash.toLocaleString('es-AR')} ARS`;

  // Total por cobrar
  const receivables = financialData.receivables || [];
  const totalReceivables = receivables.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
  if (kpiReceivables) kpiReceivables.textContent = `$${totalReceivables.toLocaleString('es-AR')}`;
  if (kpiReceivablesCount) kpiReceivablesCount.textContent = `${receivables.length} compromisos pendientes de cobro`;

  // Total egresos
  const transfers = financialData.transfers || [];
  const totalExpenses = transfers
    .filter(t => t.type === 'egreso' || t.type === 'pago_deuda')
    .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  if (kpiExpenses) kpiExpenses.textContent = `$${totalExpenses.toLocaleString('es-AR')}`;

  // Deuda Urgente (Luz y Antonella)
  const debts = financialData.debts || [];
  const urgentDebts = debts.filter(d => !d.paidThisMonth && (d.id === 'debt_luz' || d.id === 'debt_antonella'));
  const sumUrgent = urgentDebts.reduce((sum, d) => sum + (Number(d.monthlyQuota || d.totalAmount) || 0), 0);
  if (kpiUrgentDebt) kpiUrgentDebt.textContent = `$${sumUrgent.toLocaleString('es-AR')}`;
  if (kpiUrgentHint) kpiUrgentHint.textContent = `${urgentDebts.length} compromisos con prioridad inmediata`;

  // Total Ingresos del Mes (Base para la división en 5 Cubos Profit First)
  const totalIncome = transfers
    .filter(t => t.type === 'ingreso')
    .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

  // Base Profit First: Se calcula sobre el total ingresado/facturado en el mes
  const baseIncome = totalIncome > 0 ? totalIncome : cash;

  const cubosTotalBadge = document.getElementById('cubos-total-income-badge');
  const cubosDesc = document.getElementById('cubos-panel-desc');
  if (cubosTotalBadge) {
    cubosTotalBadge.textContent = `Total Ingresado: $${baseIncome.toLocaleString('es-AR')} ARS`;
  }
  if (cubosDesc) {
    cubosDesc.innerHTML = `División calculada sobre el <strong>total recaudado en el mes ($${baseIncome.toLocaleString('es-AR')} ARS)</strong> antes de egresos:`;
  }

  // 5 Cubos Profit First (Basado en el total de ingresos del mes)
  if (barValDeuda) barValDeuda.textContent = `$${Math.round(baseIncome * 0.30).toLocaleString('es-AR')}`;
  if (barValOperacion) barValOperacion.textContent = `$${Math.round(baseIncome * 0.25).toLocaleString('es-AR')}`;
  if (barValSocios) barValSocios.textContent = `$${Math.round(baseIncome * 0.30).toLocaleString('es-AR')}`;
  if (barValPatrimonio) barValPatrimonio.textContent = `$${Math.round(baseIncome * 0.10).toLocaleString('es-AR')}`;
  if (barValInversion) barValInversion.textContent = `$${Math.round(baseIncome * 0.05).toLocaleString('es-AR')}`;

  // Lista urgente en panel
  if (urgentDebtsList) {
    urgentDebtsList.innerHTML = '';
    debts.slice(0, 4).forEach(d => {
      const isPaid = d.paidThisMonth || d.totalAmount === 0;
      const item = document.createElement('div');
      item.className = `urgent-item ${isPaid ? 'paid' : ''}`;
      item.innerHTML = `
        <div class="urgent-title">
          <strong>${d.creditor}</strong>
          <span>${isPaid ? '✓ Cancelado este mes' : (d.dueDate || 'Vencimiento prioritario')}</span>
        </div>
        <div class="urgent-amount">$${Number(d.monthlyQuota || d.totalAmount).toLocaleString('es-AR')}</div>
      `;
      urgentDebtsList.appendChild(item);
    });
  }
}

// ==========================================
// 2.B VENTANA DE PAGOS & COMPROMISOS (1-CLIC)
// ==========================================
function renderPaymentsView() {
  const container = document.getElementById('payments-cards-container');
  const payCashAvail = document.getElementById('pay-cash-available');
  const payMonthNeeded = document.getElementById('pay-month-needed');
  const payCoverageStatus = document.getElementById('pay-coverage-status');
  if (!container) return;

  const cash = Number(financialData.finances?.cashAvailable || 0);
  const debts = financialData.debts || [];

  // Calcular compromisos requeridos del mes
  const monthNeeded = debts.reduce((sum, d) => {
    if (d.paidThisMonth || d.totalAmount === 0) return sum;
    return sum + (Number(d.monthlyQuota || d.totalAmount) || 0);
  }, 0);

  if (payCashAvail) payCashAvail.textContent = `$${cash.toLocaleString('es-AR')} ARS`;
  if (payMonthNeeded) payMonthNeeded.textContent = `$${monthNeeded.toLocaleString('es-AR')} ARS`;

  if (payCoverageStatus) {
    if (monthNeeded === 0) {
      payCoverageStatus.className = 'coverage-badge ok';
      payCoverageStatus.innerHTML = '<span>Semáforo:</span> <strong>🟢 Al Día (Sin Cuotas Pendientes)</strong>';
    } else if (cash >= monthNeeded) {
      payCoverageStatus.className = 'coverage-badge ok';
      payCoverageStatus.innerHTML = '<span>Semáforo:</span> <strong>🟢 Cobertura Completa</strong>';
    } else if (cash >= monthNeeded * 0.4) {
      payCoverageStatus.className = 'coverage-badge warning';
      payCoverageStatus.innerHTML = '<span>Semáforo:</span> <strong>🟡 Cobertura Parcial (Priorizar Urgentes)</strong>';
    } else {
      payCoverageStatus.className = 'coverage-badge danger';
      payCoverageStatus.innerHTML = '<span>Semáforo:</span> <strong>🔴 Déficit Crítico (Modo Rescate)</strong>';
    }
  }

  container.innerHTML = '';
  if (debts.length === 0) {
    container.innerHTML = '<p class="text-muted" style="grid-column: 1/-1; text-align: center; padding: 30px;">No hay compromisos cargados.</p>';
    return;
  }

  debts.forEach(d => {
    const isPaid = d.paidThisMonth || d.totalAmount === 0;
    const isUrgent = !isPaid && (d.priority === 'Alta' || d.id === 'debt_luz' || d.id === 'debt_antonella');
    const quota = Number(d.monthlyQuota || d.totalAmount);
    const total = Number(d.totalAmount);
    const priority = (d.priority || 'Media').toLowerCase();

    const card = document.createElement('div');
    card.className = `pay-card ${isUrgent ? 'urgent' : (isPaid ? 'safe-card' : 'warning-card')}`;

    card.innerHTML = `
      <div class="pay-card-header">
        <div>
          <div class="pay-card-title">
            <span>${isUrgent ? '🚨' : '💳'}</span>
            <span>${d.creditor}</span>
          </div>
          <div class="pay-card-category">${d.category || 'Servicio / Obligación'}</div>
        </div>
        <span class="pay-priority-badge ${priority}">${d.priority || 'Normal'}</span>
      </div>

      <div class="pay-card-numbers">
        <div class="pay-num-item">
          <span>Cuota / Monto Clave</span>
          <strong class="highlight">${isPaid ? '✓ Pagado' : `$${quota.toLocaleString('es-AR')}`}</strong>
        </div>
        <div class="pay-num-item">
          <span>Saldo Total Deuda</span>
          <strong class="debt-total">$${total.toLocaleString('es-AR')}</strong>
        </div>
      </div>

      <div class="pay-meta-row">
        <span>📅 Vencimiento:</span>
        <span class="pay-due-tag ${isPaid ? 'ok' : (isUrgent ? 'overdue' : 'soon')}">
          ${isPaid ? 'Cancelado este ciclo' : (d.dueDate || 'Prioritario')}
        </span>
      </div>

      ${d.actionRequired ? `<div style="font-size: 0.76rem; color: var(--text-muted); margin-bottom: 12px; background: rgba(0,0,0,0.25); padding: 6px 10px; border-radius: 4px;"><strong>Nota:</strong> ${d.actionRequired}</div>` : ''}

      <div class="pay-actions">
        ${isPaid ? `
          <button class="btn-pay-quota" style="background: rgba(16, 185, 129, 0.2); color: var(--emerald-light); cursor: default;" disabled>
            ✓ Cuota Cancelada
          </button>
        ` : `
          <button class="btn-pay-quota" onclick="window.openPayModal('${d.id}', '${d.creditor}', ${quota})">
            💸 Pagar Cuota ($${quota.toLocaleString('es-AR')})
          </button>
          <button class="btn-pay-custom" onclick="window.openPayModal('${d.id}', '${d.creditor}', 0)">
            ✏️ Otro Monto
          </button>
        `}
      </div>
    `;

    container.appendChild(card);
  });
}

// ==========================================
// 2.C PROYECCIONES & MÉTRICAS (FINANCES SKILL)
// ==========================================
function renderChartsAndProjections() {
  const cash = Number(financialData.finances?.cashAvailable || 0);
  const transfers = financialData.transfers || [];
  const debts = financialData.debts || [];
  const receivables = financialData.receivables || [];

  const totalReceivables = receivables.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
  const totalDebts = debts.reduce((sum, d) => sum + (Number(d.totalAmount) || 0), 0);

  // Egresos del mes
  const expensesList = transfers.filter(t => t.type === 'egreso' || t.type === 'pago_deuda');
  const totalExpenses = expensesList.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  const totalIncome = transfers.filter(t => t.type === 'ingreso').reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

  // Fugas Hormiga (< $15.000)
  const microLossesList = transfers.filter(t => t.type === 'egreso' && Number(t.amount) < 15000);
  const microLossesTotal = microLossesList.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  const microLossCount = microLossesList.length;

  // Burn rate diario y Runway (Pista de supervivencia según skill finances)
  const dailyBurn = Math.max(Math.round(totalExpenses / 30), 8000);
  const runwayDays = Math.max(0, Math.floor(cash / dailyBurn));

  // Quit Number / Punto de Equilibrio mensual (según skill finances: costos mensuales + cuotas ÷ 0.70)
  const monthlyQuotasNeeded = debts.reduce((sum, d) => sum + (Number(d.monthlyQuota || d.totalAmount) || 0), 0);
  const monthlyBaseNeed = Math.max(totalExpenses, 250000) + monthlyQuotasNeeded;
  const breakEven = Math.round(monthlyBaseNeed / 0.70);

  // Proyección neta a 30 días
  const netForecast = cash + totalReceivables - totalDebts;

  // Actualizar Stat Boxes
  const elRunway = document.getElementById('chart-runway-days');
  const elRunwaySub = document.getElementById('chart-runway-sub');
  if (elRunway) elRunway.textContent = `${runwayDays} Días`;
  if (elRunwaySub) elRunwaySub.textContent = `Tasa de quema: ~$${dailyBurn.toLocaleString('es-AR')}/día`;

  const elMicroLosses = document.getElementById('chart-micro-losses');
  const elMicroCount = document.getElementById('chart-micro-count');
  if (elMicroLosses) elMicroLosses.textContent = `$${microLossesTotal.toLocaleString('es-AR')} ARS`;
  if (elMicroCount) elMicroCount.textContent = `${microLossCount} fugas menores a $15.000 detectadas`;

  const elBreakEven = document.getElementById('chart-breakeven');
  if (elBreakEven) elBreakEven.textContent = `$${breakEven.toLocaleString('es-AR')} ARS`;

  const elNetForecast = document.getElementById('chart-net-forecast');
  const elNetStatus = document.getElementById('chart-net-status');
  if (elNetForecast) {
    elNetForecast.textContent = (netForecast >= 0 ? `+$` : `-$`) + `${Math.abs(netForecast).toLocaleString('es-AR')} ARS`;
    elNetForecast.style.color = netForecast >= 0 ? 'var(--emerald-light)' : 'var(--rose)';
  }
  if (elNetStatus) {
    elNetStatus.textContent = netForecast >= 0 ? 'Caja en superávit tras cobranza' : 'Déficit estructural (renegociar)';
  }

  // GRÁFICO 1: COMPARATIVA INGRESOS VS EGRESOS VS MARGEN
  const barsContainer = document.getElementById('chart-bars-container');
  if (barsContainer) {
    const margin = totalIncome - totalExpenses;
    const maxVal = Math.max(totalIncome, totalExpenses, Math.abs(margin), 100000);
    const height = 180;
    const barWidth = 56;

    const hIncome = Math.round((totalIncome / maxVal) * (height - 40));
    const hExpense = Math.round((totalExpenses / maxVal) * (height - 40));
    const hMargin = Math.round((Math.abs(margin) / maxVal) * (height - 40));

    barsContainer.innerHTML = `
      <svg width="100%" height="${height}" viewBox="0 0 380 ${height}" style="overflow: visible;">
        <line x1="20" y1="${height - 25}" x2="360" y2="${height - 25}" stroke="rgba(255,255,255,0.1)" stroke-width="1" />
        <g>
          <rect x="50" y="${height - 25 - hIncome}" width="${barWidth}" height="${hIncome}" rx="6" fill="url(#gradGreen)" />
          <text x="78" y="${height - 32 - hIncome}" text-anchor="middle" fill="#34d399" font-size="11" font-weight="700">$${Math.round(totalIncome / 1000)}k</text>
          <text x="78" y="${height - 8}" text-anchor="middle" fill="#94a3b8" font-size="11">Ingresos</text>
        </g>
        <g>
          <rect x="160" y="${height - 25 - hExpense}" width="${barWidth}" height="${hExpense}" rx="6" fill="url(#gradRed)" />
          <text x="188" y="${height - 32 - hExpense}" text-anchor="middle" fill="#fb7185" font-size="11" font-weight="700">$${Math.round(totalExpenses / 1000)}k</text>
          <text x="188" y="${height - 8}" text-anchor="middle" fill="#94a3b8" font-size="11">Egresos</text>
        </g>
        <g>
          <rect x="270" y="${height - 25 - hMargin}" width="${barWidth}" height="${hMargin}" rx="6" fill="${margin >= 0 ? 'url(#gradSky)' : 'url(#gradAmber)'}" />
          <text x="298" y="${height - 32 - hMargin}" text-anchor="middle" fill="${margin >= 0 ? '#38bdf8' : '#fbbf24'}" font-size="11" font-weight="700">${margin >= 0 ? '+' : '-'}$${Math.round(Math.abs(margin) / 1000)}k</text>
          <text x="298" y="${height - 8}" text-anchor="middle" fill="#94a3b8" font-size="11">Margen Neto</text>
        </g>
        <defs>
          <linearGradient id="gradGreen" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#34d399" />
            <stop offset="100%" stop-color="#059669" />
          </linearGradient>
          <linearGradient id="gradRed" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#fb7185" />
            <stop offset="100%" stop-color="#e11d48" />
          </linearGradient>
          <linearGradient id="gradSky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#38bdf8" />
            <stop offset="100%" stop-color="#0284c7" />
          </linearGradient>
          <linearGradient id="gradAmber" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#fbbf24" />
            <stop offset="100%" stop-color="#d97706" />
          </linearGradient>
        </defs>
      </svg>
    `;
  }

  // GRÁFICO 2: DONUT & RADAR DE MICRO-PÉRDIDAS
  const workshopExpenses = expensesList
    .filter(t => t.type === 'egreso' && Number(t.amount) >= 15000 && !t.concept?.toLowerCase().includes('retiro'))
    .reduce((s, t) => s + Number(t.amount), 0);
  const debtExpenses = expensesList
    .filter(t => t.type === 'pago_deuda' || t.destination?.toLowerCase().includes('deuda'))
    .reduce((s, t) => s + Number(t.amount), 0);
  const partnerWithdrawals = expensesList
    .filter(t => t.concept?.toLowerCase().includes('retiro') || t.client?.toLowerCase().includes('ale') || t.client?.toLowerCase().includes('socio'))
    .reduce((s, t) => s + Number(t.amount), 0);

  const grandTotalExp = Math.max(totalExpenses, 1);
  const pMicro = Math.round((microLossesTotal / grandTotalExp) * 100);
  const pWorkshop = Math.round((workshopExpenses / grandTotalExp) * 100);
  const pDebt = Math.round((debtExpenses / grandTotalExp) * 100);
  const pWithdrawal = Math.max(0, 100 - (pMicro + pWorkshop + pDebt));

  const elDonutVisual = document.getElementById('donut-expenses-chart');
  const elDonutLeakPercent = document.getElementById('donut-leak-percent');
  if (elDonutVisual) {
    const end1 = pMicro;
    const end2 = end1 + pWorkshop;
    const end3 = end2 + pDebt;
    elDonutVisual.style.background = `conic-gradient(
      var(--amber) 0% ${end1}%,
      var(--emerald) ${end1}% ${end2}%,
      var(--rose) ${end2}% ${end3}%,
      var(--sky) ${end3}% 100%
    )`;
  }
  if (elDonutLeakPercent) elDonutLeakPercent.textContent = `${pMicro}%`;

  const elBreakdown = document.getElementById('donut-breakdown-list');
  if (elBreakdown) {
    elBreakdown.innerHTML = `
      <div class="breakdown-row">
        <div class="breakdown-left">
          <span class="breakdown-dot" style="background: var(--amber);"></span>
          <span>Fugas Hormiga (&lt; $15k)</span>
        </div>
        <div class="breakdown-right">$${microLossesTotal.toLocaleString('es-AR')} (${pMicro}%)</div>
      </div>
      <div class="breakdown-row">
        <div class="breakdown-left">
          <span class="breakdown-dot" style="background: var(--emerald);"></span>
          <span>Taller & Repuestos</span>
        </div>
        <div class="breakdown-right">$${workshopExpenses.toLocaleString('es-AR')} (${pWorkshop}%)</div>
      </div>
      <div class="breakdown-row">
        <div class="breakdown-left">
          <span class="breakdown-dot" style="background: var(--rose);"></span>
          <span>Pago de Cuotas</span>
        </div>
        <div class="breakdown-right">$${debtExpenses.toLocaleString('es-AR')} (${pDebt}%)</div>
      </div>
      <div class="breakdown-row">
        <div class="breakdown-left">
          <span class="breakdown-dot" style="background: var(--sky);"></span>
          <span>Retiros de Socios</span>
        </div>
        <div class="breakdown-right">$${partnerWithdrawals.toLocaleString('es-AR')} (${pWithdrawal}%)</div>
      </div>
    `;
  }

  // Consejo financiero de Silphy
  const elSilphyAdvice = document.getElementById('silphy-leak-advice');
  if (elSilphyAdvice) {
    if (pMicro > 15) {
      elSilphyAdvice.innerHTML = `
        <strong>⚠️ Alerta de Silphy (Fugas Hormiga Peligrosas):</strong>
        <p>Las compras menores a $15.000 se están llevando el <strong>${pMicro}%</strong> de la caja ($${microLossesTotal.toLocaleString('es-AR')}). Esto drena los fondos necesarios para cancelar la luz y Antonella. Frenemos todo retiro no programado.</p>
      `;
    } else {
      elSilphyAdvice.innerHTML = `
        <strong>💚 Silphy Informa (Disciplina de Caja):</strong>
        <p>Las micro-pérdidas se mantienen acotadas en <strong>${pMicro}%</strong>. Nuestro foco de rescate debe ser cobrar el anticipo de Montmartre ($750.000) y blindar la caja para la boleta de luz de $150.000.</p>
      `;
    }
  }

  // GRÁFICO 3: PROYECCIÓN DE CAJA A 30 DÍAS (FORECAST)
  const forecastContainer = document.getElementById('forecast-timeline');
  if (forecastContainer) {
    const points = [
      { day: 0, label: 'Hoy', cash: cash, note: 'Caja actual' },
      { day: 5, label: 'Día 5', cash: Math.max(0, cash - 25000), note: 'Operación taller' },
      { day: 10, label: '10 Nov', cash: Math.max(0, cash - 25000 - 70000), note: 'Vto Cuota San Juan (-$70k)' },
      { day: 15, label: '15 Nov', cash: Math.max(0, cash - 95000 + 405000), note: 'Cobro Montmartre Hito 1 + Ancasti' },
      { day: 16, label: '16 Nov', cash: Math.max(0, cash - 95000 + 405000 - 53475), note: 'Cuota Monotributo (-$53k)' },
      { day: 20, label: '20 Nov', cash: Math.max(0, cash - 95000 + 405000 - 53475 - 150000), note: 'Boleta de Luz (-$150k)' },
      { day: 24, label: '24 Nov', cash: Math.max(0, cash - 95000 + 405000 - 203475 - 35246), note: 'Cuota Mercado Pago (-$35k)' },
      { day: 30, label: '30 Días', cash: Math.max(0, cash - 95000 + 405000 - 238721 + 375000), note: 'Cierre de mes + Hito Final' }
    ];

    const maxCash = Math.max(...points.map(p => p.cash), 600000);
    const svgW = 600;
    const svgH = 200;
    const padL = 45;
    const padR = 25;
    const padT = 25;
    const padB = 30;

    const coords = points.map(p => {
      const x = padL + (p.day / 30) * (svgW - padL - padR);
      const y = svgH - padB - (p.cash / maxCash) * (svgH - padT - padB);
      return { ...p, x, y };
    });

    const pathData = coords.reduce((acc, c, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${c.x} ${c.y}`, '');
    const areaData = `${pathData} L ${coords[coords.length - 1].x} ${svgH - padB} L ${coords[0].x} ${svgH - padB} Z`;

    forecastContainer.innerHTML = `
      <svg class="timeline-svg" viewBox="0 0 ${svgW} ${svgH}">
        <defs>
          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#10b981" stop-opacity="0.35" />
            <stop offset="100%" stop-color="#10b981" stop-opacity="0.0" />
          </linearGradient>
        </defs>
        <line x1="${padL}" y1="${svgH - padB}" x2="${svgW - padR}" y2="${svgH - padB}" stroke="rgba(255,255,255,0.1)" stroke-width="1" />
        <line x1="${padL}" y1="${padT}" x2="${padL}" y2="${svgH - padB}" stroke="rgba(255,255,255,0.1)" stroke-width="1" />
        <line x1="${padL}" y1="${(svgH - padB + padT) / 2}" x2="${svgW - padR}" y2="${(svgH - padB + padT) / 2}" stroke="rgba(255,255,255,0.05)" stroke-dasharray="4" />
        <path d="${areaData}" fill="url(#areaGrad)" />
        <path d="${pathData}" fill="none" stroke="#10b981" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
        ${coords.map(c => `
          <g>
            <circle cx="${c.x}" cy="${c.y}" r="5" fill="#10b981" stroke="#0f172a" stroke-width="2">
              <title>${c.label}: $${c.cash.toLocaleString('es-AR')} (${c.note})</title>
            </circle>
            <text x="${c.x}" y="${svgH - 10}" text-anchor="middle" fill="#94a3b8" font-size="10">${c.label}</text>
            <text x="${c.x}" y="${c.y - 10}" text-anchor="middle" fill="#34d399" font-size="10" font-weight="700">$${Math.round(c.cash / 1000)}k</text>
          </g>
        `).join('')}
      </svg>
    `;
  }
}

// Abrir modal de pago de deuda
window.openPayModal = function(debtId, creditor, defaultAmount) {
  const modalPay = document.getElementById('modal-pagar-deuda');
  const modalName = document.getElementById('modal-pay-debt-name');
  const inputId = document.getElementById('pay-modal-debt-id');
  const inputAmount = document.getElementById('pay-modal-amount');
  const inputNote = document.getElementById('pay-modal-note');

  if (!modalPay) return;
  modalName.textContent = creditor;
  inputId.value = debtId;
  inputAmount.value = defaultAmount > 0 ? defaultAmount : '';
  inputNote.value = '';

  modalPay.showModal();
};

function initPayModal() {
  const modalPay = document.getElementById('modal-pagar-deuda');
  const btnClose = document.getElementById('btn-close-pay-modal');
  const btnCancel = document.getElementById('btn-cancel-pay-modal');
  const formConfirm = document.getElementById('form-confirm-pay');
  const btnSubmit = document.getElementById('btn-confirm-pay-submit');

  if (!modalPay) return;

  if (btnClose) btnClose.addEventListener('click', () => modalPay.close());
  if (btnCancel) btnCancel.addEventListener('click', () => modalPay.close());

  if (formConfirm) {
    formConfirm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const debtId = document.getElementById('pay-modal-debt-id').value;
      const amount = Number(document.getElementById('pay-modal-amount').value);
      const customNote = document.getElementById('pay-modal-note').value;

      if (!debtId || isNaN(amount) || amount <= 0) {
        alert('Por favor ingresá un monto válido.');
        return;
      }

      btnSubmit.disabled = true;
      btnSubmit.textContent = 'Procesando débito...';

      try {
        const res = await fetch(`${API_BASE}/api/pay-debt`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ debtId, amount, customNote })
        });

        const json = await res.json();
        if (json.ok) {
          modalPay.close();
          await loadFinancialStatus();
          appendChatMessage('Silphy', `💸 Pago registrado con éxito: se debitaron $${amount.toLocaleString('es-AR')} para ${json.debt?.creditor || 'la deuda'}. Nueva caja disponible: $${Number(json.newCash).toLocaleString('es-AR')}.`, 'silphy');
          if (voiceEnabled) speakSilphy(`Listo Ale, ya registré el pago de ${amount} pesos para la deuda.`);
        } else {
          alert(json.error || 'No se pudo registrar el pago');
        }
      } catch (err) {
        console.error('Error pagando deuda:', err);
        alert('Error al conectar con el servidor.');
      } finally {
        btnSubmit.disabled = false;
        btnSubmit.textContent = 'Confirmar Débito y Pago';
      }
    });
  }
}

function renderActivitiesTable() {
  const transfers = financialData.transfers || [];
  let filtered = transfers.slice().reverse();

  if (currentFilter !== 'all') {
    filtered = filtered.filter(t => t.type === currentFilter);
  }

  if (currentSearch) {
    filtered = filtered.filter(t => {
      const full = `${t.client || ''} ${t.concept || ''} ${t.destination || ''} ${t.amount || ''} ${t.date || ''}`.toLowerCase();
      return full.includes(currentSearch);
    });
  }

  if (statTotalMovements) statTotalMovements.textContent = `${filtered.length} Movimientos`;

  let sumInc = 0;
  let sumExp = 0;
  transfers.forEach(t => {
    const val = Number(t.amount) || 0;
    if (t.type === 'ingreso') sumInc += val;
    if (t.type === 'egreso' || t.type === 'pago_deuda') sumExp += val;
  });
  if (statSumIncome) statSumIncome.textContent = `$${sumInc.toLocaleString('es-AR')}`;
  if (statSumExpense) statSumExpense.textContent = `$${sumExp.toLocaleString('es-AR')}`;

  if (!activitiesTbody) return;
  activitiesTbody.innerHTML = '';

  if (filtered.length === 0) {
    activitiesTbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 30px;">No se encontraron movimientos registrados</td></tr>`;
    return;
  }

  filtered.forEach(t => {
    const tr = document.createElement('tr');
    const isInc = t.type === 'ingreso';
    const tagClass = isInc ? 'ingreso' : (t.type === 'pago_deuda' ? 'deuda' : 'egreso');
    const typeLabel = isInc ? 'Ingreso' : (t.type === 'pago_deuda' ? 'Pago Deuda' : 'Egreso');
    const amountPrefix = isInc ? '+' : '-';
    const amountColor = isInc ? 'var(--emerald-light)' : (t.type === 'pago_deuda' ? 'var(--amber)' : 'var(--rose)');

    tr.innerHTML = `
      <td>${t.date || 'S/F'}</td>
      <td><span class="badge-tag ${tagClass}">${typeLabel}</span></td>
      <td><strong>${t.concept || 'Movimiento'}</strong></td>
      <td>${t.client || '-'}</td>
      <td><span style="font-size: 0.78rem; color: var(--text-muted);">${t.destination || 'Caja'}</span></td>
      <td style="font-weight: 700; color: ${amountColor};">${amountPrefix}$${Number(t.amount || 0).toLocaleString('es-AR')}</td>
    `;
    activitiesTbody.appendChild(tr);
  });
}

function renderDetailedDebtsAndReceivables() {
  const receivables = financialData.receivables || [];
  const debts = financialData.debts || [];

  const sumRec = receivables.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const sumDeb = debts.reduce((s, d) => s + (Number(d.totalAmount) || 0), 0);

  if (sumReceivablesBadge) sumReceivablesBadge.textContent = `$${sumRec.toLocaleString('es-AR')} ARS`;
  if (sumDebtsBadge) sumDebtsBadge.textContent = `$${sumDeb.toLocaleString('es-AR')} ARS`;

  if (detailedReceivablesList) {
    detailedReceivablesList.innerHTML = '';
    receivables.forEach(r => {
      const card = document.createElement('div');
      card.className = 'debt-card-item';
      card.innerHTML = `
        <div class="debt-card-top">
          <strong>${r.clientName || r.client || 'Cliente'}</strong>
          <span style="color: var(--emerald-light); font-weight: 700;">$${Number(r.amount).toLocaleString('es-AR')}</span>
        </div>
        <p class="debt-card-notes"><strong>Concepto:</strong> ${r.concept || 'Servicio prestado'}</p>
        <p class="debt-card-notes" style="margin-top: 4px;"><strong>Estado:</strong> ${r.date || r.status || 'Pendiente de cobro'}</p>
      `;
      detailedReceivablesList.appendChild(card);
    });
  }

  if (detailedDebtsList) {
    detailedDebtsList.innerHTML = '';
    if (formDebtId) {
      formDebtId.innerHTML = '<option value="">-- Seleccionar compromiso --</option>';
    }

    debts.forEach(d => {
      const isPaid = d.paidThisMonth || d.totalAmount === 0;
      const card = document.createElement('div');
      card.className = 'debt-card-item';
      card.innerHTML = `
        <div class="debt-card-top">
          <strong>${d.creditor}</strong>
          <span class="debt-amount-highlight">${isPaid ? '✓ AL DÍA' : `$${Number(d.monthlyQuota || d.totalAmount).toLocaleString('es-AR')}`}</span>
        </div>
        <p class="debt-card-notes"><strong>Categoría:</strong> ${d.category || 'Compromiso'} · <strong>Vence:</strong> ${d.dueDate || 'Sin fecha'}</p>
        <p class="debt-card-notes" style="margin-top: 4px;"><strong>Acción:</strong> ${d.actionRequired || d.notes || 'Ninguna especificada'}</p>
      `;
      detailedDebtsList.appendChild(card);

      if (!isPaid && formDebtId) {
        const opt = document.createElement('option');
        opt.value = d.id;
        opt.textContent = `${d.creditor} ($${Number(d.monthlyQuota || d.totalAmount).toLocaleString('es-AR')})`;
        formDebtId.appendChild(opt);
      }
    });
  }
}

// ==========================================
// 3. CHATBOT FLOTANTE CON PERSISTENCIA
// ==========================================
function initFloatingChat() {
  if (silphyBubbleBtn) silphyBubbleBtn.addEventListener('click', toggleChatWindow);
  if (btnMinimizeChat) btnMinimizeChat.addEventListener('click', () => closeChatWindow(true));
  if (btnCloseChat) btnCloseChat.addEventListener('click', () => closeChatWindow(false));

  if (btnClearChat) {
    btnClearChat.addEventListener('click', async () => {
      if (confirm('¿Querés limpiar el historial de mensajes de la ventana de chat? (Los balances y movimientos guardados no se borrarán)')) {
        try {
          await fetch(`${API_BASE}/api/chat-history`, { method: 'DELETE' });
          const oldMsgs = chatThread.querySelectorAll('.message');
          oldMsgs.forEach(m => m.remove());
        } catch (e) {
          console.error(e);
        }
      }
    });
  }

  if (btnCloseToast) {
    btnCloseToast.addEventListener('click', (e) => {
      e.stopPropagation();
      silphyPreviewToast.style.display = 'none';
    });
  }

  if (silphyPreviewToast) {
    silphyPreviewToast.addEventListener('click', () => {
      openChatWindow();
      silphyPreviewToast.style.display = 'none';
    });
  }

  if (btnToggleVoice) {
    btnToggleVoice.addEventListener('click', () => {
      voiceEnabled = !voiceEnabled;
      btnToggleVoice.classList.toggle('active', voiceEnabled);
      if (voiceIcon) voiceIcon.textContent = voiceEnabled ? '🔊' : '🔇';
      if (!voiceEnabled && speechSynth) speechSynth.cancel();
    });
  }

  if (chatForm) {
    chatForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const text = chatInput.value.trim();
      if (!text) return;

      const userName = userSelect ? userSelect.value : 'Ale';
      chatInput.value = '';

      // Mostrar mensaje del usuario
      appendChatMessage(userName, text, 'user');

      // Indicador de escribiendo
      const typingIndicator = createTypingIndicator();
      chatThread.appendChild(typingIndicator);
      scrollChatToBottom();

      try {
        const res = await fetch(`${API_BASE}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: text, userName })
        });

        const json = await res.json();
        typingIndicator.remove();

        if (json.ok) {
          appendChatMessage('Silphy', json.reply, 'silphy');
          if (voiceEnabled) speakSilphy(json.reply);
          if (json.movementExecuted) {
            await loadFinancialStatus();
          }
        } else {
          appendChatMessage('Silphy', 'Perdón, hubo un inconveniente al procesar tu consulta.', 'silphy');
        }
      } catch (err) {
        typingIndicator.remove();
        console.error('Error enviando mensaje al chat:', err);
        appendChatMessage('Silphy', 'Error de conexión con mi módulo financiero.', 'silphy');
      }
    });
  }
}

// Cargar historial de chat persistente desde servidor
async function loadChatHistory() {
  try {
    const res = await fetch(`${API_BASE}/api/chat-history`);
    const json = await res.json();
    if (json.ok && Array.isArray(json.history)) {
      chatThread.innerHTML = '';
      if (json.history.length === 0) {
        appendChatMessage('Silphy', '¡Hola Ale! Soy Silphy. Tengo los balances actualizados y la ventana de pagos lista. Contame qué ingreso o gasto querés registrar o si querés liquidar alguna deuda.', 'silphy');
      } else {
        json.history.forEach(msg => {
          const isUser = msg.sender !== 'Silphy';
          appendChatMessage(msg.sender, msg.text, isUser ? 'user' : 'silphy', msg.time);
        });
      }
      scrollChatToBottom();
    }
  } catch (err) {
    console.warn('No se pudo cargar historial de chat desde servidor:', err.message);
  }
}

function openChatWindow() {
  isChatOpen = true;
  if (silphyChatWindow) {
    silphyChatWindow.style.display = 'flex';
    silphyChatWindow.classList.add('open');
  }
  if (silphyBubbleBtn) silphyBubbleBtn.classList.add('active');
  unreadCount = 0;
  if (silphyUnreadBadge) {
    silphyUnreadBadge.textContent = '0';
    silphyUnreadBadge.classList.remove('visible');
    silphyUnreadBadge.style.display = 'none';
  }
  if (silphyPreviewToast) silphyPreviewToast.style.display = 'none';
  localStorage.setItem('silphy_chat_open', 'true');
  setTimeout(() => {
    if (chatInput) chatInput.focus();
    scrollChatToBottom();
  }, 100);
}

function closeChatWindow(minimized = true) {
  isChatOpen = false;
  if (silphyChatWindow) {
    silphyChatWindow.classList.remove('open');
    silphyChatWindow.style.display = 'none';
  }
  if (silphyBubbleBtn) silphyBubbleBtn.classList.remove('active');
  localStorage.setItem('silphy_chat_open', 'false');
}

function toggleChatWindow() {
  if (isChatOpen || (silphyChatWindow && silphyChatWindow.style.display === 'flex')) {
    closeChatWindow(true);
  } else {
    openChatWindow();
  }
}

// Exponer en window para llamadas directas
window.openChatWindow = openChatWindow;
window.closeChatWindow = closeChatWindow;
window.toggleChatWindow = toggleChatWindow;

function appendChatMessage(sender, text, type, timeStr = null) {
  const time = timeStr || new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  const msgEl = document.createElement('div');
  msgEl.className = `message ${type}`;

  const formattedText = formatChatMessageText(text);

  msgEl.innerHTML = `
    <div class="msg-bubble">
      <div class="msg-sender">${sender}</div>
      <div class="msg-text">${formattedText}</div>
      <div class="msg-time">${time}</div>
    </div>
  `;

  chatThread.appendChild(msgEl);
  scrollChatToBottom();

  // Si la ventana está cerrada y el mensaje es de Silphy, mostrar toast y badge pendiente
  if (!isChatOpen && type === 'silphy') {
    unreadCount++;
    silphyUnreadBadge.textContent = unreadCount;
    silphyUnreadBadge.classList.add('visible');

    const preview = text.replace(/[*#_`]/g, '').slice(0, 75) + '...';
    toastPreviewText.textContent = preview;
    silphyPreviewToast.style.display = 'flex';
  }
}

function formatChatMessageText(text) {
  return text
    .replace(/\n/g, '<br>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code>$1</code>');
}

function createTypingIndicator() {
  const el = document.createElement('div');
  el.className = 'message silphy typing-msg';
  el.innerHTML = `
    <div class="msg-bubble" style="padding: 10px 14px;">
      <div class="typing-indicator">
        <span class="typing-dot"></span>
        <span class="typing-dot"></span>
        <span class="typing-dot"></span>
      </div>
    </div>
  `;
  return el;
}

function scrollChatToBottom() {
  chatThread.scrollTop = chatThread.scrollHeight;
}

// ==========================================
// 4. MODAL CARGA SEMANAL (REGISTRO MANUAL)
// ==========================================
function initMovementModal() {
  if (!modal) return;

  if (btnOpenModal) {
    btnOpenModal.addEventListener('click', () => {
      modal.showModal();
    });
  }

  if (btnCloseModal) {
    btnCloseModal.addEventListener('click', () => {
      modal.close();
    });
  }

  if (btnCancelModal) {
    btnCancelModal.addEventListener('click', () => {
      modal.close();
    });
  }

  // Pestañas de tipo de movimiento dentro del modal
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      tabButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const type = btn.getAttribute('data-type');
      formType.value = type;

      if (type === 'ingreso') {
        groupClient.style.display = 'block';
        groupDebtSelect.style.display = 'none';
      } else if (type === 'pago_deuda') {
        groupClient.style.display = 'none';
        groupDebtSelect.style.display = 'block';
      } else {
        groupClient.style.display = 'none';
        groupDebtSelect.style.display = 'none';
      }
    });
  });

  // Envío del formulario
  if (formRegistro) {
    formRegistro.addEventListener('submit', async (e) => {
      e.preventDefault();
      const type = formType.value;
      const amount = document.getElementById('form-amount').value;
      const client = document.getElementById('form-client').value;
      const concept = document.getElementById('form-concept').value;
      const debtId = document.getElementById('form-debt-id').value;
      const customNote = document.getElementById('form-note').value;

      const btnSubmit = document.getElementById('btn-submit-movement');
      btnSubmit.disabled = true;
      btnSubmit.textContent = 'Guardando...';

      try {
        const res = await fetch(`${API_BASE}/api/record-movement`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type,
            amount,
            client: type === 'pago_deuda' ? (formDebtId.options[formDebtId.selectedIndex]?.text || 'Deuda') : client,
            concept,
            debtId: type === 'pago_deuda' ? debtId : null,
            customNote
          })
        });

        const json = await res.json();
        if (json.ok) {
          modal.close();
          formRegistro.reset();
          await loadFinancialStatus();
          appendChatMessage('Silphy', `💼 Registrado en el sistema: ${type.toUpperCase()} por $${Number(amount).toLocaleString('es-AR')}. Caja actualizada a $${Number(json.updatedCash).toLocaleString('es-AR')}.`, 'silphy');
          if (voiceEnabled) speakSilphy(`Listo, ya registré el movimiento de ${amount} pesos en el sistema.`);
        } else {
          alert(json.error || 'No se pudo guardar');
        }
      } catch (err) {
        alert('Error al conectar con el servidor de Silphy');
      } finally {
        btnSubmit.disabled = false;
        btnSubmit.textContent = 'Guardar en Finanzas';
      }
    });
  }
}

// ==========================================
// 5. VOZ (TTS) & MICRÓFONO (STT)
// ==========================================
function speakSilphy(text) {
  if (!speechSynth || !voiceEnabled) return;
  speechSynth.cancel();

  const clean = text
    .replace(/[*#_`]/g, '')
    .replace(/\$\s?(\d+)/g, '$1 pesos')
    .slice(0, 280);

  const utterance = new SpeechSynthesisUtterance(clean);
  utterance.lang = 'es-AR';
  utterance.rate = 1.05;
  utterance.pitch = 1.15;

  const voices = speechSynth.getVoices();
  const esVoice = voices.find(v => v.lang.includes('es') && (v.name.includes('Elena') || v.name.includes('Sabina') || v.name.includes('Female') || v.name.includes('Mujer') || v.name.includes('Laura')));
  if (esVoice) utterance.voice = esVoice;

  speechSynth.speak(utterance);
}

function initSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    if (btnMic) btnMic.style.display = 'none';
    return;
  }

  speechRecognition = new SpeechRecognition();
  speechRecognition.lang = 'es-AR';
  speechRecognition.continuous = false;
  speechRecognition.interimResults = false;

  speechRecognition.onstart = () => {
    isRecognizing = true;
    if (btnMic) btnMic.classList.add('active');
    chatInput.placeholder = 'Escuchando a Ale...';
  };

  speechRecognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    chatInput.value = transcript;
    chatForm.dispatchEvent(new Event('submit'));
  };

  speechRecognition.onerror = () => stopRecognition();
  speechRecognition.onend = () => stopRecognition();

  if (btnMic) {
    btnMic.addEventListener('click', () => {
      if (isRecognizing) {
        speechRecognition.stop();
      } else {
        speechRecognition.start();
      }
    });
  }
}

function stopRecognition() {
  isRecognizing = false;
  if (btnMic) btnMic.classList.remove('active');
  chatInput.placeholder = 'Charlá con Silphy... (Enter para enviar)';
}
