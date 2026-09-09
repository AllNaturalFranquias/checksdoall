import nodemailer from 'nodemailer';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const GMAIL_USER   = process.env.GMAIL_USER;
const GMAIL_PASS   = process.env.GMAIL_PASS;

const LOJAS = [
  { id: 'batel',        nome: 'Batel',        email: 'allnatural.batel@hotmail.com' },
  { id: 'bigorrilho',   nome: 'Bigorrilho',   email: 'allnatural.bigorrilho@gmail.com' },
  { id: 'parkshopping', nome: 'Park Shopping', email: 'allnaturalpkb@gmail.com' },
  { id: 'maringa',      nome: 'Maringá',      email: 'allnatural.mga@hotmail.com' },
];

// ── Semana ISO ────────────────────────────────────────────────
function getISOWeekNum(date) {
  const d = new Date(date); d.setHours(0,0,0,0);
  d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
  const week1 = new Date(d.getFullYear(), 0, 4);
  return 1 + Math.round(((d - week1) / 86400000 - 3 + (week1.getDay()+6) % 7) / 7);
}
function getWeekKey(date) {
  const d = new Date(date), day = d.getDay() || 7;
  d.setDate(d.getDate() - day + 1);
  return `${d.getFullYear()}-W${String(getISOWeekNum(d)).padStart(2,'0')}`;
}
function getWeekMonday(weekKey) {
  const [yr, wStr] = weekKey.split('-W');
  const jan4 = new Date(+yr, 0, 4), jan4Day = jan4.getDay() || 7;
  const week1Mon = new Date(jan4 - (jan4Day-1)*86400000);
  return new Date(week1Mon.getTime() + (parseInt(wStr)-1)*7*86400000);
}
function getWeekLabel(weekKey) {
  const mon = getWeekMonday(weekKey);
  const sun = new Date(mon.getTime() + 6*86400000);
  const fmt = d => d.toLocaleDateString('pt-BR',{day:'numeric',month:'short'}).replace('.','');
  return `Sem. ${parseInt(weekKey.split('-W')[1])} · ${fmt(mon)} – ${fmt(sun)}`;
}
function fmtR(n) { return n.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}); }

// Roda toda segunda-feira → semana fechada é a da segunda-feira ANTERIOR (7 dias atrás)
const hoje        = new Date();
const semFechada  = (() => { const d = new Date(hoje); d.setDate(d.getDate()-7); return getWeekKey(d); })();
const semAnterior = (() => { const d = new Date(hoje); d.setDate(d.getDate()-14); return getWeekKey(d); })();

console.log(`Semana fechada: ${semFechada} | Comparativo: ${semAnterior}`);

// ── Supabase ──────────────────────────────────────────────────
async function fetchEstado(chave) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/inventario_dados?chave=eq.${chave}&select=estado`,
    { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
  );
  const rows = await res.json();
  return rows?.[0]?.estado || null;
}

// ── CMV da semana ─────────────────────────────────────────────
function getCMVSemana(estado, weekKey) {
  const d     = estado?.cmv?.[weekKey] || {};
  const notas = d.notas || [];
  const gasto = notas.reduce((s, n) => s + (n.valor || 0), 0);
  const fat   = d.faturamento || 0;
  const meta  = d.meta_pct || 30;
  const pct   = fat > 0 ? gasto / fat * 100 : null;
  return { gasto, fat, meta, pct, notas, qtdNotas: notas.length };
}

// ── Top gastos por fornecedor ─────────────────────────────────
function topFornecedores(notas, top = 5) {
  const map = {};
  for (const n of notas) {
    map[n.fornecedor] = (map[n.fornecedor] || 0) + (n.valor || 0);
  }
  return Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .slice(0, top)
    .map(([nome, val]) => ({ nome, val }));
}

// ── Top gastos por linha de produto ──────────────────────────
function topLinhas(notas, top = 5) {
  const map = {};
  for (const n of notas) {
    if (n.linhas?.length) {
      for (const l of n.linhas) map[l.linha] = (map[l.linha] || 0) + (l.valor || 0);
    } else if (n.linha) {
      map[n.linha] = (map[n.linha] || 0) + (n.valor || 0);
    }
  }
  return Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .slice(0, top)
    .map(([nome, val]) => ({ nome, val }));
}

// ── HTML do email ─────────────────────────────────────────────
function gerarHTML(loja, estado) {
  const curr = getCMVSemana(estado, semFechada);
  const prev = getCMVSemana(estado, semAnterior);

  if (curr.qtdNotas === 0 && curr.fat === 0) return null; // sem dados, não envia

  const metaR  = curr.fat > 0 ? curr.fat * curr.meta / 100 : null;
  const saldo  = metaR !== null ? metaR - curr.gasto : null;
  const cor    = saldo === null ? '#6b7280' : saldo >= 0 ? '#16a34a' : '#dc2626';
  const pctStr = curr.pct !== null ? curr.pct.toFixed(1) + '%' : '—';
  const semLabel = getWeekLabel(semFechada);

  const varFat = prev.fat > 0 ? ((curr.fat - prev.fat) / prev.fat * 100) : null;
  const varGasto = prev.gasto > 0 ? ((curr.gasto - prev.gasto) / prev.gasto * 100) : null;

  const fornHtml = topFornecedores(curr.notas).map((f, i) =>
    `<tr style="background:${i%2?'#f9fafb':'#fff'}">
       <td style="padding:6px 10px;font-size:13px">${i+1}. ${f.nome}</td>
       <td style="padding:6px 10px;font-size:13px;text-align:right;font-weight:600">R$ ${fmtR(f.val)}</td>
     </tr>`).join('');

  const linhaHtml = topLinhas(curr.notas).map((l, i) =>
    `<tr style="background:${i%2?'#f9fafb':'#fff'}">
       <td style="padding:6px 10px;font-size:13px">${i+1}. ${l.nome}</td>
       <td style="padding:6px 10px;font-size:13px;text-align:right;font-weight:600">R$ ${fmtR(l.val)}</td>
     </tr>`).join('');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,sans-serif">
  <div style="max-width:560px;margin:24px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08)">

    <!-- Header -->
    <div style="background:#E87820;padding:20px 24px">
      <div style="color:#fff;font-size:11px;font-weight:700;letter-spacing:1px;opacity:.8;margin-bottom:4px">FECHAMENTO SEMANAL CMV</div>
      <div style="color:#fff;font-size:20px;font-weight:700">${loja.nome}</div>
      <div style="color:rgba(255,255,255,.85);font-size:13px;margin-top:2px">${semLabel}</div>
    </div>

    <!-- KPIs principais -->
    <div style="display:flex;gap:0;border-bottom:1px solid #e5e7eb">
      <div style="flex:1;padding:16px 20px;border-right:1px solid #e5e7eb">
        <div style="font-size:11px;color:#6b7280;font-weight:700;letter-spacing:.5px;margin-bottom:4px">CMV REAL</div>
        <div style="font-size:28px;font-weight:800;color:${curr.pct !== null && curr.pct > curr.meta ? '#dc2626' : '#16a34a'}">${pctStr}</div>
        <div style="font-size:12px;color:#6b7280;margin-top:2px">Meta: ${curr.meta}%</div>
      </div>
      <div style="flex:1;padding:16px 20px">
        <div style="font-size:11px;color:#6b7280;font-weight:700;letter-spacing:.5px;margin-bottom:4px">${saldo !== null && saldo < 0 ? 'EXCEDEU A META' : 'SALDO DA META'}</div>
        <div style="font-size:28px;font-weight:800;color:${cor}">${saldo !== null ? (saldo < 0 ? '−' : '') + 'R$ ' + fmtR(Math.abs(saldo)) : '—'}</div>
        <div style="font-size:12px;color:#6b7280;margin-top:2px">Meta: ${metaR !== null ? 'R$ ' + fmtR(metaR) : '—'}</div>
      </div>
    </div>

    <!-- Métricas secundárias -->
    <div style="display:flex;gap:0;border-bottom:1px solid #e5e7eb">
      <div style="flex:1;padding:12px 20px;border-right:1px solid #e5e7eb">
        <div style="font-size:11px;color:#6b7280;font-weight:600;margin-bottom:2px">GASTO TOTAL</div>
        <div style="font-size:16px;font-weight:700">R$ ${fmtR(curr.gasto)}</div>
        ${varGasto !== null ? `<div style="font-size:11px;color:${varGasto>0?'#dc2626':'#16a34a'}">${varGasto>0?'▲':'▼'} ${Math.abs(varGasto).toFixed(1)}% vs sem. ant.</div>` : ''}
      </div>
      <div style="flex:1;padding:12px 20px">
        <div style="font-size:11px;color:#6b7280;font-weight:600;margin-bottom:2px">FATURAMENTO</div>
        <div style="font-size:16px;font-weight:700">R$ ${fmtR(curr.fat)}</div>
        ${varFat !== null ? `<div style="font-size:11px;color:${varFat>0?'#16a34a':'#dc2626'}">${varFat>0?'▲':'▼'} ${Math.abs(varFat).toFixed(1)}% vs sem. ant.</div>` : ''}
      </div>
    </div>

    <!-- Top fornecedores -->
    ${fornHtml ? `
    <div style="padding:16px 20px;border-bottom:1px solid #e5e7eb">
      <div style="font-size:13px;font-weight:700;color:#374151;margin-bottom:8px">🏆 Top Fornecedores</div>
      <table style="width:100%;border-collapse:collapse">${fornHtml}</table>
    </div>` : ''}

    <!-- Top por linha de produto -->
    ${linhaHtml ? `
    <div style="padding:16px 20px;border-bottom:1px solid #e5e7eb">
      <div style="font-size:13px;font-weight:700;color:#374151;margin-bottom:8px">📦 Gasto por Linha</div>
      <table style="width:100%;border-collapse:collapse">${linhaHtml}</table>
    </div>` : ''}

    <!-- Rodapé -->
    <div style="padding:14px 20px;background:#f9fafb;text-align:center">
      <div style="font-size:11px;color:#9ca3af">All Natural · Sistema de Controle · ${new Date().toLocaleDateString('pt-BR')}</div>
    </div>
  </div>
</body></html>`;
}

// ── Envio ─────────────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: GMAIL_USER, pass: GMAIL_PASS }
});

const dry = process.env.DRY_RUN === 'true';

for (const loja of LOJAS) {
  try {
    const estado = await fetchEstado('dados_' + loja.id);
    if (!estado) { console.log(`[${loja.nome}] sem dados`); continue; }
    const html = gerarHTML(loja, estado);
    if (!html) { console.log(`[${loja.nome}] sem movimento, pulando`); continue; }

    if (dry) {
      console.log(`[DRY] ${loja.nome} — email gerado OK`);
      continue;
    }

    await transporter.sendMail({
      from: `"All Natural · CMV" <${GMAIL_USER}>`,
      to:   [loja.email, GMAIL_USER],
      subject: `CMV ${getWeekLabel(semFechada)} — ${loja.nome}`,
      html
    });
    console.log(`[OK] ${loja.nome} → ${loja.email}`);
  } catch(e) {
    console.error(`[ERRO] ${loja.nome}:`, e.message);
  }
}
