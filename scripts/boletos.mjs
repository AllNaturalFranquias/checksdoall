import nodemailer from 'nodemailer';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const GMAIL_USER   = process.env.GMAIL_USER;
const GMAIL_PASS   = process.env.GMAIL_PASS;
const GESTOR_EMAIL = process.env.GESTOR_EMAIL || GMAIL_USER;

const LOJAS = [
  { id: 'batel',        nome: 'Batel' },
  { id: 'bigorrilho',   nome: 'Bigorrilho' },
  { id: 'parkshopping', nome: 'Park Shopping' },
  { id: 'maringa',      nome: 'Maringá' },
  { id: 'cascavel',     nome: 'Cascavel' },
];

function fmtR(n) { return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

function parseDate(s) {
  if (!s) return null;
  const p = s.split('/');
  return p.length === 3 ? new Date(+p[2], +p[1]-1, +p[0]) : null;
}

// Semana atual (segunda a domingo)
const hoje    = new Date(); hoje.setHours(0,0,0,0);
const day     = hoje.getDay() || 7;
const segunda = new Date(hoje); segunda.setDate(hoje.getDate() - day + 1);
const domingo = new Date(segunda); domingo.setDate(segunda.getDate() + 6);
const semLabel = `${segunda.toLocaleDateString('pt-BR',{day:'numeric',month:'short'})} – ${domingo.toLocaleDateString('pt-BR',{day:'numeric',month:'short'})}`;

async function fetchEstado(chave) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/inventario_dados?chave=eq.${chave}&select=estado`,
    { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
  );
  const rows = await res.json();
  return rows?.[0]?.estado || null;
}

function coletarBoletos(estado) {
  const boletos = [];
  Object.values(estado?.cmv || {}).forEach(wd => {
    (wd?.notas || []).forEach(n => {
      (n.boletos || []).forEach(b => {
        boletos.push({
          fornecedor:      n.fornecedor,
          valor:           b.valor || 0,
          vencimento:      b.vencimento || null,
          linha_digitavel: b.linha_digitavel || null,
          vencDate:        parseDate(b.vencimento),
        });
      });
    });
  });
  return boletos.filter(b => b.vencDate).sort((a, b) => a.vencDate - b.vencDate);
}

function renderTabelaBoletos(boletos, corHeader) {
  const porData = {};
  for (const b of boletos) {
    const k = b.vencimento || 'Sem data';
    (porData[k] = porData[k] || []).push(b);
  }
  return Object.entries(porData).map(([data, lista]) => {
    const total = lista.reduce((s, b) => s + b.valor, 0);
    const rows = lista.map((b, i) => `
      <tr style="background:${i%2?'#f9fafb':'#fff'}">
        <td style="padding:6px 10px;font-size:12px">${b.fornecedor}</td>
        <td style="padding:6px 10px;font-size:12px;text-align:right;font-weight:600">R$ ${fmtR(b.valor)}</td>
        <td style="padding:6px 10px;font-size:10px;font-family:monospace;color:#6b7280;word-break:break-all;max-width:200px">${b.linha_digitavel || '<span style="color:#9ca3af">—</span>'}</td>
      </tr>`).join('');
    return `
      <div style="margin-bottom:12px">
        <div style="background:${corHeader};color:#fff;padding:6px 12px;border-radius:6px 6px 0 0;display:flex;justify-content:space-between">
          <span style="font-weight:700;font-size:13px">${data}</span>
          <span style="font-weight:700;font-size:13px">R$ ${fmtR(total)}</span>
        </div>
        <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-top:none">
          <thead>
            <tr style="background:#f9fafb">
              <th style="padding:4px 10px;font-size:11px;text-align:left;color:#6b7280">FORNECEDOR</th>
              <th style="padding:4px 10px;font-size:11px;text-align:right;color:#6b7280">VALOR</th>
              <th style="padding:4px 10px;font-size:11px;text-align:left;color:#6b7280">LINHA DIGITÁVEL</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }).join('');
}

function buildEmailLoja(lojaNome, vencidos, semana, futuros) {
  const totalSem  = semana.reduce((s, b) => s + b.valor, 0);
  const totalVenc = vencidos.reduce((s, b) => s + b.valor, 0);
  const totalFut  = futuros.reduce((s, b) => s + b.valor, 0);

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,sans-serif">
  <div style="max-width:620px;margin:24px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08)">

    <div style="background:#1d4ed8;padding:20px 24px">
      <div style="color:rgba(255,255,255,.8);font-size:11px;font-weight:700;letter-spacing:1px;margin-bottom:4px">BOLETOS — ${lojaNome.toUpperCase()}</div>
      <div style="color:#fff;font-size:20px;font-weight:700">All Natural · ${lojaNome}</div>
      <div style="color:rgba(255,255,255,.85);font-size:13px;margin-top:2px">${semLabel}</div>
    </div>

    <div style="display:flex;border-bottom:1px solid #e5e7eb">
      <div style="flex:1;padding:16px 20px${totalVenc > 0 ? ';border-right:1px solid #e5e7eb' : ''}">
        <div style="font-size:11px;color:#6b7280;font-weight:700;letter-spacing:.5px;margin-bottom:4px">VENCE ESTA SEMANA</div>
        <div style="font-size:26px;font-weight:800;color:#1d4ed8">R$ ${fmtR(totalSem)}</div>
        <div style="font-size:12px;color:#6b7280;margin-top:2px">${semana.length} boleto${semana.length !== 1 ? 's' : ''}</div>
      </div>
      ${totalVenc > 0 ? `
      <div style="flex:1;padding:16px 20px">
        <div style="font-size:11px;color:#dc2626;font-weight:700;letter-spacing:.5px;margin-bottom:4px">⚠️ VENCIDOS</div>
        <div style="font-size:26px;font-weight:800;color:#dc2626">R$ ${fmtR(totalVenc)}</div>
        <div style="font-size:12px;color:#6b7280;margin-top:2px">${vencidos.length} boleto${vencidos.length !== 1 ? 's' : ''}</div>
      </div>` : ''}
    </div>

    ${vencidos.length ? `
    <div style="padding:16px 20px;border-bottom:1px solid #e5e7eb">
      <div style="font-size:13px;font-weight:700;color:#dc2626;margin-bottom:10px">⚠️ Boletos Vencidos</div>
      ${renderTabelaBoletos(vencidos, '#dc2626')}
    </div>` : ''}

    ${semana.length ? `
    <div style="padding:16px 20px;border-bottom:1px solid #e5e7eb">
      <div style="font-size:13px;font-weight:700;color:#1d4ed8;margin-bottom:10px">📅 Vencimentos desta semana</div>
      ${renderTabelaBoletos(semana, '#1d4ed8')}
    </div>` : ''}

    ${futuros.length ? `
    <div style="padding:12px 20px;border-bottom:1px solid #e5e7eb;background:#f9fafb">
      <div style="font-size:12px;color:#6b7280;font-weight:600;margin-bottom:4px">PRÓXIMAS SEMANAS</div>
      <div style="font-size:13px">R$ ${fmtR(totalFut)} em ${futuros.length} boleto${futuros.length !== 1 ? 's' : ''} futuros</div>
    </div>` : ''}

    <div style="padding:14px 20px;background:#f9fafb;text-align:center">
      <div style="font-size:11px;color:#9ca3af">All Natural · ${lojaNome} · ${new Date().toLocaleDateString('pt-BR')}</div>
    </div>
  </div>
</body></html>`;
}

// Envio
const dry = process.env.DRY_RUN === 'true';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: GMAIL_USER, pass: GMAIL_PASS }
});

let enviados = 0;

for (const loja of LOJAS) {
  try {
    const estado = await fetchEstado('dados_' + loja.id);
    if (!estado) continue;

    const boletos  = coletarBoletos(estado);
    const vencidos = boletos.filter(b => b.vencDate < segunda);
    const semana   = boletos.filter(b => b.vencDate >= segunda && b.vencDate <= domingo);
    const futuros  = boletos.filter(b => b.vencDate > domingo);

    if (!vencidos.length && !semana.length) continue;

    const totalSem = semana.reduce((s, b) => s + b.valor, 0);
    const html     = buildEmailLoja(loja.nome, vencidos, semana, futuros);
    const subject  = `[${loja.nome}] Boletos ${semLabel} — R$ ${fmtR(totalSem)} a vencer`;

    if (dry) {
      console.log(`[DRY] ${loja.nome}: ${semana.length} boletos semana, ${vencidos.length} vencidos`);
      continue;
    }

    await transporter.sendMail({
      from:    `"All Natural · ${loja.nome}" <${GMAIL_USER}>`,
      to:      GESTOR_EMAIL,
      subject,
      html,
    });
    console.log(`[OK] ${loja.nome} → ${GESTOR_EMAIL}`);
    enviados++;

  } catch(e) {
    console.error(`[ERRO] ${loja.nome}:`, e.message);
  }
}

if (enviados === 0 && !dry) {
  console.log('Nenhum boleto relevante em nenhuma loja. Nenhum email enviado.');
}
