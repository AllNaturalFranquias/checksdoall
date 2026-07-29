import nodemailer from 'nodemailer';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const GMAIL_USER   = process.env.GMAIL_USER;
const GMAIL_PASS   = process.env.GMAIL_PASS;
const REPORT_EMAIL = 'kaue.drabik@gmail.com';
const DRY_RUN      = process.env.DRY_RUN === 'true';

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const ORDEM_LOJAS = ['Bigorrilho','Park Shopping','Batel','Maringá','Cascavel'];

function calcRange() {
  const dezenaInput = process.env.DEZENA;
  const mesAnoInput = process.env.MES_ANO;

  const hoje = new Date();
  const dia  = hoje.getUTCDate();

  if (dezenaInput && mesAnoInput) {
    const [ano, mes] = mesAnoInput.split('-').map(Number);
    const ultimoDia  = new Date(ano, mes, 0).getDate();
    const pad        = d => String(d).padStart(2,'0');
    if (dezenaInput === '1') return { de:`${mesAnoInput}-01`, ate:`${mesAnoInput}-10`, dezena:'1ª', mes, ano };
    if (dezenaInput === '2') return { de:`${mesAnoInput}-11`, ate:`${mesAnoInput}-20`, dezena:'2ª', mes, ano };
    return { de:`${mesAnoInput}-21`, ate:`${mesAnoInput}-${pad(ultimoDia)}`, dezena:'3ª', mes, ano };
  }

  const mesAtual = hoje.getUTCMonth() + 1;
  const anoAtual = hoje.getUTCFullYear();
  const pad = d => String(d).padStart(2,'0');
  const mesStr = pad(mesAtual);

  if (dia === 11) return { de:`${anoAtual}-${mesStr}-01`, ate:`${anoAtual}-${mesStr}-10`, dezena:'1ª', mes:mesAtual, ano:anoAtual };
  if (dia === 21) return { de:`${anoAtual}-${mesStr}-11`, ate:`${anoAtual}-${mesStr}-20`, dezena:'2ª', mes:mesAtual, ano:anoAtual };
  if (dia ===  1) {
    const prev       = new Date(Date.UTC(anoAtual, mesAtual - 2, 1));
    const mesAnt     = prev.getUTCMonth() + 1;
    const anoAnt     = prev.getUTCFullYear();
    const ultimoDia  = new Date(anoAtual, mesAtual - 1, 0).getDate();
    return { de:`${anoAnt}-${pad(mesAnt)}-21`, ate:`${anoAnt}-${pad(mesAnt)}-${pad(ultimoDia)}`, dezena:'3ª', mes:mesAnt, ano:anoAnt };
  }

  throw new Error(`Dia ${dia} não é dia de fatura (1, 11 ou 21). Use os inputs manuais do workflow.`);
}

function fmtMoeda(v) {
  const n = Number(v).toFixed(2);
  const [int, dec] = n.split('.');
  return 'R$ ' + int.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + dec;
}

function fmtData(iso) {
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a}`;
}

function fmtQty(item) {
  const qty = item.qty;
  if (item.qtdVenda === 1 && item.unidadeVenda === item.unidadeBase) return `${qty} ${item.unidadeBase}`;
  const total   = qty * item.qtdVenda;
  const isInt   = Math.abs(total - Math.round(total)) < 0.001;
  const tFmt    = isInt ? String(Math.round(total)) : total.toFixed(2).replace('.', ',');
  const vPl     = item.unidadeVenda === 'pacote' ? (qty > 1 ? 'pacotes' : 'pacote') : item.unidadeVenda;
  return `${qty} ${vPl} (${tFmt} ${item.unidadeBase})`;
}

function buildEmail(loja, itensMap, total, range) {
  const { de, ate, dezena, mes, ano } = range;
  const nomeMes    = MESES[mes - 1];
  const dataEmissao = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  const itens      = Object.values(itensMap).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

  const rows = itens.map(item => `
    <tr>
      <td style="padding:11px 20px;border-bottom:1px solid #F3F4F6;font-size:14px;color:#111827;">${item.nome}</td>
      <td style="padding:11px 20px;border-bottom:1px solid #F3F4F6;font-size:14px;text-align:right;white-space:nowrap;color:#374151;">${fmtQty(item)}</td>
      <td style="padding:11px 20px;border-bottom:1px solid #F3F4F6;font-size:14px;text-align:right;white-space:nowrap;font-weight:700;color:#16A34A;">${fmtMoeda(item.subtotal)}</td>
    </tr>`).join('');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>Fatura ${loja} — ${dezena} Dezena ${nomeMes} ${ano}</title>
</head>
<body style="margin:0;padding:0;background:#F3F4F6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F3F4F6;padding:24px 12px;">
<tr><td align="center">
<table width="640" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;background:white;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.10);">

  <!-- Header laranja -->
  <tr><td style="background:#E8621A;padding:26px 32px 20px;">
    <div style="font-size:22px;font-weight:900;color:white;letter-spacing:-0.3px;">🏭 All Natural Fábrica</div>
    <div style="font-size:13px;color:rgba(255,255,255,0.82);margin-top:4px;">Fatura de Consumo — ${dezena} Dezena</div>
  </td></tr>

  <!-- Info da fatura -->
  <tr><td style="background:#FDF3EC;padding:18px 32px;border-bottom:1px solid #E5E7EB;">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="vertical-align:top;">
          <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#9A3412;">Loja</div>
          <div style="font-size:20px;font-weight:800;color:#111827;margin-top:4px;">🏪 ${loja}</div>
        </td>
        <td style="vertical-align:top;text-align:right;">
          <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#9A3412;">Período</div>
          <div style="font-size:15px;font-weight:700;color:#111827;margin-top:4px;">${dezena} Dezena — ${nomeMes} ${ano}</div>
          <div style="font-size:12px;color:#6B7280;margin-top:2px;">${fmtData(de)} a ${fmtData(ate)}</div>
          <div style="font-size:11px;color:#9CA3AF;margin-top:8px;">Emitido em ${dataEmissao}</div>
        </td>
      </tr>
    </table>
  </td></tr>

  <!-- Cabeçalho tabela -->
  <tr><td style="padding:0;">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr style="background:#F9FAFB;">
        <th style="padding:10px 20px;text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;color:#6B7280;border-bottom:2px solid #E5E7EB;">Produto</th>
        <th style="padding:10px 20px;text-align:right;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;color:#6B7280;border-bottom:2px solid #E5E7EB;white-space:nowrap;">Quantidade</th>
        <th style="padding:10px 20px;text-align:right;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;color:#6B7280;border-bottom:2px solid #E5E7EB;white-space:nowrap;">Subtotal</th>
      </tr>
      ${rows}
    </table>
  </td></tr>

  <!-- Total -->
  <tr><td style="background:#F0FDF4;padding:18px 32px;border-top:2px solid #E5E7EB;">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;color:#6B7280;">Total a Pagar</td>
        <td style="text-align:right;font-size:30px;font-weight:900;color:#16A34A;">${fmtMoeda(total)}</td>
      </tr>
    </table>
  </td></tr>

  <!-- Rodapé -->
  <tr><td style="padding:14px 32px;border-top:1px solid #E5E7EB;text-align:center;">
    <div style="font-size:12px;color:#9CA3AF;">All Natural Fábrica · Curitiba, PR</div>
    <div style="font-size:11px;color:#D1D5DB;margin-top:3px;">gerado automaticamente · <a href="https://pedidosallnaturalfabrica.netlify.app/admin.html" style="color:#D1D5DB;">ver pedidos online</a></div>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

async function main() {
  const range = calcRange();
  const { de, ate, dezena, mes, ano } = range;
  const nomeMes = MESES[mes - 1];

  console.log(`📋 Faturas: ${dezena} Dezena ${nomeMes} ${ano} (${de} → ${ate})`);
  if (DRY_RUN) console.log('⚠️  DRY RUN — nenhum email será enviado');

  const url = `${SUPABASE_URL}/rest/v1/pedidos_fabrica?select=*&data_entrega=gte.${de}&data_entrega=lte.${ate}&order=unidade.asc`;
  const res = await fetch(url, {
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
  });
  if (!res.ok) throw new Error(`Supabase error ${res.status}: ${await res.text()}`);
  const pedidos = await res.json();

  console.log(`✅ ${pedidos.length} pedido(s) encontrado(s)`);

  if (!pedidos.length) {
    console.log('ℹ️  Nenhum pedido no período — nenhum email enviado.');
    return;
  }

  // Agrupa por loja
  const porLoja = {};
  for (const p of pedidos) {
    if (!porLoja[p.unidade]) porLoja[p.unidade] = { itens: {}, total: 0, nPedidos: 0 };
    const loja = porLoja[p.unidade];
    loja.nPedidos++;
    loja.total += Number(p.total);
    const itens = Array.isArray(p.itens) ? p.itens : JSON.parse(p.itens);
    for (const item of itens) {
      if (!loja.itens[item.nome]) loja.itens[item.nome] = { ...item, qty: 0, subtotal: 0 };
      loja.itens[item.nome].qty      += item.qty;
      loja.itens[item.nome].subtotal += Number(item.subtotal);
    }
  }

  const lojas = ORDEM_LOJAS.filter(l => porLoja[l]).concat(
    Object.keys(porLoja).filter(l => !ORDEM_LOJAS.includes(l))
  );

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: GMAIL_USER, pass: GMAIL_PASS }
  });

  for (const nomeLoja of lojas) {
    const loja    = porLoja[nomeLoja];
    const subject = `🏭 ${nomeLoja} — ${dezena} Dezena ${nomeMes} ${ano} — ${fmtMoeda(loja.total)}`;
    const html    = buildEmail(nomeLoja, loja.itens, loja.total, range);

    if (DRY_RUN) {
      console.log(`[DRY RUN] ${nomeLoja} | ${fmtMoeda(loja.total)} | ${loja.nPedidos} pedido(s)`);
      continue;
    }

    await transporter.sendMail({ from: `All Natural Fábrica <${GMAIL_USER}>`, to: REPORT_EMAIL, subject, html });
    console.log(`✉️  Enviado: ${nomeLoja} — ${fmtMoeda(loja.total)}`);
  }

  console.log(`🎉 ${DRY_RUN ? 'Simulado' : 'Enviado'} para ${lojas.length} loja(s).`);
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
