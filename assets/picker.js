/* 파크골프뉴스 날짜·시간 고르기
   브라우저 기본 달력(운영체제 글꼴로 그려짐) 대신 사이트에서 직접 그리는 달력을 씁니다.
   글꼴: Pretendard (SIL OFL 1.1) - 상업적 무료 글꼴만 사용 */
(function () {
  if (window.PGPick) return;
  var F = "'Pretendard Variable',Pretendard,'Noto Sans KR',sans-serif";
  var WD = ['일', '월', '화', '수', '목', '금', '토'];
  var ICON_D = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%231b7a3a' stroke-width='2' stroke-linecap='round'%3E%3Crect x='3' y='5' width='18' height='16' rx='2'/%3E%3Cpath d='M3 10h18M8 3v4M16 3v4'/%3E%3C/svg%3E\")";
  var ICON_T = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%231b7a3a' stroke-width='2' stroke-linecap='round'%3E%3Ccircle cx='12' cy='12' r='9'/%3E%3Cpath d='M12 7v5l3 2'/%3E%3C/svg%3E\")";
  var css = ''
    + 'input.pgdp{cursor:pointer;font-family:' + F + ';background-repeat:no-repeat!important;background-position:right 12px center!important;background-size:20px 20px!important;padding-right:40px!important;caret-color:transparent}'
    + 'input.pgdp[data-pg=date]{background-image:' + ICON_D + '!important}input.pgdp[data-pg=time]{background-image:' + ICON_T + '!important}'
    + '.pgp{position:absolute;z-index:99999;background:#fff;border:1px solid #cfe3d5;border-radius:14px;box-shadow:0 10px 30px rgba(0,0,0,.18);padding:12px;width:300px;max-width:calc(100vw - 16px);box-sizing:border-box;font-family:' + F + ';color:#1a1a1a;font-size:15px;user-select:none}'
    + '.pgp *{font-family:inherit;box-sizing:border-box}'
    + '.pgp .hd{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}'
    + '.pgp .hd b{font-size:17px;font-weight:800}'
    + '.pgp button{border:0;background:none;cursor:pointer;color:inherit;font-size:15px;border-radius:9px}'
    + '.pgp .nv{width:38px;height:38px;font-size:20px;font-weight:700;color:#1b7a3a}.pgp .nv:hover{background:#eef7f0}.pgp .nv:disabled{color:#ccc;cursor:default;background:none}'
    + '.pgp .g{display:grid;grid-template-columns:repeat(7,1fr);gap:2px;text-align:center}'
    + '.pgp .w{font-size:13px;font-weight:700;color:#666;padding:4px 0}.pgp .w.su{color:#d33}.pgp .w.sa{color:#2563eb}'
    + '.pgp .d{height:38px;font-weight:600}.pgp .d:hover{background:#eef7f0}.pgp .d.su{color:#d33}.pgp .d.sa{color:#2563eb}'
    + '.pgp .d.td{box-shadow:inset 0 0 0 2px #1b7a3a}.pgp .d.on{background:#1b7a3a;color:#fff}'
    + '.pgp .d:disabled{color:#ccc;cursor:default;background:none}'
    + '.pgp .ft{display:flex;justify-content:space-between;margin-top:8px;border-top:1px solid #eee;padding-top:8px}'
    + '.pgp .ft button{padding:8px 12px;font-weight:700;color:#1b7a3a}.pgp .ft button:hover{background:#eef7f0}'
    + '.pgp .tl{font-size:13px;font-weight:800;color:#666;margin:4px 2px 6px}'
    + '.pgp .tg{display:grid;grid-template-columns:repeat(6,1fr);gap:4px;margin-bottom:8px}'
    + '.pgp .tg button{height:36px;font-weight:600;background:#f6f8f6}.pgp .tg button:hover{background:#e3f1e7}.pgp .tg button.on{background:#1b7a3a;color:#fff}';
  var st = document.createElement('style'); st.textContent = css; (document.head || document.documentElement).appendChild(st);

  var p2 = function (n) { return String(n).padStart(2, '0'); };
  var dk = function (d) { return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()); };
  var pd = function (s) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ''); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; };
  var pop = null, cur = null;

  function close() { if (pop) { pop.remove(); pop = null; } cur = null; }
  function put(el, v) { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }
  function place(el) {
    var r = el.getBoundingClientRect(), w = pop.offsetWidth, h = pop.offsetHeight;
    var left = Math.min(Math.max(8, r.left), document.documentElement.clientWidth - w - 8);
    var top = r.bottom + 6;
    if (top + h > window.innerHeight - 8 && r.top - h - 6 > 8) top = r.top - h - 6;
    pop.style.left = (left + window.scrollX) + 'px'; pop.style.top = (top + window.scrollY) + 'px';
  }
  function make(el) {
    close(); cur = el; pop = document.createElement('div'); pop.className = 'pgp'; pop.setAttribute('role', 'dialog');
    pop.addEventListener('mousedown', function (e) { e.preventDefault(); });
    document.body.appendChild(pop);
  }

  function openDate(el) {
    make(el);
    var today = dk(new Date()), mn = el.getAttribute('min') || '', mx = el.getAttribute('max') || '';
    var base = pd(el.value) || pd(mn && mn > today ? mn : today) || new Date();
    var y = base.getFullYear(), m = base.getMonth();
    function draw() {
      var first = new Date(y, m, 1), days = new Date(y, m + 1, 0).getDate(), pre = first.getDay();
      var prevEnd = dk(new Date(y, m, 0)), nextStart = dk(new Date(y, m + 1, 1));
      var h = '<div class="hd"><button type="button" class="nv" data-n="-1" aria-label="이전 달"' + (mn && prevEnd < mn ? ' disabled' : '') + '>‹</button><b>' + y + '년 ' + (m + 1) + '월</b><button type="button" class="nv" data-n="1" aria-label="다음 달"' + (mx && nextStart > mx ? ' disabled' : '') + '>›</button></div><div class="g">';
      WD.forEach(function (w, i) { h += '<div class="w' + (i === 0 ? ' su' : i === 6 ? ' sa' : '') + '">' + w + '</div>'; });
      for (var i = 0; i < pre; i++) h += '<div></div>';
      for (var d = 1; d <= days; d++) {
        var k = y + '-' + p2(m + 1) + '-' + p2(d), dow = (pre + d - 1) % 7, off = (mn && k < mn) || (mx && k > mx);
        h += '<button type="button" class="d' + (dow === 0 ? ' su' : dow === 6 ? ' sa' : '') + (k === today ? ' td' : '') + (k === el.value ? ' on' : '') + '" data-k="' + k + '"' + (off ? ' disabled' : '') + '>' + d + '</button>';
      }
      h += '</div><div class="ft"><button type="button" data-a="today">오늘</button><button type="button" data-a="close">닫기</button></div>';
      pop.innerHTML = h; place(el);
    }
    pop.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b || b.disabled) return;
      if (b.dataset.n) { m += Number(b.dataset.n); if (m < 0) { m = 11; y--; } if (m > 11) { m = 0; y++; } draw(); return; }
      if (b.dataset.k) { put(el, b.dataset.k); close(); el.focus(); return; }
      if (b.dataset.a === 'today') { if ((!mn || today >= mn) && (!mx || today <= mx)) { put(el, today); close(); } else { var t = new Date(); y = t.getFullYear(); m = t.getMonth(); draw(); } return; }
      if (b.dataset.a === 'close') close();
    });
    draw();
  }

  function openTime(el) {
    make(el);
    var stp = Number(el.getAttribute('step')) || 600, mStep = Math.max(1, Math.round(stp / 60)); if (mStep < 5) mStep = 5;
    var hh = '', mm = '';
    var mt = /^(\d{2}):(\d{2})$/.exec(el.value || ''); if (mt) { hh = mt[1]; mm = mt[2]; }
    function lab(h) { h = Number(h); return (h < 12 ? '오전 ' : '오후 ') + (h % 12 || 12); }
    function draw() {
      var h = '<div class="tl">오전</div><div class="tg">';
      for (var i = 0; i < 24; i++) {
        if (i === 12) h += '</div><div class="tl">오후</div><div class="tg">';
        h += '<button type="button" data-h="' + p2(i) + '"' + (p2(i) === hh ? ' class="on"' : '') + '>' + (i % 12 || 12) + '시</button>';
      }
      h += '</div><div class="tl">분' + (hh ? ' (' + lab(hh) + '시)' : '') + '</div><div class="tg">';
      for (var j = 0; j < 60; j += mStep) h += '<button type="button" data-m="' + p2(j) + '"' + (p2(j) === mm ? ' class="on"' : '') + '>' + p2(j) + '분</button>';
      h += '</div><div class="ft"><span></span><button type="button" data-a="close">닫기</button></div>';
      pop.innerHTML = h; place(el);
    }
    pop.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      if (b.dataset.h) { hh = b.dataset.h; if (!mm) mm = '00'; put(el, hh + ':' + mm); draw(); return; }
      if (b.dataset.m) { mm = b.dataset.m; if (!hh) hh = '08'; put(el, hh + ':' + mm); close(); el.focus(); return; }
      if (b.dataset.a === 'close') close();
    });
    draw();
  }

  function open(el) { if (el.disabled) return; if (cur === el) { close(); return; } (el.dataset.pg === 'time' ? openTime : openDate)(el); }
  function upgrade(el) {
    if (el.dataset.pg) return;
    var kind = el.type === 'time' ? 'time' : 'date', v = el.value;
    el.dataset.pg = kind; el.type = 'text'; el.value = v; el.readOnly = true; el.autocomplete = 'off';
    el.setAttribute('inputmode', 'none'); el.classList.add('pgdp');
    if (!el.placeholder) el.placeholder = kind === 'time' ? '시간 고르기' : '날짜 고르기';
    el.addEventListener('click', function () { open(el); });
    el.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') { e.preventDefault(); open(el); }
      else if (e.key === 'Escape') close();
    });
  }
  function scan(root) {
    if (!root || !root.querySelectorAll) return;
    if (root.matches && root.matches('input[type=date],input[type=time]')) upgrade(root);
    root.querySelectorAll('input[type=date],input[type=time]').forEach(upgrade);
  }
  document.addEventListener('mousedown', function (e) { if (pop && !pop.contains(e.target) && e.target !== cur) close(); }, true);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
  window.addEventListener('resize', close);
  new MutationObserver(function (list) {
    list.forEach(function (r) { r.addedNodes.forEach(scan); });
    if (cur && !document.body.contains(cur)) close();
  }).observe(document.documentElement, { childList: true, subtree: true });
  if (document.body) scan(document.body); else document.addEventListener('DOMContentLoaded', function () { scan(document.body); });
  window.PGPick = { scan: scan, close: close };
})();
