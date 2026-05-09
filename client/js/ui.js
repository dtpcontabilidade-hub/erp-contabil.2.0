// ── Gradientes dos avatares ───────────────────────────────────
const CORES = [
  'linear-gradient(135deg,#1a6fc4,#00c9a7)',
  'linear-gradient(135deg,#8b5cf6,#1a6fc4)',
  'linear-gradient(135deg,#f59e0b,#ef4444)',
  'linear-gradient(135deg,#00c9a7,#0891b2)',
  'linear-gradient(135deg,#ef4444,#8b5cf6)',
  'linear-gradient(135deg,#f59e0b,#00c9a7)',
  'linear-gradient(135deg,#14b8a6,#1a6fc4)',
  'linear-gradient(135deg,#f43f5e,#8b5cf6)',
];

const ui = {
  // ── Formatadores ─────────────────────────────────────────────
  ini(name = '') {
    const p = (name || '?').trim().split(' ');
    return (p[0][0] + (p[1] ? p[1][0] : p[0][1] || '')).toUpperCase();
  },
  color(i) { return CORES[i % CORES.length]; },
  currency(v) {
    return 'R$\u00a0' + Math.abs(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  },
  currencyK(v) {
    return v >= 1000 ? 'R$\u00a0' + (v / 1000).toFixed(1).replace('.', ',') + '\u00a0k' : ui.currency(v);
  },
  date(d) {
    if (!d) return '—';
    return new Date(d + (d.length === 10 ? 'T12:00:00' : '')).toLocaleDateString('pt-BR');
  },
  competence(str) {
    if (!str) return '—';
    const [y, m] = str.split('-');
    return ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'][+m - 1] + '/' + y;
  },
  cnpj(v) {
    const s = (v || '').replace(/\D/g, '');
    return s.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5') || s;
  },
  currentCompetence() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  },
  greeting() {
    const h = new Date().getHours();
    return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
  },

  // ── Toast ─────────────────────────────────────────────────────
  toast(ic, msg) {
    let t = document.getElementById('_toast');
    if (!t) {
      t = document.createElement('div');
      t.id = '_toast';
      t.className = 'toast h';
      t.innerHTML = '<span id="_toastIc"></span><span id="_toastMsg"></span>';
      document.body.appendChild(t);
    }
    document.getElementById('_toastIc').textContent  = ic;
    document.getElementById('_toastMsg').textContent = msg;
    t.classList.remove('h');
    clearTimeout(t._t);
    t._t = setTimeout(() => t.classList.add('h'), 3600);
  },

  // ── Modal ─────────────────────────────────────────────────────
  openModal(id)  { document.getElementById(id)?.classList.add('open'); },
  closeModal(id) { document.getElementById(id)?.classList.remove('open'); },

  // ── Tabs (padrão .m-tab / .tp) ────────────────────────────────
  tab(el, paneId) {
    const modal = el.closest('.modal') || document.body;
    modal.querySelectorAll('.m-tab').forEach(t => t.classList.remove('on'));
    el.classList.add('on');
    modal.querySelectorAll('.tp').forEach(p => p.classList.remove('on'));
    document.getElementById(paneId)?.classList.add('on');
  },

  // ── Sidebar ───────────────────────────────────────────────────
  async loadSidebar() {
    const r = await fetch('/assets/sidebar.html');
    const html = await r.text();
    document.getElementById('sidebar-mount').innerHTML = html;
    this.fillUser();
    this.setNav();
  },
  fillUser() {
    const u = auth.getUser();
    if (!u) return;
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('sb-user-name',   u.name);
    set('sb-user-sub',    u.role);
    set('sb-user-avatar', this.ini(u.name));
  },
  setNav() {
    const page = location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.nav-item').forEach(el => {
      el.classList.toggle('active', (el.getAttribute('href') || '').includes(page));
    });
  },

  // ── Paginação ─────────────────────────────────────────────────
  pagination(btnId, infoId, pag, onPage) {
    const cont = document.getElementById(btnId);
    const info = document.getElementById(infoId);
    if (!cont) return;
    if (info) info.textContent = `Página ${pag.page} de ${pag.totalPages} (${pag.total})`;
    cont.innerHTML = '';
    const add = (lbl, pg, dis, act) => {
      const b = document.createElement('button');
      b.className = 'btn sm' + (act ? ' primary' : '');
      b.textContent = lbl;
      b.disabled = dis;
      if (!dis) b.onclick = () => onPage(pg);
      cont.appendChild(b);
    };
    add('«', 1, pag.page <= 1);
    add('‹', pag.page - 1, pag.page <= 1);
    for (let i = Math.max(1, pag.page - 2); i <= Math.min(pag.totalPages, pag.page + 2); i++)
      add(i, i, false, i === pag.page);
    add('›', pag.page + 1, pag.page >= pag.totalPages);
    add('»', pag.totalPages, pag.page >= pag.totalPages);
  },

  // ── Pills de status ───────────────────────────────────────────
  pill(status) {
    const cls = { pago:'pago', ativo:'pago', entregue:'pago', confirmado:'pago',
                  pendente:'pend', em_andamento:'pend',
                  atrasado:'atrs', inativo:'inat', cancelado:'inat', dispensado:'inat',
                  rascunho:'inat', processando:'pend', fechada:'pend' };
    const lbl = { pago:'Em Dia', ativo:'Ativo', entregue:'Entregue', confirmado:'Confirmado',
                  pendente:'Pendente', em_andamento:'Em andamento',
                  atrasado:'Em Atraso', inativo:'Inativo', cancelado:'Cancelado',
                  dispensado:'Dispensado', rascunho:'Rascunho', processando:'Processando', fechada:'Fechada' };
    return `<span class="pill ${cls[status]||'inat'}">${lbl[status]||status}</span>`;
  },

  // ── Debounce ──────────────────────────────────────────────────
  debounce(fn, ms = 380) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  },

  // ── CEP ───────────────────────────────────────────────────────
  async cep(raw) {
    const c = raw.replace(/\D/g, '');
    if (c.length !== 8) return null;
    try {
      const r = await fetch(`https://viacep.com.br/ws/${c}/json/`);
      const d = await r.json();
      return d.erro ? null : d;
    } catch { return null; }
  },

  // ── Máscaras ──────────────────────────────────────────────────
  maskCNPJ(el) {
    el.addEventListener('input', function () {
      let v = this.value.replace(/\D/g, '').slice(0, 14);
      v = v.replace(/^(\d{2})(\d)/, '$1.$2');
      v = v.replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3');
      v = v.replace(/\.(\d{3})(\d)/, '.$1/$2');
      v = v.replace(/(\d{4})(\d)/, '$1-$2');
      this.value = v;
    });
  },
  maskPhone(el) {
    el.addEventListener('input', function () {
      let v = this.value.replace(/\D/g, '').slice(0, 11);
      this.value = v.length <= 10
        ? v.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3')
        : v.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    });
  },
  maskCEP(el) {
    el.addEventListener('input', function () {
      this.value = this.value.replace(/\D/g, '').slice(0, 8).replace(/(\d{5})(\d)/, '$1-$2');
    });
  },
};

// Fecha modais com ESC
document.addEventListener('keydown', e => {
  if (e.key === 'Escape')
    document.querySelectorAll('.ov.open').forEach(o => o.classList.remove('open'));
});

// Fecha modal clicando no overlay
document.addEventListener('click', e => {
  if (e.target.classList.contains('ov')) e.target.classList.remove('open');
});

window.ui   = ui;
window.CORES = CORES;
