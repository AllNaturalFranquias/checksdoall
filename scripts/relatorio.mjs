import nodemailer from 'nodemailer';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const GMAIL_USER   = process.env.GMAIL_USER;
const GMAIL_PASS   = process.env.GMAIL_PASS;

const LOJAS = [
  { id: 'batel',       nome: 'Batel',        email: 'allnatural.batel@hotmail.com' },
  { id: 'bigorrilho',  nome: 'Bigorrilho',   email: 'allnatural.bigorrilho@gmail.com' },
  { id: 'parkshopping',nome: 'Park Shopping', email: 'allnaturalpkb@gmail.com' },
  { id: 'maringa',     nome: 'Maringá',      email: 'allnatural.mga@hotmail.com' },
];

// ── Semana ISO ────────────────────────────────────────────────
function getISOWeekNum(date) {
  const d = new Date(date);
  d.setHours(0,0,0,0);
  d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
  const week1 = new Date(d.getFullYear(), 0, 4);
  return 1 + Math.round(((d - week1) / 86400000 - 3 + (week1.getDay()+6) % 7) / 7);
}
function getWeekKey(date) {
  const d = new Date(date);
  const day = d.getDay() || 7;
  d.setDate(d.getDate() - day + 1);
  return `${d.getFullYear()}-W${String(getISOWeekNum(d)).padStart(2,'0')}`;
}
function getWeekMonday(weekKey) {
  const [yr, wStr] = weekKey.split('-W');
  const week = parseInt(wStr);
  const jan4 = new Date(+yr, 0, 4);
  const jan4Day = jan4.getDay() || 7;
  const week1Mon = new Date(jan4 - (jan4Day-1)*86400000);
  return new Date(week1Mon.getTime() + (week-1)*7*86400000);
}
function getWeekLabel(weekKey) {
  const mon = getWeekMonday(weekKey);
  const sun = new Date(mon.getTime() + 6*86400000);
  const fmt = d => d.toLocaleDateString('pt-BR',{day:'numeric',month:'short'}).replace('.','');
  const wNum = parseInt(weekKey.split('-W')[1]);
  return `Sem. ${wNum} · ${fmt(mon)} – ${fmt(sun)}`;
}

// Semana que acabou de fechar (segunda-feira ontem, pois roda terça)
const hoje       = new Date();
const ontem      = new Date(hoje); ontem.setDate(hoje.getDate() - 1);
const semAtual   = getWeekKey(ontem);          // semana que fechou
const semAnterior = (() => {
  const d = new Date(ontem); d.setDate(d.getDate()-7); return getWeekKey(d);
})();

console.log(`Semana fechada: ${semAtual} | Anterior: ${semAnterior}`);

// ── Supabase ──────────────────────────────────────────────────
async function fetchEstado(chave) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/inventario_dados?chave=eq.${chave}&select=estado`,
    { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
  );
  const rows = await res.json();
  return rows?.[0]?.estado || null;
}

// ── Consumo por item ──────────────────────────────────────────
function getConsumo(estado, weekKey) {
  const data = estado?.data || {};
  const result = {};
  for (const [, weekData] of Object.entries(data)) {
    const wk = weekData?.[weekKey] || {};
    for (const [itemName, vals] of Object.entries(wk)) {
      if (vals && (vals.i !== undefined || vals.f !== undefined)) {
        const c = (vals.i || 0) + (vals.e || 0) - (vals.f || 0);
        result[itemName] = (result[itemName] || 0) + c;
      }
    }
  }
  return result;
}

function getCMVSemana(estado, weekKey) {
  const d = estado?.cmv?.[weekKey] || {};
  const notas = d.notas || [];
  const gasto = notas.reduce((s, n) => s + (n.valor || 0), 0);
  const fat   = d.faturamento || 0;
  const pct   = fat > 0 ? gasto / fat * 100 : null;
  return { gasto, fat, pct, qtdNotas: notas.length };
}

// ── HTML do email ─────────────────────────────────────────────
function gerarHTML(loja, estado) {
  const curr = getConsumo(estado, semAtual);
  const prev = getConsumo(estado, semAnterior);
  const cmv  = getCMVSemana(estado, semAtual);

  const allItems = new Set([...Object.keys(curr), ...Object.keys(prev)]);
  const semZero = [], maioresAltas = [], maioresBaixas = [];

  for (const nome of allItems) {
    const cAtual = curr[nome] || 0;
    const cAnt   = prev[nome] || 0;
    if (cAtual === 0 && cAnt > 0) semZero.push({ nome, cAnt });
    if (cAnt > 0) {
      const delta = (cAtual - cAnt) / cAnt * 100;
      if (delta > 30)  maioresAltas.push({ nome, cAtual, cAnt, delta });
      if (delta < -30) maioresBaixas.push({ nome, cAtual, cAnt, delta });
    }
  }
  maioresAltas.sort((a,b) => b.delta - a.delta);
  maioresBaixas.sort((a,b) => a.delta - b.delta);

  const fmtNum = (v, u='') => `${Math.abs(v) % 1 < 0.01 ? Math.round(v) : v.toFixed(1)}${u ? ' '+u : ''}`;
  const R = v => `R$ ${v.toLocaleString('pt-BR',{minimumFractionDigits:0,maximumFractionDigits:0})}`;

  const cmvColor = cmv.pct == null ? '#666' : cmv.pct > 35 ? '#e53e3e' : cmv.pct > 30 ? '#d69e2e' : '#276749';

  const rowZero = semZero.slice(0,10).map(r => `
    <tr style="border-bottom:1px solid #f0f0f0">
      <td style="padding:7px 12px;font-size:13px;color:#333">${r.nome}</td>
      <td style="padding:7px 12px;font-size:12px;color:#999;text-align:right">${fmtNum(r.cAnt)}</td>
      <td style="padding:7px 12px;font-size:13px;font-weight:700;color:#e53e3e;text-align:right">0</td>
    </tr>`).join('');

  const rowAltas = maioresAltas.slice(0,8).map(r => `
    <tr style="border-bottom:1px solid #f0f0f0">
      <td style="padding:7px 12px;font-size:13px;color:#333">${r.nome}</td>
      <td style="padding:7px 12px;font-size:12px;color:#999;text-align:right">${fmtNum(r.cAnt)} → ${fmtNum(r.cAtual)}</td>
      <td style="padding:7px 12px;font-size:13px;font-weight:700;color:#e53e3e;text-align:right">+${r.delta.toFixed(0)}%</td>
    </tr>`).join('');

  const rowBaixas = maioresBaixas.slice(0,8).map(r => `
    <tr style="border-bottom:1px solid #f0f0f0">
      <td style="padding:7px 12px;font-size:13px;color:#333">${r.nome}</td>
      <td style="padding:7px 12px;font-size:12px;color:#999;text-align:right">${fmtNum(r.cAnt)} → ${fmtNum(r.cAtual)}</td>
      <td style="padding:7px 12px;font-size:13px;font-weight:700;color:#276749;text-align:right">${r.delta.toFixed(0)}%</td>
    </tr>`).join('');

  const tblHeader = `
    <tr style="background:#f8f8f8">
      <th style="padding:8px 12px;font-size:11px;font-weight:700;color:#999;text-transform:uppercase;text-align:left">Item</th>
      <th style="padding:8px 12px;font-size:11px;font-weight:700;color:#999;text-transform:uppercase;text-align:right">Ant. → Atual</th>
      <th style="padding:8px 12px;font-size:11px;font-weight:700;color:#999;text-transform:uppercase;text-align:right">Δ</th>
    </tr>`;

  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"></head><body style="margin:0;padding:0;background:#f4f4f4;font-family:Inter,Arial,sans-serif">
<div style="max-width:600px;margin:24px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08)">

  <!-- Header -->
  <div style="background:#1a1a1a;padding:24px;text-align:center">
    <div style="font-size:13px;font-weight:700;color:#aaa;letter-spacing:1px;text-transform:uppercase">All Natural · Controles</div>
    <div style="font-size:22px;font-weight:800;color:#fff;margin-top:4px">${loja.nome}</div>
    <div style="font-size:13px;color:#666;margin-top:6px">${getWeekLabel(semAtual)}</div>
  </div>

  <!-- CMV Summary -->
  <div style="display:grid;grid-template-columns:1fr 1fr 1fr;padding:20px;gap:12px;background:#fff">
    <div style="text-align:center;padding:14px;background:#f9f9f9;border-radius:10px">
      <div style="font-size:11px;color:#999;font-weight:700;text-transform:uppercase;letter-spacing:.5px">CMV Semana</div>
      <div style="font-size:24px;font-weight:800;color:${cmvColor};margin-top:4px">${cmv.pct != null ? cmv.pct.toFixed(1)+'%' : '—'}</div>
    </div>
    <div style="text-align:center;padding:14px;background:#f9f9f9;border-radius:10px">
      <div style="font-size:11px;color:#999;font-weight:700;text-transform:uppercase;letter-spacing:.5px">Gasto</div>
      <div style="font-size:18px;font-weight:800;color:#333;margin-top:4px">${R(cmv.gasto)}</div>
    </div>
    <div style="text-align:center;padding:14px;background:#f9f9f9;border-radius:10px">
      <div style="font-size:11px;color:#999;font-weight:700;text-transform:uppercase;letter-spacing:.5px">Notas</div>
      <div style="font-size:24px;font-weight:800;color:#333;margin-top:4px">${cmv.qtdNotas}</div>
    </div>
  </div>

  ${semZero.length > 0 ? `
  <!-- Sem consumo -->
  <div style="padding:0 20px 16px">
    <div style="font-size:12px;font-weight:700;color:#e53e3e;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">⚠ Itens sem consumo (tinham na semana anterior)</div>
    <table style="width:100%;border-collapse:collapse;border-radius:8px;overflow:hidden;border:1px solid #f0f0f0">
      ${tblHeader}${rowZero}
    </table>
  </div>` : ''}

  ${maioresAltas.length > 0 ? `
  <!-- Maiores altas -->
  <div style="padding:0 20px 16px">
    <div style="font-size:12px;font-weight:700;color:#c05621;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">📈 Maior aumento de consumo</div>
    <table style="width:100%;border-collapse:collapse;border-radius:8px;overflow:hidden;border:1px solid #f0f0f0">
      ${tblHeader}${rowAltas}
    </table>
  </div>` : ''}

  ${maioresBaixas.length > 0 ? `
  <!-- Maiores baixas -->
  <div style="padding:0 20px 16px">
    <div style="font-size:12px;font-weight:700;color:#276749;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">📉 Maior redução de consumo</div>
    <table style="width:100%;border-collapse:collapse;border-radius:8px;overflow:hidden;border:1px solid #f0f0f0">
      ${tblHeader}${rowBaixas}
    </table>
  </div>` : ''}

  ${semZero.length === 0 && maioresAltas.length === 0 && maioresBaixas.length === 0 ? `
  <div style="padding:24px;text-align:center;color:#999">Sem variações significativas esta semana.</div>` : ''}

  <!-- Footer -->
  <div style="padding:16px 20px;background:#f8f8f8;border-top:1px solid #eee;text-align:center">
    <a href="https://allnaturalfranquias.github.io/checksdoall/inventario.html?u=${loja.id}" style="font-size:12px;color:#1a7f3c;text-decoration:none;font-weight:600">Abrir app de controles →</a>
    <div style="font-size:11px;color:#bbb;margin-top:6px">Relatório automático gerado toda terça-feira · All Natural Controles</div>
  </div>

</div></body></html>`;
}

// ── Nodemailer ────────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: GMAIL_USER, pass: GMAIL_PASS }
});

// ── Main ──────────────────────────────────────────────────────
for (const loja of LOJAS) {
  console.log(`\nProcessando ${loja.nome}...`);
  const estado = await fetchEstado(`dados_${loja.id}`);
  if (!estado) { console.log(`  Sem dados para ${loja.nome}`); continue; }

  const html = gerarHTML(loja, estado);
  const cmv  = getCMVSemana(estado, semAtual);
  const cmvStr = cmv.pct != null ? `${cmv.pct.toFixed(1)}%` : '—';

  try {
    await transporter.sendMail({
      from: `"All Natural Controles" <${GMAIL_USER}>`,
      to: loja.email,
      cc: 'kaue.drabik@gmail.com',
      subject: `📊 Relatório Semanal — ${loja.nome} — ${getWeekLabel(semAtual)} — CMV ${cmvStr}`,
      html,
    });
    console.log(`  ✓ Email enviado para ${loja.email}`);
  } catch(e) {
    console.error(`  ✗ Erro ao enviar para ${loja.nome}: ${e.message}`);
  }
}

console.log('\nConcluído.');
