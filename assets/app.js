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
    .filter(r => !/^(n|no|아니오|비공개|x)$/i.test(r['공개'] || 'Y') && (r['제목'] || '').trim())
    .map(r => {
      const d = parseDate(r['날짜']) || new Date(2000, 0, 1);
      const body = r['본문'] || r['요약'] || '';
      return {
        id: ymd(d) + '-' + hash((r['제목'] || '')),
        date: d, cat: r['카테고리'] || '뉴스', title: r['제목'],
        summary: r['요약'] || body.replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120),
        embed: /^https?:\/\//.test(r['임베드'] || '') ? r['임베드'] : '',
        body, images: imgList(r['이미지']), link: r['출처링크'] || r['링크'] || '', source: r['출처'] || '', writer: r['작성자'] || ''
      };
    })
    .sort((a, b) => b.date - a.date);
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
async function layout(active) {
  const S = await getSettings();
  const nav = [['index.html', '홈', 'home'], ['news.html', '뉴스', 'news'], ['today.html', '오늘일정', 'today'], ['schedule.html', '대회일정', 'schedule'], ['about.html', '회사소개', 'about']];
  const me = Auth.get();
  const authNav = !me ? `<a href="login.html" class="auth ${active === 'login' ? 'on' : ''}">로그인</a><a href="signup.html" class="auth ${active === 'signup' ? 'on' : ''}">회원가입</a>` : (me.role === 'admin' ? `<a href="write.html" class="${active === 'write' ? 'on' : ''}">글쓰기</a>` : '') + `<span class="who">${esc(me.name)}님</span><a href="#" onclick="Auth.logout();return false" class="auth">로그아웃</a>`;
  document.body.insertAdjacentHTML('afterbegin', `
    <div class="topbar"><div class="wrap"><span>${esc(S.슬로건)}</span>
    <span><a href="${esc(S.밴드)}" target="_blank" rel="noopener">네이버 밴드</a> · <a href="${esc(S.오픈채팅)}" target="_blank" rel="noopener">오픈채팅방</a> · ${esc(S.전화)}</span></div></div>
    <header class="site"><div class="wrap">
      <a class="brand" href="index.html"><img src="assets/logo.png" alt="">${esc(S.사이트명)}</a>
      <button class="menu-btn" aria-label="메뉴" onclick="document.querySelector('nav.main').classList.toggle('open')">메뉴</button>
      <nav class="main">${nav.map(n => `<a href="${n[0]}" class="${n[2] === active ? 'on' : ''}">${n[1]}</a>`).join('')}${authNav}</nav>
    </div></header>
    ${S.공지 ? `<div class="notice"><div class="wrap">공지 | ${esc(S.공지)}</div></div>` : ''}`);
  document.body.insertAdjacentHTML('beforeend', `
    <footer class="site"><div class="wrap">
      <div><b>${esc(S.사이트명)}</b><br>주소 : ${esc(S.주소)}<br>전화 : ${esc(S.전화)} · 팩스 : ${esc(S.팩스)}<br>담당 : ${esc(S.담당)}</div>
      <div><a href="${esc(S.밴드)}" target="_blank" rel="noopener">네이버 밴드 ${esc(S.밴드.replace(/^https?:\/\//, ''))}</a><br><a href="${esc(S.오픈채팅)}" target="_blank" rel="noopener">카카오 오픈채팅방</a><br>&copy; ${new Date().getFullYear()} ${esc(S.사이트명)}. All rights reserved.</div>
    </div></footer>`);
  return S;
}

function sideBox(S) {
  return `<aside>
    <div class="card"><h3>파크골프뉴스 밴드</h3>
      <div class="info">매일 아침 오늘의 대회 일정과 뉴스를 밴드에서 가장 먼저 받아보세요.</div>
      <a class="sidebtn band" href="${esc(S.밴드)}" target="_blank" rel="noopener">네이버 밴드 가입하기</a>
      <a class="sidebtn kakao" href="${esc(S.오픈채팅)}" target="_blank" rel="noopener">카카오 오픈채팅방</a></div>
    <div class="card"><h3>연락처</h3><div class="info">
      <b>주소</b> ${esc(S.주소)}<br><b>전화</b> <a href="tel:${esc(S.전화.replace(/[^\d]/g, ''))}">${esc(S.전화)}</a><br><b>팩스</b> ${esc(S.팩스)}<br><b>담당</b> ${esc(S.담당)}</div></div>
  </aside>`;
}

/* ---------- 조각 ---------- */
function newsCard(n) {
  const img = n.images[0];
  return `<a class="card news-card" href="article.html?id=${n.id}">
    <div class="thumb ${img ? '' : 'ph'}" ${img ? `style="background-image:url('${esc(img)}')"` : ''}>${img ? '' : '<img src="assets/logo.png" alt="">'}</div>
    <div class="body"><span><span class="tag">${esc(n.cat)}</span></span><h3>${esc(n.title)}</h3><p>${esc(n.summary)}</p><div class="meta">${fmtDate(n.date)}</div></div></a>`;
}

function eventRow(e, opts = {}) {
  const same = ymd(e.start) === ymd(e.end);
  const dateTxt = same ? fmtShort(e.start) : `${fmtShort(e.start)}<small>~ ${fmtShort(e.end)}</small>`;
  const t = today0();
  const dl = e.type === '접수' && ymd(e.end) >= ymd(t) && (e.end - t) / 864e5 <= 3;
  return `<div class="ev ${dl ? 'deadline' : ''}">
    <div class="date">${dateTxt}</div>
    <div style="flex:1"><div><span class="tag ${esc(e.type)}">${esc(e.type)}</span>${dl ? ' <span class="tag 접수">마감임박</span>' : ''}</div>
    <h4>${esc(e.name)}</h4><div class="sub">${[e.region, e.place, e.note].filter(Boolean).map(esc).join(' · ')}</div>
    ${e.link ? `<a class="go" href="${esc(e.link)}" target="_blank" rel="noopener">자세히 보기 &rarr;</a>` : ''}</div></div>`;
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
