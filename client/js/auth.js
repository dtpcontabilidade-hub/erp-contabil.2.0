const auth = {
  save(token, user, remember) {
    const s = remember ? localStorage : sessionStorage;
    s.setItem('dtp_token', token);
    s.setItem('dtp_user', JSON.stringify(user));
  },
  getToken() {
    return localStorage.getItem('dtp_token') || sessionStorage.getItem('dtp_token');
  },
  getUser() {
    try {
      return JSON.parse(localStorage.getItem('dtp_user') || sessionStorage.getItem('dtp_user'));
    } catch(e) { return null; }
  },
  isLogged() { return !!this.getToken(); },
  isCliente() { return this.getUser()?.role === 'cliente'; },
  logout() {
    ['dtp_token','dtp_user'].forEach(k => { localStorage.removeItem(k); sessionStorage.removeItem(k); });
    window.location.href = '/login.html';
  },
  require() {
    if (!this.isLogged()) { window.location.href = '/login.html'; return false; }
    return true;
  },
  requireCliente() {
    if (!this.isLogged()) { window.location.href = '/login.html'; return false; }
    return true;
  },
  redirectIfLogged() {
    if (!this.isLogged()) return;
    if (this.getUser()?.role === 'cliente') window.location.href = '/cliente/dashboard.html';
    else window.location.href = '/welcome.html';
  },
  getCompanyId() {
    const u = this.getUser();
    if (!u) return null;
    if (u.company && typeof u.company === 'object') return u.company._id || u.company.id;
    return u.company || null;
  },
};
window.auth = auth;
