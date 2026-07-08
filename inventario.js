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
    key: 'BEBIDAS',
    label: 'BEBIDAS',
    groups: [
      {
        group: 'Bebidas',
        items: [
          { name: 'Água Mineral 500ml', unit: 'cx' },
          { name: 'Água Mineral 1,5L', unit: 'cx' },
          { name: 'Refrigerante Lata', unit: 'cx' },
          { name: 'Refrigerante PET 2L', unit: 'un' },
          { name: 'Suco de Laranja Natural', unit: 'lt' },
          { name: 'Suco de Caixinha', unit: 'cx' },
          { name: 'Energético', unit: 'un' },
          { name: 'Cerveja Lata', unit: 'cx' },
          { name: 'Vinho', unit: 'un' },
        ]
      }
    ]
  },
  {
    key: 'FUNC_COMIDA',
    label: 'FUNC.',
    groups: [
      {
        group: 'Alimentação de Funcionários',
        items: [
          { name: 'Arroz', unit: 'kg' },
          { name: 'Feijão', unit: 'kg' },
          { name: 'Macarrão', unit: 'kg' },
          { name: 'Óleo de Soja', unit: 'lt' },
          { name: 'Sal', unit: 'kg' },
          { name: 'Tempero Completo', unit: 'un' },
          { name: 'Carne para Funcionários', unit: 'kg' },
          { name: 'Frango para Funcionários', unit: 'kg' },
          { name: 'Ovos', unit: 'dz' },
          { name: 'Pão de Forma', unit: 'un' },
          { name: 'Manteiga', unit: 'un' },
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
  cmv: {},        // { semana_1: { faturamento: 100000, meta_pct: 30, notas: [] } }
  dre: {}         // { 'YYYY-MM': { impostos_pct, mao_obra_propria, mao_obra_terceiros, despesas: {} } }
};

// ── DRE: mês de navegação ─────────────────────────────────────
let dreMesKey = (() => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
})();

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

function getNextWeekKey(weekKey) {
  const mon = getWeekMonday(weekKey);
  mon.setDate(mon.getDate() + 7);
  return getWeekKey(mon);
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
    if (logoutBtn) {
      logoutBtn.style.display = 'inline-flex';
      if (_session && _session.nome) logoutBtn.textContent = `↩ ${_session.nome}`;
    }
  }

  loadState();
  updateCloudStatus('sync');
  await Promise.all([loadGeminiKey(), loadPins(), loadLinhas()]);

  await loadUnitConfig();
  applyUnitConfig();
  initFichas();

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

  ['dashboard','contagem','cmv','config','comparativo','dre'].forEach(v => {
    const el = document.getElementById('view-' + v);
    if (el) el.style.display = v === view ? '' : 'none';
  });

  // Tabs de seção e barra de pesquisa só na contagem
  const invTabs   = document.getElementById('invTabs');
  const searchBar = document.querySelector('.inv-search-bar');
  if (invTabs)   invTabs.style.display   = view === 'contagem' ? '' : 'none';
  if (searchBar) searchBar.style.display = view === 'contagem' ? '' : 'none';

  if (view === 'dashboard')   renderDashboard();
  if (view === 'contagem')    renderContagemDash();
  if (view === 'cmv')         renderCMVPanel();
  if (view === 'config')      renderConfigView();
  if (view === 'comparativo') renderComparativo();
  if (view === 'dre')         renderDRE();
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

  try { el.innerHTML = `
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
  `; } catch(e) { el.innerHTML = '<p style="padding:20px;color:red;font-size:13px">Erro dashboard: ' + e.message + '</p>'; }
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
      <button class="config-btn" onclick="openFichas()">📋 Fichas Técnicas</button>
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

// ── Mini dashboard de contagem ────────────────────────────────
function renderContagemDash() {
  const el = document.getElementById('contagemDash');
  if (!el) return;

  const weekKey = state.semana;
  let totalAll = 0, startedAll = 0, completedAll = 0;
  const sectionStats = [];

  for (const section of SECTIONS) {
    if (section.key === 'RESUMO' || section.key === 'CMV') continue;
    const sData = (state.data[section.key] || {})[weekKey] || {};
    let started = 0, completed = 0, total = 0;
    for (const g of section.groups) {
      for (const item of g.items) {
        total++;
        const d = sData[item.name] || {};
        if (d.i !== undefined) started++;
        if (d.i !== undefined && d.f !== undefined) completed++;
      }
    }
    sectionStats.push({ key: section.key, label: section.label, started, completed, total });
    totalAll += total;
    startedAll += started;
    completedAll += completed;
  }

  const pct      = totalAll > 0 ? Math.round(startedAll / totalAll * 100) : 0;
  const missing  = totalAll - startedAll;
  const pctColor = pct === 100 ? '#16a34a' : pct >= 60 ? '#f59e0b' : '#dc2626';

  const lastCount = state.lastCountDate
    ? new Date(state.lastCountDate).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    : null;

  const chipsHtml = sectionStats.map(s => {
    const cls = (s.completed === s.total && s.total > 0) ? 'cntdash-chip-done'
      : s.started > 0 ? 'cntdash-chip-partial'
      : 'cntdash-chip-empty';
    const icon = (s.completed === s.total && s.total > 0) ? '✓ ' : '';
    return `<span class="cntdash-chip ${cls}" onclick="switchTab('${s.key}')">${icon}${escHtml(s.label)} <em>${s.started}/${s.total}</em></span>`;
  }).join('');

  const completedPct = totalAll > 0 ? Math.round(completedAll / totalAll * 100) : 0;

  el.innerHTML = `
    <div class="cntdash-card">
      <div class="cntdash-top-row">
        <div class="cntdash-pct-block">
          <span class="cntdash-pct" style="color:${pctColor}">${pct}%</span>
          <span class="cntdash-pct-sub">iniciado</span>
        </div>
        <div class="cntdash-info-block">
          <span class="cntdash-counts">${startedAll} de ${totalAll} itens iniciados</span>
          ${completedAll > 0 && completedAll < totalAll
            ? `<span class="cntdash-missing">${completedAll} completos · ${totalAll - startedAll} pendentes</span>`
            : completedAll === totalAll && totalAll > 0
            ? `<span class="cntdash-done">Contagem completa ✓</span>`
            : missing > 0
            ? `<span class="cntdash-missing">${missing} item${missing !== 1 ? 'ns' : ''} sem inicial</span>`
            : ''}
          ${lastCount ? `<span class="cntdash-last">Últ. atualização: ${lastCount}</span>` : ''}
        </div>
      </div>
      <div class="cntdash-bar-bg">
        <div class="cntdash-bar-fill" style="width:${pct}%;background:${pctColor}"></div>
        ${completedPct > 0 ? `<div class="cntdash-bar-complete" style="width:${completedPct}%"></div>` : ''}
      </div>
      <div class="cntdash-chips">${chipsHtml}</div>
    </div>`;
}

// ── Construção de seções ──────────────────────────────────────
function buildSections() {
  const main = document.getElementById('view-contagem');
  let html = '<div id="contagemDash" class="contagem-dash-wrap"></div>';

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
  renderContagemDash();
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
        if (iEl) iEl.value = saved.i !== undefined ? saved.i : '';
        if (eEl) eEl.value = saved.e !== undefined ? saved.e : '';
        if (fEl) fEl.value = saved.f !== undefined ? saved.f : '';

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

  // Quando Final é preenchido, propaga automaticamente como Inicial da semana seguinte
  if (field === 'f' && val !== undefined) {
    const nextKey = getNextWeekKey(weekKey);
    if (!state.data[sectionKey][nextKey]) state.data[sectionKey][nextKey] = {};
    if (!state.data[sectionKey][nextKey][itemName]) state.data[sectionKey][nextKey][itemName] = {};
    // Só preenche se o Inicial da próxima semana ainda não foi tocado pelo usuário
    if (state.data[sectionKey][nextKey][itemName].i === undefined) {
      state.data[sectionKey][nextKey][itemName].i = val;
    }
  }

  state.lastCountDate = new Date().toISOString();
  const id = makeId(sectionKey, itemName);
  updateConsumption(id);
  updateCardFilled(id);
  updateBadge(sectionKey);
  renderContagemDash();
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
    // Histórico semanal de preços para Comparativo
    if (!state.precoSem) state.precoSem = {};
    if (!state.precoSem[state.semana]) state.precoSem[state.semana] = {};
    if (!state.precoSem[state.semana][sectionKey]) state.precoSem[state.semana][sectionKey] = {};
    state.precoSem[state.semana][sectionKey][itemName] = val;
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
  renderContagemDash();
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
  const globalAdmins = UNIT_ADMINS.global || [];
  const unitAdmins   = UNIT_ADMINS[UNIT_ID] || [];

  const globalMatch = globalAdmins.find(a => a.pin === val);
  const unitMatch   = !globalMatch && unitAdmins.find(a => a.pin === val);

  if (globalMatch || unitMatch) {
    document.getElementById('invOverlay').classList.remove('open');

    // Se já é admin (re-autenticação para ação específica), só executa callback
    if (IS_ADMIN) {
      if (window._pinCallback) {
        window._pinCallback();
        window._pinCallback = null;
      } else {
        renderResumo();
      }
      return;
    }

    // Primeiro login: salva sessão e recarrega para IS_ADMIN ser reavaliado
    const matchedAdmin = globalMatch || unitMatch;
    const session = {
      isAdmin:  true,
      isGlobal: Boolean(globalMatch),
      unidade:  UNIT_ID,
      nome:     matchedAdmin.nome,
    };
    sessionStorage.setItem('inv_session', JSON.stringify(session));
    location.reload();
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
function getCMVData(weekKey) {
  const key = weekKey || state.semana;
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

function parseNFDate(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  // DD/MM/YYYY
  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
  // YYYY-MM-DD
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return s;
  // DD-MM-YYYY
  m = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
  return null;
}

function checkNFDate(val, ocrFailed) {
  const warnEl = document.getElementById('nfDataWarn');
  const hintEl = document.getElementById('nfDataHint');
  const fieldEl = document.getElementById('nfRevData');
  if (!val) {
    if (warnEl) warnEl.textContent = '⚠ preencha a data';
    if (fieldEl) fieldEl.classList.add('nf-data-alert');
    return;
  }
  const d = new Date(val + 'T12:00:00');
  const today = new Date();
  const diffDays = Math.round((today - d) / 86400000);
  let warn = '';
  let hint = d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });
  if (ocrFailed) {
    warn = '⚠ data não lida — verifique';
  } else if (diffDays > 14) {
    warn = `⚠ ${diffDays} dias atrás — confira`;
  } else if (diffDays < 0) {
    warn = '⚠ data no futuro — confira';
  }
  if (warnEl) warnEl.textContent = warn;
  if (hintEl) hintEl.textContent = hint;
  if (fieldEl) fieldEl.classList.toggle('nf-data-alert', !!warn);
}

function showNFReview(geminiData) {
  document.getElementById('nfReviewLoading').style.display = 'none';
  document.getElementById('nfReviewContent').style.display = 'block';

  const fornEl = document.getElementById('nfRevFornecedor');
  const dataEl = document.getElementById('nfRevData');
  if (fornEl) fornEl.value = geminiData.fornecedor || '';
  populateLinhaSelect('nfRevLinha', geminiData.fornecedor || '', geminiData.itens || []);
  if (dataEl) {
    const parsed = parseNFDate(geminiData.data);
    dataEl.value = parsed || new Date().toISOString().slice(0,10);
    checkNFDate(dataEl.value, !parsed);
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

  if (!state.precoSem) state.precoSem = {};
  if (!state.precoSem[state.semana]) state.precoSem[state.semana] = {};

  let updatedPrices = 0;
  const weekKey = state.semana;
  for (const item of included) {
    if (!item.match) continue;
    const { sectionKey, itemName } = item.match;

    // Atualizar cotação (preço)
    if (item.preco_unitario > 0) {
      if (!state.cotacoes[q][sectionKey]) state.cotacoes[q][sectionKey] = {};
      state.cotacoes[q][sectionKey][itemName] = item.preco_unitario;
      if (!state.precoSem[state.semana][sectionKey]) state.precoSem[state.semana][sectionKey] = {};
      state.precoSem[state.semana][sectionKey][itemName] = item.preco_unitario;
      updatedPrices++;
    }

    // Somar quantidade da NF nas Entradas da semana
    if (item.quantidade > 0) {
      if (!state.data[sectionKey]) state.data[sectionKey] = {};
      if (!state.data[sectionKey][weekKey]) state.data[sectionKey][weekKey] = {};
      if (!state.data[sectionKey][weekKey][itemName]) state.data[sectionKey][weekKey][itemName] = {};
      const prev = state.data[sectionKey][weekKey][itemName].e || 0;
      state.data[sectionKey][weekKey][itemName].e = +(prev + item.quantidade).toFixed(4);
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

function buildNotasByLinhaHtml(notas) {
  // Agrupar notas por linha (considera split e nota simples)
  const groups = {};
  for (const n of notas) {
    if (n.linhas?.length) {
      for (const l of n.linhas) {
        const key = l.linha || 'Outros';
        if (!groups[key]) groups[key] = [];
        groups[key].push({ nota: n, valor: l.valor, split: true });
      }
    } else {
      const key = n.linha || 'Outros';
      if (!groups[key]) groups[key] = [];
      groups[key].push({ nota: n, valor: n.valor, split: false });
    }
  }

  if (!Object.keys(groups).length) return '<p class="cmv-panel-notas-vazio">Nenhuma nota nesta semana</p>';

  // Ordenar: linhas conhecidas primeiro, Outros por último
  const known = linhasConfig.linhas;
  const sortedKeys = Object.keys(groups).sort((a, b) => {
    if (a === 'Outros' || a === '') return 1;
    if (b === 'Outros' || b === '') return -1;
    const ia = known.indexOf(a), ib = known.indexOf(b);
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
  });

  const linhaOpts = known.map(l => `<option value="${escHtml(l)}">${escHtml(l)}</option>`).join('');

  return sortedKeys.map(key => {
    const items  = groups[key];
    const total  = items.reduce((s, i) => s + i.valor, 0);
    const isOutros = !key || key === 'Outros';

    const rows = items.map(({ nota: n, valor, split }) => {
      const reassign = split
        ? `<button class="cmv-lg-icon" onclick="openSplitNota('${n.id}')" title="Editar divisão">✂</button>`
        : `<select class="cmv-lg-select" onchange="quickReassignLinha('${n.id}',this.value)">
             <option value="${escHtml(key)}" selected>${escHtml(key)}</option>
             ${linhaOpts.replace(`value="${escHtml(key)}"`, `value="${escHtml(key)}" hidden`)}
           </select>`;
      return `<div class="cmv-lg-row">
        <div class="cmv-lg-row-left">
          <span class="cmv-lg-forn">${escHtml(n.fornecedor)}</span>
          <span class="cmv-lg-data">${n.data || ''}</span>
        </div>
        <div class="cmv-lg-row-right">
          <span class="cmv-lg-val">R$ ${fmt(valor)}</span>
          ${reassign}
          <button class="cmv-lg-icon" onclick="openEditNota('${n.id}')">✏️</button>
        </div>
      </div>`;
    }).join('');

    return `<div class="cmv-lg-group${isOutros ? ' cmv-lg-outros' : ''}">
      <div class="cmv-lg-header">
        <span class="cmv-lg-linha-name">${isOutros ? '⚠ ' : ''}${escHtml(key || 'Outros')}</span>
        ${isOutros ? '<span class="cmv-lg-warn-badge">reclassificar</span>' : ''}
        <span class="cmv-lg-total">R$ ${fmt(total)}</span>
      </div>
      <div class="cmv-lg-rows">${rows}</div>
    </div>`;
  }).join('');
}

function switchNotasTab(tab, btn) {
  document.querySelectorAll('.cmv-nvtab').forEach(b => b.classList.toggle('active', b === btn));
  const t = document.getElementById('notasTabTodas');
  const l = document.getElementById('notasTabLinha');
  if (t) t.style.display = tab === 'todas' ? '' : 'none';
  if (l) l.style.display = tab === 'linha'  ? '' : 'none';
}

function quickReassignLinha(notaId, novaLinha) {
  if (!novaLinha) return;
  const d = getCMVData();
  const nota = (d.notas || []).find(n => n.id === notaId);
  if (!nota) return;
  nota.linha = novaLinha;
  delete nota.linhas;
  learnFornecedorLinha(nota.fornecedor, novaLinha);
  doSave();
  renderCMVPanel();
  showToast('Linha atualizada ✓');
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

  let barColor = '#22c55e';
  if (progPct >= 100) barColor = '#ef4444';
  else if (progPct >= 80) barColor = '#f59e0b';

  const geminiOk = !!getGeminiKey();

  // Lista de notas (aba Todas)
  const notasHtml = notas.length
    ? notas.map(n => {
        const linhasDisplay = n.linhas?.length
          ? n.linhas.map(l => `<span class="cmv-panel-nota-linha">${escHtml(l.linha)} R$ ${fmt(l.valor)}</span>`).join('')
          : n.linha ? `<span class="cmv-panel-nota-linha">${escHtml(n.linha)}</span>` : '<span class="cmv-panel-nota-linha" style="color:#f59e0b">sem linha</span>';
        return `<div class="cmv-panel-nota">
          <div style="display:flex;flex-direction:column;gap:2px;flex:1;min-width:0">
            <span class="cmv-panel-nota-forn">${escHtml(n.fornecedor)}</span>
            <div style="display:flex;flex-wrap:wrap;gap:4px">${linhasDisplay}</div>
          </div>
          <span class="cmv-panel-nota-data">${n.data || ''}</span>
          <span class="cmv-panel-nota-val">R$ ${fmt(n.valor)}</span>
          <button class="cmv-nota-split" onclick="openSplitNota('${n.id}')" title="Dividir por linha">✂</button>
          <button class="cmv-nota-edit" onclick="openEditNota('${n.id}')" title="Editar">✏️</button>
          <button class="cmv-nota-del" onclick="deleteNota('${n.id}')">✕</button>
        </div>`;
      }).join('')
    : `<p class="cmv-panel-notas-vazio">Nenhuma nota inserida nesta semana</p>`;

  // Breakdown por linha
  const breakdown = calcLinhaBreakdown(notas, fat);
  const linhaBreakdownHtml = breakdown.length > 0 ? `
    <div class="cmv-linhas-breakdown">
      <div class="cmv-linhas-title">Gasto por linha</div>
      ${breakdown.map(b => `
        <div class="cmv-linha-row">
          <span class="cmv-linha-nome">${escHtml(b.linha)}</span>
          <span class="cmv-linha-val">R$ ${fmt(b.total)}</span>
          ${b.pct !== null ? `<span class="cmv-linha-pct">${b.pct.toFixed(1)}%</span>` : ''}
        </div>`).join('')}
    </div>` : '';

  // YTD mês
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
  const cmvYTD   = fatYTD > 0 ? gastoYTD / fatYTD * 100 : null;
  const ytdColor = cmvYTD != null
    ? (cmvYTD > pct * 1.1 ? '#ef4444' : cmvYTD > pct ? '#f59e0b' : '#4ade80')
    : '#9ca3af';

  // Verificar se há notas em "Outros" para alerta
  const hasOutros = notas.some(n => !n.linha && !n.linhas?.length || n.linha === 'Outros');

  panel.innerHTML = `
    <div class="cmv-panel-header">

      <!-- Topbar: data + ícones admin -->
      <div class="cmv-panel-topbar">
        <div class="cmv-panel-topbar-left">
          <span class="cmv-panel-week-label">${getWeekLabel(state.semana)}</span>
          ${hasOutros ? `<span class="cmv-outros-alert">⚠ Notas sem linha</span>` : ''}
        </div>
        <div class="cmv-panel-icon-row">
          ${IS_ADMIN ? `<button class="cmv-icon-btn" onclick="openCMVConfig()" title="Faturamento e meta">⚙️</button>` : ''}
          ${IS_ADMIN ? `<button class="cmv-icon-btn" onclick="openLinhas()" title="Linhas de produto">📦</button>` : ''}
          ${IS_ADMIN ? `<button class="cmv-icon-btn" onclick="openGeminiKeyModal()" title="Chave Gemini IA">🔑</button>` : ''}
          ${IS_ADMIN ? `<button class="cmv-icon-btn" onclick="openTrocarPin()" title="Meu PIN">👤</button>` : ''}
        </div>
      </div>

      <!-- Botões principais: Foto NF + Manual -->
      <div class="cmv-panel-main-btns">
        <button class="cmv-mainbtn-foto" onclick="openCameraForNF()">
          📷 Foto NF${geminiOk ? '' : ' ⚠'}
        </button>
        <button class="cmv-mainbtn-manual" onclick="openNFManual()">
          📝 Manual
        </button>
      </div>

      <!-- KPIs -->
      <div class="cmv-kpis-row">
        <div class="cmv-kpi-block">
          <span class="cmv-kpi-label">CMV semana</span>
          <span class="cmv-kpi-value" style="color:${barColor}">${cmvReal !== null ? cmvReal.toFixed(1) + '%' : '—'}</span>
          <span class="cmv-kpi-sub">${fat ? `meta ${pct}% · R$ ${fmt(total)}` : IS_ADMIN ? 'configure ⚙️' : 'sem faturamento'}</span>
        </div>
        <div class="cmv-kpi-divider"></div>
        <div class="cmv-kpi-block">
          <span class="cmv-kpi-label">CMV mês</span>
          <span class="cmv-kpi-value" style="color:${ytdColor}">${cmvYTD != null ? cmvYTD.toFixed(1) + '%' : '—'}</span>
          <span class="cmv-kpi-sub">${fatYTD > 0 ? `R$ ${fmt(gastoYTD)} / R$ ${fmt(fatYTD)}` : 'aguardando dados'}</span>
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
      </div>` : ''}

      ${linhaBreakdownHtml}

      <!-- Notas com tabs Todas / Por Linha -->
      <div class="cmv-panel-notas-section">
        <button class="cmv-notas-toggle" onclick="toggleNotasDrawer(this)">
          📋 ${notas.length} nota${notas.length !== 1 ? 's' : ''} · R$ ${fmt(total)}
          <span class="cmv-notas-toggle-icon">▾</span>
        </button>
        <div class="cmv-notas-drawer" style="display:none">
          <div class="cmv-notas-view-tabs">
            <button class="cmv-nvtab active" onclick="switchNotasTab('todas',this)">Todas</button>
            <button class="cmv-nvtab" onclick="switchNotasTab('linha',this)">Por Linha ${hasOutros ? '⚠' : ''}</button>
          </div>
          <div id="notasTabTodas">
            <div class="cmv-panel-notas-list">${notasHtml}</div>
          </div>
          <div id="notasTabLinha" style="display:none">
            ${buildNotasByLinhaHtml(notas)}
          </div>
        </div>
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
  'Hortifruti', 'Alimentos', 'Bebidas', 'Embalagens',
  'Sobremesas', 'Comida Funcionários', 'Limpeza', 'Outros'
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

function normalizeForn(s) {
  return s.toLowerCase().trim()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
}

function autoFillLinha(selectId, fornecedor) {
  const sel = document.getElementById(selectId);
  if (!sel || !fornecedor.trim()) return;
  const norm = normalizeForn(fornecedor);
  const known = linhasConfig.fornecedores || {};

  // Busca exata primeiro
  let linha = known[norm];

  // Busca substring se não achou
  if (!linha) {
    for (const [key, val] of Object.entries(known)) {
      if (norm.includes(key) || key.includes(norm)) { linha = val; break; }
    }
  }

  if (linha && linhasConfig.linhas.includes(linha)) sel.value = linha;
}

function learnFornecedorLinha(fornecedor, linha) {
  if (!fornecedor || !linha) return;
  if (!linhasConfig.fornecedores) linhasConfig.fornecedores = {};
  linhasConfig.fornecedores[normalizeForn(fornecedor)] = linha;
  saveLinhas();
}

// ── Linhas overlay — navegação ────────────────────────────────
let linhasWeekKey   = '';
let linhasViewStack = [];   // ['home'] | ['home','notas','edit']
let linhasActiveLinha  = '';
let linhasActiveNotaId = '';

function openLinhas() {
  linhasWeekKey   = state.semana;
  linhasViewStack = ['home'];
  document.getElementById('invLinhasOverlay').style.display = 'flex';
  renderLinhasWeekBar();
  showLinhasView('home');
}

function closeLinhas() {
  document.getElementById('invLinhasOverlay').style.display = 'none';
  linhasViewStack = [];
}

function linhasGoBack() {
  linhasViewStack.pop();
  const prev = linhasViewStack[linhasViewStack.length - 1] || 'home';
  showLinhasView(prev);
}

function showLinhasView(view) {
  ['home','notas','editNota'].forEach(v => {
    const el = document.getElementById('linhasView' + v.charAt(0).toUpperCase() + v.slice(1));
    if (el) el.style.display = v === view ? 'flex' : 'none';
  });
  const backBtn = document.getElementById('linhasBackBtn');
  const titleEl = document.getElementById('linhasTitle');
  if (backBtn) backBtn.style.display = linhasViewStack.length > 1 ? '' : 'none';

  if (view === 'home') {
    if (titleEl) titleEl.textContent = 'Linhas de Produto';
    renderLinhasHome();
  } else if (view === 'notas') {
    if (titleEl) titleEl.textContent = linhasActiveLinha || 'Notas';
    renderLinhasNotas();
  } else if (view === 'editNota') {
    if (titleEl) titleEl.textContent = 'Editar Nota';
    renderLinhasEditNota();
  }
}

function linhasChangeWeek(dir) {
  const mon = getWeekMonday(linhasWeekKey);
  mon.setDate(mon.getDate() + dir * 7);
  linhasWeekKey = getWeekKey(mon);
  renderLinhasWeekBar();
  // Re-render current view
  const cur = linhasViewStack[linhasViewStack.length - 1] || 'home';
  showLinhasView(cur);
}

function renderLinhasWeekBar() {
  const el = document.getElementById('linhasWeekLbl');
  if (el) el.textContent = getWeekLabel(linhasWeekKey);
}

// ── View 1: Home — resumo por linha ──────────────────────────
function calcLinhaMap(notas) {
  const map = {};
  for (const n of notas) {
    if (n.linhas && n.linhas.length) {
      for (const e of n.linhas) { const l = e.linha || 'Outros'; map[l] = (map[l] || 0) + (e.valor || 0); }
    } else {
      const l = n.linha || 'Outros'; map[l] = (map[l] || 0) + (n.valor || 0);
    }
  }
  return map;
}

function renderLinhasHome() {
  const el = document.getElementById('linhasHomeContent');
  if (!el) return;
  const d = getCMVData(linhasWeekKey);
  const notas = d.notas || [];
  const breakdown = calcLinhaMap(notas);
  const total = Object.values(breakdown).reduce((s, v) => s + v, 0);

  // Ordenar: linhas configuradas primeiro, depois eventuais extras
  const ordered = [...linhasConfig.linhas];
  Object.keys(breakdown).forEach(l => { if (!ordered.includes(l)) ordered.push(l); });
  // Linhas sem notas também aparecem (valor 0)

  if (!notas.length) {
    el.innerHTML = '<p class="linhas-empty">Nenhuma nota nesta semana</p>';
    return;
  }

  el.innerHTML = ordered.map(linha => {
    const val  = breakdown[linha] || 0;
    const pct  = total > 0 ? Math.round(val / total * 100) : 0;
    const cnt  = contarNotasLinha(notas, linha);
    const isOutros = (linha === 'Outros' || linha === '');
    return `<div class="linhas-card ${isOutros && cnt > 0 ? 'linhas-card-warn' : ''}" onclick="openLinhaNotas('${escHtml(linha)}')">
      <div class="linhas-card-top">
        <span class="linhas-card-nome">${escHtml(linha || 'Sem linha')}</span>
        <span class="linhas-card-val">R$ ${fmt(val)}</span>
      </div>
      <div class="linhas-bar-bg"><div class="linhas-bar-fill" style="width:${pct}%"></div></div>
      <div class="linhas-card-foot">
        <span>${cnt} nota${cnt !== 1 ? 's' : ''}</span>
        <span>${pct}% do total</span>
      </div>
    </div>`;
  }).join('') + `<div class="linhas-total-row"><span>Total semana</span><span>R$ ${fmt(total)}</span></div>`;
}

function contarNotasLinha(notas, linha) {
  return notas.filter(n => {
    if (n.linhas && n.linhas.length) return n.linhas.some(e => (e.linha || 'Outros') === linha);
    return (n.linha || 'Outros') === linha;
  }).length;
}

function openLinhaNotas(linha) {
  linhasActiveLinha = linha;
  linhasViewStack.push('notas');
  showLinhasView('notas');
}

// ── View 2: Notas de uma linha ────────────────────────────────
function renderLinhasNotas() {
  const el = document.getElementById('linhasNotasContent');
  if (!el) return;
  const d = getCMVData(linhasWeekKey);
  const notas = (d.notas || []).filter(n => {
    if (n.linhas && n.linhas.length) return n.linhas.some(e => (e.linha || 'Outros') === linhasActiveLinha);
    return (n.linha || 'Outros') === linhasActiveLinha;
  });

  if (!notas.length) {
    el.innerHTML = '<p class="linhas-empty">Nenhuma nota nesta linha nesta semana</p>';
    return;
  }

  el.innerHTML = notas.map(n => {
    const isSplit = n.linhas && n.linhas.length > 0;
    const valorLinha = isSplit
      ? (n.linhas.find(e => (e.linha || 'Outros') === linhasActiveLinha)?.valor || 0)
      : n.valor;
    const splitTag = isSplit ? `<span class="linhas-split-tag">dividida · ${n.linhas.length} linhas</span>` : '';
    return `<div class="linhas-nota-card" onclick="openEditNota('${n.id}')">
      <div class="linhas-nota-top">
        <span class="linhas-nota-forn">${escHtml(n.fornecedor || '—')}</span>
        <span class="linhas-nota-val">R$ ${fmt(valorLinha)}</span>
      </div>
      <div class="linhas-nota-foot">
        <span>${n.data || '—'} ${splitTag}</span>
        <span class="linhas-nota-edit-hint">Toque para editar →</span>
      </div>
    </div>`;
  }).join('');
}

function openEditNota(notaId) {
  linhasActiveNotaId = notaId;
  linhasViewStack.push('editNota');
  showLinhasView('editNota');
}

// ── View 3: Editar nota ───────────────────────────────────────
function renderLinhasEditNota() {
  const el = document.getElementById('linhasEditNotaContent');
  if (!el) return;
  const d = getCMVData(linhasWeekKey);
  const nota = (d.notas || []).find(n => n.id === linhasActiveNotaId);
  if (!nota) { el.innerHTML = '<p class="linhas-empty">Nota não encontrada</p>'; return; }

  const isSplit = nota.linhas && nota.linhas.length > 0;
  const linhaOpts = linhasConfig.linhas.map(l =>
    `<option value="${escHtml(l)}">${escHtml(l)}</option>`).join('');

  // Data no formato YYYY-MM-DD para input[type=date]
  const dataISO = parseNotaDataToISO(nota.data);

  const splitRows = (isSplit ? nota.linhas : [{ linha: nota.linha || '', valor: nota.valor || 0 }])
    .map((entry, idx) => `
      <div class="linhas-split-row" id="splitRow_${idx}">
        <select class="linhas-split-sel" onchange="linhasEditSplitLinha(${idx},this.value)">
          ${linhasConfig.linhas.map(l => `<option value="${escHtml(l)}"${(entry.linha||'')=== l?' selected':''}>${escHtml(l)}</option>`).join('')}
        </select>
        <input class="linhas-split-val" type="number" inputmode="decimal" step="0.01"
          value="${(entry.valor||0).toFixed(2)}"
          oninput="linhasEditSplitValor(${idx},parseFloat(this.value)||0)">
        ${(isSplit || idx > 0) ? `<button class="linhas-split-del" onclick="linhasRemoveSplitRow(${idx})">✕</button>` : '<span></span>'}
      </div>`).join('');

  el.innerHTML = `
    <div class="linhas-edit-form">
      <div class="linhas-edit-field">
        <label>Fornecedor</label>
        <input id="leditForn" type="text" value="${escHtml(nota.fornecedor || '')}" placeholder="Fornecedor">
      </div>
      <div class="linhas-edit-field">
        <label>Data da nota</label>
        <input id="leditData" type="date" value="${dataISO}">
      </div>
      <div class="linhas-edit-field">
        <label>Valor total</label>
        <span class="linhas-edit-total" id="leditTotal">R$ ${fmt(nota.valor || 0)}</span>
      </div>

      <div class="linhas-split-header">
        <span>Linha${isSplit ? 's' : ''} de produto</span>
        <button class="linhas-add-split-btn" onclick="linhasAddSplitRow()">+ Dividir</button>
      </div>
      <div id="linhasSplitRows">${splitRows}</div>
      <div class="linhas-split-resto" id="linhasSplitResto"></div>

      <div class="linhas-edit-actions">
        <button class="linhas-save-btn" onclick="saveLinhasEditNota()">Salvar</button>
        <button class="linhas-del-nota-btn" onclick="deleteLinhasNota()">Excluir nota</button>
      </div>
    </div>`;

  linhasUpdateResto();
}

// Helpers temporários para edição de splits (guardados no DOM)
function linhasGetSplitState() {
  const rows = document.querySelectorAll('.linhas-split-row');
  return [...rows].map(row => ({
    linha: row.querySelector('.linhas-split-sel')?.value || '',
    valor: parseFloat(row.querySelector('.linhas-split-val')?.value) || 0
  }));
}

function linhasEditSplitLinha(idx, val) { linhasUpdateResto(); }
function linhasEditSplitValor(idx, val) { linhasUpdateResto(); }

function linhasUpdateResto() {
  const nota = (getCMVData(linhasWeekKey).notas || []).find(n => n.id === linhasActiveNotaId);
  if (!nota) return;
  const splits = linhasGetSplitState();
  const totalSplit = splits.reduce((s, r) => s + r.valor, 0);
  const resto = +(nota.valor - totalSplit).toFixed(2);
  const el = document.getElementById('linhasSplitResto');
  if (!el) return;
  if (splits.length > 1) {
    el.textContent = resto !== 0
      ? `Diferença: R$ ${fmt(Math.abs(resto))} ${resto < 0 ? '(excede)' : '(falta)'}`
      : 'Valores conferem ✓';
    el.className = 'linhas-split-resto' + (resto !== 0 ? ' linhas-split-resto-warn' : ' linhas-split-resto-ok');
  } else {
    el.textContent = '';
  }
}

function linhasAddSplitRow() {
  const container = document.getElementById('linhasSplitRows');
  if (!container) return;
  const idx = container.querySelectorAll('.linhas-split-row').length;
  const div = document.createElement('div');
  div.className = 'linhas-split-row';
  div.id = 'splitRow_' + idx;
  div.innerHTML = `
    <select class="linhas-split-sel" onchange="linhasEditSplitLinha(${idx},this.value)">
      ${linhasConfig.linhas.map(l => `<option value="${escHtml(l)}">${escHtml(l)}</option>`).join('')}
    </select>
    <input class="linhas-split-val" type="number" inputmode="decimal" step="0.01" value="0"
      oninput="linhasEditSplitValor(${idx},parseFloat(this.value)||0)">
    <button class="linhas-split-del" onclick="linhasRemoveSplitRow(${idx})">✕</button>`;
  container.appendChild(div);
  linhasUpdateResto();
}

function linhasRemoveSplitRow(idx) {
  const row = document.getElementById('splitRow_' + idx);
  if (row) row.remove();
  // Re-index IDs
  document.querySelectorAll('.linhas-split-row').forEach((r, i) => {
    r.id = 'splitRow_' + i;
    const sel = r.querySelector('.linhas-split-sel');
    const inp = r.querySelector('.linhas-split-val');
    const del = r.querySelector('.linhas-split-del');
    if (sel) sel.setAttribute('onchange', `linhasEditSplitLinha(${i},this.value)`);
    if (inp) inp.setAttribute('oninput', `linhasEditSplitValor(${i},parseFloat(this.value)||0)`);
    if (del) del.setAttribute('onclick', `linhasRemoveSplitRow(${i})`);
  });
  linhasUpdateResto();
}

function saveLinhasEditNota() {
  const d = getCMVData(linhasWeekKey);
  const nota = (d.notas || []).find(n => n.id === linhasActiveNotaId);
  if (!nota) return;

  const forn  = document.getElementById('leditForn')?.value.trim() || nota.fornecedor;
  const dataV = document.getElementById('leditData')?.value;
  const dataFmt = dataV
    ? new Date(dataV + 'T12:00:00').toLocaleDateString('pt-BR')
    : nota.data;

  nota.fornecedor = forn;
  nota.data = dataFmt;

  const splits = linhasGetSplitState();
  if (splits.length === 1) {
    nota.linha  = splits[0].linha;
    delete nota.linhas;
  } else {
    nota.linhas = splits;
    nota.linha  = '';
  }

  doSave();
  renderCMVPanel();
  showToast('Nota atualizada ✓');
  linhasGoBack();
}

function deleteLinhasNota() {
  if (!confirm('Excluir esta nota?')) return;
  const d = getCMVData(linhasWeekKey);
  d.notas = (d.notas || []).filter(n => n.id !== linhasActiveNotaId);
  doSave();
  renderCMVPanel();
  showToast('Nota excluída');
  linhasGoBack();
}

function parseNotaDataToISO(dataStr) {
  if (!dataStr) return new Date().toISOString().slice(0, 10);
  const p = dataStr.split('/');
  if (p.length === 3) return `${p[2]}-${p[1].padStart(2,'0')}-${p[0].padStart(2,'0')}`;
  return new Date().toISOString().slice(0, 10);
}

function toggleLinhasMgr() {
  const sec = document.getElementById('linhasMgrSection');
  if (!sec) return;
  const open = sec.style.display === 'none';
  sec.style.display = open ? 'block' : 'none';
  if (open) renderLinhasList();
}

function renderLinhasList() {
  const el = document.getElementById('linhasList');
  if (!el) return;
  el.innerHTML = linhasConfig.linhas.map((l, i) => `
    <div class="linhas-mgr-row">
      <span>${escHtml(l)}</span>
      ${linhasConfig.linhas.length > 1
        ? `<button class="linhas-mgr-del" onclick="removeLinha(${i})">✕</button>` : ''}
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
    if (n.linhas && n.linhas.length) {
      // nota dividida em múltiplas linhas
      for (const entry of n.linhas) {
        const l = entry.linha || 'Outros';
        map[l] = (map[l] || 0) + (entry.valor || 0);
      }
    } else {
      const l = n.linha || 'Outros';
      map[l] = (map[l] || 0) + (n.valor || 0);
    }
  }
  return Object.entries(map)
    .filter(([, v]) => v > 0)
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

// ── Split de nota por linha ───────────────────────────────────
let _splitNotaId = null;

function openSplitNota(id) {
  const d = getCMVData();
  const nota = (d.notas || []).find(n => n.id === id);
  if (!nota) return;
  _splitNotaId = id;

  document.getElementById('splitNotaInfo').textContent =
    `${nota.fornecedor} · ${nota.data || ''} · Total: R$ ${fmt(nota.valor)}`;

  // Monta linhas existentes ou inicializa com a linha atual
  const linhas = nota.linhas?.length
    ? nota.linhas.map(l => ({...l}))
    : [{ linha: nota.linha || '', valor: nota.valor || 0 }];

  renderSplitRows(linhas, nota.valor);
  document.getElementById('invSplitNotaOverlay').classList.add('open');
}

function renderSplitRows(linhas, total) {
  const container = document.getElementById('splitNotaRows');
  container.innerHTML = linhas.map((l, i) => `
    <div class="split-row" data-idx="${i}">
      <select class="split-linha-sel" onchange="updateSplitCalc()">
        <option value="">— linha —</option>
        ${linhasConfig.linhas.map(ln => `<option value="${escHtml(ln)}" ${l.linha === ln ? 'selected' : ''}>${escHtml(ln)}</option>`).join('')}
      </select>
      <div style="display:flex;align-items:center;gap:4px">
        <span style="font-size:12px;color:#6b7280">R$</span>
        <input type="number" inputmode="decimal" class="split-val-inp" value="${l.valor || ''}" placeholder="0,00" step="0.01" oninput="updateSplitCalc()">
      </div>
      ${linhas.length > 1 ? `<button onclick="removeSplitRow(${i})" style="background:none;border:none;color:#9ca3af;font-size:16px;cursor:pointer;padding:4px">✕</button>` : ''}
    </div>
  `).join('');
  updateSplitCalc();
}

function updateSplitCalc() {
  const nota = (getCMVData().notas || []).find(n => n.id === _splitNotaId);
  if (!nota) return;
  const total = nota.valor || 0;
  const rows = document.querySelectorAll('#splitNotaRows .split-row');
  let soma = 0;
  rows.forEach(row => {
    const v = parseFloat(row.querySelector('.split-val-inp').value) || 0;
    soma += v;
  });
  const restante = total - soma;
  const el = document.getElementById('splitNotaRestante');
  el.textContent = restante === 0 ? '✓ Distribuído corretamente'
    : restante > 0 ? `Restam R$ ${fmt(restante)} para distribuir`
    : `Excede em R$ ${fmt(Math.abs(restante))}`;
  el.style.color = restante === 0 ? '#16a34a' : '#dc2626';
}

function addSplitRow() {
  const nota = (getCMVData().notas || []).find(n => n.id === _splitNotaId);
  if (!nota) return;
  const current = getSplitRowsData();
  const soma = current.reduce((s, r) => s + r.valor, 0);
  const restante = (nota.valor || 0) - soma;
  current.push({ linha: '', valor: restante > 0 ? Math.round(restante * 100) / 100 : 0 });
  renderSplitRows(current, nota.valor);
}

function removeSplitRow(idx) {
  const nota = (getCMVData().notas || []).find(n => n.id === _splitNotaId);
  if (!nota) return;
  const current = getSplitRowsData();
  current.splice(idx, 1);
  renderSplitRows(current, nota.valor);
}

function getSplitRowsData() {
  const rows = document.querySelectorAll('#splitNotaRows .split-row');
  return Array.from(rows).map(row => ({
    linha: row.querySelector('.split-linha-sel').value,
    valor: parseFloat(row.querySelector('.split-val-inp').value) || 0,
  }));
}

function saveSplitNota() {
  const d = getCMVData();
  const nota = (d.notas || []).find(n => n.id === _splitNotaId);
  if (!nota) return;
  const rows = getSplitRowsData().filter(r => r.linha && r.valor > 0);
  if (!rows.length) { showToast('Adicione ao menos uma linha com valor'); return; }
  const soma = rows.reduce((s, r) => s + r.valor, 0);
  if (Math.abs(soma - nota.valor) > 0.01) {
    showToast('Total das linhas deve ser igual ao valor da nota'); return;
  }
  // Salva as linhas na nota
  nota.linhas = rows;
  delete nota.linha; // remove campo antigo
  // Aprende mapeamento fornecedor → primeira linha
  learnFornecedorLinha(nota.fornecedor, rows[0].linha);
  doSave();
  renderCMVPanel();
  closeSplitNota();
  showToast('Nota dividida ✓');
}

function closeSplitNota() {
  _splitNotaId = null;
  document.getElementById('invSplitNotaOverlay').classList.remove('open');
}

// ── Comparativo ───────────────────────────────────────────────
const COMP_TRACKED = [
  { section: 'COZINHA', item: 'Peito de Frango',  label: 'Frango' },
  { section: 'COZINHA', item: 'Posta Branca',      label: 'Tilápia' },
  { section: 'COZINHA', item: 'Bacon Cubos',       label: 'Bacon' },
  { section: 'COZINHA', item: 'Queijo Muçarela',   label: 'Muçarela' },
  { section: 'COZINHA', item: 'Queijo Parmesão',   label: 'Parmesão' },
  { section: 'COZINHA', item: 'Muçarela Búfala',   label: 'M. Búfala' },
];

function renderComparativo() {
  const el = document.getElementById('comparativoContent');
  if (!el) return;

  // 1. CMV por semana – últimas semanas com dados
  const cmvWeeks = Object.entries(state.cmv || {})
    .filter(([k]) => /^\d{4}-W\d{2}$/.test(k))
    .sort(([a], [b]) => a < b ? -1 : 1)
    .map(([k, d]) => {
      const fat   = d?.faturamento || 0;
      const gasto = (d?.notas || []).reduce((s, n) => s + (n.valor || 0), 0);
      const cmvPct = fat > 0 ? gasto / fat * 100 : null;
      const meta   = d?.meta_pct || 30;
      return { key: k, label: getWeekLabel(k), fat, gasto, cmvPct, meta };
    })
    .filter(w => w.fat > 0 || w.gasto > 0)
    .slice(-10);

  // 2. Preços monitorados – cotacoes (q1/q2) + precoSem (semanal)
  const cotacoes = state.cotacoes || {};
  const precoSem = state.precoSem  || {};
  const semWeeks = Object.keys(precoSem).filter(k => /^\d{4}-W\d{2}$/.test(k)).sort();
  const lastSemWeek = semWeeks[semWeeks.length - 1];
  const prevSemWeek = semWeeks[semWeeks.length - 2];

  // 3. Top fornecedores (all time)
  const fornMap = {};
  Object.values(state.cmv || {}).forEach(d => {
    (d?.notas || []).forEach(n => {
      const f = (n.fornecedor || 'Outros').trim();
      fornMap[f] = (fornMap[f] || 0) + (n.valor || 0);
    });
  });
  const totalForn = Object.values(fornMap).reduce((s, v) => s + v, 0);
  const topForn   = Object.entries(fornMap).sort((a, b) => b[1] - a[1]).slice(0, 8);

  // 4. Por linha de produto (all time)
  const linhaMap = {};
  Object.values(state.cmv || {}).forEach(d => {
    calcLinhaBreakdown(d?.notas || [], null).forEach(b => {
      linhaMap[b.linha] = (linhaMap[b.linha] || 0) + b.total;
    });
  });
  const totalLinha = Object.values(linhaMap).reduce((s, v) => s + v, 0);
  const topLinhas  = Object.entries(linhaMap).sort((a, b) => b[1] - a[1]);

  // ── Render CMV histórico
  const cmvHistHtml = cmvWeeks.length === 0
    ? '<p class="comp-empty">Nenhuma semana com dados ainda.</p>'
    : `<div class="comp-table-wrap">
        <table class="comp-table">
          <thead><tr><th>Semana</th><th>Fat.</th><th>Gasto</th><th>CMV</th></tr></thead>
          <tbody>${cmvWeeks.map(w => {
            const col = w.cmvPct == null ? '#9ca3af'
              : w.cmvPct > w.meta * 1.1 ? '#ef4444'
              : w.cmvPct > w.meta       ? '#f59e0b' : '#16a34a';
            const isCur = w.key === state.semana;
            return `<tr style="${isCur ? 'background:#fef9f9' : ''}">
              <td style="${isCur ? 'font-weight:700' : ''}">${w.label}${isCur ? ' ←' : ''}</td>
              <td>${w.fat > 0 ? 'R$ ' + fmt(w.fat) : '—'}</td>
              <td>${w.gasto > 0 ? 'R$ ' + fmt(w.gasto) : '—'}</td>
              <td style="font-weight:700;color:${col}">${w.cmvPct != null ? w.cmvPct.toFixed(1) + '%' : '—'}</td>
            </tr>`;
          }).join('')}</tbody>
        </table>
      </div>`;

  // ── Render preços monitorados
  const precosHtml = COMP_TRACKED.map(t => {
    const q     = getQuinzena(state.semana);
    const other = q === 'q1' ? 'q2' : 'q1';
    const qCur  = ((cotacoes[q]     || {})[t.section] || {})[t.item];
    const qPrev = ((cotacoes[other] || {})[t.section] || {})[t.item];
    const sCur  = lastSemWeek ? ((precoSem[lastSemWeek] || {})[t.section] || {})[t.item] : undefined;
    const sPrev = prevSemWeek ? ((precoSem[prevSemWeek] || {})[t.section] || {})[t.item] : undefined;

    const price = qCur  ?? sCur;
    const prev  = qPrev ?? sPrev;
    let varHtml = '';
    if (price != null && prev != null && prev > 0) {
      const pct = (price - prev) / prev * 100;
      const col = pct > 0 ? '#ef4444' : '#16a34a';
      varHtml = `<span class="comp-preco-var" style="color:${col}">${pct > 0 ? '▲' : '▼'} ${Math.abs(pct).toFixed(1)}%</span>`;
    }
    return `<div class="comp-preco-card">
      <span class="comp-preco-label">${escHtml(t.label)}</span>
      <span class="comp-preco-val">${price != null ? 'R$ ' + price.toFixed(2).replace('.', ',') + '/kg' : '—'}</span>
      ${varHtml}
    </div>`;
  }).join('');

  // ── Render top fornecedores
  const fornHtml = topForn.length === 0
    ? '<p class="comp-empty">Nenhuma nota registrada ainda.</p>'
    : topForn.map(([f, v], i) => {
        const pct = totalForn > 0 ? v / totalForn * 100 : 0;
        return `<div class="comp-forn-row">
          <span class="comp-forn-rank">${i + 1}</span>
          <div class="comp-forn-info">
            <span class="comp-forn-nome">${escHtml(f)}</span>
            <div class="comp-forn-bar-bg">
              <div class="comp-forn-bar-fill" style="width:${pct.toFixed(1)}%"></div>
            </div>
          </div>
          <div class="comp-forn-right">
            <span class="comp-forn-val">R$ ${fmt(v)}</span>
            <span class="comp-forn-pct">${pct.toFixed(1)}%</span>
          </div>
        </div>`;
      }).join('');

  // ── Render por linha
  const linhaHtml = topLinhas.length === 0
    ? '<p class="comp-empty">Nenhum dado de linha ainda.</p>'
    : topLinhas.map(([l, v]) => {
        const pct = totalLinha > 0 ? v / totalLinha * 100 : 0;
        return `<div class="comp-linha-row">
          <span class="comp-linha-nome">${escHtml(l)}</span>
          <div class="comp-linha-bar-bg">
            <div class="comp-linha-bar-fill" style="width:${pct.toFixed(1)}%"></div>
          </div>
          <div class="comp-linha-right">
            <span class="comp-linha-val">R$ ${fmt(v)}</span>
            <span class="comp-linha-pct">${pct.toFixed(1)}%</span>
          </div>
        </div>`;
      }).join('');

  el.innerHTML = `
    <div class="comp-view">
      <div class="comp-section">
        <div class="comp-section-title">📈 CMV por Semana</div>
        <div class="comp-section-sub">Histórico · últimas semanas com dados</div>
        ${cmvHistHtml}
      </div>
      <div class="comp-section">
        <div class="comp-section-title">💰 Preços Monitorados</div>
        <div class="comp-section-sub">Frango · Tilápia · Bacon · Queijos — vs quinzena anterior</div>
        <div class="comp-precos-grid">${precosHtml}</div>
      </div>
      <div class="comp-section">
        <div class="comp-section-title">🏆 Top Fornecedores</div>
        <div class="comp-section-sub">Total acumulado · R$ ${fmt(totalForn)}</div>
        <div class="comp-forn-list">${fornHtml}</div>
      </div>
      <div class="comp-section">
        <div class="comp-section-title">📦 Por Linha de Produto</div>
        <div class="comp-section-sub">Acumulado total · R$ ${fmt(totalLinha)}</div>
        <div class="comp-linhas-list">${linhaHtml}</div>
      </div>
    </div>`;
}

// ── Fichas Técnicas ───────────────────────────────────────────
let fichasCurrentCat = 'all';
let fichasSearchTerm = '';
let fichasEditingId  = null;

function initFichas() {
  if (!state.fichas || state.fichas.length === 0) {
    state.fichas = JSON.parse(JSON.stringify(FICHAS_DEFAULT));
  }
}

function openFichas() {
  const el = document.getElementById('fichasOverlay');
  if (!el) return;
  el.style.display = 'flex';
  fichasCurrentCat = 'all';
  fichasSearchTerm = '';
  fichasEditingId  = null;
  document.querySelectorAll('.fichas-catbtn').forEach(b => b.classList.remove('active'));
  const all = document.querySelector('.fichas-catbtn[data-cat="all"]');
  if (all) all.classList.add('active');
  const si = document.querySelector('.fichas-search');
  if (si) si.value = '';
  showFichasList();
}

function closeFichas() {
  const el = document.getElementById('fichasOverlay');
  if (el) el.style.display = 'none';
}

function filterFichas(cat) {
  fichasCurrentCat = cat;
  document.querySelectorAll('.fichas-catbtn').forEach(b => b.classList.remove('active'));
  const btn = document.querySelector(`.fichas-catbtn[data-cat="${cat}"]`);
  if (btn) btn.classList.add('active');
  renderFichasList();
}

function searchFichas(term) {
  fichasSearchTerm = term.toLowerCase();
  renderFichasList();
}

function showFichasList() {
  const lv = document.getElementById('fichasListView');
  const ev = document.getElementById('fichasEditView');
  if (lv) lv.style.display = '';
  if (ev) ev.style.display = 'none';
  renderFichasList();
}

function renderFichasList() {
  const el = document.getElementById('fichasList');
  if (!el) return;

  let fichas = state.fichas || [];
  if (fichasCurrentCat !== 'all') fichas = fichas.filter(f => f.cat === fichasCurrentCat);
  if (fichasSearchTerm)           fichas = fichas.filter(f => f.nome.toLowerCase().includes(fichasSearchTerm));

  const catLabel = { base:'Base', prato:'Prato', salada:'Salada', snack:'Snack',
                     cafe:'Café', cafe_manha:'Café Manhã', suco:'Suco' };

  if (!fichas.length) {
    el.innerHTML = '<p class="fichas-empty">Nenhuma ficha encontrada</p>';
    return;
  }

  el.innerHTML = fichas.map(f => `
    <div class="fichas-card" onclick="showFichasEdit('${f.id}')">
      <div class="fichas-card-nome">${escHtml(f.nome)}</div>
      <div class="fichas-card-meta">
        <span class="fichas-cat-badge fichas-cat-${f.cat}">${catLabel[f.cat] || f.cat}</span>
        <span>${f.ing.length} ingredientes${f.rend ? ' · rend. ' + f.rend + 'g' : ''}</span>
      </div>
    </div>`).join('');
}

function showFichasEdit(id) {
  fichasEditingId = id;
  const lv = document.getElementById('fichasListView');
  const ev = document.getElementById('fichasEditView');
  if (lv) lv.style.display = 'none';
  if (ev) ev.style.display = '';
  renderFichasEditForm(id);
}

function getAllInventoryItems() {
  const items = new Set();
  for (const section of SECTIONS) {
    if (section.key === 'RESUMO' || section.key === 'CMV') continue;
    for (const g of section.groups) for (const item of g.items) items.add(item.name);
  }
  return [...items].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

function renderFichasEditForm(id) {
  const ficha = (state.fichas || []).find(f => f.id === id);
  const el = document.getElementById('fichasEditContent');
  if (!el || !ficha) return;

  const allItems    = getAllInventoryItems();
  const datalistHtml = allItems.map(i => `<option value="${escHtml(i)}">`).join('');

  const unOpts = ['kg','g','litro','l','ml','un','caixa','mc','cx'].map(u =>
    `<option value="${u}"${ficha.ing[0]?.u === u ? '' : ''}>${u}</option>`).join('');

  const ingRows = ficha.ing.map((ing, idx) => `
    <div class="fichas-ing-row">
      <div class="fichas-ing-order">
        ${idx > 0 ? `<button class="fichas-ord-btn" onclick="moveFichaIng('${id}',${idx},-1)">▲</button>` : '<span></span>'}
        ${idx < ficha.ing.length - 1 ? `<button class="fichas-ord-btn" onclick="moveFichaIng('${id}',${idx},1)">▼</button>` : '<span></span>'}
      </div>
      <input class="fichas-ing-name" list="fichasIngList" value="${escHtml(ing.n)}"
        onchange="updateFichaIng('${id}',${idx},'n',this.value)" placeholder="Ingrediente">
      <input class="fichas-ing-qty" type="number" step="0.0001" value="${ing.q}"
        onchange="updateFichaIng('${id}',${idx},'q',parseFloat(this.value)||0)" placeholder="Qtd">
      <select class="fichas-ing-un" onchange="updateFichaIng('${id}',${idx},'u',this.value)">
        ${['kg','g','litro','l','ml','un','caixa','mc','cx'].map(u =>
          `<option value="${u}"${ing.u===u?' selected':''}>${u}</option>`).join('')}
      </select>
      <button class="fichas-ing-del" onclick="deleteFichaIng('${id}',${idx})">✕</button>
    </div>`).join('');

  const catOptions = [['base','Base'],['prato','Prato'],['salada','Salada'],['snack','Snack'],
    ['cafe','Café'],['cafe_manha','Café Manhã'],['suco','Suco']].map(([v, l]) =>
      `<option value="${v}"${ficha.cat===v?' selected':''}>${l}</option>`).join('');

  el.innerHTML = `
    <datalist id="fichasIngList">${datalistHtml}</datalist>
    <div class="fichas-edit-field">
      <label class="fichas-edit-label">Nome da receita</label>
      <input class="fichas-edit-nome" value="${escHtml(ficha.nome)}"
        onchange="updateFichaField('${id}','nome',this.value)">
    </div>
    <div class="fichas-edit-row2">
      <div class="fichas-edit-field">
        <label class="fichas-edit-label">Categoria</label>
        <select class="fichas-edit-cat" onchange="updateFichaField('${id}','cat',this.value)">${catOptions}</select>
      </div>
      <div class="fichas-edit-field">
        <label class="fichas-edit-label">Rendimento (g)</label>
        <input class="fichas-edit-rend" type="number" value="${ficha.rend || ''}"
          onchange="updateFichaField('${id}','rend',parseInt(this.value)||0)" placeholder="0">
      </div>
    </div>
    <div class="fichas-ing-header">
      <span>Ingredientes</span>
      <button class="fichas-add-ing-btn" onclick="addFichaIng('${id}')">+ Adicionar</button>
    </div>
    <div class="fichas-ing-list">${ingRows}</div>`;
}

function updateFichaField(id, field, value) {
  const ficha = (state.fichas || []).find(f => f.id === id);
  if (!ficha) return;
  ficha[field] = value;
  scheduleSave();
}

function updateFichaIng(id, idx, field, value) {
  const ficha = (state.fichas || []).find(f => f.id === id);
  if (!ficha || !ficha.ing[idx]) return;
  ficha.ing[idx][field] = value;
  scheduleSave();
}

function moveFichaIng(id, idx, dir) {
  const ficha = (state.fichas || []).find(f => f.id === id);
  if (!ficha) return;
  const ni = idx + dir;
  if (ni < 0 || ni >= ficha.ing.length) return;
  [ficha.ing[idx], ficha.ing[ni]] = [ficha.ing[ni], ficha.ing[idx]];
  scheduleSave();
  renderFichasEditForm(id);
}

function deleteFichaIng(id, idx) {
  const ficha = (state.fichas || []).find(f => f.id === id);
  if (!ficha) return;
  ficha.ing.splice(idx, 1);
  scheduleSave();
  renderFichasEditForm(id);
}

function addFichaIng(id) {
  const ficha = (state.fichas || []).find(f => f.id === id);
  if (!ficha) return;
  ficha.ing.push({ n: '', q: 0, u: 'kg' });
  scheduleSave();
  renderFichasEditForm(id);
  setTimeout(() => {
    const rows = document.querySelectorAll('.fichas-ing-name');
    if (rows.length) rows[rows.length - 1].focus();
  }, 50);
}

function newFicha() {
  if (!state.fichas) state.fichas = [];
  const id = 'ficha_' + Date.now().toString(36);
  state.fichas.push({ id, nome: 'Nova Ficha', cat: 'prato', rend: 0, porcao: 0, ing: [] });
  scheduleSave();
  showFichasEdit(id);
}

function deleteFichaById(id) {
  if (!id || !confirm('Excluir esta ficha técnica?')) return;
  state.fichas = (state.fichas || []).filter(f => f.id !== id);
  scheduleSave();
  showFichasList();
}

// ── DRE Franqueado ────────────────────────────────────────────
function getDREMesLabel(mesKey) {
  const [yr, mo] = mesKey.split('-');
  const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  return `${meses[parseInt(mo)-1]} ${yr}`;
}

function prevDREMes() {
  const [yr, mo] = dreMesKey.split('-').map(Number);
  const d = new Date(yr, mo - 2, 1);
  dreMesKey = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  renderDRE();
}

function nextDREMes() {
  const [yr, mo] = dreMesKey.split('-').map(Number);
  const d = new Date(yr, mo, 1);
  dreMesKey = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  renderDRE();
}

function getDREState(mesKey) {
  if (!state.dre) state.dre = {};
  if (!state.dre[mesKey]) state.dre[mesKey] = {
    impostos_pct: 0,
    mao_obra_propria: 0,
    mao_obra_terceiros: 0,
    despesas: {
      administrativa: 0,
      marketing: 0,
      informatica: 0,
      manutencao: 0,
      fin_tarifas: 0,
      fin_juros: 0
    }
  };
  return state.dre[mesKey];
}

function onDREChange(field, subfield, rawVal) {
  const d = getDREState(dreMesKey);
  const val = parseFloat(rawVal) || 0;
  if (subfield) {
    if (!d[field]) d[field] = {};
    d[field][subfield] = val;
  } else {
    d[field] = val;
  }
  scheduleSave();
  renderDRE();
}

function renderDRE() {
  const el = document.getElementById('dreContent');
  if (!el) return;

  const d = getDREState(dreMesKey);

  // Auto: agregar semanas do mês
  const weekKeys = Object.keys(state.cmv || {}).filter(k => /^\d{4}-W\d{2}$/.test(k));
  const mesWeeks = weekKeys.filter(k => {
    const mon = getWeekMonday(k);
    return `${mon.getFullYear()}-${String(mon.getMonth()+1).padStart(2,'0')}` === dreMesKey;
  });

  let faturamento = 0;
  const cmvByLinha = {};
  mesWeeks.forEach(wk => {
    const wd = state.cmv[wk];
    faturamento += wd?.faturamento || 0;
    (wd?.notas || []).forEach(n => {
      if (n.linhas?.length) {
        n.linhas.forEach(l => { cmvByLinha[l.linha] = (cmvByLinha[l.linha] || 0) + (l.valor || 0); });
      } else {
        const ln = n.linha || 'Outros';
        cmvByLinha[ln] = (cmvByLinha[ln] || 0) + (n.valor || 0);
      }
    });
  });

  const totalCMV = Object.values(cmvByLinha).reduce((s, v) => s + v, 0);
  const cmvPctFat = faturamento > 0 ? totalCMV / faturamento * 100 : null;

  const impostosR = faturamento * ((d.impostos_pct || 0) / 100);
  const receitaLiq = faturamento - impostosR;
  const maoObra = (d.mao_obra_propria || 0) + (d.mao_obra_terceiros || 0);
  const maoObraPct = faturamento > 0 ? maoObra / faturamento * 100 : null;

  const desp = d.despesas || {};
  const totalDesp = Object.values(desp).reduce((s, v) => s + v, 0);
  const margContrib = receitaLiq - maoObra - totalCMV;
  const margPct = faturamento > 0 ? margContrib / faturamento * 100 : null;
  const ebit = margContrib - totalDesp;
  const ebitPct = faturamento > 0 ? ebit / faturamento * 100 : null;

  const R = (v) => v ? 'R$ ' + fmt(v) : '—';
  const P = (v) => v !== null ? v.toFixed(1) + '%' : '—';
  const colorPct = (v, inv) => {
    if (v === null) return '#9ca3af';
    if (inv) return v > 0 ? '#22c55e' : '#ef4444';
    return v < 10 ? '#22c55e' : v < 20 ? '#f59e0b' : '#ef4444';
  };

  const linhasRows = Object.entries(cmvByLinha).sort((a,b) => b[1]-a[1]).map(([ln, v]) => {
    const pct = faturamento > 0 ? v / faturamento * 100 : null;
    return `<div class="dre-row dre-row-sub">
      <span class="dre-label">${escHtml(ln)}</span>
      <span class="dre-pct" style="color:#9ca3af">${pct !== null ? pct.toFixed(1)+'%' : '—'}</span>
      <span class="dre-val">${R(v)}</span>
    </div>`;
  }).join('');

  el.innerHTML = `
    <div class="dre-container">
      <!-- Navegação de mês -->
      <div class="dre-month-nav">
        <button class="dre-nav-btn" onclick="prevDREMes()">‹</button>
        <span class="dre-month-label">${getDREMesLabel(dreMesKey)}</span>
        <button class="dre-nav-btn" onclick="nextDREMes()">›</button>
      </div>

      <div class="dre-card">
        <!-- FATURAMENTO -->
        <div class="dre-row dre-row-main">
          <span class="dre-label">Faturamento Bruto</span>
          <span class="dre-pct" style="color:#9ca3af">100%</span>
          <span class="dre-val dre-val-fat">${R(faturamento)}</span>
        </div>
        ${faturamento === 0 ? `<p class="dre-hint">Insira faturamento nas semanas deste mês na aba CMV</p>` : ''}

        <!-- IMPOSTOS -->
        <div class="dre-row dre-row-sub">
          <span class="dre-label">(-) Impostos</span>
          <span class="dre-pct">
            <input class="dre-pct-input" type="number" min="0" max="100" step="0.1"
              value="${d.impostos_pct || ''}" placeholder="0"
              oninput="onDREChange('impostos_pct',null,this.value)">%
          </span>
          <span class="dre-val" style="color:#ef4444">${impostosR > 0 ? '− R$ '+fmt(impostosR) : '—'}</span>
        </div>

        <!-- RECEITA LÍQUIDA -->
        <div class="dre-row dre-row-total">
          <span class="dre-label">(=) Receita Líquida</span>
          <span class="dre-pct"></span>
          <span class="dre-val">${R(receitaLiq)}</span>
        </div>

        <div class="dre-divider"></div>

        <!-- MÃO DE OBRA -->
        <div class="dre-row dre-row-main">
          <span class="dre-label">(-) Mão de Obra</span>
          <span class="dre-pct" style="color:${colorPct(maoObraPct, false)}">${P(maoObraPct)}</span>
          <span class="dre-val" style="color:#ef4444">${maoObra > 0 ? '− R$ '+fmt(maoObra) : '—'}</span>
        </div>
        <div class="dre-row dre-row-sub dre-row-input">
          <span class="dre-label">Própria (CLT + encargos)</span>
          <span class="dre-pct"></span>
          <input class="dre-val-input" type="number" min="0" step="100"
            value="${d.mao_obra_propria || ''}" placeholder="0,00"
            oninput="onDREChange('mao_obra_propria',null,this.value)">
        </div>
        <div class="dre-row dre-row-sub dre-row-input">
          <span class="dre-label">Terceirizada</span>
          <span class="dre-pct"></span>
          <input class="dre-val-input" type="number" min="0" step="100"
            value="${d.mao_obra_terceiros || ''}" placeholder="0,00"
            oninput="onDREChange('mao_obra_terceiros',null,this.value)">
        </div>

        <div class="dre-divider"></div>

        <!-- CMV -->
        <div class="dre-row dre-row-main">
          <span class="dre-label">(-) CMV</span>
          <span class="dre-pct" style="color:${colorPct(cmvPctFat, false)}">${P(cmvPctFat)}</span>
          <span class="dre-val" style="color:#ef4444">${totalCMV > 0 ? '− R$ '+fmt(totalCMV) : '—'}</span>
        </div>
        ${linhasRows || `<div class="dre-row dre-row-sub"><span class="dre-label" style="color:#9ca3af">Sem notas neste mês</span><span class="dre-pct"></span><span class="dre-val">—</span></div>`}

        <!-- MARGEM DE CONTRIBUIÇÃO -->
        <div class="dre-row dre-row-total">
          <span class="dre-label">(=) Margem de Contribuição</span>
          <span class="dre-pct" style="color:${colorPct(margPct, true)}">${P(margPct)}</span>
          <span class="dre-val" style="color:${margContrib >= 0 ? '#22c55e' : '#ef4444'}">${R(margContrib)}</span>
        </div>

        <div class="dre-divider"></div>

        <!-- DESPESAS OPERACIONAIS -->
        <div class="dre-row dre-row-main">
          <span class="dre-label">(-) Despesas Operacionais</span>
          <span class="dre-pct" style="color:#9ca3af">${faturamento > 0 ? (totalDesp/faturamento*100).toFixed(1)+'%' : '—'}</span>
          <span class="dre-val" style="color:#ef4444">${totalDesp > 0 ? '− R$ '+fmt(totalDesp) : '—'}</span>
        </div>

        ${[
          ['administrativa',    'Administrativa'],
          ['marketing',         'Marketing'],
          ['informatica',       'Informática'],
          ['manutencao',        'Manutenção'],
          ['fin_tarifas',       'Financeiro – Tarifas'],
          ['fin_juros',         'Financeiro – Juros'],
        ].map(([key, label]) => `
          <div class="dre-row dre-row-sub dre-row-input">
            <span class="dre-label">${label}</span>
            <span class="dre-pct"></span>
            <input class="dre-val-input" type="number" min="0" step="100"
              value="${(desp[key] || '')}" placeholder="0,00"
              oninput="onDREChange('despesas','${key}',this.value)">
          </div>`).join('')}

        <!-- EBIT -->
        <div class="dre-row dre-row-total dre-row-ebit">
          <span class="dre-label">(=) Resultado (EBIT)</span>
          <span class="dre-pct" style="color:${colorPct(ebitPct, true)}">${P(ebitPct)}</span>
          <span class="dre-val" style="color:${ebit >= 0 ? '#22c55e' : '#ef4444'}">${R(ebit)}</span>
        </div>
      </div>

      <p class="dre-footer-hint">Faturamento e CMV puxados automaticamente das semanas do mês. Demais valores inseridos manualmente.</p>
    </div>
  `;
}

// ── Start ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', init);
