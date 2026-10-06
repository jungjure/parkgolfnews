/* 파크골프뉴스 공용 스크립트: 구글시트 -> 화면 */
const CONFIG = {
  SHEET_ID: '1sl-4jdTKIqpiUM-s2kjPAF-jJoIrCnBnoM8mmcY36cc',   // 구글시트 주소의 /d/ 와 /edit 사이 긴 문자열
  TABS: { news: '뉴스', schedule: '일정', calendar: '캘린더', settings: '설정' },
  CACHE_MIN: 3,
  API_URL: 'https://script.google.com/macros/s/AKfycby4zEPx3AB25E7x4peqc9UTlYsGgywDjew64Xh8Va7VhM4zMG8clQGM0eCUZIQqsW2tVg/exec'   // 글쓰기·로그인용 Apps Script 웹앱 주소 (배포 후 여기에 넣습니다)
};

const DEFAULTS = {
  사이트명: '파크골프뉴스',
  슬로건: '파크골프뉴스는 오늘의 소식을 전합니다.',
  주소: '대전 유성구 대학로 31, 803호',
  전화: '042-368-7330',
  팩스: '0504-326-2591',
  담당: '정지현 PD 010-9288-2591',
  밴드: 'https://band.us/@parkgolfnews1',
  오픈채팅: 'https://open.kakao.com/o/gsBaV3ni',
  공지: ''
};

/* ---------- 유틸 ---------- */
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const $ = (sel, el = document) => el.querySelector(sel);
const WD = ['일', '월', '화', '수', '목', '금', '토'];

function parseCSV(text) {
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; }
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cur); cur = ''; }
    else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
    else if (c !== '\r') cur += c;
  }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
  return rows;
}

async function loadTab(name) {
  const key = 'pgn_' + name;
  try {
    const c = JSON.parse(sessionStorage.getItem(key) || 'null');
    if (c && Date.now() - c.t < CONFIG.CACHE_MIN * 60000) return c.d;
  } catch (e) {}
  const url = `https://docs.google.com/spreadsheets/d/${CONFIG.SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(name)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('시트를 불러오지 못했습니다 (' + res.status + ')');
  const rows = parseCSV(await res.text());
  if (!rows.length) return [];
  const head = rows[0].map(h => h.trim());
  const data = rows.slice(1)
    .filter(r => r.some(v => v && v.trim()))
    .map(r => Object.fromEntries(head.map((h, i) => [h, (r[i] ?? '').trim()])));
  try { sessionStorage.setItem(key, JSON.stringify({ t: Date.now(), d: data })); } catch (e) {}
  return data;
}

/* 날짜: 2026-10-02 / 2026.10.2 / 2026/10/2 / 10/2 / 10월 2일 */
function parseDate(s) {
  if (!s) return null;
  let m = String(s).match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  m = String(s).match(/(\d{1,2})\s*[\/.월]\s*(\d{1,2})/);
  if (m) return new Date(new Date().getFullYear(), +m[1] - 1, +m[2]);
  return null;
}
const ymd = d => d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
const fmtDate = d => `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}(${WD[d.getDay()]})`;
const fmtShort = d => `${d.getMonth() + 1}/${d.getDate()}(${WD[d.getDay()]})`;
const today0 = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); };

function hash(str) { let h = 5381; for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) >>> 0; return h.toString(36); }

/* 구글드라이브 공유링크 -> 이미지 주소 */
function imgUrl(u) {
  if (!u) return '';
  u = u.trim();
  let m = u.match(/drive\.google\.com\/file\/d\/([\w-]+)/) || u.match(/drive\.google\.com\/(?:open|uc)\?(?:[^#]*&)?id=([\w-]+)/);
  if (m) return `https://drive.google.com/thumbnail?id=${m[1]}&sz=w1600`;
  return u;
}
const imgList = s => (s || '').split(/[\n,\s]+/).map(imgUrl).filter(u => /^https?:\/\//.test(u));

function linkify(text) {
  return esc(text).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener" style="color:var(--g700);text-decoration:underline">$1</a>');
}
function paragraphs(text) {
  return String(text || '').split(/\n{2,}|\n/).map(p => p.trim()).filter(Boolean).map(p => `<p>${linkify(p)}</p>`).join('');
}

/* 본문 렌더링: 일반 글 / HTML 조각 / 완전한 HTML(아트팩트) */
const HTML_RE = /<\/?[a-z][^>]*>/i;
function sanitizeFragment(html) {
  if (!/<(p|div|br|h\d|ul|ol|li|table)[\s>\/]/i.test(html)) html = html.replace(/\n/g, '<br>');
  const doc = new DOMParser().parseFromString('<body>' + html + '</body>', 'text/html');
  doc.querySelectorAll('script,style,object,embed,link,meta,form,base').forEach(n => n.remove());
  doc.querySelectorAll('iframe').forEach(n => { if (!/^https:\/\/(www\.)?(youtube\.com|youtube-nocookie\.com|player\.vimeo\.com)\//.test(n.getAttribute('src') || '')) n.remove(); else { n.style.width = '100%'; n.style.aspectRatio = '16/9'; n.style.border = '0'; } });
  doc.body.querySelectorAll('*').forEach(el => {
    [...el.attributes].forEach(a => {
      const v = a.value.trim().toLowerCase();
      if (/^on/i.test(a.name) || ((a.name === 'href' || a.name === 'src' || a.name === 'srcset') && /^(javascript|data:text|vbscript)/.test(v))) el.removeAttribute(a.name);
    });
    if (el.tagName === 'A') { el.target = '_blank'; el.rel = 'noopener'; }
    if (el.tagName === 'IMG') { el.loading = 'lazy'; const s = el.getAttribute('src'); if (s) el.setAttribute('src', imgUrl(s)); }
  });
  return doc.body.innerHTML;
}
let _fid = 0;
function frameDoc(html, id) {
  const resizer = '<script>(function(){function s(){parent.postMessage({pgnFrame:"' + id + '",h:document.documentElement.offsetHeight},"*")}addEventListener("load",s);new ResizeObserver(s).observe(document.documentElement);setInterval(s,1500)})()<\/script>';
  const base = '<base target="_blank">';
  if (/<\/body>/i.test(html)) return html.replace(/<\/body>/i, resizer + '</body>').replace(/<head[^>]*>/i, m => m + base);
  return '<!doctype html><html><head><meta charset="utf-8">' + base + '<style>body{margin:0;font-family:Pretendard,"Noto Sans KR","Malgun Gothic",sans-serif;line-height:1.65}img{max-width:100%}</style></head><body>' + html + resizer + '</body></html>';
}
function iframeHTML(html, id) {
  return '<iframe class="artifact" id="' + id + '" sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox" srcdoc="' + esc(frameDoc(html, id)) + '" style="width:100%;height:600px;border:0;display:block;margin:14px 0"></iframe>';
}
window.addEventListener('message', ev => {
  const d = ev.data; if (!d || !d.pgnFrame) return;
  const f = document.getElementById(d.pgnFrame); if (f && d.h) f.style.height = (d.h + 4) + 'px';
});
function renderBody(n) {
  let out = '';
  if (n.embed) out += '<iframe class="artifact" src="' + esc(n.embed) + '" loading="lazy" allowfullscreen sandbox="allow-scripts allow-popups allow-same-origin allow-forms" style="width:100%;height:760px;border:0;display:block;margin:14px 0"></iframe>';
  const b = n.body || '';
  if (!HTML_RE.test(b)) return out + paragraphs(b || n.summary);
  if (/<(script|style|html|body)|<!doctype/i.test(b)) return out + iframeHTML(b, 'af' + (++_fid));
  return out + sanitizeFragment(b);
}

/* ---------- 데이터 모델 ---------- */
async function getSettings() {
  try {
    const rows = await loadTab(CONFIG.TABS.settings);
    const s = { ...DEFAULTS };
    rows.forEach(r => { const k = r['키'] || r['항목']; if (k && (r['값'] ?? '') !== '') s[k] = r['값']; });
    return s;
  } catch (e) { return { ...DEFAULTS }; }
}

async function getNews() {
  const rows = await loadTab(CONFIG.TABS.news);
  return rows
    .filter(r => !/^(n|no|아니오|비공개|x)$/i.test(r['공개'] || 'Y') && (r['제목'] || '').trim() && (r['카테고리'] || '') !== '회원글')   // 회원글은 자유게시판으로 이동
    .map((r, idx) => {
      const d = parseDate(r['날짜']) || new Date(2000, 0, 1);
      const body = r['본문'] || r['요약'] || '';
      return {
        id: ymd(d) + '-' + hash((r['제목'] || '')),
        date: d, idx, cat: r['카테고리'] || '뉴스', title: r['제목'],
        summary: r['요약'] || body.replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120),
        embed: /^https?:\/\//.test(r['임베드'] || '') ? r['임베드'] : '',
        body, images: imgList(r['이미지']), link: r['출처링크'] || r['링크'] || '', source: r['출처'] || '', writer: r['작성자'] || ''
      };
    })
    .sort((a, b) => b.date - a.date || b.idx - a.idx);   // 최신 날짜 먼저, 같은 날은 나중에 올린 글 먼저
}

async function getSchedule() {
  const tabs = await Promise.all([CONFIG.TABS.calendar, CONFIG.TABS.schedule].map(n => loadTab(n).catch(() => [])));
  tabs[0].forEach(r => { r['비고'] = ''; });   /* 캘린더 설명은 길고 계좌번호 등이 섞여 있어 화면에는 쓰지 않음 */
  const rows = tabs.flat();
  if (!rows.length) throw new Error('일정을 불러오지 못했습니다');
  const seen = new Set();
  return rows
    .filter(r => !/^(n|no|아니오|비공개|x)$/i.test(r['공개'] || 'Y') && (r['대회명'] || '').trim())
    .map(r => {
      const s = parseDate(r['시작일']); if (!s) return null;
      const e = parseDate(r['종료일']) || s;
      return { start: s, end: e < s ? s : e, type: r['구분'] || '대회', name: r['대회명'].replace(/^[\s\u{1F300}-\u{1FAFF}\u2600-\u27BF\uFE0F]+/u, ''), region: r['지역'] || '', place: r['장소'] || '', link: (r['링크'] || '').replace(/[)\]\.,;]+$/, ''), note: r['비고'] || '' };
    })
    .filter(Boolean)
    .filter(e => { const k = ymd(e.start) + '|' + ymd(e.end) + '|' + e.type + '|' + e.name; if (seen.has(k)) return false; seen.add(k); return true; })
    .sort((a, b) => a.start - b.start || a.name.localeCompare(b.name));
}

/* ---------- 공통 레이아웃 ---------- */
async function layout(active, opts) {
  opts = opts || {};
  const S = await getSettings();
  const me = Auth.get();
  const memberMode = me && me.role !== 'admin';   // 회원: 메뉴는 '자유게시판' 하나 (중복 방지)
  const nav = [['today.html', '오늘일정', 'today'], ['schedule.html', '대회일정', 'schedule'], ['news.html', '뉴스', 'news'], ['board.html', '자유게시판', 'board']];
  const authNav = !me ? `<a href="login.html" class="auth ${active === 'login' ? 'on' : ''}">로그인</a><a href="signup.html" class="auth ${active === 'signup' ? 'on' : ''}">회원가입</a>` : (me.role === 'admin' ? `<a href="members.html" class="${active === 'members' ? 'on' : ''}">회원현황</a><a href="requests.html" class="${active === 'requests' ? 'on' : ''}">개선요청</a>` : '') + `<a href="mypage.html" class="who ${active === 'mypage' ? 'on' : ''}" title="마이페이지">${esc(me.name)}님</a><a href="#" onclick="Auth.logout();return false" class="auth">로그아웃</a>`;
  document.body.insertAdjacentHTML('afterbegin', `
    <div class="topbar"><div class="wrap"><span>${esc(S.슬로건)}</span>
    <span><a href="${esc(S.밴드)}" target="_blank" rel="noopener">네이버 밴드</a> · <a href="${esc(S.오픈채팅)}" target="_blank" rel="noopener">오픈채팅방</a> · ${esc(S.전화)}</span></div></div>
    <header class="site"><div class="wrap">
      <span class="brand"><a href="index.html" title="홈" style="display:flex;align-items:center"><img src="assets/logo.png" alt="홈"></a><a href="about.html" title="회사소개">${esc(S.사이트명)}</a></span>
      <button class="menu-btn" aria-label="메뉴" onclick="document.querySelector('nav.main').classList.toggle('open')">메뉴</button>
      <nav class="main">${nav.map(n => `<a href="${n[0]}" class="${n[2] === active ? 'on' : ''}">${n[1]}</a>`).join('')}${authNav}</nav>
    </div></header>
    ${S.공지 ? `<div class="notice"><div class="wrap">공지 | ${esc(S.공지)}</div></div>` : ''}`);
  document.body.insertAdjacentHTML('beforeend', `
    <footer class="site"><div class="wrap">
      <div><b>${esc(S.사이트명)}</b><br>주소 : ${esc(S.주소)}<br>전화 : ${esc(S.전화)} · 팩스 : ${esc(S.팩스)}<br>담당 : ${esc(S.담당)}</div>
      <div><a href="${esc(S.밴드)}" target="_blank" rel="noopener">네이버 밴드 ${esc(S.밴드.replace(/^https?:\/\//, ''))}</a><br><a href="${esc(S.오픈채팅)}" target="_blank" rel="noopener">카카오 오픈채팅방</a><br>개선요청사항 접수 : <a href="request.html">개선요청 남기기</a><br><br>&copy; ${new Date().getFullYear()} ${esc(S.사이트명)}. All rights reserved.</div>
    </div></footer>`);
  if (me) startPing();
  else if (opts.openList) {   // 뉴스 목록: 로그인 없이 기사 목록을 보여 주고, 기사를 누르면 로그인 안내창
    document.addEventListener('click', e => {
      const a = e.target.closest && e.target.closest('a[href*="article.html"]');
      if (!a || e.defaultPrevented || e.ctrlKey || e.metaKey || e.shiftKey || e.button) return;
      e.preventDefault();
      showLoginGate(false, a.getAttribute('href'));
    });
  }
  else if (['news', 'board', 'write', 'members', 'mypage', 'request', 'requests'].includes(active)) { showLoginGate(true); return new Promise(() => {}); }   // 뉴스·기사·글쓰기: 로그인 전에는 진행 불가
  else if (['home', 'today', 'schedule'].includes(active)) watchScrollGate();                                  // 홈·일정: 스크롤하면 로그인 안내
  return S;
}

/* ---------- 로그인 안내 (회사소개 제외) ---------- */
function loginNext() { return (location.pathname.split('/').pop() || 'index.html') + location.search; }   // 로그인 후 돌아올 주소(보던 뉴스·일정)
function showLoginGate(hard, next) {
  if (document.getElementById('pgn-gate')) return;
  const nx = encodeURIComponent(next || loginNext());
  document.body.insertAdjacentHTML('beforeend', `
    <style>#pgn-gate{position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;padding:18px}
    #pgn-gate .box{background:#fff;border-radius:14px;max-width:380px;width:100%;padding:28px 24px;text-align:center;box-shadow:0 10px 40px rgba(0,0,0,.3)}
    #pgn-gate h3{margin:0 0 10px;font-size:1.25rem}#pgn-gate p{margin:0 0 20px;line-height:1.6;color:#444}
    #pgn-gate .row{display:flex;gap:10px}#pgn-gate .row a{flex:1}
    #pgn-gate .box{position:relative}#pgn-gate .x{position:absolute;top:8px;right:10px;border:0;background:none;font-size:1.9rem;line-height:1;color:#666;cursor:pointer;padding:4px 10px}#pgn-gate .x:hover{color:#000}</style>
    <div id="pgn-gate" role="dialog" aria-modal="true"><div class="box">
      <button type="button" class="x" aria-label="닫기" title="닫기">&times;</button>
      <h3>로그인이 필요합니다</h3>
      <p>${next ? '기사를 읽으려면 로그인해 주세요.' : '로그인하셔야 계속 보실 수 있습니다.'}<br>로그인하면 보시던 페이지로 바로 돌아옵니다.</p>
      <div class="row"><a class="btn green big" href="login.html?next=${nx}">로그인</a><a class="btn green big" href="signup.html?next=${nx}">회원가입</a></div>
    </div></div>`);
  document.body.style.overflow = 'hidden';
  // 닫기: 일정·홈은 안내창만 닫고(다시 스크롤하면 또 나옴), 뉴스·기사·글쓰기는 홈으로 이동
  const close = () => {
    document.removeEventListener('keydown', onKey);
    if (hard) { location.href = 'index.html'; return; }
    document.getElementById('pgn-gate').remove(); document.body.style.overflow = ''; if (!next) watchScrollGate();
  };
  const onKey = e => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  document.querySelector('#pgn-gate .x').onclick = close;
}
function watchScrollGate() {
  const trip = () => { ['scroll', 'wheel', 'touchmove'].forEach(e => window.removeEventListener(e, trip)); window.scrollTo(0, 0); showLoginGate(false); };
  ['scroll', 'wheel', 'touchmove'].forEach(e => window.addEventListener(e, trip, { passive: true }));
}

/* 접속 표시: 로그인한 회원이 페이지를 보고 있으면 1분마다 알립니다 (실패해도 조용히 무시) */
function pingOnce() {
  const a = Auth.get(); if (!a || !CONFIG.API_URL || a.role === 'admin') return;
  fetch(CONFIG.API_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action: 'ping', token: a.token }) }).catch(() => {});
}
function startPing() {
  pingOnce();
  setInterval(() => { if (!document.hidden) pingOnce(); }, 60000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) pingOnce(); });
}

function sideBox(S) {
  return '';
}

/* ---------- 조각 ---------- */
function newsCard(n) {
  const img = n.images[0];
  return `<a class="card news-card" href="article.html?id=${n.id}">
    <div class="thumb ${img ? '' : 'ph'}" ${img ? `style="background-image:url('${esc(img)}')"` : ''}>${img ? '' : '<img src="assets/logo.png" alt="">'}</div>
    <div class="body"><span><span class="tag">${esc(n.cat)}</span></span><h3>${esc(n.title)}</h3><p>${esc(n.summary)}</p><div class="meta">${fmtDate(n.date)}</div><div class="rx" data-id="${esc(n.id)}"></div></div></a>`;
}

/* 제목·비고·장소에 시범운영(시범 운영) 문구가 있으면 시범운영 일정 */
function isTrial(e) { return new RegExp('시범\\s*운영').test([e.name, e.note, e.place].join(' ')); }
/* 접수 링크 -> 사이트명 */
function siteName(u) {
  let h = '';
  try { h = new URL(u).hostname.replace(/^www\./, '').toLowerCase(); } catch (x) { return u; }
  const M = { 'martincarat.com': '마틴캐럿', 'kpga7330.com': '대한파크골프협회', 'park-ro.com': '파크로', 'vcparkgolf.com': '보이스파크', 'xn--bb0bp9it32a1kcc8ci3c.com': '파크골프대회.com' };
  return M[h] || h;
}
function eventRow(e, opts = {}) {
  const same = ymd(e.start) === ymd(e.end);
  let dateTxt = same ? fmtShort(e.start) : `${fmtShort(e.start)}<small>~ ${fmtShort(e.end)}</small>`;
  const t = today0();
  /* 접수는 마감일만(~ 10/8(목)), 대회·연습라운딩은 날짜 칸을 비워 둠 (시범운영은 그대로) */
  let blank = false;
  if (!isTrial(e)) { if (e.type === '접수' && !same) dateTxt = `~ ${fmtShort(e.end)}`; else if (e.type === '대회' || e.type === '연습라운딩') blank = true; }
  const dl = e.type === '접수' && ymd(e.end) >= ymd(t) && (e.end - t) / 864e5 <= 3;
  const trial = isTrial(e);
  return `<div class="ev ${dl ? 'deadline' : ''}">
    <div class="date"${blank ? ' style="visibility:hidden"' : ''}>${blank ? '&nbsp;' : dateTxt}</div>
    <div style="flex:1;min-width:0"><div style="display:flex;align-items:flex-start;gap:10px"><h4 style="flex:1;min-width:0"${opts.max && e.name.length > opts.max ? ` title="${esc(e.name)}"` : ''}>${esc(opts.max && e.name.length > opts.max ? e.name.slice(0, opts.max) + '...' : e.name)}</h4><div style="display:flex;gap:6px;flex-shrink:0;flex-wrap:nowrap;justify-content:flex-end;white-space:nowrap">${trial ? '<span class="tag 시범운영">시범운영</span>' : `<span class="tag ${esc(e.type)}">${esc(e.type)}</span>${dl ? '<span class="tag 접수">마감임박</span>' : (e.type === '접수' && /접수마감/.test(e.name) ? '<span class="tag 접수">마감</span>' : '')}`}</div></div><div class="sub">${[e.region, e.place, e.note].filter(Boolean).map(esc).join(' · ')}</div>
    ${e.link && e.type === '접수' && !trial ? `<a class="go" href="${esc(e.link)}" target="_blank" rel="noopener">${esc(siteName(e.link))}</a>` : ''}</div></div>`;
}

function showError(el, e) {
  el.innerHTML = `<div class="empty">내용을 불러오지 못했습니다.<br><small>${esc(e.message || e)}</small></div>`;
}


/* ---------- 로그인 / 서버 통신 (Apps Script) ---------- */
const Auth = {
  get() {
    try {
      const v = JSON.parse(localStorage.getItem('pgn_auth') || sessionStorage.getItem('pgn_auth') || 'null');
      if (v && v.exp > Date.now() && v.role) return v;
    } catch (e) {}
    this.clear(); return null;
  },
  set(v, keep) { this.clear(); (keep ? localStorage : sessionStorage).setItem('pgn_auth', JSON.stringify(v)); },
  clear() { localStorage.removeItem('pgn_auth'); sessionStorage.removeItem('pgn_auth'); },
  logout() { this.clear(); location.href = 'index.html'; }
};

async function api(action, data = {}) {
  if (!CONFIG.API_URL) throw new Error('서버 연결이 아직 설정되지 않았습니다.');
  const a = Auth.get();
  const res = await fetch(CONFIG.API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },   /* 사전요청(CORS preflight)을 피하기 위해 text/plain 사용 */
    body: JSON.stringify({ action, token: a ? a.token : '', ...data })
  });
  if (!res.ok) throw new Error('서버 응답 오류 (' + res.status + ')');
  const out = await res.json();
  if (!out.ok) { if (out.auth) Auth.clear(); throw new Error(out.error || '요청에 실패했습니다.'); }
  return out;
}
function clearSheetCache() { Object.keys(sessionStorage).filter(k => k.startsWith('pgn_') && k !== 'pgn_auth').forEach(k => sessionStorage.removeItem(k)); }


const fmtPhone = v => v.replace(/[^0-9]/g, '').slice(0, 11).replace(/^(\d{3})(\d{3,4})(\d{0,4}).*/, (m, x, y, z) => z ? x + '-' + y + '-' + z : x + '-' + y);

/* ---------- 소셜 로그인 (구글 / 카카오 / 네이버) ---------- */
const OAUTH_REDIRECT = location.origin + '/oauth.html';
let _cfg = null;
async function getConfig() {
  if (_cfg) return _cfg;
  try { _cfg = await api('config'); } catch (e) { _cfg = { sms: false, google: '', kakao: '', naver: '' }; }
  return _cfg;
}
function loginDone(r, next) {
  Auth.set({ token: r.token, exp: r.exp, role: r.role, name: r.name || '' }, true);
  location.href = next || 'index.html';
}
function socialStart(provider, cid, next) {
  const st = provider + '.' + Math.random().toString(36).slice(2) + Date.now().toString(36);
  sessionStorage.setItem('pgn_oauth_state', st); sessionStorage.setItem('pgn_oauth_next', next || '');
  const q = 'response_type=code&client_id=' + encodeURIComponent(cid) + '&redirect_uri=' + encodeURIComponent(OAUTH_REDIRECT) + '&state=' + encodeURIComponent(st);
  location.href = provider === 'kakao' ? 'https://kauth.kakao.com/oauth/authorize?' + q : 'https://nid.naver.com/oauth2.0/authorize?' + q;
}
async function socialResult(r, next) {
  if (r.needNick) { showNickForm(r, next); return; }
  loginDone(r, next);
}
function showNickForm(r, next) {
  document.body.insertAdjacentHTML('beforeend', '<div class="modal" id="nickModal"><div class="card authbox" style="margin:0;max-width:420px;width:92%"><h2>닉네임 정하기</h2><p class="sub">처음 오셨네요. 댓글에 표시될 닉네임을 정해 주세요.</p><label class="field"><span>닉네임</span><input id="nk" maxlength="12"><small>2~12자</small></label><label class="field"><span>휴대폰 번호</span><input id="nkph" type="tel" inputmode="numeric" maxlength="13" placeholder="010-1234-5678"><small>운영자 연락용</small></label><div class="terms"><b>개인정보 수집·이용 안내</b><br>수집 항목: 소셜 계정 고유번호, 닉네임, 휴대폰 번호<br>이용 목적: 회원 식별, 댓글 작성 관리, 운영자 연락(공지·문의 응대). 휴대폰 번호는 관리자만 볼 수 있습니다.<br>보유 기간: 회원 탈퇴 요청 시까지</div><label class="chk"><input type="checkbox" id="nkagree"> 위 내용에 동의합니다</label><div id="nkmsg"></div><button class="btn green big" id="nkgo">가입 완료</button></div></div>');
  $('#nk').value = r.suggest || '';
  $('#nkph').addEventListener('input', e => { e.target.value = fmtPhone(e.target.value); });
  $('#nkgo').onclick = async () => {
    const m = $('#nkmsg'), b = $('#nkgo'); m.innerHTML = '';
    if (!$('#nkagree').checked) { m.innerHTML = '<div class="msg err">개인정보 수집·이용에 동의해 주세요.</div>'; return; }
    b.disabled = true; b.textContent = '처리 중...';
    try { loginDone(await api('socialjoin', { pending: r.pending, nick: $('#nk').value.trim(), phone: $('#nkph').value, agree: true }), next); }
    catch (e) { m.innerHTML = '<div class="msg err">' + esc(e.message) + '</div>'; b.disabled = false; b.textContent = '가입 완료'; }
  };
}
async function renderSocial(el, next) {
  const c = await getConfig();
  if (!c.google && !c.kakao && !c.naver) { el.innerHTML = ''; return; }
  el.innerHTML = '<div class="or"><span>또는 간편하게</span></div>' +
    (c.kakao ? '<button type="button" class="sbtn kakao" data-p="kakao">카카오로 시작하기</button>' : '') +
    (c.naver ? '<button type="button" class="sbtn naver" data-p="naver">네이버로 시작하기</button>' : '') +
    (c.google ? '<div id="gbtn" style="display:flex;justify-content:center;margin-top:8px"></div>' : '');
  el.onclick = e => { const b = e.target.closest('[data-p]'); if (b) socialStart(b.dataset.p, c[b.dataset.p], next); };
  if (c.google) {
    const s = document.createElement('script'); s.src = 'https://accounts.google.com/gsi/client'; s.async = true;
    s.onload = () => {
      google.accounts.id.initialize({ client_id: c.google, callback: async resp => {
        try { socialResult(await api('social', { provider: 'google', credential: resp.credential }), next); }
        catch (e) { alert(e.message); }
      } });
      google.accounts.id.renderButton($('#gbtn'), { theme: 'outline', size: 'large', text: 'continue_with', locale: 'ko', width: 280 });
    };
    document.head.appendChild(s);
  }
}

/* 비밀번호 보기/숨기기 단추 */
function pwEye(...sels) {
  sels.forEach(sel => {
    const inp = $(sel); if (!inp || inp.dataset.eye) return; inp.dataset.eye = '1';
    const w = document.createElement('div'); w.className = 'pwwrap';
    inp.parentNode.insertBefore(w, inp); w.appendChild(inp);
    const b = document.createElement('button'); b.type = 'button'; b.className = 'pweye'; b.textContent = '보기'; b.setAttribute('aria-label', '비밀번호 보기'); b.setAttribute('aria-pressed', 'false');
    b.onmousedown = e => e.preventDefault();
    b.onclick = () => { const on = inp.type === 'password'; inp.type = on ? 'text' : 'password'; b.textContent = on ? '숨기기' : '보기'; b.setAttribute('aria-pressed', String(on)); b.setAttribute('aria-label', on ? '비밀번호 숨기기' : '비밀번호 보기'); };
    w.appendChild(b);
  });
}


/* ---------- 뉴스 반응 (최고예요·좋아요·싫어요) ---------- */
const RX_DEF = [['best', '\u{1F60D}', '최고예요'], ['like', '\u{1F44D}', '좋아요'], ['dislike', '\u{1F44E}', '싫어요']];
const RX = { counts: {}, mine: {}, loaded: false, p: null };
(function () {
  const st = document.createElement('style');
  st.textContent = '.rx{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}' +
    '.rx button{font:inherit;font-size:.85rem;background:#fff;border:1px solid var(--line);border-radius:999px;padding:3px 10px;cursor:pointer;display:inline-flex;align-items:center;gap:4px;color:var(--ink);line-height:1.4}' +
    '.rx button .e{font-size:1.15rem}.rx button .t{display:none}' +
    '.rx button:hover{border-color:var(--g600);background:var(--g50)}' +
    '.rx button.on{background:var(--g100);border-color:var(--g700);font-weight:800;color:var(--g900)}' +
    '.rx button:disabled{opacity:.6;cursor:wait}' +
    '.rx.big{gap:10px;margin:10px 0 4px;justify-content:center}' +
    '.rx.big button{font-size:1rem;padding:8px 16px}.rx.big button .e{font-size:1.7rem}.rx.big button .t{display:inline}' +
    '.rxhead{text-align:center;font-weight:800;margin:24px 0 0;color:var(--g900)}';
  document.head.appendChild(st);
})();
function rxHtml(id) {
  const c = RX.counts[id] || {}, m = RX.mine[id];
  return RX_DEF.map(([k, e, t]) => '<button type="button" data-k="' + k + '" class="' + (m === k ? 'on' : '') + '" title="' + t + '" aria-label="' + t + '" aria-pressed="' + (m === k) + '"><span class="e">' + e + '</span><span class="t">' + t + '</span> <b>' + (c[k] || 0) + '</b></button>').join('');
}
function rxPaint(id) {
  document.querySelectorAll('.rx[data-id]').forEach(el => { if (!id || el.dataset.id === id) { el.dataset.ok = 1; el.innerHTML = rxHtml(el.dataset.id); } });
}
function rxLoad() {
  if (!RX.p) RX.p = api('rlist').then(r => { RX.counts = r.counts || {}; RX.mine = r.mine || {}; }).catch(() => {}).then(() => { RX.loaded = true; });
  return RX.p;
}
let _rxT;
function rxScan() {
  const els = [...document.querySelectorAll('.rx[data-id]:not([data-ok])')];
  if (!els.length) return;
  rxLoad().then(() => els.forEach(el => { el.dataset.ok = 1; el.innerHTML = rxHtml(el.dataset.id); }));
}
new MutationObserver(() => { clearTimeout(_rxT); _rxT = setTimeout(rxScan, 40); }).observe(document.documentElement, { childList: true, subtree: true });
document.addEventListener('click', async e => {
  const b = e.target.closest('.rx button[data-k]'); if (!b) return;
  e.preventDefault(); e.stopPropagation();
  const box = b.closest('.rx'), id = box.dataset.id;
  if (!Auth.get()) {
    if (confirm('반응을 남기려면 로그인이 필요합니다.\n로그인 화면으로 이동할까요?')) location.href = 'login.html?next=' + encodeURIComponent(location.pathname.split('/').pop() + location.search);
    return;
  }
  const all = box.querySelectorAll('button'); all.forEach(x => x.disabled = true);
  try {
    const r = await api('react', { aid: id, kind: b.dataset.k });
    RX.counts[id] = (r.counts && r.counts[id]) || { best: 0, like: 0, dislike: 0 };
    if (r.mine && r.mine[id]) RX.mine[id] = r.mine[id]; else delete RX.mine[id];
    rxPaint(id);
  } catch (err) { alert(err.message); all.forEach(x => x.disabled = false); }
}, true);


/* ---------- 개선요청 답변 알림 (로그인한 회원에게 새 답변이 있으면 한 번만 띄움) ---------- */
async function rqCheck() {
  const me = Auth.get(); if (!me || me.role === 'admin') return;
  if (/\/(login|signup|oauth|find)(\.html)?$/.test(location.pathname)) return;
  const K = 'pgn_rqchk', tk = String(me.token || '').slice(-16);
  if (sessionStorage.getItem(K) === tk) return;
  sessionStorage.setItem(K, tk);
  let r; try { r = await api('reqnotice'); } catch (e) { return; }
  if (!r.items || !r.items.length || document.getElementById('pgn-rq')) return;
  document.body.insertAdjacentHTML('beforeend', '<div id="pgn-rq" role="dialog" aria-modal="true" style="position:fixed;inset:0;z-index:9998;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;padding:18px"><div style="background:#fff;border-radius:14px;max-width:480px;width:100%;max-height:85vh;overflow:auto;padding:24px;box-shadow:0 10px 40px rgba(0,0,0,.3)">' +
    '<h3 style="margin:0 0 6px;font-size:1.2rem;color:var(--g900)">개선요청에 답변이 도착했습니다</h3>' +
    r.items.map(x => '<div style="border-top:1px solid var(--line);padding:12px 0"><b>[' + esc(x.cat) + '] ' + esc(x.title) + '</b> <span class="tag">' + esc(x.status) + '</span><div style="margin-top:6px;white-space:pre-wrap;word-break:break-word;line-height:1.6;background:var(--g50);border-radius:10px;padding:10px 12px"><b>운영자 답변</b> <small style="color:var(--muted)">' + esc(x.replyAt) + '</small><br>' + esc(x.reply) + '</div></div>').join('') +
    '<div style="display:flex;gap:10px;margin-top:6px"><a class="btn green" style="flex:1;text-align:center" href="mypage.html#rq">마이페이지에서 보기</a><button type="button" class="btn" style="flex:1;background:#fff;color:var(--g900);border:2px solid var(--g700);cursor:pointer;font-weight:800" id="pgn-rq-x">닫기</button></div>' +
    '<p style="margin:12px 0 0;color:var(--muted);font-size:.85rem">이 안내는 한 번만 표시됩니다. 답변은 마이페이지 > 개선요청에서 다시 볼 수 있습니다.</p></div></div>');
  document.body.style.overflow = 'hidden';
  const close = () => { const m = document.getElementById('pgn-rq'); if (m) m.remove(); document.body.style.overflow = ''; };
  document.getElementById('pgn-rq-x').onclick = close;
  document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
}
setTimeout(rqCheck, 1500);


/* ---------- 일정 카드 행 높이: 화면에 있는 가장 높은 행에 모두 맞춤 ---------- */
(function () {
  const st = document.createElement('style'); st.textContent = '.ev,.ev.eq{padding:4mm 14px;align-items:center}';   /* 행 위아래 여백 4mm, 높이는 내용에 맞춤 */ document.head.appendChild(st);
  let T;
  function eqRows() {
    const rows = [...document.querySelectorAll('.ev')].filter(r => !r.closest('.mylist'));
    if (!rows.length) return;
    rows.forEach(r => { r.style.minHeight = ''; r.classList.add('eq'); });
    let m = 0; rows.forEach(r => { m = Math.max(m, r.getBoundingClientRect().height); });
    rows.forEach(r => { r.style.minHeight = ''; });
  }
  const later = ms => { clearTimeout(T); T = setTimeout(eqRows, ms); };
  new MutationObserver(() => later(60)).observe(document.documentElement, { childList: true, subtree: true });
  addEventListener('resize', () => later(150));
  addEventListener('load', () => later(100));
})();
