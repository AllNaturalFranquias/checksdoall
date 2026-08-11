import nodemailer from 'nodemailer';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const GMAIL_USER   = process.env.GMAIL_USER;
const GMAIL_PASS   = process.env.GMAIL_PASS;
const REPORT_EMAIL = 'allnatural.cwb@gmail.com';
const DRY_RUN      = process.env.DRY_RUN === 'true';

const MESES    = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const DOW_FULL = ['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado'];
const ORDEM_LOJAS = ['Bigorrilho','Park Shopping','Batel','Maringá','Cascavel'];

function calcRange() {
  const dezenaInput = process.env.DEZENA;
  const mesAnoInput = process.env.MES_ANO;
  const hoje = new Date();
  const dia  = hoje.getUTCDate();
  const pad  = d => String(d).padStart(2,'0');

  if (dezenaInput && mesAnoInput) {
    const [ano, mes] = mesAnoInput.split('-').map(Number);
    const ultimoDia  = new Date(ano, mes, 0).getDate();
    if (dezenaInput === '1') return { de:`${mesAnoInput}-01`, ate:`${mesAnoInput}-10`, dezena:'1ª', mes, ano };
    if (dezenaInput === '2') return { de:`${mesAnoInput}-11`, ate:`${mesAnoInput}-20`, dezena:'2ª', mes, ano };
    return { de:`${mesAnoInput}-21`, ate:`${mesAnoInput}-${pad(ultimoDia)}`, dezena:'3ª', mes, ano };
  }

  const mesAtual = hoje.getUTCMonth() + 1;
  const anoAtual = hoje.getUTCFullYear();
  const mesStr   = pad(mesAtual);

  if (dia === 11) return { de:`${anoAtual}-${mesStr}-01`, ate:`${anoAtual}-${mesStr}-10`, dezena:'1ª', mes:mesAtual, ano:anoAtual };
  if (dia === 21) return { de:`${anoAtual}-${mesStr}-11`, ate:`${anoAtual}-${mesStr}-20`, dezena:'2ª', mes:mesAtual, ano:anoAtual };
  if (dia ===  1) {
    const prev      = new Date(Date.UTC(anoAtual, mesAtual - 2, 1));
    const mesAnt    = prev.getUTCMonth() + 1;
    const anoAnt    = prev.getUTCFullYear();
    const ultimoDia = new Date(anoAtual, mesAtual - 1, 0).getDate();
    return { de:`${anoAnt}-${pad(mesAnt)}-21`, ate:`${anoAnt}-${pad(mesAnt)}-${pad(ultimoDia)}`, dezena:'3ª', mes:mesAnt, ano:anoAnt };
  }
  throw new Error(`Dia ${dia} não é dia de fatura (1, 11 ou 21). Use os inputs manuais.`);
}

function fmtMoeda(v) {
  const n = Number(v).toFixed(2);
  const [int, dec] = n.split('.');
  return 'R$&nbsp;' + int.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + dec;
}
function fmtMoedaPlain(v) {
  const n = Number(v).toFixed(2);
  const [int, dec] = n.split('.');
  return 'R$ ' + int.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + dec;
}
function fmtData(iso) { const [a,m,d] = iso.split('-'); return `${d}/${m}/${a}`; }
function dowData(iso) { const [a,m,d] = iso.split('-').map(Number); return new Date(a,m-1,d).getDay(); }

function fmtQty(item) {
  const qty = item.qty;
  if (item.qtdVenda === 1 && item.unidadeVenda === item.unidadeBase) return `${qty} ${item.unidadeBase}`;
  const total = qty * item.qtdVenda;
  const isInt = Math.abs(total - Math.round(total)) < 0.001;
  const tFmt  = isInt ? Math.round(total) : total.toFixed(2).replace('.',',');
  const vPl   = item.unidadeVenda === 'pacote' ? (qty > 1 ? 'pacotes' : 'pacote') : item.unidadeVenda;
  return `${qty} ${vPl} (${tFmt} ${item.unidadeBase})`;
}

function fmtQtySimples(item) {
  const qty = item.qty;
  if (item.qtdVenda === 1 && item.unidadeVenda === item.unidadeBase) return `${qty} ${item.unidadeBase}`;
  const total = qty * item.qtdVenda;
  const isInt = Math.abs(total - Math.round(total)) < 0.001;
  const tFmt  = isInt ? Math.round(total) : total.toFixed(2).replace('.',',');
  return `${qty}× (${tFmt} ${item.unidadeBase})`;
}

function buildEmail(loja, itensMap, pedidos, total, range) {
  const { de, ate, dezena, mes, ano } = range;
  const nomeMes    = MESES[mes - 1];
  const dataEmissao = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day:'2-digit', month:'2-digit', year:'numeric' });
  const itens      = Object.values(itensMap).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

  // ── Seção de pedidos individuais ──────────────────────
  const pedidosHtml = pedidos.map(p => {
    const dow   = dowData(p.data_entrega);
    const itensPedido = Array.isArray(p.itens) ? p.itens : JSON.parse(p.itens);
    const linhas = itensPedido.map(item =>
      `<tr>
        <td style="padding:4px 0;font-size:13px;color:#374151;">• ${item.nome}</td>
        <td style="padding:4px 0;font-size:13px;color:#6B7280;text-align:right;padding-left:16px;white-space:nowrap;">${fmtQtySimples(item)}</td>
      </tr>`
    ).join('');
    const obsHtml = p.observacoes
      ? `<tr><td colspan="2" style="padding:6px 0 2px;font-size:12px;color:#D97706;">📝 ${p.observacoes}</td></tr>`
      : '';
    return `
      <div style="border:1px solid #E5E7EB;border-radius:8px;margin-bottom:10px;overflow:hidden;">
        <div style="background:#F9FAFB;padding:9px 14px;display:flex;justify-content:space-between;border-bottom:1px solid #E5E7EB;">
          <span style="font-size:13px;font-weight:700;color:#111827;">📅 ${DOW_FULL[dow]}, ${fmtData(p.data_entrega)}</span>
          <span style="font-size:13px;font-weight:700;color:#16A34A;">${fmtMoedaPlain(p.total)}</span>
        </div>
        <div style="padding:10px 14px;">
          <table width="100%" cellpadding="0" cellspacing="0">${linhas}${obsHtml}</table>
        </div>
      </div>`;
  }).join('');

  // ── Tabela consolidada ────────────────────────────────
  const rows = itens.map(item =>
    `<tr>
      <td style="padding:9px 14px;border-bottom:1px solid #F3F4F6;font-size:13px;color:#111827;">${item.nome}</td>
      <td style="padding:9px 14px;border-bottom:1px solid #F3F4F6;font-size:13px;text-align:right;white-space:nowrap;color:#374151;">${fmtQty(item)}</td>
      <td style="padding:9px 14px;border-bottom:1px solid #F3F4F6;font-size:13px;text-align:right;white-space:nowrap;font-weight:700;color:#16A34A;">${fmtMoedaPlain(item.subtotal)}</td>
    </tr>`
  ).join('');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Fatura ${loja} — ${dezena} Dezena ${nomeMes} ${ano}</title></head>
<body style="margin:0;padding:0;background:#F3F4F6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F3F4F6;padding:24px 12px;">
<tr><td align="center">
<table width="640" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;background:white;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.10);">

  <!-- Header -->
  <tr><td style="background:#E8621A;padding:26px 32px 20px;">
    <div style="font-size:22px;font-weight:900;color:white;">🏭 All Natural Fábrica</div>
    <div style="font-size:13px;color:rgba(255,255,255,0.82);margin-top:4px;">Fatura de Consumo — ${dezena} Dezena</div>
  </td></tr>

  <!-- Info -->
  <tr><td style="background:#FDF3EC;padding:16px 32px;border-bottom:1px solid #E5E7EB;">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td style="vertical-align:top;">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#9A3412;">Loja</div>
        <div style="font-size:20px;font-weight:800;color:#111827;margin-top:4px;">🏪 ${loja}</div>
        <div style="font-size:12px;color:#6B7280;margin-top:3px;">${pedidos.length} pedido${pedidos.length > 1 ? 's' : ''} no período</div>
      </td>
      <td style="vertical-align:top;text-align:right;">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#9A3412;">Período</div>
        <div style="font-size:15px;font-weight:700;color:#111827;margin-top:4px;">${dezena} Dezena — ${nomeMes} ${ano}</div>
        <div style="font-size:12px;color:#6B7280;margin-top:2px;">${fmtData(de)} a ${fmtData(ate)}</div>
        <div style="font-size:11px;color:#9CA3AF;margin-top:8px;">Emitido em ${dataEmissao}</div>
      </td>
    </tr></table>
  </td></tr>

  <!-- Pedidos do período -->
  <tr><td style="padding:20px 32px 8px;">
    <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#6B7280;margin-bottom:12px;">Pedidos do período</div>
    ${pedidosHtml}
  </td></tr>

  <!-- Resumo consolidado -->
  <tr><td style="padding:8px 32px 0;">
    <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#6B7280;margin-bottom:8px;">Resumo consolidado</div>
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E5E7EB;border-radius:8px;overflow:hidden;">
      <thead>
        <tr style="background:#F9FAFB;">
          <th style="padding:8px 14px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#6B7280;border-bottom:1.5px solid #E5E7EB;">Produto</th>
          <th style="padding:8px 14px;text-align:right;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#6B7280;border-bottom:1.5px solid #E5E7EB;white-space:nowrap;">Qtd total</th>
          <th style="padding:8px 14px;text-align:right;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#6B7280;border-bottom:1.5px solid #E5E7EB;white-space:nowrap;">Subtotal</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </td></tr>

  <!-- Total -->
  <tr><td style="background:#F0FDF4;padding:16px 32px;border-top:2px solid #E5E7EB;margin-top:20px;">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;color:#6B7280;">Total a Pagar — ${loja}</td>
      <td style="text-align:right;font-size:28px;font-weight:900;color:#16A34A;">${fmtMoedaPlain(total)}</td>
    </tr></table>
  </td></tr>

  <!-- Rodapé -->
  <tr><td style="padding:14px 32px;border-top:1px solid #E5E7EB;text-align:center;">
    <div style="font-size:12px;color:#9CA3AF;">All Natural Fábrica · Curitiba, PR</div>
    <div style="font-size:11px;color:#D1D5DB;margin-top:3px;">gerado automaticamente · <a href="https://pedidosallnaturalfabrica.netlify.app/admin.html" style="color:#D1D5DB;">ver pedidos online</a></div>
  </td></tr>

</table>
</td></tr>
</table>
</body></html>`;
}

async function main() {
  const range = calcRange();
  const { de, ate, dezena, mes, ano } = range;
  const nomeMes = MESES[mes - 1];

  console.log(`📋 Faturas: ${dezena} Dezena ${nomeMes} ${ano} (${de} → ${ate})`);
  if (DRY_RUN) console.log('⚠️  DRY RUN — nenhum email será enviado');

  const url = `${SUPABASE_URL}/rest/v1/pedidos_fabrica?select=*&data_entrega=gte.${de}&data_entrega=lte.${ate}&order=unidade.asc,data_entrega.asc,created_at.asc`;
  const res = await fetch(url, { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } });
  if (!res.ok) throw new Error(`Supabase error ${res.status}: ${await res.text()}`);
  const pedidos = await res.json();

  console.log(`✅ ${pedidos.length} pedido(s) encontrado(s)`);
  if (!pedidos.length) { console.log('ℹ️  Nenhum pedido no período.'); return; }

  // Agrupa por loja mantendo pedidos individuais
  const porLoja = {};
  for (const p of pedidos) {
    if (!porLoja[p.unidade]) porLoja[p.unidade] = { pedidos: [], itens: {}, total: 0 };
    const loja = porLoja[p.unidade];
    loja.total += Number(p.total);
    loja.pedidos.push(p);
    const itens = Array.isArray(p.itens) ? p.itens : JSON.parse(p.itens);
    for (const item of itens) {
      if (!loja.itens[item.nome]) loja.itens[item.nome] = { ...item, qty: 0, subtotal: 0 };
      loja.itens[item.nome].qty      += item.qty;
      loja.itens[item.nome].subtotal += Number(item.subtotal);
    }
  }

  const lojas = ORDEM_LOJAS.filter(l => porLoja[l]).concat(Object.keys(porLoja).filter(l => !ORDEM_LOJAS.includes(l)));
  const transporter = nodemailer.createTransport({ service: 'gmail', auth: { user: GMAIL_USER, pass: GMAIL_PASS } });

  for (const nomeLoja of lojas) {
    const loja    = porLoja[nomeLoja];
    const subject = `🏭 ${nomeLoja} — ${dezena} Dezena ${nomeMes} ${ano} — ${fmtMoedaPlain(loja.total)}`;
    const html    = buildEmail(nomeLoja, loja.itens, loja.pedidos, loja.total, range);

    if (DRY_RUN) { console.log(`[DRY RUN] ${nomeLoja} | ${fmtMoedaPlain(loja.total)} | ${loja.pedidos.length} pedido(s)`); continue; }

    await transporter.sendMail({ from: `All Natural Fábrica <${GMAIL_USER}>`, to: REPORT_EMAIL, subject, html });
    console.log(`✉️  Enviado: ${nomeLoja} — ${fmtMoedaPlain(loja.total)}`);
  }

  console.log(`🎉 ${DRY_RUN ? 'Simulado' : 'Enviado'} para ${lojas.length} loja(s).`);
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
