'use strict';
/* =====================================================
   โรงเรียนลำผักชี - script.js
   แบ่งเป็นโมดูล: Config, Store, UI, Router, Posts, Students, Auth
   ถ้าจะเปลี่ยนไปใช้ Firebase/Supabase ให้แก้เฉพาะโมดูล Store
   (get/set) แล้วเปลี่ยนเป็น async ได้เลย
   ===================================================== */

/* ---------- 1) ค่าตั้งต้น ---------- */
const Config = {
  // รหัสผ่านแอดมิน (ตัวอย่างเท่านั้น! เก็บในฝั่งเบราว์เซอร์ใครก็เปิดดูได้
  // เมื่อใช้งานจริงต้องย้ายไปตรวจสอบที่เซิร์ฟเวอร์ เช่น Firebase Auth / Supabase Auth)
  ADMIN_KEY: 'lpc-admin-2569',
  KEYS: { students: 'lpc_students', posts: 'lpc_posts', admin: 'lpc_admin', student: 'lpc_student' },
  CODE_CHARS: 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // ตัดตัวที่สับสน เช่น O/0, I/1
};

/* ---------- 2) ชั้นเก็บข้อมูล (LocalStorage) ---------- */
const Store = {
  get(key, fallback) {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
    catch { return fallback; }
  },
  set(key, value) { localStorage.setItem(key, JSON.stringify(value)); },
  remove(key) { localStorage.removeItem(key); }
};

/* ---------- 3) ตัวช่วย UI ---------- */
const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];

// ป้องกัน XSS: แปลงอักขระพิเศษก่อนแทรกลง HTML
const esc = (t = '') => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtDate = iso => new Date(iso).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

const UI = {
  // แจ้งเตือนมุมจอ (type: 'ok' | 'error')
  toast(msg, type = 'ok') {
    const el = document.createElement('div');
    el.className = 'toast' + (type === 'error' ? ' error' : '');
    el.textContent = msg;
    $('#toasts').appendChild(el);
    setTimeout(() => el.remove(), 3200);
  },
  // เปิด Modal ฟอร์มแก้ไข: html = เนื้อฟอร์ม, onSave = ฟังก์ชันรับค่า FormData
  modal(title, html, onSave) {
    const form = $('#modalForm');
    form.innerHTML = `<h3>${esc(title)}</h3>${html}
      <div class="modal-actions"><button type="button" class="btn btn-ghost" id="mCancel">ยกเลิก</button>
      <button type="submit" class="btn btn-primary">บันทึก</button></div>`;
    $('#modal').classList.remove('hidden');
    $('#mCancel').onclick = UI.closeModal;
    form.onsubmit = e => { e.preventDefault(); onSave(new FormData(form)); UI.closeModal(); };
  },
  closeModal() { $('#modal').classList.add('hidden'); }
};

/* ---------- 4) ระบบสลับหน้า ---------- */
const Router = {
  go(page) {
    if (!$('#page-' + page)) page = 'home';
    $$('.page').forEach(p => p.classList.toggle('active', p.id === 'page-' + page));
    $$('[data-nav].on, .menu button.on').forEach(b => b.classList.remove('on'));
    $$(`.menu [data-nav="${page}"]`).forEach(b => b.classList.add('on'));
    $('#menu').classList.remove('open');
    $('#burger').setAttribute('aria-expanded', 'false');
    history.replaceState(null, '', '#' + page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    Auth.render(); // ตรวจสถานะล็อกอินใหม่ทุกครั้งที่เปลี่ยนหน้า
  },
  init() {
    document.addEventListener('click', e => {
      const t = e.target.closest('[data-nav]');
      if (t) { e.preventDefault(); Router.go(t.dataset.nav); }
    });
    $('#burger').onclick = () => {
      const open = $('#menu').classList.toggle('open');
      $('#burger').setAttribute('aria-expanded', open);
    };
    Router.go(location.hash.slice(1) || 'home');
  }
};

/* ---------- 5) ข่าวและประกาศ ---------- */
const Posts = {
  seed() {
    if (Store.get(Config.KEYS.posts, null)) return;
    const now = Date.now(), day = 864e5;
    Store.set(Config.KEYS.posts, [
      { id: uid(), type: 'news', target: '', title: 'เปิดภาคเรียนที่ 2 ปีการศึกษา 2569', body: 'นักเรียนทุกชั้นมารายงานตัวและรับตารางเรียนที่ห้องเรียนประจำชั้น', date: new Date(now).toISOString() },
      { id: uid(), type: 'news', target: '', title: 'กำหนดการสอบกลางภาค', body: 'สอบกลางภาคระหว่างวันที่ 15-19 ธันวาคม โปรดตรวจสอบตารางสอบกับครูประจำชั้น', date: new Date(now - day).toISOString() },
      { id: uid(), type: 'news', target: '', title: 'กิจกรรมวันเด็กแห่งชาติ', body: 'ขอเชิญนักเรียนและผู้ปกครองร่วมกิจกรรมที่สนามโรงเรียน', date: new Date(now - 2 * day).toISOString() }
    ]);
  },
  all() { return Store.get(Config.KEYS.posts, []).sort((a, b) => b.date.localeCompare(a.date)); },
  card(p) {
    const hw = p.type === 'homework';
    return `<article class="card post"><span class="tag ${hw ? 'hw' : ''}">${hw ? 'การบ้าน/ประกาศ' : 'ข่าว'}${p.target ? ' · ' + esc(p.target) : ''}</span>
      <h3>${esc(p.title)}</h3><p>${esc(p.body)}</p><time>${fmtDate(p.date)}</time></article>`;
  },
  render() {
    const news = Posts.all().filter(p => p.type === 'news');
    $('#homeNews').innerHTML = news.slice(0, 3).map(Posts.card).join('') || '<p class="empty">ยังไม่มีข่าว</p>';
    $('#newsList').innerHTML = news.map(Posts.card).join('') || '<p class="empty">ยังไม่มีข่าว</p>';
    $('#statPosts').textContent = news.length;
    $('#postList').innerHTML = Posts.all().map(p =>
      `<div><span>${esc(p.title)}</span><button type="button" class="btn btn-danger btn-sm" data-delpost="${p.id}">ลบ</button></div>`).join('');
  },
  add(e) {
    e.preventDefault();
    const list = Store.get(Config.KEYS.posts, []);
    list.push({ id: uid(), title: $('#pTitle').value.trim(), body: $('#pBody').value.trim(),
      type: $('#pType').value, target: $('#pTarget').value.trim(), date: new Date().toISOString() });
    Store.set(Config.KEYS.posts, list);
    e.target.reset(); Posts.render(); UI.toast('โพสต์สำเร็จ');
  },
  remove(id) {
    Store.set(Config.KEYS.posts, Store.get(Config.KEYS.posts, []).filter(p => p.id !== id));
    Posts.render(); UI.toast('ลบโพสต์แล้ว');
  }
};

/* ---------- 6) ข้อมูลนักเรียน (แอดมิน) ---------- */
const Students = {
  all() { return Store.get(Config.KEYS.students, []); },
  save(list) { Store.set(Config.KEYS.students, list); },

  // สร้างรหัสเฉพาะตัว รูปแบบ LPC-XXXXXX และไม่ซ้ำกับของเดิม
  makeCode() {
    const used = new Set(Students.all().map(s => s.code));
    let code;
    do {
      const r = crypto.getRandomValues(new Uint32Array(6));
      code = 'LPC-' + [...r].map(n => Config.CODE_CHARS[n % Config.CODE_CHARS.length]).join('');
    } while (used.has(code));
    return code;
  },

  create(e) {
    e.preventDefault();
    const no = $('#gNo').value.trim();
    if (Students.all().some(s => s.no === no)) return UI.toast('เลขประจำตัวนี้มีอยู่แล้ว', 'error');
    const stu = { id: uid(), name: $('#gName').value.trim(), cls: $('#gClass').value.trim(), no,
      contact: $('#gContact').value.trim(), code: Students.makeCode(), records: [], created: new Date().toISOString() };
    Students.save([...Students.all(), stu]);
    e.target.reset();
    const box = $('#genResult');
    box.classList.remove('hidden');
    box.innerHTML = `<p>รหัสของ <b>${esc(stu.name)}</b></p><div class="code">${stu.code}</div>
      <button type="button" class="btn btn-ghost btn-sm" data-copy="${stu.code}">คัดลอกรหัส</button>`;
    Students.render(); UI.toast('สร้างรหัสนักเรียนสำเร็จ');
  },

  render() {
    const q = $('#searchBox').value.trim().toLowerCase();
    const rows = Students.all().filter(s => [s.name, s.cls, s.no, s.code].join(' ').toLowerCase().includes(q));
    $('#studentRows').innerHTML = rows.map(s => `<tr><td>${esc(s.name)}</td><td>${esc(s.cls)}</td><td>${esc(s.no)}</td>
      <td><b>${s.code}</b></td><td><button class="btn btn-ghost btn-sm" data-edit="${s.id}">แก้ไข</button>
      <button class="btn btn-danger btn-sm" data-del="${s.id}">ลบ</button></td></tr>`).join('')
      || '<tr><td colspan="5" class="empty">ยังไม่มีข้อมูลนักเรียน</td></tr>';
    $('#statStudents').textContent = Students.all().length;
  },

  // แก้ไขข้อมูล: ผลการเรียนพิมพ์บรรทัดละหนึ่งรายการ รูปแบบ "วิชา:ผลการเรียน"
  edit(id) {
    const s = Students.all().find(x => x.id === id); if (!s) return;
    UI.modal('แก้ไขข้อมูลนักเรียน', `
      <label>ชื่อ-นามสกุล</label><input name="name" value="${esc(s.name)}" required>
      <label>ชั้นเรียน</label><input name="cls" value="${esc(s.cls)}" required>
      <label>เลขประจำตัว</label><input name="no" value="${esc(s.no)}" required>
      <label>ข้อมูลติดต่อ</label><input name="contact" value="${esc(s.contact)}">
      <label>ผลการเรียน/กิจกรรม (บรรทัดละรายการ เช่น คณิตศาสตร์:4)</label>
      <textarea name="records" rows="4">${esc(s.records.map(r => r.subject + ':' + r.result).join('\n'))}</textarea>`,
      fd => {
        const list = Students.all().map(x => x.id !== id ? x : { ...x,
          name: fd.get('name').trim(), cls: fd.get('cls').trim(), no: fd.get('no').trim(), contact: fd.get('contact').trim(),
          records: fd.get('records').split('\n').map(l => l.trim()).filter(Boolean).map(l => {
            const [subject, ...rest] = l.split(':'); return { subject: subject.trim(), result: rest.join(':').trim() };
          }) });
        Students.save(list); Students.render(); UI.toast('บันทึกการแก้ไขแล้ว');
      });
  },

  remove(id) {
    if (!confirm('ยืนยันการลบนักเรียนคนนี้?')) return;
    Students.save(Students.all().filter(s => s.id !== id));
    Students.render(); UI.toast('ลบข้อมูลนักเรียนแล้ว');
  }
};

/* ---------- 7) ระบบล็อกอิน (แอดมิน/นักเรียน) ---------- */
const Auth = {
  adminLogin(e) {
    e.preventDefault();
    if ($('#adminKey').value !== Config.ADMIN_KEY) return UI.toast('รหัสผ่านแอดมินไม่ถูกต้อง', 'error');
    Store.set(Config.KEYS.admin, true); e.target.reset();
    Auth.render(); UI.toast('เข้าสู่ระบบแอดมินสำเร็จ');
  },
  studentLogin(e) {
    e.preventDefault();
    const code = $('#studentCode').value.trim().toUpperCase();
    const s = Students.all().find(x => x.code === code);
    if (!s) return UI.toast('ไม่พบรหัสนี้ กรุณาตรวจสอบกับแอดมิน', 'error');
    Store.set(Config.KEYS.student, s.id); e.target.reset();
    Auth.render(); UI.toast('ยินดีต้อนรับ ' + s.name);
  },
  logout(kind) {
    Store.remove(Config.KEYS[kind]); Auth.render(); UI.toast('ออกจากระบบแล้ว');
  },
  // แสดง/ซ่อนส่วนที่ต้องล็อกอิน และวาดแดชบอร์ดนักเรียน
  render() {
    const isAdmin = Store.get(Config.KEYS.admin, false);
    $('#adminLogin').classList.toggle('hidden', isAdmin);
    $('#adminPanel').classList.toggle('hidden', !isAdmin);

    const stu = Students.all().find(s => s.id === Store.get(Config.KEYS.student, null));
    $('#studentLogin').classList.toggle('hidden', !!stu);
    $('#studentDash').classList.toggle('hidden', !stu);
    if (!stu) return;
    $('#dName').textContent = stu.name;
    $('#dInfo').innerHTML = `<dt>ชื่อ</dt><dd>${esc(stu.name)}</dd><dt>ชั้นเรียน</dt><dd>${esc(stu.cls)}</dd>
      <dt>เลขประจำตัว</dt><dd>${esc(stu.no)}</dd><dt>รหัสนักเรียน</dt><dd>${stu.code}</dd>`;
    $('#dRecords').innerHTML = stu.records.length
      ? `<table style="min-width:0"><tbody>${stu.records.map(r => `<tr><td>${esc(r.subject)}</td><td><b>${esc(r.result)}</b></td></tr>`).join('')}</tbody></table>`
      : '<p class="muted">ยังไม่มีข้อมูลผลการเรียน</p>';
    // แสดงเฉพาะโพสต์ที่ส่งถึงทุกชั้น หรือชั้นของนักเรียนคนนี้
    const mine = Posts.all().filter(p => p.type === 'homework' && (!p.target || p.target === stu.cls));
    $('#dPosts').innerHTML = mine.map(Posts.card).join('') || '<p class="muted">ยังไม่มีการบ้านหรือประกาศ</p>';
  }
};

/* ---------- 8) เริ่มต้นระบบและผูกอีเวนต์ ---------- */
document.addEventListener('DOMContentLoaded', () => {
  Posts.seed();
  $('#adminForm').addEventListener('submit', Auth.adminLogin);
  $('#studentForm').addEventListener('submit', Auth.studentLogin);
  $('#adminLogout').onclick = () => Auth.logout('admin');
  $('#studentLogout').onclick = () => Auth.logout('student');
  $('#genForm').addEventListener('submit', Students.create);
  $('#postForm').addEventListener('submit', Posts.add);
  $('#searchBox').addEventListener('input', Students.render);
  $('#modal').addEventListener('click', e => { if (e.target.id === 'modal') UI.closeModal(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') UI.closeModal(); });

  // จัดการปุ่มในตาราง/รายการด้วย event delegation
  document.addEventListener('click', e => {
    const d = e.target.dataset;
    if (d.edit) Students.edit(d.edit);
    if (d.del) Students.remove(d.del);
    if (d.delpost) Posts.remove(d.delpost);
    if (d.copy) navigator.clipboard.writeText(d.copy).then(() => UI.toast('คัดลอกรหัสแล้ว'));
  });

  Posts.render(); Students.render(); Router.init();
});
