// client/js/api.js — versão completa com todos os módulos
const BASE = '/api';

async function req(path, opts = {}) {
  const token = auth.getToken();
  try {
    const res = await fetch(BASE + path, {
      ...opts,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(opts.headers || {}),
      },
    });
    if (res.status === 401) { auth.logout(); return null; }
    return res.json();
  } catch (e) {
    console.error('API error:', e);
    return null;
  }
}

const j  = d => JSON.stringify(d);
const qs = p => '?' + new URLSearchParams(
  Object.fromEntries(Object.entries(p).filter(([,v]) => v !== '' && v !== undefined && v !== null))
);

window.API = {
  auth: {
    login:  d  => req('/auth/login',    { method:'POST', body:j(d) }),
    me:     ()  => req('/auth/me'),
    chgPwd: d  => req('/auth/password', { method:'PUT',  body:j(d) }),
  },
  companies: {
    list:   (p={}) => req('/companies'        + qs(p)),
    stats:  ()     => req('/companies/stats'),
    get:    id     => req(`/companies/${id}`),
    create: d      => req('/companies',        { method:'POST',   body:j(d) }),
    update: (id,d) => req(`/companies/${id}`,  { method:'PUT',    body:j(d) }),
    remove: id     => req(`/companies/${id}`,  { method:'DELETE' }),
  },
  transactions: {
    list:    (p={}) => req('/transactions'          + qs(p)),
    summary: (p={}) => req('/transactions/summary'  + qs(p)),
    get:     id     => req(`/transactions/${id}`),
    create:  d      => req('/transactions',          { method:'POST',   body:j(d) }),
    update:  (id,d) => req(`/transactions/${id}`,    { method:'PUT',    body:j(d) }),
    cancel:  id     => req(`/transactions/${id}`,    { method:'DELETE' }),
  },
  duties: {
    list:     (p={})   => req('/duties'              + qs(p)),
    upcoming: (days=7) => req(`/duties/upcoming?days=${days}`),
    get:      id       => req(`/duties/${id}`),
    create:   d        => req('/duties',              { method:'POST',   body:j(d) }),
    update:   (id,d)   => req(`/duties/${id}`,        { method:'PUT',    body:j(d) }),
    remove:   id       => req(`/duties/${id}`,        { method:'DELETE' }),
    status:   (id,d)   => req(`/duties/${id}/status`, { method:'PUT',    body:j(d) }),
  },
  billing: {
    summary:   () => req('/billing/summary'),
    byService: () => req('/billing/by-service'),
    byRegime:  () => req('/billing/by-regime'),
  },
  payroll: {
    list:   (p={}) => req('/payroll'              + qs(p)),
    stats:  (p={}) => req('/payroll/stats'        + qs(p)),
    get:    id     => req(`/payroll/${id}`),
    create: d      => req('/payroll',              { method:'POST',   body:j(d) }),
    update: (id,d) => req(`/payroll/${id}`,        { method:'PUT',    body:j(d) }),
    status: (id,d) => req(`/payroll/${id}/status`, { method:'PUT',    body:j(d) }),
    remove: id     => req(`/payroll/${id}`,        { method:'DELETE' }),
  },
  bpo: {
    list:    (p={}) => req('/bpo'              + qs(p)),
    summary: (p={}) => req('/bpo/summary'     + qs(p)),
    get:     id     => req(`/bpo/${id}`),
    create:  d      => req('/bpo',             { method:'POST',   body:j(d) }),
    update:  (id,d) => req(`/bpo/${id}`,       { method:'PUT',    body:j(d) }),
    remove:  id     => req(`/bpo/${id}`,       { method:'DELETE' }),
    baixa:   (id,d) => req(`/bpo/${id}/baixa`, { method:'PUT',    body:j(d) }),
  },
  auditoria: {
    list:   (p={}) => req('/auditoria'        + qs(p)),
    stats:  ()     => req('/auditoria/stats'),
    get:    id     => req(`/auditoria/${id}`),
    create: d      => req('/auditoria',        { method:'POST',   body:j(d) }),
    update: (id,d) => req(`/auditoria/${id}`,  { method:'PUT',    body:j(d) }),
    remove: id     => req(`/auditoria/${id}`,  { method:'DELETE' }),
  },
  consultorias: {
    list:   (p={}) => req('/consultorias'        + qs(p)),
    stats:  ()     => req('/consultorias/stats'),
    get:    id     => req(`/consultorias/${id}`),
    create: d      => req('/consultorias',        { method:'POST',   body:j(d) }),
    update: (id,d) => req(`/consultorias/${id}`,  { method:'PUT',    body:j(d) }),
    remove: id     => req(`/consultorias/${id}`,  { method:'DELETE' }),
  },
  escrituracao: {
    list:       (p={}) => req('/escrituracao'              + qs(p)),
    get:        id     => req(`/escrituracao/${id}`),
    create:     d      => req('/escrituracao',              { method:'POST', body:j(d) }),
    update:     (id,d) => req(`/escrituracao/${id}`,        { method:'PUT',  body:j(d) }),
    livroDiario:(p={}) => req('/escrituracao/livro-diario' + qs(p)),
    livroRazao: (p={}) => req('/escrituracao/livro-razao'  + qs(p)),
    balancete:  (p={}) => req('/escrituracao/balancete'    + qs(p)),
    apuracao:   (p={}) => req('/escrituracao/apuracao'     + qs(p)),
  },
  fpa: {
    list:      (p={}) => req('/fpa'              + qs(p)),
    dashboard: (p={}) => req('/fpa/dashboard'   + qs(p)),
    get:       id     => req(`/fpa/${id}`),
    create:    d      => req('/fpa',             { method:'POST',   body:j(d) }),
    update:    (id,d) => req(`/fpa/${id}`,       { method:'PUT',    body:j(d) }),
    remove:    id     => req(`/fpa/${id}`,       { method:'DELETE' }),
  },
  planoConta: {
    list:   (p={}) => req('/plano-contas' + qs(p)),
    seed:   ()     => req('/plano-contas/seed', { method:'POST' }),
    create: d      => req('/plano-contas',       { method:'POST', body:j(d) }),
    update: (id,d) => req(`/plano-contas/${id}`, { method:'PUT',  body:j(d) }),
    remove: id     => req(`/plano-contas/${id}`, { method:'DELETE' }),
  },
  centroCusto: {
    list:   (p={}) => req('/centros-custo' + qs(p)),
    create: d      => req('/centros-custo',       { method:'POST', body:j(d) }),
    get:    id     => req(`/centros-custo/${id}`),
    update: (id,d) => req(`/centros-custo/${id}`, { method:'PUT',  body:j(d) }),
    remove: id     => req(`/centros-custo/${id}`, { method:'DELETE' }),
  },
  esocial: {
    list:    (p={}) => req('/esocial'                  + qs(p)),
    stats:   (p={}) => req('/esocial/stats'            + qs(p)),
    s1000:   (p={}) => req('/esocial/s1000'            + qs(p)),
    s1200:   (p={}) => req('/esocial/s1200'            + qs(p)),
    s2200:   d      => req('/esocial/s2200',            { method:'POST', body:j(d) }),
    s2299:   d      => req('/esocial/s2299',            { method:'POST', body:j(d) }),
    s5001:   (p={}) => req('/esocial/s5001'            + qs(p)),
    status:  (id,d) => req(`/esocial/${id}/status`,    { method:'PUT',  body:j(d) }),
  },
  conciliacao: {
    list:   (p={}) => req('/conciliacao' + qs(p)),
    get:    id     => req(`/conciliacao/${id}`),
    create: d      => req('/conciliacao',                        { method:'POST', body:j(d) }),
    importOFX:(id,d)=>req(`/conciliacao/${id}/ofx`,             { method:'POST', body:j(d) }),
    importCSV:(id,d)=>req(`/conciliacao/${id}/csv`,             { method:'POST', body:j(d) }),
    match:  id     => req(`/conciliacao/${id}/match`,           { method:'POST' }),
    relatorio:id   => req(`/conciliacao/${id}/relatorio`),
  },
  users: {
    list:   ()     => req('/users'),
    get:    id     => req(`/users/${id}`),
    create: d      => req('/users',        { method:'POST',   body:j(d) }),
    update: (id,d) => req(`/users/${id}`,  { method:'PUT',    body:j(d) }),
    remove: id     => req(`/users/${id}`,  { method:'DELETE' }),
  },
  centralGestao: {
    listarEmpresas:    ()         => req('/central-gestao/empresas'),
    listarUsuariosERP: ()         => req('/central-gestao/usuarios-erp'),
    getEmpresa:        id         => req(`/central-gestao/empresas/${id}`),
    presets:           ()         => req('/central-gestao/presets'),
    salvarConfig:      d          => req('/central-gestao/config',           { method:'PUT',    body:j(d) }),
    gerenciarUsuario:  d          => req('/central-gestao/usuarios',         { method:'POST',   body:j(d) }),
    removerUsuario:    id         => req(`/central-gestao/usuarios/${id}`,   { method:'DELETE' }),
    resetarSenha:      (id, d)    => req(`/central-gestao/usuarios/${id}/senha`, { method:'POST', body:j(d) }),
  },
  cliente: {
    me: () => req('/cliente/me'),
  },

  relatorios: {
    dre:       (p={}) => req('/relatorios/dre'       + qs(p)),
    fluxo:     (p={}) => req('/relatorios/fluxo'     + qs(p)),
    balanco:   (p={}) => req('/relatorios/balanco'   + qs(p)),
    balancete: (p={}) => req('/relatorios/balancete' + qs(p)),
    kpis:      (p={}) => req('/relatorios/kpis'      + qs(p)),
    dashboard: (p={}) => req('/relatorios/dashboard' + qs(p)),
  },
  notificacoes: {
    list:          (p={}) => req('/notificacoes'              + qs(p)),
    marcarLida:    id     => req(`/notificacoes/${id}/lida`,   { method:'PUT' }),
    todasLidas:    ()     => req('/notificacoes/todas-lidas',  { method:'PUT' }),
    processar:     ()     => req('/notificacoes/processar',    { method:'POST' }),
    enviar:        ()     => req('/notificacoes/enviar',       { method:'POST' }),
    getConfig:     ()     => req('/notificacoes/config'),
    saveConfig:    d      => req('/notificacoes/config',       { method:'POST', body:j(d) }),
  },
};
