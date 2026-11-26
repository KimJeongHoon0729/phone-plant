// 기록을 폰 안(localStorage)에만 저장해요. 서버로 보내지 않아요.
// 저장 형태: { "2026-11-26": { minutes: 45, success: 2, fail: 1 }, ... }
const Store = {
  KEY: 'phonePlant.records.v1',
  SESSION_KEY: 'phonePlant.session.v1',

  load() {
    try { return JSON.parse(localStorage.getItem(this.KEY)) || {}; }
    catch (e) { return {}; }
  },
  save(records) {
    try { localStorage.setItem(this.KEY, JSON.stringify(records)); } catch (e) {}
  },
  today() {
    const d = new Date();
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  },
  // 한 회차 결과를 오늘 날짜에 더해요
  addResult(minutes, success) {
    const records = this.load();
    const key = this.today();
    const r = records[key] || { minutes: 0, success: 0, fail: 0 };
    if (success) { r.minutes += minutes; r.success += 1; }
    else { r.fail += 1; }
    records[key] = r;
    this.save(records);
  },
  todayMinutes() {
    const r = this.load()[this.today()];
    return r ? r.minutes : 0;
  },
  reset() {
    try { localStorage.removeItem(this.KEY); } catch (e) {}
  },

  // 진행 중인 회차를 저장해서, 화면이 꺼지거나 앱이 다시 열려도 이어가요
  saveSession(s) {
    try { localStorage.setItem(this.SESSION_KEY, JSON.stringify(s)); } catch (e) {}
  },
  loadSession() {
    try { return JSON.parse(localStorage.getItem(this.SESSION_KEY)); } catch (e) { return null; }
  },
  clearSession() {
    try { localStorage.removeItem(this.SESSION_KEY); } catch (e) {}
  },
};
