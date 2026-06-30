'use strict';

// ── Configuração Supabase ─────────────────────────────────────
// Cole aqui as credenciais do seu projeto Supabase
const SUPABASE_URL = 'https://nhuotdwfzowydrjeyttc.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5odW90ZHdmem93eWRyamV5dHRjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0MTM2NDAsImV4cCI6MjA5NTk4OTY0MH0.JovSWvkJ5OdX1tauz7sYOuyDIm1Mbcx5gJF8Zb20oe4';
const SUPABASE_CONFIGURED = !SUPABASE_URL.includes('COLE');

// ── Gemini (chave no Supabase — nunca no código) ──────────────
function getGeminiKey() { return localStorage.getItem('gemini_api_key') || ''; }
function setGeminiKey(k) { localStorage.setItem('gemini_api_key', k.trim()); }

async function loadGeminiKey() {
  if (!SUPABASE_CONFIGURED) return;
  // Sempre busca do Supabase — sobrescreve localStorage com a versão mais recente
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/inventario_dados?chave=eq.config_gemini&select=estado`,
      { headers: supabaseHeaders() }
    );
    const rows = await res.json();
    const key = rows?.[0]?.estado?.key;
    if (key) setGeminiKey(key);
  } catch(e) {}
}

async function saveGeminiKeyToCloud(key) {
  if (!SUPABASE_CONFIGURED) return;
  const body = JSON.stringify({ chave: 'config_gemini', estado: { key } });
  await fetch(`${SUPABASE_URL}/rest/v1/inventario_dados`, {
    method: 'POST',
    headers: { ...supabaseHeaders(), 'Prefer': 'resolution=merge-duplicates' },
    body
  });
}

// ── Unidade (via URL ?u=batel) ────────────────────────────────
const UNIT_ID    = new URLSearchParams(location.search).get('u') || 'batel';
const UNIT_NAMES = { batel:'Batel', maringa:'Maringá', parkshopping:'Park Shopping', bigorrilho:'Bigorrilho', cascavel:'Cascavel' };
const UNIT_NAME  = UNIT_NAMES[UNIT_ID] || UNIT_ID;
const LOCAL_KEY  = 'inventario_' + UNIT_ID + '_v1';
const CLOUD_DADOS = 'dados_' + UNIT_ID;
const CLOUD_CFG   = 'config_' + UNIT_ID;

// ── Sessão de admin (setada pelo login) ───────────────────────
let _session = null;
try { _session = JSON.parse(sessionStorage.getItem('inv_session') || 'null'); } catch(e) {}
const IS_ADMIN = Boolean(_session && _session.isAdmin && (_session.unidade === UNIT_ID || _session.isGlobal));

// ── PINs de admin por unidade ─────────────────────────────────
let UNIT_ADMINS = {
  global:       [{ nome: 'Kauê',    pin: '1234' }],
  batel:        [{ nome: 'Admin 1', pin: '1111' }, { nome: 'Admin 2', pin: '2222' }],
  maringa:      [{ nome: 'Admin 1', pin: '1111' }, { nome: 'Admin 2', pin: '2222' }],
  parkshopping: [{ nome: 'Admin 1', pin: '1111' }, { nome: 'Admin 2', pin: '2222' }],
  bigorrilho:   [{ nome: 'Admin 1', pin: '1111' }, { nome: 'Admin 2', pin: '2222' }],
  cascavel:     [{ nome: 'Admin 1', pin: '1111' }, { nome: 'Admin 2', pin: '2222' }],
};

// ── Config de unidade (itens customizados) ────────────────────
let editMode           = false;
let unitConfig         = { added: {}, deleted: {} };
let currentEditSection = null;

// ── Dados de estoque (base — igual para todas as unidades) ────
const BASE_SECTIONS = [
  {
    key: 'HORTI',
    label: 'HORTI',
    groups: [
      {
        group: 'Verduranet',
        items: [
          { name: 'Abobrinha Espaguete', unit: 'un' },
          { name: 'Alface Americana', unit: 'un' },
          { name: 'Cenoura Espaguete', unit: 'un' },
          { name: 'Cenoura Ralada', unit: 'un' },
          { name: 'Escarola', unit: 'un' },
          { name: 'Mix de Folhas', unit: 'un' },
          { name: 'Pupunha Espaguete', unit: 'un' },
        ]
      },
      {
        group: 'Ceasa',
        items: [
          { name: 'Abacate', unit: 'un' },
          { name: 'Abóbora Cabotia', unit: 'un' },
          { name: 'Abobrinha', unit: 'un' },
          { name: 'Alho Sem Casca', unit: 'un' },
          { name: 'Batata Branca Inglesa', unit: 'un' },
          { name: 'Batata Doce', unit: 'cx' },
          { name: 'Cebola Branca', unit: 'un' },
          { name: 'Cebola Roxa', unit: 'un' },
          { name: 'Cebolinha', unit: 'maço' },
          { name: 'Cenoura Inteira', unit: 'un' },
          { name: 'Couve', unit: 'maço' },
          { name: 'Couve-Flor', unit: 'un' },
          { name: 'Espinafre', unit: 'maço' },
          { name: 'Limão', unit: 'un' },
          { name: 'Maçã Fuji para Geleia', unit: 'un' },
          { name: 'Manga', unit: 'un' },
          { name: 'Mandioca Descascada', unit: 'kg' },
          { name: 'Manjericão', unit: 'maço' },
          { name: 'Morango', unit: 'cx' },
          { name: 'Ovo', unit: 'dz' },
          { name: 'Pepino Japonês', unit: 'un' },
          { name: 'Pimenta Dedo de Moça', unit: 'un' },
          { name: 'Repolho Roxo', unit: 'un' },
          { name: 'Repolho Branco', unit: 'un' },
          { name: 'Salsinha', unit: 'maço' },
          { name: 'Tomate Cereja', unit: 'cx' },
          { name: 'Tomate Italiano', unit: 'un' },
        ]
      },
      {
        group: 'Bebidas',
        items: [
          { name: 'Água com Gás', unit: 'un' },
          { name: 'Água Sem Gás', unit: 'un' },
          { name: 'Cerveja', unit: 'un' },
          { name: 'Chá de Hibisco', unit: 'un' },
          { name: 'Chá Mate', unit: 'un' },
          { name: 'Coca Zero', unit: 'un' },
          { name: 'Kombucha Maracujá c/ Gengibre', unit: 'un' },
          { name: 'Kombucha Açaí c/ Cravo', unit: 'un' },
          { name: 'Kombucha Guaraná c/ Laranja', unit: 'un' },
          { name: 'Kombucha Berry c/ Hibisco', unit: 'un' },
          { name: 'Suco de Laranja', unit: 'un' },
          { name: 'Suco Detox', unit: 'un' },
          { name: 'Suco Refrescante', unit: 'un' },
          { name: 'Suco Thermofresh', unit: 'un' },
          { name: 'Vinho Branco', unit: 'un' },
          { name: 'Vinho Rosé', unit: 'un' },
          { name: 'Vinho Tinto', unit: 'un' },
        ]
      },
      {
        group: 'Sobremesas',
        items: [
          { name: 'Strogonozes', unit: 'un' },
          { name: 'Brownie', unit: 'un' },
          { name: 'Mousse Chocolate com Pasta', unit: 'un' },
        ]
      },
      {
        group: 'Snacks',
        items: [
          { name: 'Coxinha', unit: 'un' },
          { name: 'Palitinhos de Tapioca', unit: 'un' },
          { name: 'Sanduíche Natural', unit: 'un' },
          { name: 'Tortinha Frango e Legumes', unit: 'un' },
          { name: 'Tortinha Legumes', unit: 'un' },
        ]
      }
    ]
  },
  {
    key: 'COZINHA',
    label: 'COZINHA',
    groups: [
      {
        group: 'Secos',
        items: [
          { name: 'Açúcar Demerara', unit: 'un' },
          { name: 'Adoçante Zero Cal', unit: 'un' },
          { name: 'Arroz Integral', unit: 'un' },
          { name: 'Azeite de Oliva Misto (Cozinha)', unit: 'un' },
          { name: 'Azeite de Oliva Puro (Cliente)', unit: 'un' },
          { name: 'Bifummm', unit: 'un' },
          { name: 'Café', unit: 'un' },
          { name: 'Conhaque', unit: 'un' },
          { name: 'Creme de Leite 0 Lactose', unit: 'un' },
          { name: 'Extrato de Tomate', unit: 'un' },
          { name: 'Farelo de Aveia', unit: 'un' },
          { name: 'Farinha de Mandioca', unit: 'un' },
          { name: 'Farinha de Trigo', unit: 'un' },
          { name: 'Feijão Preto', unit: 'un' },
          { name: 'Leite de Coco', unit: 'un' },
          { name: 'Macarrão Fusilli', unit: 'un' },
          { name: 'Maionese Hellmans', unit: 'un' },
          { name: 'Maisena (Amido de Milho)', unit: 'un' },
          { name: 'Mel', unit: 'un' },
          { name: 'Milho Verde Conserva', unit: 'un' },
          { name: 'Molho Inglês', unit: 'un' },
          { name: 'Mostarda Amarela', unit: 'un' },
          { name: 'Óleo de Algodão', unit: 'lt' },
          { name: 'Pepino Conserva (Picles)', unit: 'un' },
          { name: 'Pimenta Clientes', unit: 'un' },
          { name: 'Pimenta do Reino', unit: 'un' },
          { name: 'Pupunha Laminada (Lasanha)', unit: 'un' },
          { name: 'Sal', unit: 'un' },
          { name: 'Shoyu Light', unit: 'un' },
          { name: 'Tapioca Granulada', unit: 'un' },
          { name: 'Tomate Pelado', unit: 'un' },
          { name: 'Tomate Seco', unit: 'un' },
          { name: 'Tortilha de Wrap', unit: 'un' },
          { name: 'Vinagre Balsâmico', unit: 'un' },
          { name: 'Vinagre de Vinho Tinto', unit: 'un' },
        ]
      },
      {
        group: 'Grãos e Sementes',
        items: [
          { name: 'Amêndoas Laminadas', unit: 'un' },
          { name: 'Chia', unit: 'un' },
          { name: 'Edamame', unit: 'un' },
          { name: 'Ervas Finas', unit: 'un' },
          { name: 'Farinha de Linhaça', unit: 'un' },
          { name: 'Lemon Pepper', unit: 'un' },
          { name: 'Louro', unit: 'un' },
          { name: 'Mix Gergelim', unit: 'un' },
          { name: 'Nozes', unit: 'un' },
          { name: 'Orégano', unit: 'un' },
          { name: 'Páprica Defumada', unit: 'un' },
          { name: 'Pimenta Preta em Pó', unit: 'un' },
          { name: 'Semente de Girassol', unit: 'un' },
          { name: 'Semente de Linhaça', unit: 'un' },
        ]
      },
      {
        group: 'Laticínios',
        items: [
          { name: 'Iogurte Natural', unit: 'un' },
          { name: 'Leite Desnatado', unit: 'lt' },
          { name: 'Manteiga Sem Sal', unit: 'un' },
          { name: 'Muçarela Búfala', unit: 'un' },
          { name: 'Queijo Muçarela', unit: 'un' },
          { name: 'Queijo Parmesão', unit: 'un' },
          { name: 'Requeijão Light', unit: 'un' },
          { name: 'Ricota (Lasanha)', unit: 'un' },
        ]
      },
      {
        group: 'Proteínas',
        items: [
          { name: 'Bacon Cubos', unit: 'kg' },
          { name: 'Bacon Manta Feijoada', unit: 'kg' },
          { name: 'Calabresa', unit: 'kg' },
          { name: 'Carne Moída', unit: 'kg' },
          { name: 'Cogumelos', unit: 'kg' },
          { name: 'Costelinha', unit: 'kg' },
          { name: 'Mignon Cubos', unit: 'kg' },
          { name: 'Mignon Tiras', unit: 'kg' },
          { name: 'Peito de Frango', unit: 'kg' },
          { name: 'Peito de Peru', unit: 'kg' },
          { name: 'Posta Branca', unit: 'kg' },
          { name: 'Presunto Parma', unit: 'kg' },
        ]
      },
      {
        group: 'Pães',
        items: [
          { name: 'Pão Integral Charlotte', unit: 'un' },
        ]
      }
    ]
  },
  {
    key: 'PRODUCAO',
    label: 'PRODUÇÃO',
    groups: [
      {
        group: 'Itens Produzidos',
        items: [
          { name: 'Abobrinha do Balcão de Saladas', unit: 'un' },
          { name: 'Arroz Integral Cozido', unit: 'un' },
          { name: 'Bacon ao Forno', unit: 'un' },
          { name: 'Base Creme Abóbora (porções 0,350g)', unit: 'porção' },
          { name: 'Base Creme Mandioca (porções 0,350g)', unit: 'porção' },
          { name: 'Batata Chips - Frita', unit: 'un' },
          { name: 'Batata Palha - Frita', unit: 'un' },
          { name: 'Cebolinha Picada', unit: 'un' },
          { name: 'Cogumelos Fatiados', unit: 'un' },
          { name: 'Cogumelos Grelhados', unit: 'un' },
          { name: 'Couve Branqueada Wrap', unit: 'un' },
          { name: 'Couve Flor Triturada/Porcionada', unit: 'porção' },
          { name: 'Couve Refogada Feijoada', unit: 'un' },
          { name: 'Coxinha Massa', unit: 'un' },
          { name: 'Croutons', unit: 'un' },
          { name: 'Farofa Brasileirinho (porções 0,030g)', unit: 'porção' },
          { name: 'Farofa de Cebola Feijoada', unit: 'un' },
          { name: 'Feijão Temperado', unit: 'un' },
          { name: 'Feijoadinha', unit: 'un' },
          { name: 'Frango Desfiado', unit: 'un' },
          { name: 'Frango Desfiado Porcionado 30g', unit: 'porção' },
          { name: 'Frango em Cubos (Puxado)', unit: 'un' },
          { name: 'Frango Cru em Cubos', unit: 'un' },
          { name: 'Geléia de Pimenta (porções 0,030g)', unit: 'porção' },
          { name: 'Guacamole', unit: 'un' },
          { name: 'Lasanha Bolonhesa', unit: 'un' },
          { name: 'Lasanha Vegetariana', unit: 'un' },
          { name: 'Legumes Brasileirinho Fatiados', unit: 'un' },
          { name: 'Legumes Brasileirinho Grelhados', unit: 'un' },
          { name: 'Mignon em Cubos 120g', unit: 'porção' },
          { name: 'Mignon em Cubos 90g', unit: 'porção' },
          { name: 'Mix de Sementes e Amêndoas', unit: 'un' },
          { name: 'Mix de Spaghetti', unit: 'un' },
          { name: 'Molho Balsâmico Mostarda e Mel', unit: 'un' },
          { name: 'Molho Golf', unit: 'un' },
          { name: 'Molho Mostarda e Mel', unit: 'un' },
          { name: 'Molho Pesto', unit: 'un' },
          { name: 'Molho Pomodoro', unit: 'un' },
          { name: 'Molho Ranch', unit: 'un' },
          { name: 'Palitinho de Tapioca (6un / 0,025g)', unit: 'porção' },
          { name: 'Patê Pronto Sanduíche Natural', unit: 'un' },
          { name: 'Parmegiana Congelado Pré-Assado', unit: 'un' },
          { name: 'Parmegiana Pré-Assado', unit: 'un' },
          { name: 'Posta Desfiada Porcionada 0,030g', unit: 'porção' },
          { name: 'Pupunha Branqueada p/ Saladas (0,020g)', unit: 'porção' },
          { name: 'Queijo Parmesão Ralado (0,020g)', unit: 'porção' },
          { name: 'Salada Colorida Strogonoff Delivery', unit: 'un' },
          { name: 'Strogonoff de Frango Pré-Pronto (0,170g)', unit: 'porção' },
          { name: 'Strogonoff de Mignon Pré-Pronto (0,170g)', unit: 'porção' },
          { name: 'Tempero All', unit: 'un' },
          { name: 'Tilápia na Farinha para Congelar', unit: 'un' },
          { name: 'Tortilla Crocante e Picada', unit: 'un' },
          { name: 'Tortinha Frango c/ Legumes Congelada', unit: 'un' },
          { name: 'Tortinha Legumes Congelada', unit: 'un' },
          { name: 'Vinagrete', unit: 'un' },
        ]
      }
    ]
  },
  {
    key: 'DESCARTAVEIS',
    label: 'DESCART.',
    groups: [
      {
        group: 'Descartáveis e Embalagens',
        items: [
          { name: 'Adesivo Cenoura', unit: 'un' },
          { name: 'Bobina de Impressora Térmica', unit: 'un' },
          { name: 'Bobina de Seladora', unit: 'un' },
          { name: 'Bobina Máquina de Cartão', unit: 'un' },
          { name: 'Bobina Plástica Grande 7kg', unit: 'un' },
          { name: 'Bobina Plástica Média 5kg', unit: 'un' },
          { name: 'Bobina Plástica Pequena 2kg', unit: 'un' },
          { name: 'Canudos de Papel', unit: 'un' },
          { name: 'Cartão Fidelidade', unit: 'un' },
          { name: 'Colher Descartável', unit: 'pct' },
          { name: 'Copo Papel Descartável', unit: 'un' },
          { name: 'Durex', unit: 'un' },
          { name: 'Embalagem 3 Divisórias', unit: 'un' },
          { name: 'Embalagem Retangular', unit: 'un' },
          { name: 'Etiqueta Validade', unit: 'rolo' },
          { name: 'Flyer Cardápio', unit: 'un' },
          { name: 'Folha Enrolar Wrap', unit: 'un' },
          { name: 'Grampo Grampeador', unit: 'cx' },
          { name: 'Guardanapos', unit: 'pct' },
          { name: 'Lacre de Delivery', unit: 'un' },
          { name: 'Limpa Alumínio', unit: 'un' },
          { name: 'Limpa Forno', unit: 'un' },
          { name: 'Palito de Dente', unit: 'cx' },
          { name: 'Pano de Chão', unit: 'un' },
          { name: 'Papel Interfolhado (Dispenser)', unit: 'pct' },
          { name: 'Perfex', unit: 'un' },
          { name: 'Pilha', unit: 'un' },
          { name: 'Pote de Caldo', unit: 'un' },
          { name: 'Pote Molho Salada', unit: 'un' },
          { name: 'Pote Proteína', unit: 'un' },
          { name: 'Rolo de Papel', unit: 'un' },
          { name: 'Rolo de Papel Toalha', unit: 'un' },
          { name: 'Rolo de Plástico Filme Grande', unit: 'un' },
          { name: 'Saco de Snacks', unit: 'un' },
          { name: 'Saco para Talher', unit: 'pct' },
          { name: 'Sacola de Delivery', unit: 'un' },
          { name: 'Sacola Plástica (Sobremesas/Sucos)', unit: 'un' },
          { name: 'Sal Sachê', unit: 'cx' },
          { name: 'Saladeira', unit: 'un' },
          { name: 'Saquinho para Croutons de Farofa', unit: 'un' },
          { name: 'Talher Descartável', unit: 'pct' },
          { name: 'Tampa Proteína', unit: 'un' },
          { name: 'Touca Descartável', unit: 'cx' },
        ]
      }
    ]
  },
  {
    key: 'LIMPEZA',
    label: 'LIMPEZA',
    groups: [
      {
        group: 'Produtos de Limpeza',
        items: [
          { name: 'Água Sanitária QBOA', unit: 'lt' },
          { name: 'Álcool Líquido', unit: 'lt' },
          { name: 'Desinfetante', unit: 'lt' },
          { name: 'Detergente', unit: 'un' },
          { name: 'Esponja de Louça', unit: 'un' },
          { name: 'Esponja Grossa (Fibração)', unit: 'un' },
          { name: 'Luva Descartável Plástico', unit: 'cx' },
          { name: 'Palha de Aço', unit: 'un' },
          { name: 'Rodo', unit: 'un' },
          { name: 'Sabonete Líquido', unit: 'lt' },
          { name: 'Saco de Lixo Azul', unit: 'pct' },
          { name: 'Saco de Lixo Preto', unit: 'pct' },
          { name: 'Vassoura', unit: 'un' },
        ]
      }
    ]
  },
  {
    key: 'UNIFORMES',
    label: 'UNIF.',
    groups: [
      {
        group: 'Balcão',
        items: [
          { name: 'Avental (Balcão)', unit: 'un' },
          { name: 'Avental Gerência', unit: 'un' },
          { name: 'Calça Jeans G', unit: 'un' },
          { name: 'Calça Jeans GG', unit: 'un' },
          { name: 'Calça Jeans M', unit: 'un' },
          { name: 'Calça Jeans P', unit: 'un' },
          { name: 'Camiseta Preta G', unit: 'un' },
          { name: 'Camiseta Preta GG', unit: 'un' },
          { name: 'Camiseta Preta M', unit: 'un' },
          { name: 'Camiseta Preta P', unit: 'un' },
          { name: 'Polo Gerência', unit: 'un' },
          { name: 'Touca Jeans', unit: 'un' },
        ]
      },
      {
        group: 'Cozinha',
        items: [
          { name: 'Avental Jeans (Cozinha)', unit: 'un' },
          { name: 'Avental Branco (Plástico)', unit: 'un' },
          { name: 'Calça Xadrez G', unit: 'un' },
          { name: 'Calça Xadrez GG', unit: 'un' },
          { name: 'Calça Xadrez M', unit: 'un' },
          { name: 'Calça Xadrez P', unit: 'un' },
          { name: 'Camiseta Branca G', unit: 'un' },
          { name: 'Camiseta Branca GG', unit: 'un' },
          { name: 'Camiseta Branca M', unit: 'un' },
          { name: 'Camiseta Branca P', unit: 'un' },
          { name: 'Crocs (Sapato de Borracha Preto)', unit: 'par' },
          { name: 'Dólmã', unit: 'un' },
          { name: 'Touca Xadrez', unit: 'un' },
        ]
      }
    ]
  },
  {
    key: 'CMV',
    label: 'CMV',
    groups: []
  },
  {
    key: 'RESUMO',
    label: 'RESUMO',
    groups: []
  }
];

// SECTIONS é a versão aplicada da unidade (base + customizações)
let SECTIONS = BASE_SECTIONS.slice();

// ── Estado ────────────────────────────────────────────────────
let state = {
  semana: 1,
  mesAtual: null, // 'YYYY-MM' — mês do ciclo atual
  data: {},       // { HORTI: { semana_1: { 'Alface': { i: 5, e: 3, f: 2 } } } }
  cotacoes: {},   // { q1: { HORTI: { 'Alface': 4.50 } }, q2: { ... } }
  cmv: {}         // { semana_1: { faturamento: 100000, meta_pct: 30, notas: [] } }
};

// ── Calendário de semanas ─────────────────────────────────────
// ── Semanas ISO (Segunda a Domingo) ──────────────────────────
function getISOWeekNum(d) {
  const date = new Date(d);
  date.setHours(0,0,0,0);
  date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
  const week1 = new Date(date.getFullYear(), 0, 4);
  return 1 + Math.round(((date - week1) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
}

function getWeekKey(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay() || 7;
  d.setDate(d.getDate() - day + 1); // vai para segunda-feira
  return `${d.getFullYear()}-W${String(getISOWeekNum(d)).padStart(2, '0')}`;
}

function getWeekMonday(weekKey) {
  const [yr, wStr] = weekKey.split('-W');
  const week = parseInt(wStr);
  const jan4 = new Date(parseInt(yr), 0, 4);
  const jan4Day = jan4.getDay() || 7;
  const week1Mon = new Date(jan4 - (jan4Day - 1) * 86400000);
  return new Date(week1Mon.getTime() + (week - 1) * 7 * 86400000);
}

function getWeekLabel(weekKey) {
  const mon = getWeekMonday(weekKey);
  const sun = new Date(mon.getTime() + 6 * 86400000);
  const f = d => d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' }).replace('.', '');
  return `${f(mon)} – ${f(sun)}`;
}

function prevWeek() {
  const mon = getWeekMonday(state.semana);
  mon.setDate(mon.getDate() - 7);
  switchWeek(getWeekKey(mon));
}

function nextWeek() {
  const mon = getWeekMonday(state.semana);
  mon.setDate(mon.getDate() + 7);
  switchWeek(getWeekKey(mon));
}

// ── Helpers de cotação ────────────────────────────────────────
function getQuinzena(semana) {
  if (typeof semana === 'string' && semana.includes('-W')) {
    return parseInt(semana.split('-W')[1]) % 2 === 0 ? 'q2' : 'q1';
  }
  return semana <= 2 ? 'q1' : 'q2';
}
function getRefSemana(semana)     { return semana <= 2 ? 1 : 3; }
function isCotacaoRequired(semana){ return false; }

function getItemPrice(sectionKey, itemName) {
  const q = getQuinzena(state.semana);
  return (((state.cotacoes || {})[q] || {})[sectionKey] || {})[itemName];
}

function getLastPrice(sectionKey, itemName) {
  const cotacoes = state.cotacoes || {};
  const q        = getQuinzena(state.semana);
  const other    = q === 'q1' ? 'q2' : 'q1';
  const cur  = ((cotacoes[q]     || {})[sectionKey] || {})[itemName];
  const prev = ((cotacoes[other] || {})[sectionKey] || {})[itemName];
  // Retorna o mais recente disponível
  return cur !== undefined ? cur : prev;
}

function getPriceVariationPct(sectionKey, itemName) {
  const cotacoes = state.cotacoes || {};
  const q        = getQuinzena(state.semana);
  const other    = q === 'q1' ? 'q2' : 'q1';
  const cur  = ((cotacoes[q]     || {})[sectionKey] || {})[itemName];
  const prev = ((cotacoes[other] || {})[sectionKey] || {})[itemName];
  if (cur === undefined || prev === undefined || prev === 0) return null;
  return ((cur - prev) / prev) * 100;
}

let saveTimer = null;

// ── Inicialização ─────────────────────────────────────────────
async function init() {
  const unitNameEl = document.getElementById('invUnitName');
  if (unitNameEl) unitNameEl.textContent = UNIT_NAME;

  if (IS_ADMIN) {
    const logoutBtn = document.getElementById('invLogoutBtn');
    if (logoutBtn) logoutBtn.style.display = 'inline-flex';
  }

  loadState();
  updateCloudStatus('sync');
  await Promise.all([loadGeminiKey(), loadPins(), loadLinhas()]);

  await loadUnitConfig();
  applyUnitConfig();

  // Garante semana ISO válida; migra formato antigo (1/2/3/4)
  if (!state.semana || !/^\d{4}-W\d{2}$/.test(state.semana)) {
    state.semana = getWeekKey(); // semana atual (segunda-feira desta semana)
  }

  buildTabs();
  buildSections();
  updateAllBadges();
  updateWeekNav();
  await loadFromCloud();
  // Corrige semana novamente caso cloud tenha sobrescrito com formato antigo
  if (!state.semana || !/^\d{4}-W\d{2}$/.test(String(state.semana))) {
    state.semana = getWeekKey();
  }
  updateWeekNav();
  switchView('dashboard');
}

// ── Views (bottom nav) ────────────────────────────────────────

function switchView(view) {
  document.querySelectorAll('.app-nav-item').forEach(btn =>
    btn.classList.toggle('active', btn.dataset.view === view));

  ['dashboard','contagem','cmv','config'].forEach(v => {
    const el = document.getElementById('view-' + v);
    if (el) el.style.display = v === view ? '' : 'none';
  });

  // Tabs de seção e barra de pesquisa só na contagem
  const invTabs   = document.getElementById('invTabs');
  const searchBar = document.querySelector('.inv-search-bar');
  if (invTabs)   invTabs.style.display   = view === 'contagem' ? '' : 'none';
  if (searchBar) searchBar.style.display = view === 'contagem' ? '' : 'none';

  if (view === 'dashboard') renderDashboard();
  if (view === 'cmv')       renderCMVPanel();
  if (view === 'config')    renderConfigView();
}

function renderDashboard() {
  const el = document.getElementById('dashboardContent');
  if (!el) return;

  const d     = getCMVData();
  const fat   = d.faturamento;
  const notas = d.notas || [];
  const total = notas.reduce((s, n) => s + (n.valor || 0), 0);
  const pct   = d.meta_pct || 30;
  const cmvReal = fat > 0 ? total / fat * 100 : null;
  const meta    = fat ? fat * pct / 100 : null;
  const saldo   = meta !== null ? meta - total : null;
  const barColor = cmvReal == null ? '#9ca3af'
    : cmvReal > pct * 1.1 ? '#ef4444'
    : cmvReal > pct       ? '#f59e0b' : '#22c55e';

  const hoje = new Date();
  const mesAtualNum = hoje.getFullYear() * 100 + (hoje.getMonth() + 1);
  let gastoYTD = 0, fatYTD = 0;
  Object.entries(state.cmv || {}).forEach(([key, dw]) => {
    if (!/^\d{4}-W\d{2}$/.test(key)) return;
    const mon = getWeekMonday(key);
    if (mon.getFullYear() * 100 + (mon.getMonth() + 1) !== mesAtualNum) return;
    gastoYTD += (dw.notas || []).reduce((s, n) => s + (n.valor || 0), 0);
    if (dw.faturamento > 0) fatYTD += dw.faturamento;
  });
  const cmvYTD  = fatYTD > 0 ? gastoYTD / fatYTD * 100 : null;
  const ytdColor = cmvYTD == null ? '#9ca3af'
    : cmvYTD > pct * 1.1 ? '#ef4444'
    : cmvYTD > pct       ? '#f59e0b' : '#22c55e';

  const allNotas = Object.values(state.cmv || {}).flatMap(d => d?.notas || []);
  const lastNota = allNotas.length
    ? allNotas[allNotas.length - 1].data || '—' : '—';
  const lastCount = state.lastCountDate
    ? new Date(state.lastCountDate).toLocaleDateString('pt-BR') : '—';

  el.innerHTML = `
    <div class="dash-header">
      <div class="dash-unit">${UNIT_NAME}</div>
      <div class="dash-week">${getWeekLabel(state.semana)}</div>
    </div>
    <div class="dash-kpis">
      <div class="dash-kpi">
        <span class="dash-kpi-label">CMV semana</span>
        <span class="dash-kpi-val" style="color:${barColor}">${cmvReal != null ? cmvReal.toFixed(1) + '%' : '—'}</span>
        <span class="dash-kpi-sub">meta ${pct}%</span>
      </div>
      <div class="dash-kpi">
        <span class="dash-kpi-label">CMV mês</span>
        <span class="dash-kpi-val" style="color:${ytdColor}">${cmvYTD != null ? cmvYTD.toFixed(1) + '%' : '—'}</span>
        <span class="dash-kpi-sub">R$ ${fmt(gastoYTD)}</span>
      </div>
    </div>
    <div class="dash-metrics">
      <div class="dash-metric">
        <span class="dash-metric-label">Gasto semana</span>
        <span class="dash-metric-val">R$ ${fmt(total)}</span>
      </div>
      <div class="dash-metric">
        <span class="dash-metric-label">Faturamento</span>
        <span class="dash-metric-val">${fat ? 'R$ ' + fmt(fat) : '—'}</span>
      </div>
      <div class="dash-metric">
        <span class="dash-metric-label">${saldo != null ? (saldo >= 0 ? 'Saldo' : 'Excesso') : 'Meta gasto'}</span>
        <span class="dash-metric-val" style="color:${saldo != null ? (saldo >= 0 ? '#16a34a' : '#dc2626') : 'inherit'}">
          ${saldo != null ? (saldo >= 0 ? '' : '−') + 'R$ ' + fmt(Math.abs(saldo)) : meta ? 'R$ ' + fmt(meta) : '—'}
        </span>
      </div>
      <div class="dash-metric">
        <span class="dash-metric-label">Última nota</span>
        <span class="dash-metric-val">${lastNota}</span>
      </div>
      <div class="dash-metric">
        <span class="dash-metric-label">Última contagem</span>
        <span class="dash-metric-val">${lastCount}</span>
      </div>
      <div class="dash-metric dash-metric-action" onclick="switchView('cmv')">
        <span class="dash-metric-label">Notas semana</span>
        <span class="dash-metric-val">${notas.length} nota${notas.length !== 1 ? 's' : ''} →</span>
      </div>
    </div>
  `;
}

function renderConfigView() {
  const el = document.getElementById('configViewContent');
  if (!el) return;
  if (!IS_ADMIN) {
    el.innerHTML = '<p style="padding:40px 24px;text-align:center;color:#9ca3af;font-size:15px">Apenas administradores têm acesso às configurações.</p>';
    return;
  }
  el.innerHTML = `
    <div class="config-view">
      <div class="config-section-title">Conta</div>
      <button class="config-btn" onclick="openTrocarPin()">👤 Trocar meu PIN</button>
      <div class="config-section-title" style="margin-top:20px">CMV</div>
      <button class="config-btn" onclick="openCMVConfig()">⚙️ Faturamento e Meta CMV</button>
      <button class="config-btn" onclick="openLinhas()">📦 Linhas de produto</button>
      <div class="config-section-title" style="margin-top:20px">Integrações</div>
      <button class="config-btn" onclick="openGeminiKeyModal()">🔑 Chave Gemini (IA)</button>
      <div class="config-section-title" style="margin-top:20px"></div>
      <button class="config-btn config-btn-danger" onclick="logout()">↩ Sair</button>
    </div>
  `;
}

// ── Persistência ──────────────────────────────────────────────
function loadState() {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      state = parsed;
    }
  } catch (e) { /* ignore */ }
}

function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(doSave, 300);
}

function doSave() {
  state.lastSaved = new Date().toISOString();
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(state));
    updateSavedLabel();
    showToast('Salvo ✓');
    scheduleCloudSync(); // sincroniza com a nuvem após salvar
  } catch (e) { /* ignore */ }
}

function updateSavedLabel() {
  const el = document.getElementById('invSaved');
  if (!el) return;
  if (state.lastSaved) {
    const d = new Date(state.lastSaved);
    el.textContent = 'Salvo ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }
}

// ── Construção de tabs ────────────────────────────────────────
function buildTabs() {
  const nav = document.getElementById('invTabs');
  nav.innerHTML = SECTIONS.filter(s => s.key !== 'CMV').map(s => `
    <button class="inv-tab" data-key="${s.key}" onclick="switchTab('${s.key}')">
      ${s.label}
      ${s.key !== 'RESUMO' ? `<span class="inv-tab-badge" id="badge_${s.key}">0</span>` : ''}
    </button>
  `).join('');
}

// ── Construção de seções ──────────────────────────────────────
function buildSections() {
  const main = document.getElementById('view-contagem');
  let html = '';

  for (const section of SECTIONS) {
    if (section.key === 'RESUMO') {
      html += `<div class="inv-section" id="sec_RESUMO"><div id="resumoContent"></div></div>`;
      continue;
    }
    if (section.key === 'CMV') continue;

    let groupsHtml = '';
    for (const g of section.groups) {
      groupsHtml += `<p class="inv-section-title">${g.group}</p>`;
      for (const item of g.items) {
        const id = makeId(section.key, item.name);
        groupsHtml += itemCard(section.key, item, id);
      }
      if (IS_ADMIN) {
        groupsHtml += `<button class="inv-add-item-btn" data-section="${escHtml(section.key)}" data-group="${escHtml(g.group)}" onclick="openAddItemFromBtn(this)">+ Incluir insumo em ${escHtml(g.group)}</button>`;
      }
    }

    html += `<div class="inv-section" id="sec_${section.key}">${groupsHtml}</div>`;
  }

  main.innerHTML = html;

  // Restore saved values
  restoreValues();
  updateSavedLabel();
}

function itemCard(sectionKey, item, id) {
  const adminControls = IS_ADMIN ? `
    <div class="inv-item-admin-btns">
      <button class="inv-item-btn-del" data-section="${escHtml(sectionKey)}" data-name="${escHtml(item.name)}"
              onclick="deleteItemFromCard(this)" title="Remover insumo">🗑</button>
    </div>` : '';

  return `
    <div class="inv-item" id="card_${id}">
      <div class="inv-item-header">
        <div class="inv-item-name">
          ${escHtml(item.name)}
          <span class="inv-item-unit">${escHtml(item.unit)}</span>
        </div>
        ${adminControls}
      </div>

      <!-- Preço — último valor pago + variação -->
      <div class="inv-preco-row-simple">
        <span class="inv-preco-label">Preço</span>
        <span class="inv-preco-prefix-simple">R$</span>
        <input class="inv-preco-input-simple" type="number" inputmode="decimal"
               min="0" step="0.01" id="p_${id}" placeholder="—"
               oninput="onPriceChange('${sectionKey}','${escHtml(item.name)}',this.value)">
        <span class="inv-preco-unit-label">/ ${escHtml(item.unit)}</span>
        <span class="inv-preco-hint" id="hint_${id}"></span>
        <span class="inv-preco-var" id="var_${id}"></span>
      </div>

      <!-- Campos de contagem -->
      <div class="inv-fields">
        <div class="inv-field">
          <label>Inicial</label>
          <input type="number" inputmode="decimal" min="0" step="any"
                 id="i_${id}" placeholder="—"
                 oninput="onFieldChange('${sectionKey}','${escHtml(item.name)}','i',this.value)">
        </div>
        <div class="inv-field entrada">
          <label>Entradas</label>
          <input type="number" inputmode="decimal" min="0" step="any"
                 id="e_${id}" placeholder="—"
                 oninput="onFieldChange('${sectionKey}','${escHtml(item.name)}','e',this.value)">
        </div>
        <div class="inv-field">
          <label>Final</label>
          <input type="number" inputmode="decimal" min="0" step="any"
                 id="f_${id}" placeholder="—"
                 oninput="onFieldChange('${sectionKey}','${escHtml(item.name)}','f',this.value)">
        </div>
      </div>
      <div class="inv-consumo">
        <span class="inv-consumo-label">Consumo:</span>
        <span class="inv-consumo-value zero" id="c_${id}">—</span>
        <span style="font-size:10px;color:#aaa;margin-left:4px" id="cf_${id}"></span>
        <span style="font-size:11px;font-weight:600;color:#D97706;margin-left:8px" id="custo_${id}"></span>
      </div>
    </div>`;
}

function restoreValues() {
  for (const section of SECTIONS) {
    if (section.key === 'RESUMO') continue;
    const weekKey = state.semana;
    const sData = (state.data[section.key] || {})[weekKey] || {};

    for (const g of section.groups) {
      for (const item of g.items) {
        const id = makeId(section.key, item.name);
        const saved = sData[item.name] || {};

        const iEl  = document.getElementById('i_' + id);
        const eEl  = document.getElementById('e_' + id);
        const fEl  = document.getElementById('f_' + id);
        const pEl  = document.getElementById('p_' + id);
        if (iEl && saved.i !== undefined) iEl.value = saved.i;
        if (eEl && saved.e !== undefined) eEl.value = saved.e;
        if (fEl && saved.f !== undefined) fEl.value = saved.f;

        // Restaurar preço da quinzena atual
        const price = getItemPrice(section.key, item.name);
        if (pEl && price !== undefined) pEl.value = price;

        // Último valor pago (outra quinzena) como hint
        updatePriceHint(section.key, item.name, id);

        updateCotacaoBadge(id);
        updateLockState(section.key, item.name, id);
        updateConsumption(id);
        updateCardFilled(id);
      }
    }
  }
}

// ── Mudança de campo ──────────────────────────────────────────
function onFieldChange(sectionKey, itemName, field, rawValue) {
  const weekKey = state.semana;
  if (!state.data[sectionKey]) state.data[sectionKey] = {};
  if (!state.data[sectionKey][weekKey]) state.data[sectionKey][weekKey] = {};
  if (!state.data[sectionKey][weekKey][itemName]) state.data[sectionKey][weekKey][itemName] = {};

  const val = rawValue === '' ? undefined : parseFloat(rawValue);
  if (val === undefined) {
    delete state.data[sectionKey][weekKey][itemName][field];
  } else {
    state.data[sectionKey][weekKey][itemName][field] = val;
  }

  state.lastCountDate = new Date().toISOString();
  const id = makeId(sectionKey, itemName);
  updateConsumption(id);
  updateCardFilled(id);
  updateBadge(sectionKey);
  scheduleSave();
}

// ── Cotação de preço ──────────────────────────────────────────
function onPriceChange(sectionKey, itemName, rawValue) {
  const q = getQuinzena(state.semana);
  if (!state.cotacoes)            state.cotacoes = {};
  if (!state.cotacoes[q])         state.cotacoes[q] = {};
  if (!state.cotacoes[q][sectionKey]) state.cotacoes[q][sectionKey] = {};

  const val = rawValue === '' ? undefined : parseFloat(rawValue);
  if (val === undefined) {
    delete state.cotacoes[q][sectionKey][itemName];
  } else {
    state.cotacoes[q][sectionKey][itemName] = val;
  }

  const id = makeId(sectionKey, itemName);
  updateLockState(sectionKey, itemName, id);
  updatePriceHint(sectionKey, itemName, id);
  updateConsumption(id);
  scheduleSave();
}

function updatePriceHint(sectionKey, itemName, id) {
  const hintEl = document.getElementById('hint_' + id);
  const varEl  = document.getElementById('var_' + id);
  if (!hintEl) return;

  const cotacoes = state.cotacoes || {};
  const q        = getQuinzena(state.semana);
  const other    = q === 'q1' ? 'q2' : 'q1';
  const cur  = ((cotacoes[q]     || {})[sectionKey] || {})[itemName];
  const prev = ((cotacoes[other] || {})[sectionKey] || {})[itemName];

  // Hint: mostra preço da outra quinzena se não há preço atual
  if (cur === undefined && prev !== undefined) {
    hintEl.textContent = `Últ: R$ ${prev.toFixed(2).replace('.',',')}`;
    hintEl.style.display = 'inline';
  } else {
    hintEl.textContent = '';
    hintEl.style.display = 'none';
  }

  // Variação de preço
  if (varEl) {
    if (cur !== undefined && prev !== undefined && prev > 0) {
      const pct = ((cur - prev) / prev) * 100;
      if (Math.abs(pct) >= 10) {
        const up   = pct > 0;
        varEl.textContent = `${up ? '▲' : '▼'} ${Math.abs(pct).toFixed(0)}%`;
        varEl.className   = 'inv-preco-var ' + (up ? 'up' : 'down');
        varEl.style.display = 'inline';
      } else {
        varEl.textContent   = '';
        varEl.style.display = 'none';
      }
    } else {
      varEl.textContent   = '';
      varEl.style.display = 'none';
    }
  }
}

function updateLockState(sectionKey, itemName, id) {
  // cotação não é mais obrigatória — nunca bloqueia
  const card = document.getElementById('card_' + id);
  if (card) card.classList.remove('locked');
  ['i_', 'e_', 'f_'].forEach(prefix => {
    const el = document.getElementById(prefix + id);
    if (el) el.disabled = false;
  });
}

function updateCotacaoBadge(id) {
  // sem badge obrigatório — nada a fazer
}

function updateConsumption(id) {
  const iEl = document.getElementById('i_' + id);
  const eEl = document.getElementById('e_' + id);
  const fEl = document.getElementById('f_' + id);
  const cEl = document.getElementById('c_' + id);
  const cfEl = document.getElementById('cf_' + id);
  if (!iEl || !fEl || !cEl) return;

  const i = iEl.value !== '' ? parseFloat(iEl.value) : null;
  const e = eEl && eEl.value !== '' ? parseFloat(eEl.value) : 0;
  const f = fEl.value !== '' ? parseFloat(fEl.value) : null;

  const custoEl = document.getElementById('custo_' + id);

  if (i === null || f === null) {
    cEl.textContent = '—';
    cEl.className = 'inv-consumo-value zero';
    if (cfEl)   cfEl.textContent = '';
    if (custoEl) custoEl.textContent = '';
    return;
  }

  // Consumo = Inicial + Entradas - Final
  const c = i + e - f;
  if (cfEl) cfEl.textContent = e > 0 ? `(${formatNum(i)}+${formatNum(e)}−${formatNum(f)})` : '';

  if (c > 0) {
    cEl.textContent = formatNum(c);
    cEl.className = 'inv-consumo-value positive';
  } else if (c < 0) {
    cEl.textContent = formatNum(c);
    cEl.className = 'inv-consumo-value negative';
  } else {
    cEl.textContent = '0';
    cEl.className = 'inv-consumo-value zero';
  }

  // Custo estimado = consumo × preço
  if (custoEl) {
    const pEl = document.getElementById('p_' + id);
    const price = pEl && pEl.value !== '' ? parseFloat(pEl.value) : null;
    if (price !== null && c > 0) {
      custoEl.textContent = '≈ R$ ' + (c * price).toFixed(2).replace('.', ',');
    } else {
      custoEl.textContent = '';
    }
  }
}

function updateCardFilled(id) {
  const card = document.getElementById('card_' + id);
  if (!card) return;
  const iEl = document.getElementById('i_' + id);
  const fEl = document.getElementById('f_' + id);
  // Entradas é opcional — card preenchido se tiver Inicial e Final
  const filled = iEl && fEl && iEl.value !== '' && fEl.value !== '';
  card.classList.toggle('filled', filled);
}

// ── Badges ────────────────────────────────────────────────────
function updateBadge(sectionKey) {
  const section = SECTIONS.find(s => s.key === sectionKey);
  if (!section || section.key === 'RESUMO') return;

  const weekKey = state.semana;
  const sData = (state.data[sectionKey] || {})[weekKey] || {};

  let filled = 0, total = 0;
  for (const g of section.groups) {
    for (const item of g.items) {
      total++;
      const d = sData[item.name] || {};
      if (d.i !== undefined && d.f !== undefined) filled++;
    }
  }

  const badge = document.getElementById('badge_' + sectionKey);
  if (badge) badge.textContent = `${filled}/${total}`;
}

function updateAllBadges() {
  for (const s of SECTIONS) {
    if (s.key !== 'RESUMO') updateBadge(s.key);
  }
}

// ── Navegação de abas ─────────────────────────────────────────
function filterInventory(q) {
  const query = q.toLowerCase().trim();
  const clearBtn = document.getElementById('invSearchClear');
  if (clearBtn) clearBtn.style.display = query ? 'block' : 'none';

  document.querySelectorAll('#view-contagem .inv-item').forEach(card => {
    const name = (card.querySelector('.inv-item-name')?.textContent || '').toLowerCase();
    card.style.display = (!query || name.includes(query)) ? '' : 'none';
  });

  // Mostra/esconde títulos de grupo sem itens visíveis
  document.querySelectorAll('#view-contagem .inv-section').forEach(sec => {
    sec.querySelectorAll('.inv-section-title').forEach(title => {
      if (!query) { title.style.display = ''; return; }
      let sib = title.nextElementSibling;
      let hasVisible = false;
      while (sib && !sib.classList.contains('inv-section-title')) {
        if (sib.classList.contains('inv-item') && sib.style.display !== 'none') hasVisible = true;
        sib = sib.nextElementSibling;
      }
      title.style.display = hasVisible ? '' : 'none';
    });
  });

  // Se pesquisando, mostra todas as sections; se não, volta à tab ativa
  if (query) {
    document.querySelectorAll('#view-contagem .inv-section').forEach(s => {
      if (s.id !== 'sec_CMV' && s.id !== 'sec_RESUMO') s.classList.add('active');
    });
  } else {
    const activeTab = document.querySelector('.inv-tab.active');
    if (activeTab) switchTab(activeTab.dataset.key);
  }
}

function clearInventorySearch() {
  const inp = document.getElementById('invSearch');
  if (inp) { inp.value = ''; filterInventory(''); inp.focus(); }
}

function switchTab(key) {
  // Limpa pesquisa ao trocar de tab
  const inp = document.getElementById('invSearch');
  if (inp && inp.value) { inp.value = ''; filterInventory(''); }

  document.querySelectorAll('.inv-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.key === key);
  });
  document.querySelectorAll('.inv-section').forEach(s => {
    s.classList.toggle('active', s.id === 'sec_' + key);
  });

  if (key === 'RESUMO') {
    document.getElementById('invOverlay').classList.add('open');
    document.getElementById('invPin').value = '';
    document.getElementById('invPin').classList.remove('error');
    setTimeout(() => document.getElementById('invPin').focus(), 100);
  }
}

// ── Semana ────────────────────────────────────────────────────
function switchWeek(weekKey) {
  state.semana = weekKey;
  updateWeekNav();
  restoreValues();
  updateAllBadges();
  renderCMVPanel();
  saveState();
  const dash = document.getElementById('view-dashboard');
  if (dash && dash.style.display !== 'none') renderDashboard();
}

function updateWeekNav() {
  const label = document.getElementById('invWeekLabel');
  if (label && state.semana) label.textContent = getWeekLabel(state.semana);
}

function updateWeekButtons() { updateWeekNav(); } // alias compat

// ── PIN / Resumo ──────────────────────────────────────────────
function checkPin() {
  const val = document.getElementById('invPin').value;
  const validPins = [
    ...(UNIT_ADMINS[UNIT_ID] || []).map(a => a.pin),
    ...(UNIT_ADMINS.global   || []).map(a => a.pin),
  ];
  if (validPins.includes(val)) {
    document.getElementById('invOverlay').classList.remove('open');
    if (window._pinCallback) {
      window._pinCallback();
      window._pinCallback = null;
    } else {
      renderResumo();
    }
  } else {
    const input = document.getElementById('invPin');
    input.classList.add('error');
    input.value = '';
    setTimeout(() => input.classList.remove('error'), 400);
  }
}

function closePin() {
  document.getElementById('invOverlay').classList.remove('open');
  switchTab(SECTIONS[0].key);
}

function renderResumo() {
  const container = document.getElementById('resumoContent');

  const cards = SECTIONS.filter(s => s.key !== 'RESUMO').map(section => {
    const weekKey = state.semana;
    const sData = (state.data[section.key] || {})[weekKey] || {};
    let filled = 0, total = 0, totalConsumo = 0, totalCusto = 0;

    for (const g of section.groups) {
      for (const item of g.items) {
        total++;
        const d     = sData[item.name] || {};
        const price = getItemPrice(section.key, item.name);
        if (d.i !== undefined && d.f !== undefined) {
          filled++;
          const c = d.i + (d.e || 0) - d.f;
          totalConsumo += c;
          if (price !== undefined && c > 0) totalCusto += c * price;
        }
      }
    }

    const pct = total > 0 ? filled / total : 0;
    let statusClass, statusText;
    if (pct === 1) { statusClass = 'completo'; statusText = 'Completo'; }
    else if (pct > 0) { statusClass = 'andamento'; statusText = 'Em andamento'; }
    else { statusClass = 'nao-iniciado'; statusText = 'Não iniciado'; }

    return `
      <div class="inv-resumo-card" onclick="toggleDetail('${section.key}')">
        <div class="inv-resumo-card-title">${section.label}</div>
        <div class="inv-resumo-card-count">${filled}<span style="font-size:14px;font-weight:500;color:#999">/${total}</span></div>
        <div class="inv-resumo-card-sub">Consumo: ${formatNum(totalConsumo)} · Custo: R$ ${totalCusto > 0 ? totalCusto.toFixed(2).replace('.',',') : '—'}</div>
        <span class="inv-resumo-status ${statusClass}">${statusText}</span>
        <div class="inv-resumo-detail" id="detail_${section.key}">
          ${renderDetailTable(section, sData)}
        </div>
      </div>`;
  }).join('');

  container.innerHTML = `
    <p class="inv-section-title" style="margin-bottom:16px">${getWeekLabel(state.semana)} — Resumo Geral</p>
    <div class="inv-resumo-cards">${cards}</div>
    <div class="inv-resumo-actions">
      <button class="inv-btn inv-btn-primary" onclick="exportCSV()">⬇ Exportar CSV</button>
      <button class="inv-btn inv-btn-danger" onclick="confirmClear()">Limpar dados da semana</button>
    </div>
    <div class="inv-footer">PIN: ${OWNER_PIN} · Dados salvos neste dispositivo</div>`;
}

function renderDetailTable(section, sData) {
  let rows = '';
  for (const g of section.groups) {
    for (const item of g.items) {
      const d = sData[item.name] || {};
      const hasData = d.i !== undefined && d.f !== undefined;
      if (!hasData) continue;
      const e     = d.e || 0;
      const c     = d.i + e - d.f;
      const price = getItemPrice(section.key, item.name);
      const custo = (price !== undefined && c > 0) ? (c * price).toFixed(2).replace('.', ',') : '—';
      const cls   = c > 0 ? 'td-positive' : c < 0 ? 'td-negative' : 'td-zero';
      rows += `<tr>
        <td>${escHtml(item.name)}</td>
        <td>${formatNum(d.i)}</td>
        <td>${e > 0 ? formatNum(e) : '—'}</td>
        <td>${formatNum(d.f)}</td>
        <td class="${cls}">${formatNum(c)}</td>
        <td>${price !== undefined ? 'R$ ' + price.toFixed(2).replace('.',',') : '—'}</td>
        <td>${custo !== '—' ? 'R$ ' + custo : '—'}</td>
      </tr>`;
    }
  }
  if (!rows) return '<p style="font-size:12px;color:#999;padding:8px">Nenhum item preenchido</p>';
  return `<table class="inv-detail-table">
    <thead><tr><th>Item</th><th>Inicial</th><th>Entradas</th><th>Final</th><th>Consumo</th><th>Preço</th><th>Custo</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function toggleDetail(sectionKey) {
  const el = document.getElementById('detail_' + sectionKey);
  if (el) el.classList.toggle('open');
}

// ── Exportar CSV ──────────────────────────────────────────────
function exportCSV() {
  const rows = ['Secao,Item,Unidade,Semana,Preco,Inicial,Entradas,Final,Consumo,Custo'];
  const weekKey = state.semana;

  for (const section of SECTIONS) {
    if (section.key === 'RESUMO') continue;
    const sData = (state.data[section.key] || {})[weekKey] || {};

    for (const g of section.groups) {
      for (const item of g.items) {
        const d     = sData[item.name] || {};
        const price = getItemPrice(section.key, item.name);
        const i     = d.i !== undefined ? d.i : '';
        const e     = d.e !== undefined ? d.e : '';
        const f     = d.f !== undefined ? d.f : '';
        const eVal  = d.e || 0;
        const c     = (d.i !== undefined && d.f !== undefined) ? d.i + eVal - d.f : '';
        const custo = (price !== undefined && typeof c === 'number' && c > 0)
                      ? (c * price).toFixed(2) : '';
        rows.push([
          csvCell(section.label),
          csvCell(item.name),
          csvCell(item.unit),
          state.semana,
          price !== undefined ? price.toFixed(2) : '',
          i, e, f, c, custo
        ].join(','));
      }
    }
  }

  const csv = rows.join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const today = new Date().toISOString().slice(0, 10);
  link.href = url;
  link.download = `inventario_semana_${state.semana}_${today}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function confirmClear() {
  if (confirm(`Tem certeza que quer apagar todos os dados de ${getWeekLabel(state.semana)}? Esta ação não pode ser desfeita.`)) {
    const weekKey = state.semana;
    for (const section of SECTIONS) {
      if (state.data[section.key]) {
        delete state.data[section.key][weekKey];
      }
    }
    doSave();
    restoreValues();
    updateAllBadges();
    renderResumo();
    showToast('Semana apagada');
  }
}

// ── CMV ───────────────────────────────────────────────────────
function getCMVData() {
  const key = state.semana;
  if (!state.cmv) state.cmv = {};
  if (!state.cmv[key]) state.cmv[key] = { faturamento: null, meta_pct: 30, notas: [] };
  return state.cmv[key];
}

function renderCMV() {
  const container = document.getElementById('cmvContent');
  if (!container) return;
  const d      = getCMVData();
  const fat    = d.faturamento;
  const pct    = d.meta_pct || 30;
  const notas  = d.notas || [];
  const total  = notas.reduce((s, n) => s + (n.valor || 0), 0);
  const meta   = fat ? fat * pct / 100 : null;
  const saldo  = meta !== null ? meta - total : null;
  const cmvReal = fat ? (total / fat * 100) : null;
  const progPct = meta ? Math.min(total / meta * 100, 100) : 0;
  const _prevMon = getWeekMonday(state.semana);
  _prevMon.setDate(_prevMon.getDate() - 7);
  const semRef = getWeekLabel(getWeekKey(_prevMon));

  // Cor da barra
  let barColor = '#22c55e';
  if (progPct >= 100) barColor = '#ef4444';
  else if (progPct >= 80) barColor = '#f59e0b';

  // Card de configuração (sempre visível, campos bloqueados sem PIN)
  const configHtml = `
    <div class="cmv-config-card" id="cmvConfigCard">
      <div class="cmv-config-header">
        <span class="cmv-config-title">Configuração (${semRef})</span>
        <button class="cmv-config-pin-btn" id="cmvConfigBtn" onclick="openCMVConfig()">🔒 Configurar</button>
      </div>
      <div class="cmv-config-fields" id="cmvConfigFields" style="display:none">
        <div class="cmv-config-row">
          <label>Faturamento da ${semRef}</label>
          <div class="cmv-input-wrap">
            <span class="cmv-prefix">R$</span>
            <input type="number" inputmode="decimal" id="cmvFaturamento" placeholder="0,00"
                   value="${fat || ''}" oninput="onCMVConfigChange()">
          </div>
        </div>
        <div class="cmv-config-row">
          <label>Meta CMV (%)</label>
          <div class="cmv-input-wrap">
            <input type="number" inputmode="decimal" id="cmvMetaPct" placeholder="30"
                   value="${pct}" min="1" max="100" oninput="onCMVConfigChange()">
            <span class="cmv-suffix">%</span>
          </div>
        </div>
        ${meta !== null ? `<div class="cmv-meta-result">Meta de gasto: <strong>R$ ${fmt(meta)}</strong></div>` : ''}
      </div>
    </div>`;

  // Painel de progresso
  const painelHtml = fat ? `
    <div class="cmv-painel">
      <div class="cmv-painel-top">
        <div>
          <div class="cmv-painel-label">Gasto até agora</div>
          <div class="cmv-painel-valor">R$ ${fmt(total)}</div>
        </div>
        <div style="text-align:right">
          <div class="cmv-painel-label">Meta</div>
          <div class="cmv-painel-valor">R$ ${fmt(meta)}</div>
        </div>
      </div>
      <div class="cmv-bar-bg">
        <div class="cmv-bar-fill" style="width:${progPct}%;background:${barColor}"></div>
      </div>
      <div class="cmv-painel-bottom">
        <span class="cmv-cmv-real" style="color:${barColor}">CMV: ${cmvReal.toFixed(1)}%</span>
        <span class="cmv-saldo ${saldo < 0 ? 'negativo' : ''}">
          ${saldo >= 0 ? `Saldo: R$ ${fmt(saldo)}` : `⚠ Estourou R$ ${fmt(Math.abs(saldo))}`}
        </span>
      </div>
    </div>` : `
    <div class="cmv-painel cmv-painel-vazio">
      <span>Configure o faturamento para ver o painel</span>
    </div>`;

  // Lista de notas
  const notasHtml = notas.length ? notas.map(n => `
    <div class="cmv-nota">
      <div class="cmv-nota-info">
        <span class="cmv-nota-fornecedor">${escHtml(n.fornecedor)}</span>
        <span class="cmv-nota-data">${n.data || ''}</span>
      </div>
      <div class="cmv-nota-right">
        <span class="cmv-nota-valor">R$ ${fmt(n.valor)}</span>
        <button class="cmv-nota-del" onclick="deleteNota('${n.id}')">✕</button>
      </div>
    </div>`).join('') : `<p class="cmv-notas-vazio">Nenhuma nota inserida ainda</p>`;

  container.innerHTML = `
    <p class="inv-section-title" style="margin-bottom:12px">CMV — ${getWeekLabel(state.semana)}</p>
    ${configHtml}
    ${painelHtml}
    <div class="cmv-notas-header">
      <span class="inv-section-title">Notas Fiscais · Total: R$ ${fmt(total)}</span>
      <div style="display:flex;gap:8px;align-items:center">
        <button class="cmv-foto-btn" onclick="openCameraForNF()">📷 Foto NF</button>
        <button class="cmv-add-btn" onclick="openAddNota()">+ Manual</button>
      </div>
    </div>
    <div class="cmv-notas-list">${notasHtml}</div>`;
}

function openCMVConfig() {
  document.getElementById('invOverlay').classList.add('open');
  document.getElementById('invPin').value = '';
  document.getElementById('invPin').classList.remove('error');
  window._pinCallback = () => {
    const d = getCMVData();
    const sem = state.semana;
    document.getElementById('cmvConfigSemRef').textContent = `Semana ${getWeekLabel(sem)}`;
    document.getElementById('cmvFaturamento').value = d.faturamento != null ? d.faturamento : '';
    document.getElementById('cmvMetaPct').value = d.meta_pct || 30;
    updateCMVConfigResult();
    document.getElementById('invCMVConfigOverlay').classList.add('open');
  };
  setTimeout(() => document.getElementById('invPin').focus(), 100);
}

function updateCMVConfigResult() {
  const fat = parseFloat(document.getElementById('cmvFaturamento').value);
  const pct = parseFloat(document.getElementById('cmvMetaPct').value) || 30;
  const el  = document.getElementById('cmvConfigResult');
  if (el && !isNaN(fat) && fat > 0) {
    el.innerHTML = `Meta de gasto: <strong>R$ ${fmt(fat * pct / 100)}</strong>`;
  } else if (el) {
    el.textContent = '';
  }
}

function onCMVConfigChange() {
  const d   = getCMVData();
  const fat = document.getElementById('cmvFaturamento');
  const pct = document.getElementById('cmvMetaPct');
  if (fat) d.faturamento = fat.value !== '' ? parseFloat(fat.value) : null;
  if (pct) d.meta_pct    = pct.value !== '' ? parseFloat(pct.value) : 30;
  scheduleSave();
  updateCMVConfigResult();
  renderCMVPanel();
}

function closeCMVConfig() {
  document.getElementById('invCMVConfigOverlay').classList.remove('open');
}

function openAddNota() {
  document.getElementById('invNotaOverlay').classList.add('open');
  document.getElementById('notaFornecedor').value = '';
  document.getElementById('notaValor').value = '';
  document.getElementById('notaData').value = new Date().toISOString().slice(0,10);
  populateLinhaSelect('notaLinha');
  setTimeout(() => document.getElementById('notaFornecedor').focus(), 100);
}

function closeAddNota() {
  document.getElementById('invNotaOverlay').classList.remove('open');
}

function saveNota() {
  const fornecedor = document.getElementById('notaFornecedor').value.trim();
  const valor      = parseFloat(document.getElementById('notaValor').value);
  const data       = document.getElementById('notaData').value;
  const linha      = document.getElementById('notaLinha')?.value || 'Outros';

  if (!fornecedor || isNaN(valor) || valor <= 0) {
    document.getElementById('notaFornecedor').classList.toggle('error', !fornecedor);
    document.getElementById('notaValor').classList.toggle('error', isNaN(valor) || valor <= 0);
    return;
  }

  learnFornecedorLinha(fornecedor, linha);
  const d = getCMVData();
  if (!d.notas) d.notas = [];
  d.notas.push({
    id: Date.now().toString(36),
    fornecedor, linha, valor,
    data: data ? new Date(data).toLocaleDateString('pt-BR') : ''
  });
  closeAddNota();
  doSave();
  renderCMVPanel();
}

function openEditNota(id) {
  const d = getCMVData();
  const nota = (d.notas || []).find(n => n.id === id);
  if (!nota) return;

  document.getElementById('editNotaId').value = id;
  document.getElementById('editNotaFornecedor').value = nota.fornecedor || '';
  document.getElementById('editNotaValor').value = nota.valor || '';

  // Data: converte DD/MM/YYYY → YYYY-MM-DD para o input date
  if (nota.data) {
    const p = nota.data.split('/');
    document.getElementById('editNotaData').value = p.length === 3 ? `${p[2]}-${p[1]}-${p[0]}` : '';
  } else {
    document.getElementById('editNotaData').value = '';
  }

  populateLinhaSelect('editNotaLinha');
  document.getElementById('editNotaLinha').value = nota.linha || '';

  document.getElementById('invEditNotaOverlay').classList.add('open');
  setTimeout(() => document.getElementById('editNotaFornecedor').focus(), 100);
}

function saveEditNota() {
  const id         = document.getElementById('editNotaId').value;
  const fornecedor = document.getElementById('editNotaFornecedor').value.trim();
  const valor      = parseFloat(document.getElementById('editNotaValor').value);
  const data       = document.getElementById('editNotaData').value;
  const linha      = document.getElementById('editNotaLinha').value;

  if (!fornecedor || isNaN(valor) || valor <= 0) return;

  const d = getCMVData();
  const nota = (d.notas || []).find(n => n.id === id);
  if (!nota) return;

  nota.fornecedor = fornecedor;
  nota.valor      = valor;
  nota.linha      = linha;
  nota.data       = data ? new Date(data).toLocaleDateString('pt-BR') : nota.data;

  learnFornecedorLinha(fornecedor, linha);
  closeEditNota();
  doSave();
  renderCMVPanel();
  showToast('Nota atualizada ✓');
}

function closeEditNota() {
  document.getElementById('invEditNotaOverlay').classList.remove('open');
}

function deleteNota(id) {
  if (!confirm('Remover esta nota?')) return;
  const d = getCMVData();
  d.notas = (d.notas || []).filter(n => n.id !== id);
  doSave();
  renderCMVPanel();
}

function fmt(n) {
  if (n === null || n === undefined) return '—';
  return Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ── Supabase Cloud Sync ───────────────────────────────────────
let cloudSyncTimer = null;

function supabaseHeaders() {
  return {
    'apikey':        SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type':  'application/json'
  };
}

async function loadFromCloud() {
  if (!SUPABASE_CONFIGURED) { updateCloudStatus('nao-configurado'); return; }
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/inventario_dados?chave=eq.${CLOUD_DADOS}&select=estado,atualizado_em`,
      { headers: supabaseHeaders() }
    );
    if (!res.ok) { updateCloudStatus('erro'); return; }

    const rows = await res.json();
    if (!rows.length || !rows[0].estado) { updateCloudStatus('ok'); return; }

    const cloudState   = rows[0].estado;
    const cloudTime    = new Date(rows[0].atualizado_em);
    const localTime    = state.lastSaved ? new Date(state.lastSaved) : new Date(0);

    // Nuvem mais recente → atualiza tela e localStorage
    if (cloudTime > localTime) {
      state = { ...state, ...cloudState };
      localStorage.setItem(LOCAL_KEY, JSON.stringify(state));
      restoreValues();
      updateAllBadges();
      updateSavedLabel();
    }
    updateCloudStatus('ok');
  } catch (e) {
    updateCloudStatus('offline');
  }
}

async function syncToCloud() {
  if (!SUPABASE_CONFIGURED) return;
  updateCloudStatus('sync');
  try {
    const payload = {
      chave:        CLOUD_DADOS,
      estado:       state,
      atualizado_em: new Date().toISOString()
    };
    const res = await fetch(`${SUPABASE_URL}/rest/v1/inventario_dados`, {
      method:  'POST',
      headers: { ...supabaseHeaders(), 'Prefer': 'resolution=merge-duplicates' },
      body:    JSON.stringify(payload)
    });
    updateCloudStatus(res.ok ? 'ok' : 'erro');
  } catch (e) {
    updateCloudStatus('offline');
  }
}

function scheduleCloudSync() {
  clearTimeout(cloudSyncTimer);
  cloudSyncTimer = setTimeout(syncToCloud, 3000); // sincroniza 3s após último input
}

function updateCloudStatus(status) {
  const el = document.getElementById('invCloudStatus');
  if (!el) return;
  const map = {
    'ok':             { icon: '☁',  color: '#4ade80', title: 'Sincronizado com a nuvem' },
    'sync':           { icon: '↻',  color: '#93c5fd', title: 'Sincronizando...' },
    'offline':        { icon: '⚡', color: '#fbbf24', title: 'Sem internet — dados salvos localmente' },
    'erro':           { icon: '⚠', color: '#f87171', title: 'Erro ao sincronizar — verifique a conexão' },
    'nao-configurado':{ icon: '○',  color: '#888',    title: 'Nuvem não configurada (apenas local)' }
  };
  const s = map[status] || map['offline'];
  el.textContent   = s.icon;
  el.style.color   = s.color;
  el.title         = s.title;
}

// ── Toast ─────────────────────────────────────────────────────
let toastTimer = null;
function showToast(msg) {
  const el = document.getElementById('invToast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2000);
}

// ── Helpers ───────────────────────────────────────────────────
function makeId(sectionKey, itemName) {
  return (sectionKey + '_' + itemName)
    .replace(/[^a-zA-Z0-9_]/g, '_')
    .replace(/_+/g, '_');
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatNum(n) {
  if (n === null || n === undefined || n === '') return '—';
  const num = parseFloat(n);
  if (isNaN(num)) return '—';
  return Number.isInteger(num) ? num : num.toFixed(2).replace('.', ',');
}

function csvCell(val) {
  const s = String(val);
  return s.includes(',') || s.includes('"') ? '"' + s.replace(/"/g, '""') + '"' : s;
}

// ── Config de itens por unidade ───────────────────────────────
async function loadUnitConfig() {
  if (!SUPABASE_CONFIGURED) return;
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/inventario_dados?chave=eq.${CLOUD_CFG}&select=estado`,
      { headers: supabaseHeaders() }
    );
    if (!res.ok) return;
    const rows = await res.json();
    if (rows.length && rows[0].estado) {
      unitConfig = { added: {}, deleted: {}, ...rows[0].estado };
    }
  } catch(e) {}
}

async function saveUnitConfig() {
  if (!SUPABASE_CONFIGURED) return;
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/inventario_dados`, {
      method:  'POST',
      headers: { ...supabaseHeaders(), 'Prefer': 'resolution=merge-duplicates' },
      body:    JSON.stringify({ chave: CLOUD_CFG, estado: unitConfig, atualizado_em: new Date().toISOString() })
    });
  } catch(e) {}
}

function applyUnitConfig() {
  const added   = unitConfig.added   || {};
  const deleted = unitConfig.deleted || {};

  SECTIONS = BASE_SECTIONS.map(section => {
    if (section.key === 'CMV' || section.key === 'RESUMO') return section;

    const sAdded   = added[section.key]   || [];
    const sDeleted = new Set(deleted[section.key] || []);

    const groups = section.groups.map(g => ({
      group: g.group,
      items: g.items.filter(item => !sDeleted.has(item.name)).map(i => ({ ...i }))
    }));

    for (const newItem of sAdded) {
      const g = groups.find(gr => gr.group === newItem.group);
      if (g) {
        if (!g.items.find(i => i.name === newItem.name)) {
          g.items.push({ name: newItem.name, unit: newItem.unit || 'un' });
        }
      } else {
        groups.push({ group: newItem.group, items: [{ name: newItem.name, unit: newItem.unit || 'un' }] });
      }
    }

    return { key: section.key, label: section.label, groups };
  });
}

// ── Modo edição de itens ──────────────────────────────────────
function toggleEditMode() {
  if (!IS_ADMIN) return;
  editMode = !editMode;
  updateEditModeUI();
}

function updateEditModeUI() {
  document.body.classList.toggle('edit-mode', editMode);
  const btn = document.getElementById('editModeBtn');
  if (btn) {
    btn.textContent = editMode ? '✓ Fechar Edição' : '✏ Editar Lista';
    btn.style.background = editMode ? '#22c55e' : '#f59e0b';
  }
}

function openAddItemFromBtn(btn) {
  openAddItem(btn.dataset.section, btn.dataset.group);
}

function openAddItem(sectionKey, groupName) {
  currentEditSection = { sectionKey, groupName };
  const lbl = document.getElementById('addItemGroupLabel');
  if (lbl) lbl.textContent = 'Grupo: ' + groupName;
  const nameEl = document.getElementById('addItemName');
  const unitEl = document.getElementById('addItemUnit');
  if (nameEl) { nameEl.value = ''; nameEl.classList.remove('error'); }
  if (unitEl) unitEl.value = '';
  document.getElementById('invAddItemOverlay').classList.add('open');
  setTimeout(() => nameEl && nameEl.focus(), 100);
}

function closeAddItem() {
  document.getElementById('invAddItemOverlay').classList.remove('open');
  currentEditSection = null;
}

function saveNewItem() {
  const nameEl = document.getElementById('addItemName');
  const unitEl = document.getElementById('addItemUnit');
  const name = nameEl.value.trim();
  const unit = unitEl.value.trim() || 'un';

  if (!name) { nameEl.classList.add('error'); return; }
  if (!currentEditSection) return;

  const { sectionKey, groupName } = currentEditSection;
  if (!unitConfig.added[sectionKey]) unitConfig.added[sectionKey] = [];
  if (unitConfig.added[sectionKey].find(i => i.name === name)) {
    showToast('Item já existe!'); return;
  }

  if (unitConfig.deleted[sectionKey]) {
    unitConfig.deleted[sectionKey] = unitConfig.deleted[sectionKey].filter(n => n !== name);
  }
  unitConfig.added[sectionKey].push({ group: groupName, name, unit });

  saveUnitConfig();
  closeAddItem();
  rebuildSections();
  showToast('Item adicionado ✓');
}

function deleteItemFromCard(btn) {
  deleteItem(btn.dataset.section, btn.dataset.name);
}

function deleteItem(sectionKey, itemName) {
  if (!confirm(`Remover "${itemName}" desta unidade?`)) return;

  if (!unitConfig.deleted[sectionKey]) unitConfig.deleted[sectionKey] = [];
  if (!unitConfig.deleted[sectionKey].includes(itemName)) {
    unitConfig.deleted[sectionKey].push(itemName);
  }
  if (unitConfig.added[sectionKey]) {
    unitConfig.added[sectionKey] = unitConfig.added[sectionKey].filter(i => i.name !== itemName);
  }

  saveUnitConfig();
  rebuildSections();
  showToast('Item removido');
}

function rebuildSections() {
  const activeKey = (document.querySelector('.inv-tab.active') || {}).dataset?.key || SECTIONS[0]?.key;
  applyUnitConfig();
  buildSections();
  document.querySelectorAll('.inv-tab').forEach(t =>
    t.classList.toggle('active', t.dataset.key === activeKey));
  document.querySelectorAll('.inv-section').forEach(s =>
    s.classList.toggle('active', s.id === 'sec_' + activeKey));
  updateAllBadges();
}

function logout() {
  sessionStorage.removeItem('inv_session');
  window.location.href = 'index.html';
}

// ── Leitura de NF por foto (Gemini Vision) ────────────────────
let mapeamentos     = {};
let nfExtractedItems = [];

async function loadPins() {
  if (!SUPABASE_CONFIGURED) return;
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/inventario_dados?chave=eq.config_pins&select=estado`,
      { headers: supabaseHeaders() }
    );
    const rows = await res.json();
    if (rows?.[0]?.estado) Object.assign(UNIT_ADMINS, rows[0].estado);
  } catch(e) {}
}

async function loadMapeamentos() {
  if (!SUPABASE_CONFIGURED) return;
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/inventario_dados?chave=eq.mapeamentos&select=estado`,
      { headers: supabaseHeaders() }
    );
    if (!res.ok) return;
    const rows = await res.json();
    if (rows.length && rows[0].estado) mapeamentos = rows[0].estado;
  } catch(e) {}
}

async function saveMapeamentos() {
  if (!SUPABASE_CONFIGURED) return;
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/inventario_dados`, {
      method:  'POST',
      headers: { ...supabaseHeaders(), 'Prefer': 'resolution=merge-duplicates' },
      body:    JSON.stringify({ chave: 'mapeamentos', estado: mapeamentos, atualizado_em: new Date().toISOString() })
    });
  } catch(e) {}
}

function openCameraForNF() {
  document.getElementById('nfCamera').click();
}

async function handleNFPhoto(input) {
  if (!input.files || !input.files[0]) return;
  const file = input.files[0];
  input.value = '';

  document.getElementById('nfReviewLoading').style.display = 'block';
  document.getElementById('nfReviewContent').style.display = 'none';
  document.getElementById('invNFReviewOverlay').classList.add('open');

  if (!getGeminiKey()) {
    document.getElementById('invNFReviewOverlay').classList.remove('open');
    openGeminiKeyModal();
    return;
  }
  try {
    const base64 = await fileToBase64(file);
    await loadMapeamentos();
    const geminiData = await callGemini(base64, 'image/jpeg');
    showNFReview(geminiData);
  } catch(e) {
    document.getElementById('invNFReviewOverlay').classList.remove('open');
    const msg = e?.message || String(e);
    console.error('Gemini error completo:', msg);
    showToast('Erro: ' + msg.slice(0, 80));
  }
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const img    = new Image();
    const url    = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const MAX  = 1280;
      let w = img.width, h = img.height;
      if (w > MAX || h > MAX) {
        if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
        else        { w = Math.round(w * MAX / h); h = MAX; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', 0.85).split(',')[1]);
    };
    img.onerror = reject;
    img.src = url;
  });
}

function setNFLoadingMsg(msg) {
  const el = document.querySelector('#nfReviewLoading p');
  if (el) el.textContent = msg;
}

async function countdownWait(seconds) {
  for (let s = seconds; s > 0; s--) {
    setNFLoadingMsg(`Limite atingido — aguardando ${s}s para tentar novamente...`);
    await new Promise(r => setTimeout(r, 1000));
  }
  setNFLoadingMsg('Tentando novamente...');
}

async function callGemini(base64Data, mimeType, attempt = 1) {
  const MAX_ATTEMPTS = 8;
  const prompt = `Você está lendo uma nota fiscal ou cupom fiscal brasileiro. Extraia os dados e retorne APENAS um JSON válido (sem markdown, sem explicação):
{
  "fornecedor": "nome da empresa emitente",
  "data": "DD/MM/YYYY",
  "itens": [
    { "descricao": "descrição do produto", "quantidade": 1.0, "unidade": "UN", "preco_unitario": 0.00, "preco_total": 0.00 }
  ],
  "valor_total": 0.00
}
Se não conseguir ler algum campo, use null. Retorne APENAS o JSON, sem texto adicional.`;

  const key = getGeminiKey();
  const reqBody = JSON.stringify({
    contents: [{ parts: [
      { inline_data: { mime_type: mimeType, data: base64Data } },
      { text: prompt }
    ]}],
    generationConfig: { temperature: 0.1 }
  });

  const MODELS = [
    'gemini-2.5-flash-lite',
    'gemini-2.5-flash',
    'gemini-2.5-flash-preview-05-20',
    'gemini-1.5-flash',
    'gemini-1.5-flash-latest',
  ];
  const ROOT = 'https://generativelanguage.googleapis.com/v1/models/';

  // Tenta cada modelo até um responder (não 404)
  let resp, BASE;
  for (const model of MODELS) {
    BASE = `${ROOT}${model}:generateContent`;
    resp = await fetch(BASE,
      { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key }, body: reqBody });
    if (resp.status === 401) {
      resp = await fetch(`${BASE}?key=${encodeURIComponent(key)}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: reqBody });
    }
    if (resp.status === 401) {
      resp = await fetch(BASE,
        { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` }, body: reqBody });
    }
    if (resp.status !== 404) break; // modelo encontrado (pode ser 200, 503, 429, etc.)
    setNFLoadingMsg(`Modelo ${model} indisponível, tentando próximo...`);
  }

  if (!resp.ok) {
    if (attempt < MAX_ATTEMPTS) {
      if (resp.status === 429) {
        // Rate limit: respeita Retry-After ou aguarda 60s com countdown
        const retryAfter = parseInt(resp.headers.get('Retry-After') || '0') || 60;
        await countdownWait(retryAfter);
        return callGemini(base64Data, mimeType, attempt + 1);
      }
      if (resp.status === 503) {
        const delay = Math.min(5000 * attempt, 30000);
        setNFLoadingMsg(`Serviço ocupado — tentativa ${attempt}/${MAX_ATTEMPTS - 1}, aguardando ${delay/1000}s...`);
        await new Promise(r => setTimeout(r, delay));
        setNFLoadingMsg('Tentando novamente...');
        return callGemini(base64Data, mimeType, attempt + 1);
      }
    }
    const errText = await resp.text();
    throw new Error('Gemini ' + resp.status + ': ' + errText);
  }

  const data = await resp.json();
  const text = (data.candidates?.[0]?.content?.parts?.[0]?.text || '').trim();
  const clean = text.replace(/^```json\n?/,'').replace(/^```\n?/,'').replace(/```$/,'').trim();
  return JSON.parse(clean);
}

function normalizeForMatch(s) {
  return String(s).toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

function findBestMatch(description) {
  const normDesc = normalizeForMatch(description);

  // Mapeamento salvo tem prioridade
  if (mapeamentos[normDesc]) {
    const m = mapeamentos[normDesc];
    return { sectionKey: m.sectionKey, itemName: m.itemName, score: 1.0 };
  }

  const words = normDesc.split(' ').filter(w => w.length > 2);
  let bestScore = 0, bestMatch = null;

  for (const section of SECTIONS) {
    if (section.key === 'CMV' || section.key === 'RESUMO') continue;
    for (const g of section.groups) {
      for (const item of g.items) {
        const itemNorm  = normalizeForMatch(item.name);
        const itemWords = itemNorm.split(' ').filter(w => w.length > 2);
        const matches   = words.filter(w => itemWords.some(iw => iw.includes(w) || w.includes(iw)));
        const score     = matches.length / Math.max(words.length, itemWords.length, 1);
        if (score > bestScore) { bestScore = score; bestMatch = { sectionKey: section.key, itemName: item.name, score }; }
      }
    }
  }

  return bestScore >= 0.35 ? bestMatch : null;
}

function openNFManual() {
  showNFReview({ fornecedor: '', data: '', itens: [] });
  // Adiciona uma linha em branco para começar
  addNFManualItem();
}

function addNFManualItem() {
  const idx = nfExtractedItems.length;
  nfExtractedItems.push({
    id: idx, descricao: '', quantidade: 1, unidade: 'UN',
    preco_unitario: 0, preco_total: 0, match: null, incluir: true
  });
  renderNFItems();
  // Foca na descrição do novo item
  setTimeout(() => {
    const inputs = document.querySelectorAll('.nf-item-desc-input');
    if (inputs.length) inputs[inputs.length - 1].focus();
  }, 50);
}

function showNFReview(geminiData) {
  document.getElementById('nfReviewLoading').style.display = 'none';
  document.getElementById('nfReviewContent').style.display = 'block';

  const fornEl = document.getElementById('nfRevFornecedor');
  const dataEl = document.getElementById('nfRevData');
  if (fornEl) fornEl.value = geminiData.fornecedor || '';
  populateLinhaSelect('nfRevLinha', geminiData.fornecedor || '', geminiData.itens || []);
  if (dataEl && geminiData.data) {
    const p = geminiData.data.split('/');
    if (p.length === 3) dataEl.value = `${p[2]}-${p[1].padStart(2,'0')}-${p[0].padStart(2,'0')}`;
  } else if (dataEl) {
    dataEl.value = new Date().toISOString().slice(0,10);
  }

  nfExtractedItems = (geminiData.itens || []).map((item, idx) => ({
    id:             idx,
    descricao:      item.descricao || '',
    quantidade:     item.quantidade || 1,
    unidade:        item.unidade || 'UN',
    preco_unitario: item.preco_unitario || 0,
    preco_total:    item.preco_total || (item.quantidade || 1) * (item.preco_unitario || 0),
    match:          findBestMatch(item.descricao || ''),
    incluir:        true
  }));

  renderNFItems();
}

function renderNFItems() {
  const list = document.getElementById('nfItemsList');
  if (!list) return;

  const q = (document.getElementById('nfItemSearch')?.value || '').toLowerCase().trim();

  const allItems = [];
  for (const section of SECTIONS) {
    if (section.key === 'CMV' || section.key === 'RESUMO') continue;
    for (const g of section.groups)
      for (const item of g.items)
        allItems.push({ sectionKey: section.key, itemName: item.name, label: `[${section.label}] ${item.name}` });
  }
  allItems.sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));

  const visible = q
    ? nfExtractedItems.filter(i => i.descricao.toLowerCase().includes(q))
    : nfExtractedItems;

  list.innerHTML = visible.map(item => {
    const matchVal  = item.match ? `${item.match.sectionKey}::${item.match.itemName}` : '';
    const matchBadge = item.match
      ? (item.match.score === 1.0 ? 'nf-match-saved' : 'nf-match-auto')
      : 'nf-match-none';
    const matchLabel = item.match
      ? `[${item.match.sectionKey}] ${item.match.itemName}`
      : 'Não identificado — selecione abaixo';

    const opts = `<option value=""${!matchVal ? ' selected' : ''}>— Não usar —</option>` +
      allItems.map(i => {
        const v   = `${i.sectionKey}::${i.itemName}`;
        const sel = v === matchVal ? ' selected' : '';
        return `<option value="${escHtml(v)}"${sel}>${escHtml(i.label)}</option>`;
      }).join('');

    const showCadastrar = !matchVal;

    return `<div class="nf-item${item.incluir ? '' : ' nf-item-off'}" id="nfitem_${item.id}">
      <input class="nf-item-chk" type="checkbox" ${item.incluir ? 'checked' : ''} onchange="toggleNFItem(${item.id},this.checked)">
      <div class="nf-item-body">
        <input class="nf-item-desc-input" type="text" value="${escHtml(item.descricao)}"
          onchange="updateNFItemVal(${item.id},'descricao',this.value)">
        <div class="nf-item-meta-edit">
          <label class="nf-meta-lbl">Qtd</label>
          <input class="nf-meta-input" type="number" inputmode="decimal" value="${item.quantidade}"
            onchange="updateNFItemVal(${item.id},'quantidade',this.value)">
          <input class="nf-meta-input nf-meta-unit" type="text" value="${escHtml(item.unidade)}"
            onchange="updateNFItemVal(${item.id},'unidade',this.value)">
          <label class="nf-meta-lbl">R$/un</label>
          <input class="nf-meta-input" type="number" inputmode="decimal" value="${item.preco_unitario}"
            onchange="updateNFItemVal(${item.id},'preco_unitario',this.value)">
          <label class="nf-meta-lbl">Total</label>
          <input class="nf-meta-input nf-meta-total" id="nftotal_${item.id}" type="number" inputmode="decimal" value="${item.preco_total}"
            onchange="updateNFItemVal(${item.id},'preco_total',this.value)">
        </div>
        <span class="nf-match-badge ${matchBadge}">${matchLabel}</span>
        <select class="nf-item-select" onchange="changeNFMatch(${item.id},this.value)">${opts}</select>
        <button class="nf-cadastrar-btn" id="nfcad_${item.id}"
          style="display:${showCadastrar ? 'flex' : 'none'}"
          data-nf-id="${item.id}" data-nf-desc="${escHtml(item.descricao)}"
          onclick="openAddItemFromNF(parseInt(this.dataset.nfId), this.dataset.nfDesc)">
          📝 Cadastrar este insumo
        </button>
      </div>
    </div>`;
  }).join('') || '<p style="color:#999;text-align:center;padding:16px">Nenhum item encontrado</p>';

  updateNFTotal();
}

function updateNFItemVal(id, field, rawVal) {
  const item = nfExtractedItems.find(i => i.id === id);
  if (!item) return;
  const val = (field === 'unidade' || field === 'descricao') ? rawVal : (parseFloat(rawVal) || 0);
  item[field] = val;
  if (field === 'quantidade' || field === 'preco_unitario') {
    item.preco_total = +(item.quantidade * item.preco_unitario).toFixed(2);
    const totalEl = document.getElementById('nftotal_' + id);
    if (totalEl) totalEl.value = item.preco_total;
  } else if (field === 'preco_total') {
    if (item.quantidade > 0)
      item.preco_unitario = +(item.preco_total / item.quantidade).toFixed(4);
  }
  updateNFTotal();
}

function toggleNFItem(id, checked) {
  const item = nfExtractedItems.find(i => i.id === id);
  if (!item) return;
  item.incluir = checked;
  const el = document.getElementById('nfitem_' + id);
  if (el) el.classList.toggle('nf-item-off', !checked);
  updateNFTotal();
}

function changeNFMatch(id, value) {
  const item = nfExtractedItems.find(i => i.id === id);
  if (!item) return;
  if (value) {
    const sep = value.indexOf('::');
    const sectionKey = value.slice(0, sep);
    const itemName   = value.slice(sep + 2);
    item.match = { sectionKey, itemName };
    mapeamentos[normalizeForMatch(item.descricao)] = { sectionKey, itemName };
  } else {
    item.match = null;
  }
  const badge = document.querySelector(`#nfitem_${id} .nf-match-badge`);
  if (badge) {
    badge.textContent = item.match ? `[${item.match.sectionKey}] ${item.match.itemName}` : 'Não identificado — selecione abaixo';
    badge.className   = 'nf-match-badge ' + (item.match ? 'nf-match-auto' : 'nf-match-none');
  }
  const cadBtn = document.getElementById(`nfcad_${id}`);
  if (cadBtn) cadBtn.style.display = value ? 'none' : 'flex';
}

function openAddItemFromNF(itemId, desc) {
  const overlay = document.getElementById('invNFAddItemOverlay');
  if (!overlay) { showToast('Atualize a página (F5) e tente novamente'); return; }

  const sectionEl = document.getElementById('nfAddItemSection');
  const groupEl   = document.getElementById('nfAddItemGroup');
  const nameEl    = document.getElementById('nfAddItemName');
  const unitEl    = document.getElementById('nfAddItemUnit');

  sectionEl.innerHTML = SECTIONS
    .filter(s => s.key !== 'CMV' && s.key !== 'RESUMO')
    .map(s => `<option value="${escHtml(s.key)}">${escHtml(s.label)}</option>`)
    .join('');

  nameEl.value = desc;
  unitEl.value = '';
  updateNFAddGroups();

  document.getElementById('nfAddItemId').value = itemId;
  document.getElementById('invNFAddItemOverlay').classList.add('open');
  setTimeout(() => nameEl.focus(), 100);
}

function updateNFAddGroups() {
  const sectionKey = document.getElementById('nfAddItemSection').value;
  const section    = SECTIONS.find(s => s.key === sectionKey);
  document.getElementById('nfAddItemGroup').innerHTML =
    (section?.groups || []).map(g => `<option value="${escHtml(g.group)}">${escHtml(g.group)}</option>`).join('');
}

function saveNFAddItem() {
  const nameEl     = document.getElementById('nfAddItemName');
  const unitEl     = document.getElementById('nfAddItemUnit');
  const sectionKey = document.getElementById('nfAddItemSection').value;
  const groupName  = document.getElementById('nfAddItemGroup').value;
  const name       = nameEl.value.trim();
  const unit       = unitEl.value.trim() || 'un';
  const itemId     = parseInt(document.getElementById('nfAddItemId').value);

  if (!name) { nameEl.classList.add('error'); return; }

  if (!unitConfig.added[sectionKey]) unitConfig.added[sectionKey] = [];
  if (!unitConfig.added[sectionKey].find(i => i.name === name)) {
    if (unitConfig.deleted[sectionKey])
      unitConfig.deleted[sectionKey] = unitConfig.deleted[sectionKey].filter(n => n !== name);
    unitConfig.added[sectionKey].push({ group: groupName, name, unit });
    saveUnitConfig();
    rebuildSections();
  }

  // Auto-seleciona o item recém-criado no NF item
  const item = nfExtractedItems.find(i => i.id === itemId);
  if (item) {
    item.match = { sectionKey, itemName: name };
    mapeamentos[normalizeForMatch(item.descricao)] = { sectionKey, itemName: name };
    const sel = document.querySelector(`#nfitem_${itemId} .nf-item-select`);
    if (sel) {
      const val = `${sectionKey}::${name}`;
      const opt = document.createElement('option');
      opt.value = val; opt.textContent = `[${sectionKey}] ${name}`; opt.selected = true;
      sel.appendChild(opt);
      const badge = document.querySelector(`#nfitem_${itemId} .nf-match-badge`);
      if (badge) { badge.textContent = `[${sectionKey}] ${name}`; badge.className = 'nf-match-badge nf-match-auto'; }
      const cadBtn = document.getElementById(`nfcad_${itemId}`);
      if (cadBtn) cadBtn.style.display = 'none';
    }
  }

  document.getElementById('invNFAddItemOverlay').classList.remove('open');
  showToast('Insumo cadastrado ✓');
}

function closeNFAddItem() {
  document.getElementById('invNFAddItemOverlay').classList.remove('open');
}

function updateNFTotal() {
  const total = nfExtractedItems.filter(i => i.incluir).reduce((s, i) => s + (i.preco_total || 0), 0);
  const el = document.getElementById('nfTotalConfirmado');
  if (el) el.textContent = 'R$ ' + fmt(total);
}

function closeNFReview() {
  document.getElementById('invNFReviewOverlay').classList.remove('open');
  nfExtractedItems = [];
}

async function confirmNFItems() {
  const fornecedor = (document.getElementById('nfRevFornecedor').value.trim()) || 'Fornecedor NF';
  const dataVal    = document.getElementById('nfRevData').value;
  const dataFmt    = dataVal ? new Date(dataVal).toLocaleDateString('pt-BR') : new Date().toLocaleDateString('pt-BR');
  const included   = nfExtractedItems.filter(i => i.incluir);
  const total      = included.reduce((s, i) => s + (i.preco_total || 0), 0);

  // Salvar nota
  const d = getCMVData();
  if (!d.notas) d.notas = [];
  const linha = document.getElementById('nfRevLinha')?.value || 'Outros';
  learnFornecedorLinha(fornecedor, linha);
  d.notas.push({ id: Date.now().toString(36), fornecedor, linha, valor: total, data: dataFmt });

  // Atualizar cotações com preços lidos
  const q = getQuinzena(state.semana);
  if (!state.cotacoes)    state.cotacoes = {};
  if (!state.cotacoes[q]) state.cotacoes[q] = {};

  let updatedPrices = 0;
  for (const item of included) {
    if (item.match && item.preco_unitario > 0) {
      const { sectionKey, itemName } = item.match;
      if (!state.cotacoes[q][sectionKey]) state.cotacoes[q][sectionKey] = {};
      state.cotacoes[q][sectionKey][itemName] = item.preco_unitario;
      updatedPrices++;
    }
  }

  saveMapeamentos();
  doSave();
  closeNFReview();
  renderCMVPanel();
  restoreValues();
  showToast(`NF salva ✓ · ${updatedPrices} preço${updatedPrices !== 1 ? 's' : ''} atualizado${updatedPrices !== 1 ? 's' : ''}`);
}

// ── CMV Top Panel ─────────────────────────────────────────────

function calcMonthlyAvg() {
  let sum = 0, count = 0;
  const hoje = new Date();
  const mesNum = hoje.getFullYear() * 100 + (hoje.getMonth() + 1);
  Object.entries(state.cmv || {}).forEach(([key, d]) => {
    if (!/^\d{4}-W\d{2}$/.test(key)) return;
    const mon = getWeekMonday(key);
    if (mon.getFullYear() * 100 + (mon.getMonth() + 1) !== mesNum) return;
    if (d && d.faturamento && d.faturamento > 0) {
      const total = (d.notas || []).reduce((s, n) => s + (n.valor || 0), 0);
      sum += (total / d.faturamento) * 100;
      count++;
    }
  });
  return count > 0 ? { avg: sum / count, weeks: count } : null;
}

function calcProjecao() {
  // Acumula todas as semanas com dados
  let gastoTotal = 0, fatTotal = 0, semCount = 0;
  for (const [, d] of Object.entries(state.cmv || {})) {
    if (!d) continue;
    const gasto = (d.notas || []).reduce((s, n) => s + (n.valor || 0), 0);
    if (gasto > 0 || (d.faturamento && d.faturamento > 0)) {
      gastoTotal += gasto;
      if (d.faturamento > 0) fatTotal += d.faturamento;
      semCount++;
    }
  }
  if (semCount === 0) return null;
  // Projeta para 4 semanas
  const gastoProj = gastoTotal / semCount * 4;
  const fatProj   = fatTotal   / semCount * 4;
  const cmvProj   = fatProj > 0 ? gastoProj / fatProj * 100 : null;
  return { gastoProj, fatProj, cmvProj, semCount };
}

function renderCMVPanel() {
  const panel = document.getElementById('cmvPanel');
  if (!panel) return;

  const d      = getCMVData();
  const fat    = d.faturamento;
  const pct    = d.meta_pct || 30;
  const notas  = d.notas || [];
  const total  = notas.reduce((s, n) => s + (n.valor || 0), 0);
  const meta   = fat ? fat * pct / 100 : null;
  const saldo  = meta !== null ? meta - total : null;
  const cmvReal = fat && fat > 0 ? (total / fat * 100) : null;
  const progPct = meta ? Math.min(total / meta * 100, 100) : 0;
  const monthly = calcMonthlyAvg();

  let barColor = '#22c55e';
  if (progPct >= 100) barColor = '#ef4444';
  else if (progPct >= 80) barColor = '#f59e0b';

  const geminiOk = !!getGeminiKey();
  const actionBtns = `
    <div class="cmv-panel-actions">
      <button class="cmv-panel-btn-foto" onclick="openCameraForNF()" title="${geminiOk ? 'Tirar foto de NF' : 'Configure a chave Gemini primeiro'}">
        📷 Foto NF${geminiOk ? '' : ' ⚠'}
      </button>
      <button class="cmv-panel-btn-cfg" onclick="openNFManual()" title="Inserir nota manualmente com itens">📝 Manual</button>
      ${IS_ADMIN ? `<button class="cmv-panel-btn-cfg" onclick="openCMVConfig()">⚙ CMV</button>` : ''}
      ${IS_ADMIN ? `<button class="cmv-panel-btn-cfg" onclick="openLinhas()" title="Gerenciar linhas de produto">📦 Linhas</button>` : ''}
      ${IS_ADMIN ? `<button class="cmv-panel-btn-cfg" onclick="openGeminiKeyModal()" title="Configurar chave Gemini">🔑 IA</button>` : ''}
      ${IS_ADMIN ? `<button class="cmv-panel-btn-cfg" onclick="openTrocarPin()" title="Trocar meu PIN">👤 PIN</button>` : ''}
    </div>`;

  const notasHtml = notas.length
    ? notas.map(n => `
        <div class="cmv-panel-nota">
          <div style="display:flex;flex-direction:column;gap:1px;flex:1;min-width:0">
            <span class="cmv-panel-nota-forn">${escHtml(n.fornecedor)}</span>
            ${n.linha ? `<span class="cmv-panel-nota-linha">${escHtml(n.linha)}</span>` : ''}
          </div>
          <span class="cmv-panel-nota-data">${n.data || ''}</span>
          <span class="cmv-panel-nota-val">R$ ${fmt(n.valor)}</span>
          <button class="cmv-nota-edit" onclick="openEditNota('${n.id}')" title="Editar">✏️</button>
          <button class="cmv-nota-del" onclick="deleteNota('${n.id}')">✕</button>
        </div>`).join('')
    : `<p class="cmv-panel-notas-vazio">Nenhuma nota inserida nesta semana</p>`;

  // Breakdown por linha
  const breakdown = calcLinhaBreakdown(notas, fat);
  const linhaBreakdownHtml = breakdown.length > 1 ? `
    <div class="cmv-linhas-breakdown">
      <div class="cmv-linhas-title">Por linha de produto</div>
      ${breakdown.map(b => `
        <div class="cmv-linha-row">
          <span class="cmv-linha-nome">${escHtml(b.linha)}</span>
          <span class="cmv-linha-val">R$ ${fmt(b.total)}</span>
          ${b.pct !== null ? `<span class="cmv-linha-pct">${b.pct.toFixed(1)}%</span>` : ''}
        </div>`).join('')}
    </div>` : '';

  // CMV mês YTD = total gasto acumulado / total faturamento acumulado (semanas do mês atual)
  const _hoje = new Date();
  const _mesNum = _hoje.getFullYear() * 100 + (_hoje.getMonth() + 1);
  let gastoYTD = 0, fatYTD = 0;
  Object.entries(state.cmv || {}).forEach(([key, dw]) => {
    if (!/^\d{4}-W\d{2}$/.test(key)) return;
    const mon = getWeekMonday(key);
    if (mon.getFullYear() * 100 + (mon.getMonth() + 1) !== _mesNum) return;
    gastoYTD += (dw.notas || []).reduce((s, n) => s + (n.valor || 0), 0);
    if (dw.faturamento > 0) fatYTD += dw.faturamento;
  });
  const cmvYTD     = fatYTD > 0 ? gastoYTD / fatYTD * 100 : null;
  const ytdColor   = cmvYTD != null
    ? (cmvYTD > pct * 1.1 ? '#ef4444' : cmvYTD > pct ? '#f59e0b' : '#4ade80')
    : '#9ca3af';

  panel.innerHTML = `
    <div class="cmv-panel-header">
      <div class="cmv-panel-title-row">
        <span class="cmv-panel-week-label">${getWeekLabel(state.semana)}</span>
        <div style="flex:1"></div>
        ${actionBtns.replace('<div class="cmv-panel-actions">', '<div class="cmv-panel-actions" style="margin-top:0">')}
      </div>

      <!-- Dois KPIs grandes -->
      <div class="cmv-kpis-row">
        <div class="cmv-kpi-block">
          <span class="cmv-kpi-label">CMV semana</span>
          <span class="cmv-kpi-value" style="color:${barColor}">${cmvReal !== null ? cmvReal.toFixed(1) + '%' : '—'}</span>
          <span class="cmv-kpi-sub">${fat ? `meta ${pct}% · R$ ${fmt(total)}` : IS_ADMIN ? 'configure faturamento' : 'sem faturamento'}</span>
        </div>
        <div class="cmv-kpi-divider"></div>
        <div class="cmv-kpi-block">
          <span class="cmv-kpi-label">CMV mês</span>
          <span class="cmv-kpi-value" style="color:${ytdColor}">${cmvYTD != null ? cmvYTD.toFixed(1) + '%' : '—'}</span>
          <span class="cmv-kpi-sub">${fatYTD > 0 ? `R$ ${fmt(gastoYTD)} de R$ ${fmt(fatYTD)}` : 'aguardando dados'}</span>
        </div>
      </div>

      ${fat ? `
      <div class="cmv-panel-bar-wrap">
        <div class="cmv-panel-bar-bg">
          <div class="cmv-panel-bar-fill" style="width:${progPct.toFixed(1)}%;background:${barColor}"></div>
        </div>
        <span class="cmv-panel-barpct" style="color:${barColor}">${progPct.toFixed(0)}%</span>
      </div>
      <div class="cmv-panel-metrics">
        <div class="cmv-panel-metric">
          <span class="cmv-panel-metric-label">Gasto</span>
          <span class="cmv-panel-metric-val">R$ ${fmt(total)}</span>
        </div>
        <div class="cmv-panel-metric">
          <span class="cmv-panel-metric-label">Meta (${pct}%)</span>
          <span class="cmv-panel-metric-val">R$ ${fmt(meta)}</span>
        </div>
        <div class="cmv-panel-metric">
          <span class="cmv-panel-metric-label">${saldo >= 0 ? 'Saldo' : 'Excesso'}</span>
          <span class="cmv-panel-metric-val" style="color:${saldo >= 0 ? '#4ade80' : '#f87171'}">${saldo >= 0 ? '' : '−'}R$ ${fmt(Math.abs(saldo))}</span>
        </div>
        <div class="cmv-panel-metric">
          <span class="cmv-panel-metric-label">Faturamento</span>
          <span class="cmv-panel-metric-val">R$ ${fmt(fat)}</span>
        </div>
      </div>
      ` : ''}

    ${linhaBreakdownHtml}

    <div class="cmv-panel-notas-section">
      <button class="cmv-notas-toggle" onclick="toggleNotasDrawer(this)">
        📋 ${notas.length} nota${notas.length !== 1 ? 's' : ''} · R$ ${fmt(total)}
        <span class="cmv-notas-toggle-icon">▾</span>
      </button>
      <div class="cmv-notas-drawer" style="display:none">
        <div class="cmv-panel-notas-list">${notasHtml}</div>
      </div>
    </div>
  `;
}

// ── Configuração da chave Gemini (admin) ──────────────────────
function openGeminiKeyModal() {
  const el = document.getElementById('invGeminiKeyOverlay');
  if (!el) return;
  document.getElementById('geminiKeyInput').value = getGeminiKey();
  el.classList.add('open');
  setTimeout(() => document.getElementById('geminiKeyInput').focus(), 100);
}

async function saveGeminiKey() {
  const val = document.getElementById('geminiKeyInput').value.trim();
  if (!val) { document.getElementById('geminiKeyInput').classList.add('error'); return; }
  setGeminiKey(val);
  await saveGeminiKeyToCloud(val);
  document.getElementById('invGeminiKeyOverlay').classList.remove('open');
  renderCMVPanel();
  showToast('Chave Gemini salva ✓');
}

async function testGeminiKey() {
  const val = document.getElementById('geminiKeyInput').value.trim();
  if (!val) { showToast('Cole a chave antes de testar'); return; }
  const btn = document.getElementById('btnTestGeminiKey');
  btn.textContent = '⏳ Testando...';
  btn.disabled = true;

  const BASE = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent';
  const body = JSON.stringify({ contents:[{ parts:[{ text:'Responda apenas: OK' }] }] });

  let resp, label;
  try {
    resp = await fetch(BASE, { method:'POST', headers:{ 'Content-Type':'application/json', 'x-goog-api-key': val }, body });
    label = 'x-goog-api-key';
    if (resp.status === 401) {
      resp = await fetch(`${BASE}?key=${encodeURIComponent(val)}`, { method:'POST', headers:{ 'Content-Type':'application/json' }, body });
      label = '?key=';
    }
    if (resp.status === 401) {
      resp = await fetch(BASE, { method:'POST', headers:{ 'Content-Type':'application/json', 'Authorization':`Bearer ${val}` }, body });
      label = 'Bearer';
    }
    const text = await resp.text();
    const d = document.getElementById('geminiKeyTestResult');
    d.style.display = 'block';
    if (resp.ok) {
      d.style.background = '#f0fdf4';
      d.style.borderColor = '#86efac';
      d.style.color = '#14532d';
      d.textContent = `✅ Chave OK (autenticou via ${label})`;
    } else {
      d.style.background = '#fef2f2';
      d.style.borderColor = '#fca5a5';
      d.style.color = '#7f1d1d';
      d.textContent = `❌ ${resp.status} via ${label}:\n${text.slice(0,400)}`;
    }
  } catch(e) {
    showToast('Erro de rede: ' + e.message);
  }
  btn.textContent = '🔍 Testar chave';
  btn.disabled = false;
}

function toggleNotasDrawer(btn) {
  const drawer = btn.nextElementSibling;
  const open   = drawer.style.display !== 'none';
  drawer.style.display = open ? 'none' : 'block';
  btn.querySelector('.cmv-notas-toggle-icon').textContent = open ? '▾' : '▴';
}

function closeGeminiKeyModal() {
  document.getElementById('invGeminiKeyOverlay').classList.remove('open');
}

// ── Linhas de Produto ─────────────────────────────────────────
const DEFAULT_LINHAS = [
  'Carnes Vermelhas', 'Frango', 'Pescados', 'Queijos e Laticínios',
  'Hortifruti', 'Bebidas', 'Embalagens', 'Outros'
];

let linhasConfig = {
  linhas:       [...DEFAULT_LINHAS],
  fornecedores: {}   // { 'Nome Fornecedor': 'Linha' }
};

async function loadLinhas() {
  if (!SUPABASE_CONFIGURED) return;
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/inventario_dados?chave=eq.config_linhas&select=estado`,
      { headers: supabaseHeaders() }
    );
    const rows = await res.json();
    if (rows?.[0]?.estado) linhasConfig = { ...linhasConfig, ...rows[0].estado };
  } catch(e) {}
}

async function saveLinhas() {
  if (!SUPABASE_CONFIGURED) return;
  await fetch(`${SUPABASE_URL}/rest/v1/inventario_dados`, {
    method: 'POST',
    headers: { ...supabaseHeaders(), Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify({ chave: 'config_linhas', estado: linhasConfig })
  });
}

function detectLinhaFromItems(items, fornecedor) {
  // 1. Fornecedor já mapeado
  if (fornecedor) {
    const known = linhasConfig.fornecedores[fornecedor.trim().toLowerCase()];
    if (known) return known;
  }
  // 2. Palavras-chave dos nomes das linhas nos itens da nota
  const allText = (items || []).map(i => i.descricao || '').join(' ').toLowerCase();
  for (const linha of linhasConfig.linhas) {
    const keywords = linha.toLowerCase().replace(/[^a-záéíóúàâêôãõç\s]/gi, '').split(/\s+/).filter(w => w.length > 3);
    if (keywords.some(kw => allText.includes(kw))) return linha;
  }
  return null;
}

function populateLinhaSelect(selectId, fornecedor = '', items = []) {
  const sel = document.getElementById(selectId);
  if (!sel) return;
  sel.innerHTML = `<option value="">— Selecionar linha —</option>` +
    linhasConfig.linhas.map(l => `<option value="${escHtml(l)}">${escHtml(l)}</option>`).join('');
  const detected = detectLinhaFromItems(items, fornecedor);
  if (detected) sel.value = detected;
}

function autoFillLinha(selectId, fornecedor) {
  const sel = document.getElementById(selectId);
  if (!sel || !fornecedor) return;
  const known = linhasConfig.fornecedores[fornecedor.trim().toLowerCase()];
  if (known) sel.value = known;
}

function learnFornecedorLinha(fornecedor, linha) {
  if (!fornecedor || !linha) return;
  linhasConfig.fornecedores[fornecedor.trim().toLowerCase()] = linha;
  saveLinhas();
}

function openLinhas() {
  renderLinhasList();
  document.getElementById('invLinhasOverlay').classList.add('open');
}

function closeLinhas() {
  document.getElementById('invLinhasOverlay').classList.remove('open');
}

function renderLinhasList() {
  const el = document.getElementById('linhasList');
  if (!el) return;
  el.innerHTML = linhasConfig.linhas.map((l, i) => `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:7px 0;border-bottom:1px solid #f3f4f6">
      <span style="font-size:14px;font-weight:500;color:#1e293b">${escHtml(l)}</span>
      ${linhasConfig.linhas.length > 1 ? `<button onclick="removeLinha(${i})"
        style="background:none;border:none;color:#ef4444;font-size:16px;cursor:pointer;padding:2px 6px">✕</button>` : ''}
    </div>`).join('');
}

function addLinha() {
  const inp = document.getElementById('novaLinhaInput');
  const val = inp.value.trim();
  if (!val || linhasConfig.linhas.includes(val)) { inp.focus(); return; }
  linhasConfig.linhas.push(val);
  inp.value = '';
  renderLinhasList();
  saveLinhas();
  refreshLinhaSelects();
}

function removeLinha(idx) {
  linhasConfig.linhas.splice(idx, 1);
  renderLinhasList();
  saveLinhas();
  refreshLinhaSelects();
}

function refreshLinhaSelects() {
  ['nfRevLinha','notaLinha'].forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    const cur = sel.value;
    populateLinhaSelect(id);
    if (linhasConfig.linhas.includes(cur)) sel.value = cur;
  });
}

// Breakdown de CMV por linha
function calcLinhaBreakdown(notas, faturamento) {
  const map = {};
  for (const n of notas) {
    const l = n.linha || 'Outros';
    map[l] = (map[l] || 0) + (n.valor || 0);
  }
  return Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .map(([linha, total]) => ({
      linha, total,
      pct: faturamento > 0 ? (total / faturamento) * 100 : null
    }));
}

// ── Trocar PIN ────────────────────────────────────────────────
function openTrocarPin() {
  const session = JSON.parse(sessionStorage.getItem('inv_session') || '{}');
  document.getElementById('tpNome').value = session.nome || '';
  document.getElementById('tpPin1').value = '';
  document.getElementById('tpPin2').value = '';
  document.getElementById('tpError').textContent = '';
  document.getElementById('tpError').style.color = '#e11d48';
  document.getElementById('invTrocarPinOverlay').classList.add('open');
  setTimeout(() => document.getElementById('tpNome').focus(), 100);
}

function closeTrocarPin() {
  document.getElementById('invTrocarPinOverlay').classList.remove('open');
}

async function saveTrocarPin() {
  const nome = document.getElementById('tpNome').value.trim();
  const p1   = document.getElementById('tpPin1').value;
  const p2   = document.getElementById('tpPin2').value;
  const err  = document.getElementById('tpError');

  if (!nome)              { err.textContent = 'Digite seu nome'; return; }
  if (p1.length < 4)     { err.textContent = 'PIN deve ter 4 dígitos'; return; }
  if (p1 !== p2)         { err.textContent = 'Os PINs não coincidem'; return; }
  if (!/^\d{4}$/.test(p1)) { err.textContent = 'Use apenas números'; return; }

  const session = JSON.parse(sessionStorage.getItem('inv_session') || '{}');
  const unit    = session.unidade || 'global';
  const admins  = UNIT_ADMINS[unit] || [];
  const idx     = admins.findIndex(a => a.nome === session.nome);
  if (idx !== -1) { admins[idx].pin = p1; admins[idx].nome = nome; }

  // Salva PINs no Supabase
  if (SUPABASE_CONFIGURED) {
    const body = JSON.stringify({ chave: 'config_pins', estado: UNIT_ADMINS });
    await fetch(`${SUPABASE_URL}/rest/v1/inventario_dados`, {
      method: 'POST',
      headers: { ...supabaseHeaders(), Prefer: 'resolution=merge-duplicates' },
      body
    });
  }

  session.nome = nome;
  sessionStorage.setItem('inv_session', JSON.stringify(session));

  err.style.color = '#16a34a';
  err.textContent = `PIN salvo! Bem-vinda, ${nome} ✓`;
  setTimeout(closeTrocarPin, 1500);
}

// ── Start ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', init);
