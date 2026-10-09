/* 파크골프뉴스 공용 스크립트: 구글시트 -> 화면 */
const CONFIG = {
  SHEET_ID: '1sl-4jdTKIqpiUM-s2kjPAF-jJoIrCnBnoM8mmcY36cc',   // 구글시트 주소의 /d/ 와 /edit 사이 긴 문자열
  TABS: { news: '뉴스', schedule: '일정', calendar: '캘린더', settings: '설정' },
  CACHE_MIN: 3,
  KAKAO_JS: '329814625fa8441db2871c2b10da8efa',   // 카카오 개발자센터 앱의 JavaScript 키 (넣으면 카카오톡 친구선택 화면이 바로 열림)
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

/* ---------- 데이터 읽기 ----------
   서버(feed) 우선 + 구글시트 보조(6초 넘게 걸리거나 실패하면 동시에 시작).
   기기에 저장된 사본을 먼저 보여 주고, 뒤에서 새로 받아 바뀐 게 있으면 'pgn-data' 이벤트로 화면을 다시 그립니다. */
const TAB_NAMES = [CONFIG.TABS.news, CONFIG.TABS.calendar, CONFIG.TABS.schedule, CONFIG.TABS.settings];
const FRESH_MS = 90 * 1000, MAX_STALE_MS = 12 * 3600 * 1000, LS = 'pgn3_';
const ALL_KEY = TAB_NAMES.join('|');
const _mem = {}, _fly = {};
function lsGet(k) { try { return JSON.parse(localStorage.getItem(LS + k) || 'null'); } catch (e) { return null; } }
function lsSet(k, v) {
  const s = JSON.stringify(v);
  try { localStorage.setItem(LS + k, s); }
  catch (e) { try { Object.keys(localStorage).filter(x => x.startsWith(LS) && x !== LS + 'set').forEach(x => localStorage.removeItem(x)); localStorage.setItem(LS + k, s); } catch (e2) {} }
}
function csvToRows(text) {
  const rows = parseCSV(text);
  if (!rows.length) return [];
  const head = rows[0].map(h => h.trim());
  return rows.slice(1)
    .filter(r => r.some(v => v && v.trim()))
    .map(r => Object.fromEntries(head.map((h, i) => [h, (r[i] ?? '').trim()])));
}
async function gvizTab(name) {
  const res = await fetch('https://docs.google.com/spreadsheets/d/' + CONFIG.SHEET_ID + '/gviz/tq?tqx=out:csv&sheet=' + encodeURIComponent(name));
  if (!res.ok) throw new Error('시트를 불러오지 못했습니다 (' + res.status + ')');
  return csvToRows(await res.text());
}
async function feedTabs(names) {
  if (!CONFIG.API_URL) throw new Error('no api');
  const res = await fetch(CONFIG.API_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action: 'feed', tabs: names }) });
  if (!res.ok) throw new Error('feed ' + res.status);
  const out = await res.json();
  if (!out || !out.ok || !out.tabs) throw new Error('feed');
  return out.tabs;
}
function fetchTabs(names) {
  const key = names.join('|');
  if (_fly[key]) return _fly[key];
  const p = new Promise((resolve, reject) => {
    let done = false, gvStarted = false, feedBad = false, gvBad = false;
    const finish = t => { if (!done) { done = true; resolve(t); } };
    const maybeFail = e => { if (!done && feedBad && gvBad) { done = true; reject(e); } };
    const gv = () => {
      if (done || gvStarted) return; gvStarted = true;
      Promise.all(names.map(n => gvizTab(n).catch(() => null))).then(arr => {
        const t = {}; names.forEach((n, i) => { t[n] = arr[i]; });
        if (arr.some(Boolean)) finish(t); else { gvBad = true; maybeFail(new Error('시트를 불러오지 못했습니다')); }
      });
    };
    feedTabs(names).then(finish).catch(e => { feedBad = true; gv(); maybeFail(e); });
    setTimeout(gv, 6000);
  });
  _fly[key] = p;
  const clr = () => { delete _fly[key]; };
  p.then(clr, clr);
  return p;
}
function storeAll(tabs) {
  const old = (_mem.all && _mem.all.tabs) || {}, merged = {};
  TAB_NAMES.forEach(n => { merged[n] = tabs[n] || old[n] || null; });
  _mem.all = { t: Date.now(), tabs: merged };
  lsSet('all', _mem.all);
  if (merged[CONFIG.TABS.settings]) lsSet('set', { t: Date.now(), rows: merged[CONFIG.TABS.settings] });
  return merged;
}
let _bg = null;
function bgRefresh() {
  if (_bg) return;
  const before = JSON.stringify(_mem.all.tabs);
  _bg = fetchTabs(TAB_NAMES).then(t => { const m = storeAll(t); if (JSON.stringify(m) !== before) window.dispatchEvent(new Event('pgn-data')); }).catch(() => {}).then(() => { _bg = null; });
}
function getAll() {
  if (!_mem.all) _mem.all = lsGet('all');
  const c = _mem.all, age = c && c.tabs ? Date.now() - c.t : Infinity;
  if (age < FRESH_MS) return Promise.resolve(c.tabs);
  if (age < MAX_STALE_MS) { bgRefresh(); return Promise.resolve(c.tabs); }
  return fetchTabs(TAB_NAMES).then(storeAll).catch(e => { if (c && c.tabs) return c.tabs; throw e; });
}
function parseSettings(rows) {
  const s = { ...DEFAULTS };
  (rows || []).forEach(r => { const k = r['키'] || r['항목']; if (k && (r['값'] ?? '') !== '') s[k] = r['값']; });
  return s;
}
function settingsNow() { const c = lsGet('set'); return parseSettings(c && c.rows); }
function refreshSettings(onChange) {
  const c = lsGet('set'); if (c && Date.now() - c.t < 10 * 60000) return;
  setTimeout(() => {
    const p = (_mem.all && Date.now() - _mem.all.t < FRESH_MS) ? Promise.resolve(_mem.all.tabs) : (_fly[ALL_KEY] || fetchTabs([CONFIG.TABS.settings]));
    p.then(t => { const rows = t[CONFIG.TABS.settings]; if (!rows) return; lsSet('set', { t: Date.now(), rows }); onChange(parseSettings(rows)); }).catch(() => {});
  }, 60);
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
async function getSettings() { return settingsNow(); }

async function getNews() {
  const tabs = await getAll();
  const rows = tabs[CONFIG.TABS.news];
  if (!rows) throw new Error('시트를 불러오지 못했습니다');
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
  const all = await getAll();
  const tabs = [all[CONFIG.TABS.calendar] || [], all[CONFIG.TABS.schedule] || []];
  tabs[0] = tabs[0].map(r => ({ ...r, 비고: '' }));   /* 캘린더 설명은 길고 계좌번호 등이 섞여 있어 화면에는 쓰지 않음 */
  const rows = tabs.flat();
  if (!rows.length) throw new Error('일정을 불러오지 못했습니다');
  const seen = new Set();
  return rows
    .filter(r => !/^(n|no|아니오|비공개|x)$/i.test(r['공개'] || 'Y') && (r['대회명'] || '').trim())
    .map(r => {
      const s = parseDate(r['시작일']); if (!s) return null;
      const e = parseDate(r['종료일']) || s;
      return { start: s, end: e < s ? s : e, type: (/연습\s*(라운딩|일)/.test(r['대회명']) || r['구분'] === '연습라운딩') ? '연습일' : (r['구분'] || '대회'), name: r['대회명'].replace(/^[\s\u{1F300}-\u{1FAFF}\u2600-\u27BF\uFE0F]+/u, ''), region: r['지역'] || '', place: r['장소'] || '', link: (r['링크'] || '').replace(/[)\]\.,;]+$/, ''), note: r['비고'] || '', detail: r['상세'] || '' };
    })
    .filter(Boolean)
    .filter(e => { const k = ymd(e.start) + '|' + ymd(e.end) + '|' + e.type + '|' + e.name; if (seen.has(k)) return false; seen.add(k); return true; })
    .sort((a, b) => a.start - b.start || a.name.localeCompare(b.name));
}

/* ---------- 방문 통계 기록 (관리자 > 통계). 관리자·봇·제외 설정한 브라우저는 기록 안 함 ---------- */
const TRK = (() => {
  const ua = navigator.userAgent;
  const bot = !!navigator.webdriver || /bot|crawl|spider|slurp|Yeti|Daumoa|facebookexternalhit|kakaotalk-scrap|HeadlessChrome|Lighthouse|PageSpeed|Prerender/i.test(ua);
  const off = () => { try { return bot || !CONFIG.API_URL || localStorage.getItem('pgn_notrack') === '1' || (Auth.get() || {}).role === 'admin'; } catch (e) { return true; } };
  let q = [], tm = 0;
  const rid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const dev = () => (/iPad|Tablet|SM-T|SM-X|Tab/i.test(ua) || (/Android/.test(ua) && !/Mobile/.test(ua)) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) ? '태블릿' : /Mobi|iPhone|iPod|Android/i.test(ua) ? '모바일' : 'PC';
  const brw = () => /KAKAOTALK/i.test(ua) ? '카카오톡' : /BAND\//.test(ua) ? '밴드앱' : /NAVER/.test(ua) ? '네이버앱' : /Whale/.test(ua) ? '웨일' : /SamsungBrowser/.test(ua) ? '삼성인터넷' : /Edg/.test(ua) ? '엣지' : /CriOS|Chrome\//.test(ua) ? '크롬' : /Firefox|FxiOS/.test(ua) ? '파이어폭스' : /Safari/.test(ua) ? '사파리' : '기타';
  const page = () => { const sp = new URLSearchParams(location.search); ['ref', 'post', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content'].forEach(k => sp.delete(k)); const s = sp.toString(); return (location.pathname === '/' ? '/index.html' : location.pathname) + (s ? '?' + s : ''); };
  function source() {
    const sp = new URLSearchParams(location.search);
    const ref = (sp.get('ref') || sp.get('utm_source') || '').toLowerCase().slice(0, 30), post = (sp.get('post') || sp.get('utm_content') || '').slice(0, 40);
    let r0 = ''; try { r0 = sessionStorage.getItem('pgn_ref0'); sessionStorage.removeItem('pgn_ref0'); } catch (e) {}
    const rf = r0 || document.referrer || '';
    let host = '', kw = '';
    try { if (rf) { const u = new URL(rf); host = u.hostname.replace(/^(www|m)\./, ''); kw = u.searchParams.get('query') || u.searchParams.get('q') || ''; } } catch (e) {}
    const own = host && location.hostname.replace(/^www\./, '') === host;
    let ch;
    if (/band/.test(ref)) ch = '네이버 밴드';
    else if (/kakao/.test(ref)) ch = '카카오톡';
    else if (ref) ch = ref;
    else if (own) ch = '내부 이동';
    else if (/band\.us/.test(host) || /BAND\//.test(ua)) ch = '네이버 밴드';
    else if (/kakao/.test(host) || /KAKAOTALK/i.test(ua)) ch = '카카오톡';
    else if (/naver\.com/.test(host)) ch = '네이버 검색';
    else if (/google\./.test(host)) ch = '구글 검색';
    else if (/daum\.net/.test(host)) ch = '다음 검색';
    else if (/bing\.com/.test(host)) ch = '빙 검색';
    else if (host) ch = '기타 사이트';
    else ch = '직접 접속';
    return { ch, det: [ref ? 'ref=' + ref : '', post ? 'post=' + post : '', own ? '' : host].filter(Boolean).join(' '), kw: /검색/.test(ch) ? kw.slice(0, 100) : '' };
  }
  function session() {
    const now = Date.now(), last = +sessionStorage.getItem('pgn_slast') || 0, s0 = source();
    let sid = sessionStorage.getItem('pgn_sid'), src = null;
    try { src = JSON.parse(sessionStorage.getItem('pgn_src') || 'null'); } catch (e) {}
    const fresh = s0.ch !== '내부 이동' && s0.ch !== '직접 접속' && (!src || s0.ch !== src.ch || s0.det !== src.det);
    if (!sid || !src || now - last > 30 * 60e3 || fresh) {
      sid = rid(); src = s0.ch === '내부 이동' ? { ch: '직접 접속', det: '', kw: '' } : s0;
      sessionStorage.setItem('pgn_sid', sid); sessionStorage.setItem('pgn_src', JSON.stringify(src));
    }
    sessionStorage.setItem('pgn_slast', String(now));
    return { sid, src };
  }
  let vid = '', sid = '';
  function push(h) {
    if (off()) return;
    if (!vid) { vid = localStorage.getItem('pgn_vid') || ''; if (!vid) { vid = rid(); localStorage.setItem('pgn_vid', vid); } }
    if (!sid) sid = sessionStorage.getItem('pgn_sid') || session().sid;
    q.push(Object.assign({ v: vid, s: sid, p: page(), dv: dev(), br: brw(), w: innerWidth, at: Date.now() }, h));
  }
  function flush() {
    clearTimeout(tm); tm = 0;
    if (!q.length || off()) { q = []; return; }
    const t = document.title.replace(/\s*-\s*파크골프뉴스$/, '');
    q.forEach(h => { if (h.k === 'pv' && !h.ti) h.ti = t; });
    const a = Auth.get(), body = JSON.stringify({ action: 'hit', token: a ? a.token : '', hits: q.splice(0, 30) });
    /* sendBeacon은 구글 로그인 쿠키가 붙어 여러 계정 사용자에게서 실패하므로 쿠키 없이 fetch(keepalive) */
    fetch(CONFIG.API_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body, keepalive: true, credentials: 'omit' }).catch(() => {});
  }
  const later = ms => { if (!tm) tm = setTimeout(flush, ms); };
  let pvDone = false;
  function pv() {
    if (pvDone || off()) return; pvDone = true;
    const isNew = !localStorage.getItem('pgn_vid');
    const ss = session(); sid = ss.sid;
    push({ k: 'pv', n: isNew ? 1 : 0, ch: ss.src.ch, cd: ss.src.det, q: ss.src.kw });
    later(2500);   // 제목이 다 그려진 뒤 보냄 (페이지 속도에 영향 없음)
  }
  function ev(e) { push({ k: 'ev', tg: e.name, ti: isTrial(e) ? '시범운영' : e.type, rg: e.region || '' }); later(3000); }
  document.addEventListener('click', e => {
    const a = e.target.closest && e.target.closest('a[href]'); if (!a) return;
    let u; try { u = new URL(a.href, location.href); } catch (x) { return; }
    if (!/^https?:$/.test(u.protocol) || u.hostname === location.hostname) return;
    const evEl = a.closest('.ev, #evd'), name = evEl ? ((evEl.querySelector('h4, h3') || {}).textContent || '').trim() : '';
    push({ k: 'click', tg: u.href, ti: name, cd: (a.textContent || '').trim().slice(0, 60) }); flush();
  }, true);
  document.addEventListener('change', e => {
    const t = e.target; if (!t || !t.matches || !t.matches('input[type=search], input#q')) return;
    const v = (t.value || '').trim(); if (v.length >= 2) { push({ k: 'search', tg: v.slice(0, 60) }); later(2000); }
  }, true);
  addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });
  function tag(url, ref) { try { const u = new URL(url); ['ref', 'post'].forEach(k => u.searchParams.delete(k)); u.searchParams.set('ref', ref); return u.toString(); } catch (e) { return url; } }
  return { pv, ev, flush, tag, off };
})();

/* ---------- 공통 레이아웃 ---------- */
async function layout(active, opts) {
  opts = opts || {};
  let S = settingsNow();   // 저장된 설정(없으면 기본값)으로 바로 그리고, 바뀐 게 있으면 나중에 갱신
  const me = Auth.get();
  const memberMode = me && me.role !== 'admin';   // 회원: 메뉴는 '자유게시판' 하나 (중복 방지)
  const nav = [['today.html', '오늘일정', 'today'], ['schedule.html', '월간일정', 'schedule'], ['news.html', '뉴스', 'news'], ['board.html', '자유게시판', 'board'], ['join.html', '조인게시판', 'join']];
  const authNav = !me ? `<a href="login.html" class="auth ${active === 'login' ? 'on' : ''}">로그인</a><a href="signup.html" class="auth ${active === 'signup' ? 'on' : ''}">회원가입</a>` : (me.role === 'admin' ? `<a href="members.html" class="${active === 'members' ? 'on' : ''}">회원현황</a><a href="requests.html" class="${active === 'requests' ? 'on' : ''}">개선요청</a><a href="stats.html" class="${active === 'stats' ? 'on' : ''}">통계</a>` : '') + `<a href="mypage.html" class="who ${active === 'mypage' ? 'on' : ''}" title="마이페이지">${esc(me.name)}님</a><a href="#" onclick="Auth.logout();return false" class="auth">로그아웃</a>`;
  const head = S => `
    <div class="topbar"><div class="wrap"><span>${esc(S.슬로건)}</span>
    <span><a href="${esc(S.밴드)}" target="_blank" rel="noopener">네이버 밴드</a> · <a href="${esc(S.오픈채팅)}" target="_blank" rel="noopener">오픈채팅방</a> · ${esc(S.전화)}</span></div></div>
    <header class="site"><div class="wrap">
      <span class="brand"><a href="index.html" title="홈" style="display:flex;align-items:center"><img src="assets/logo.png" alt="홈"></a><a href="about.html" title="회사소개">${esc(S.사이트명)}</a></span>
      <button class="menu-btn" aria-label="메뉴" onclick="document.querySelector('nav.main').classList.toggle('open')">메뉴</button>
      <nav class="main">${nav.map(n => `<a href="${n[0]}" class="${n[2] === active ? 'on' : ''}">${n[1]}</a>`).join('')}${authNav}</nav>
    </div></header>
    ${S.공지 ? `<div class="notice"><div class="wrap">공지 | ${esc(S.공지)}</div></div>` : ''}`;
  const foot = S => `
    <div class="wrap">
      <div><b>${esc(S.사이트명)}</b><br>주소 : ${esc(S.주소)}<br>전화 : ${esc(S.전화)} · 팩스 : ${esc(S.팩스)}<br>담당 : ${esc(S.담당)}</div>
      <div><a href="${esc(S.밴드)}" target="_blank" rel="noopener">네이버 밴드 ${esc(S.밴드.replace(/^https?:\/\//, ''))}</a><br><a href="${esc(S.오픈채팅)}" target="_blank" rel="noopener">카카오 오픈채팅방</a><br>개선요청사항 접수 : <a href="request.html">개선요청 남기기</a><br><br>&copy; ${new Date().getFullYear()} ${esc(S.사이트명)}. All rights reserved.</div>
    </div>`;
  document.body.insertAdjacentHTML('afterbegin', '<div id="pgn-head" style="display:contents">' + head(S) + '</div>');
  document.body.insertAdjacentHTML('beforeend', '<footer class="site" id="pgn-foot">' + foot(S) + '</footer>');
  refreshSettings(S2 => { if (JSON.stringify(S2) === JSON.stringify(S)) return; S = S2; $('#pgn-head').innerHTML = head(S); $('#pgn-foot').innerHTML = foot(S); });
  startShare(active);   // 제목 오른쪽 공유 버튼
  pageComments(active);   // 페이지 맨 아래 댓글
  TRK.pv();             // 방문 통계
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
  const last = +localStorage.getItem('pgn_lastping') || 0; if (Date.now() - last < 100000) return;   // 페이지를 옮길 때마다 서버를 부르지 않음
  localStorage.setItem('pgn_lastping', String(Date.now()));
  fetch(CONFIG.API_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action: 'ping', token: a.token }) }).catch(() => {});
}
function startPing() {
  setTimeout(pingOnce, 4000);   // 화면 데이터가 먼저 오도록 늦춤
  setInterval(() => { if (!document.hidden) pingOnce(); }, 60000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) pingOnce(); });
}

function sideBox(S) {
  return '';
}

/* ---------- 조각 ---------- */
function thumbUrl(u) { return String(u).replace(/(drive\.google\.com\/thumbnail\?[^\s]*?)sz=w\d+/, '$1sz=w640'); }
function newsCard(n) {
  const img = n.images[0];
  return `<a class="card news-card" href="article.html?id=${n.id}">
    <div class="thumb ${img ? '' : 'ph'}" ${img ? 'style="position:relative;overflow:hidden"' : ''}>${img ? `<img src="${esc(thumbUrl(img))}" alt="" loading="lazy" decoding="async" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover">` : '<img src="assets/logo.png" alt="">'}</div>
    <div class="body"><span><span class="tag">${esc(n.cat)}</span></span><h3>${esc(n.title)}</h3><p>${esc(n.summary)}</p><div class="meta">${fmtDate(n.date)}</div><div class="cardfoot"><div class="rx" data-id="${esc(n.id)}"></div><button type="button" class="cmb" data-cid="${esc(n.id)}" data-title="${esc(n.title)}" data-href="article.html?id=${esc(n.id)}" aria-label="댓글 보기·쓰기"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1.1-4.6A8 8 0 1 1 21 12z"/></svg>댓글 <b>0</b></button></div></div></a>`;
}

/* 제목·비고·장소에 시범운영(시범 운영) 문구가 있으면 시범운영 일정 */
function isTrial(e) { return new RegExp('시범\\s*운영').test([e.name, e.note, e.place].join(' ')); }
/* 접수 링크 -> 사이트명 */
function siteName(u) {
  let h = '';
  try { h = new URL(u).hostname.replace(/^www\./, '').toLowerCase(); } catch (x) { return u; }
  const M = { 'martincarat.com': '마틴캐럿', 'kpga7330.com': '대한파크골프협회', 'park-ro.com': '파크로', 'vcparkgolf.com': '보이스파크', 'parkmoa.kr': '파크모아', 'xn--bb0bp9it32a1kcc8ci3c.com': '파크골프대회.com' };
  return M[h] || h;
}
/* 일정 제목 클릭 -> 상세내용 */
const EV_REG = [];
function evReg(e) { EV_REG.push(e); return EV_REG.length - 1; }
function showEv(i) {
  const e = EV_REG[i]; if (!e) return;
  TRK.ev(e);
  if (!document.getElementById('evd-css')) {
    const st = document.createElement('style'); st.id = 'evd-css';
    st.textContent = '#evd{position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px}.evd-box{background:#fff;border-radius:16px;max-width:640px;width:100%;max-height:85vh;overflow:auto;padding:24px 26px;position:relative;font-size:1.05rem}.evd-box h3{font-size:1.25rem;line-height:1.4;margin:0 36px 14px 0}.evd-x{position:sticky;top:0;float:right;margin:-12px -12px 0 8px;width:40px;height:40px;border-radius:50%;border:0;background:#fff;box-shadow:0 1px 5px rgba(0,0,0,.3);font-size:1.8rem;cursor:pointer;line-height:1;z-index:2}.evd-box dl{display:grid;grid-template-columns:auto 1fr;gap:6px 14px;margin:0 0 12px}.evd-box dt{font-weight:700;color:#555}.evd-box dd{margin:0}.evd-link{font-weight:700;margin-bottom:12px}.evd-link a{color:var(--g700)}.evd-body{white-space:pre-wrap;line-height:1.6;border-top:1px solid #e5e5e5;padding-top:12px}.evd-body a{color:var(--g700);word-break:break-all}h4.evt{cursor:pointer}h4.evt:hover{text-decoration:underline}';
    document.head.appendChild(st);
  }
  const same = ymd(e.start) === ymd(e.end);
  const when = same ? fmtShort(e.start) : fmtShort(e.start) + ' ~ ' + fmtShort(e.end);
  const rows = [['구분', isTrial(e) ? '시범운영' : e.type], ['기간', when], ['장소', [e.region, e.place].filter(Boolean).join(' · ')]].filter(r => r[1]);
  const link = e.link && e.type === '접수' ? '<div class="evd-link">접수처 : <a href="' + esc(e.link) + '" target="_blank" rel="noopener">' + esc(siteName(e.link)) + '</a></div>' : (e.type === '접수' && !isTrial(e) && jeopsuTxt(e) ? '<div class="evd-link">접수처 : ' + esc(jeopsuTxt(e)) + '</div>' : '');
  const body = e.detail ? esc(e.detail).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>') : '등록된 상세 내용이 없습니다.';
  const old = document.getElementById('evd'); if (old) old.remove();
  const el = document.createElement('div'); el.id = 'evd';
  el.innerHTML = '<div class="evd-box" role="dialog" aria-modal="true"><button class="evd-x" aria-label="닫기">&times;</button><h3>' + esc(e.name) + '</h3><dl>' + rows.map(r => '<dt>' + esc(r[0]) + '</dt><dd>' + esc(r[1]) + '</dd>').join('') + '</dl>' + link + '<div class="evd-body">' + body + '</div></div>';
  document.body.appendChild(el);
  const onKey = ev => { if (ev.key === 'Escape') close(); };
  const close = () => { el.remove(); document.removeEventListener('keydown', onKey); };
  el.addEventListener('click', ev => { if (ev.target === el || ev.target.closest('.evd-x')) close(); });
  document.addEventListener('keydown', onKey);
}
(function () { if (document.getElementById('evt-css')) return; const st = document.createElement('style'); st.id = 'evt-css'; st.textContent = 'h4.evt{cursor:pointer}h4.evt:hover,h4.evt:focus-visible{text-decoration:underline}'; document.head.appendChild(st); })();
/* 접수처·상세 팝업 링크: 새 창으로 열고 바로 앞으로 가져오기 (막히면 현재 창에서 이동) */
document.addEventListener('click', ev => {
  const a = ev.target.closest && ev.target.closest('.ev a.go, .evd-link a, .evd-body a');
  if (!a || ev.button || ev.ctrlKey || ev.metaKey || ev.shiftKey) return;
  ev.preventDefault();
  location.href = a.href;   /* 새 창이 안 보이는 경우가 있어 현재 창에서 바로 이동 */
});
document.addEventListener('click', ev => { const h = ev.target.closest && ev.target.closest('h4.evt'); if (h) showEv(+h.dataset.ev); });
document.addEventListener('keydown', ev => { if (ev.key === 'Enter' && ev.target.classList && ev.target.classList.contains('evt')) showEv(+ev.target.dataset.ev); });

/* 링크 없는 접수: 상세(또는 비고) 첫 줄 "접수: ..." 글자를 접수처로 표시 */
function jeopsuTxt(e) {
  const src = [e.detail, e.note].filter(Boolean);
  for (const s of src) { const m = String(s).split(/\n|---/)[0].match(/^\s*접수\s*[:：]\s*(.+)$/); if (m) return m[1].replace(/https?:\/\/\S+/g, '').trim().slice(0, 80); }
  return '';
}
function eventRow(e, opts = {}) {
  const same = ymd(e.start) === ymd(e.end);
  let dateTxt = same ? fmtShort(e.start) : `~ ${fmtShort(e.end)}`;
  const t = today0();
  /* 접수는 마감일만(~ 10/8(목)), 대회·연습일은 날짜 칸을 비워 둠 (시범운영은 그대로) */
  let blank = false;
  if (!isTrial(e)) { if (e.type === '접수' && !same) dateTxt = `~ ${fmtShort(e.end)}`; else if (e.type === '대회' || e.type === '연습일') blank = true; }
  const dl = e.type === '접수' && ymd(e.end) >= ymd(t) && (e.end - t) / 864e5 <= 3;
  const trial = isTrial(e);
  const hasLink = !!(e.link && e.type === '접수' && !trial);
  const jtxt = (!hasLink && e.type === '접수' && !trial) ? jeopsuTxt(e) : '';
  const dateHtml = blank ? '' : `<div class="date" style="min-width:0;padding:0;background:none;color:var(--muted);font-size:.85rem;font-weight:400;line-height:inherit;white-space:nowrap;margin-left:auto">${dateTxt}</div>`;
  return `<div class="ev ${dl ? 'deadline' : ''}">
    <div style="flex:1;min-width:0"><div style="display:flex;align-items:flex-start;gap:10px"><h4 class="evt" tabindex="0" role="button" data-ev="${evReg(e)}" style="flex:1;min-width:0"${opts.max && e.name.length > opts.max ? ` title="${esc(e.name)}"` : ''}>${esc(opts.max && e.name.length > opts.max ? e.name.slice(0, opts.max) + '...' : e.name)}</h4><div style="display:flex;gap:6px;flex-shrink:0;flex-wrap:nowrap;justify-content:flex-end;white-space:nowrap">${trial ? '<span class="tag 시범운영">시범운영</span>' : `<span class="tag ${esc(e.type)}">${esc(e.type)}</span>${dl ? '<span class="tag 접수">마감임박</span>' : (e.type === '접수' && /접수마감/.test(e.name) ? '<span class="tag 접수">마감</span>' : '')}`}</div></div><div class="sub" style="display:flex;justify-content:space-between;align-items:baseline;gap:10px"><span>${[e.region, e.place, e.note].filter(Boolean).map(esc).join(' · ')}</span>${dateHtml}</div>
    ${hasLink ? `<div style="font-size:.85rem;font-weight:700;color:var(--ink);margin-top:4px">접수처 : <a class="go" href="${esc(e.link)}" target="_blank" rel="noopener">${esc(siteName(e.link))}</a></div>` : (jtxt ? `<div style="font-size:.85rem;font-weight:700;color:var(--ink);margin-top:4px">접수처 : <span style="font-weight:400">${esc(jtxt)}</span></div>` : '')}</div></div>`;
}


/* ---------- 공유 버튼 (각 페이지 제목 오른쪽 끝): 카카오톡 / 밴드 ---------- */
const SHARE_SKIP = ['write', 'members', 'requests', 'stats', 'request', 'mypage', 'login', 'signup', 'find'];
function shareInfo() {
  const url = location.href.split('#')[0];
  const h = document.querySelector('h1') || document.querySelector('h2.sec');
  const t = (h && h.firstChild && h.firstChild.textContent || document.title).trim().replace(/\s*-\s*파크골프뉴스$/, '') || '파크골프뉴스';
  /* 공유 문구: 페이지가 PGN_SHARE()로 정해 주면 그것(예: 파크골프뉴스 오늘일정 총 14건입니다.), 없으면 제목으로 */
  let text = '';
  try { if (typeof window.PGN_SHARE === 'function') text = window.PGN_SHARE() || ''; } catch (e) {}
  if (!text) text = t === '파크골프뉴스' ? '파크골프뉴스' : document.querySelector('main.article h1') ? '[파크골프뉴스] ' + t : '파크골프뉴스 ' + t + '입니다.';
  return { url, title: t === '파크골프뉴스' ? t : t + ' - 파크골프뉴스', text };
}
/* 앱 자동실행: 앱이 열리면 이 화면이 숨겨짐. 1.6초 뒤에도 화면이 그대로면(앱 없음) fallback 실행 */
const SH_UA = navigator.userAgent;
const SH_MOB = /Android|iPhone|iPad|iPod/i.test(SH_UA) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
function launchApp(url, fallback) {
  let left = false; const hid = () => { if (document.hidden) left = true; };
  document.addEventListener('visibilitychange', hid); window.addEventListener('pagehide', hid);
  setTimeout(() => { document.removeEventListener('visibilitychange', hid); window.removeEventListener('pagehide', hid); if (!left && !document.hidden && fallback) fallback(); }, 1600);
  location.href = url;
}
function shareToast(msg) {
  let t = document.getElementById('shr-toast');
  if (!t) { t = document.createElement('div'); t.id = 'shr-toast'; t.style.cssText = 'position:fixed;left:50%;bottom:28px;transform:translateX(-50%);max-width:92vw;background:rgba(25,25,25,.92);color:#fff;padding:12px 18px;border-radius:12px;font-size:.95rem;line-height:1.5;z-index:9999;text-align:center;white-space:pre-line;box-shadow:0 4px 18px rgba(0,0,0,.25)'; document.body.appendChild(t); }
  t.textContent = msg; t.hidden = false; clearTimeout(t._h); t._h = setTimeout(() => { t.hidden = true; }, 6000);
}
function copyText(s) {
  try { if (navigator.clipboard && window.isSecureContext) { navigator.clipboard.writeText(s).catch(() => {}); return; } } catch (e) {}
  const a = document.createElement('textarea'); a.value = s; a.style.cssText = 'position:fixed;top:-1000px;opacity:0'; document.body.appendChild(a); a.select();
  try { document.execCommand('copy'); } catch (e) {} a.remove();
}
/* 카카오 JavaScript 키(CONFIG.KAKAO_JS)가 있으면 카카오 공유 SDK로 카카오톡 친구선택 화면을 바로 엽니다 */
function kakaoReady() { return !!(window.Kakao && Kakao.isInitialized && Kakao.isInitialized() && Kakao.Share); }
function loadKakaoSdk() {
  if (!CONFIG.KAKAO_JS || window.Kakao || document.getElementById('kakao-sdk')) return;
  const s = document.createElement('script'); s.id = 'kakao-sdk'; s.src = 'https://t1.kakaocdn.net/kakao_js_sdk/2.7.4/kakao.min.js'; s.crossOrigin = 'anonymous';
  s.onload = () => { try { if (!Kakao.isInitialized()) Kakao.init(CONFIG.KAKAO_JS); } catch (e) {} };
  document.head.appendChild(s);
}
function shareKakao() {
  const s = shareInfo(); s.url = TRK.tag(s.url, 'kakao');
  const all = s.text + '\n' + s.url;
  if (kakaoReady()) { try { Kakao.Share.sendScrap({ requestUrl: s.url }); return; } catch (e) {} }
  copyText(all);   // 앱에서 바로 붙여넣기 할 수 있게 공유 문구+주소 복사
  shareToast(SH_MOB ? '공유 문구를 복사했습니다.\n카카오톡이 열리면 대화방에 붙여넣기 해 주세요.' : '공유 문구와 주소를 복사했습니다.\n카카오톡 대화창에 붙여넣기(Ctrl+V) 해 주세요.');
  launchApp('kakaotalk://launch', null);   // 카카오톡 앱(PC는 설치된 경우) 자동실행
}
function shareBand() {
  const s = shareInfo(); s.url = TRK.tag(s.url, 'band');
  const body = s.text + '\n' + s.url, route = location.host;
  const web = 'https://band.us/plugin/share?body=' + encodeURIComponent(body) + '&route=' + encodeURIComponent(route);
  if (!SH_MOB) { location.href = web; return; }   // PC: 밴드 글쓰기(공유) 화면
  launchApp('bandapp://create/post?text=' + encodeURIComponent(body) + '&route=' + encodeURIComponent(route), () => { location.href = web; });   // 휴대폰: 밴드 앱 자동실행, 앱이 없으면 웹 공유
}
function addShareButtons() {
  if (!document.getElementById('shr-css')) {
    const st = document.createElement('style'); st.id = 'shr-css';
    st.textContent = '.shr{position:relative;margin-left:auto;flex-shrink:0;border-left:0;padding:0}.shr-btn{display:inline-flex;align-items:center;gap:5px;border:1px solid var(--line);background:#fff;color:var(--g900);border-radius:999px;padding:5px 12px;font-size:.85rem;font-weight:700;cursor:pointer;font-family:inherit;line-height:1.4}.shr-btn:hover{border-color:var(--g700);color:var(--g700)}.shr-menu{position:absolute;right:0;top:calc(100% + 6px);background:#fff;border:1px solid var(--line);border-radius:12px;box-shadow:var(--shadow);padding:6px;z-index:30;display:flex;flex-direction:column;gap:4px;min-width:150px}.shr-menu[hidden]{display:none!important}.shr-menu button{display:flex;align-items:center;gap:8px;border:0;border-radius:8px;padding:9px 12px;font-size:.95rem;font-weight:700;cursor:pointer;font-family:inherit;text-align:left}.shr-k{background:#FEE500;color:#191919}.shr-b{background:#00C73C;color:#fff}';
    document.head.appendChild(st);
  }
  document.querySelectorAll('h2.sec, h1').forEach(h => {
    if (h.querySelector('.shr') || h.closest('header.site, #pgn-gate, #evd, .modal') || /^(글쓰기|글 수정)/.test(h.textContent.trim())) return;
    if (getComputedStyle(h).display !== 'flex') { h.style.display = 'flex'; h.style.alignItems = 'center'; h.style.gap = '10px'; }
    const w = document.createElement('span'); w.className = 'shr';
    w.innerHTML = '<button type="button" class="shr-btn" aria-haspopup="true" aria-label="공유하기"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></svg>공유</button><div class="shr-menu" hidden><button type="button" class="shr-k">카카오톡 공유</button><button type="button" class="shr-b">밴드 공유</button></div>';
    h.appendChild(w);
  });
}
document.addEventListener('click', ev => {
  const b = ev.target.closest && ev.target.closest('.shr-btn, .shr-k, .shr-b');
  document.querySelectorAll('.shr-menu').forEach(m => { if (!b || !m.parentNode.contains(b)) m.hidden = true; });
  if (!b) return;
  ev.preventDefault(); ev.stopPropagation();
  if (b.classList.contains('shr-btn')) { const m = b.nextElementSibling; m.hidden = !m.hidden; return; }
  b.closest('.shr-menu').hidden = true;
  if (b.classList.contains('shr-k')) shareKakao(); else shareBand();
}, true);
function startShare(active) {
  if (SHARE_SKIP.includes(active)) return;
  loadKakaoSdk();
  let q = 0; const run = () => { q = 0; addShareButtons(); };
  run();
  new MutationObserver(() => { if (!q) q = requestAnimationFrame(run); }).observe(document.body, { childList: true, subtree: true });
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
function clearSheetCache() { Object.keys(sessionStorage).filter(k => k.startsWith('pgn_') && k !== 'pgn_auth').forEach(k => sessionStorage.removeItem(k)); localStorage.removeItem(LS + 'all'); _mem.all = null; }


const fmtPhone = v => v.replace(/[^0-9]/g, '').slice(0, 11).replace(/^(\d{3})(\d{3,4})(\d{0,4}).*/, (m, x, y, z) => z ? x + '-' + y + '-' + z : x + '-' + y);

/* ---------- 소셜 로그인 (구글 / 카카오 / 네이버) ---------- */
const OAUTH_REDIRECT = location.origin + '/oauth.html';
let _cfg = null;
async function getConfig() {
  if (_cfg) return _cfg;
  const c = lsGet('cfg'), age = c ? Date.now() - c.t : Infinity;
  if (c && c.d && age < 3600 * 1000) {   // 1시간 안의 사본은 바로 쓰고, 뒤에서 한 번 불러 서버도 미리 깨워 둠(로그인이 빨라짐)
    _cfg = c.d;
    if (age > 20000) api('config').then(d => lsSet('cfg', { t: Date.now(), d })).catch(() => {});
    return _cfg;
  }
  try { _cfg = await api('config'); lsSet('cfg', { t: Date.now(), d: _cfg }); } catch (e) { _cfg = { sms: false, google: '', kakao: '', naver: '' }; }
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

/* ---------- 댓글 (페이지별 · 뉴스 항목별) ---------- */
const PAGE_CMT = { today: '오늘일정', schedule: '월간일정', board: '자유게시판', join: '조인게시판', about: '회사소개' };
(function () {
  const st = document.createElement('style');
  st.textContent = '.cardfoot{display:flex;flex-wrap:wrap;gap:6px;align-items:center}' +
    '.cmb{font:inherit;font-size:.85rem;background:#fff;border:1px solid var(--line);border-radius:999px;padding:3px 10px;cursor:pointer;display:inline-flex;align-items:center;gap:5px;color:var(--ink);line-height:1.4;margin-top:8px}' +
    '.cmb:hover{border-color:var(--g600);background:var(--g50)}.cmb svg{flex:none;color:var(--g700)}' +
    '#cmm{position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px}' +
    '#cmm .box{background:#fff;border-radius:16px;max-width:640px;width:100%;max-height:88vh;overflow:auto;padding:20px 22px;position:relative}' +
    '#cmm .x{position:sticky;top:0;float:right;margin:-8px -8px 0 8px;width:40px;height:40px;border-radius:50%;border:0;background:#fff;box-shadow:0 1px 5px rgba(0,0,0,.3);font-size:1.8rem;cursor:pointer;line-height:1;z-index:2}' +
    '#cmm .cm-t{font-weight:800;font-size:1.1rem;line-height:1.45;margin:0 44px 4px 0;color:var(--g900)}#cmm .go{display:inline-block;margin:2px 0 12px;font-size:.92rem;color:var(--g700);font-weight:700}' +
    '#cmm .comments{margin:0;padding:0;border:0;box-shadow:none}.pgcm{max-width:905px;margin-top:26px;margin-bottom:10px}.pgcm .comments{margin-top:0}';
  document.head.appendChild(st);
})();
const CMC = { counts: null, p: null };
function cmCountLoad() {
  if (!CMC.p) CMC.p = api('ccount').then(r => { CMC.counts = r.counts || {}; }).catch(() => { CMC.counts = CMC.counts || {}; });
  return CMC.p;
}
function cmPaint() {
  document.querySelectorAll('.cmb[data-cid]').forEach(b => { const v = String((CMC.counts || {})[b.dataset.cid] || 0), x = b.querySelector('b'); b.dataset.ok = 1; if (x && x.textContent !== v) x.textContent = v; });
}
let _cmT;
new MutationObserver(() => { clearTimeout(_cmT); _cmT = setTimeout(() => { if (document.querySelector('.cmb[data-cid]:not([data-ok])')) cmCountLoad().then(cmPaint); }, 60); }).observe(document.documentElement, { childList: true, subtree: true });
/* 댓글이 어디에 달렸는지 (관리자 목록·내 댓글에서 사용) */
function cmWhere(aid, newsById, boards) {
  aid = String(aid || '');
  if (aid.indexOf('page:') === 0) {
    let k = aid.slice(5); if (CM_NEW[k]) k = CM_NEW[k];   // 날짜 구분 전에 달린 댓글
    const p = k.split(':'), pg = p[0], sub = p[1] || ''; let mm;
    if (pg === 'today' && (mm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(sub))) return { kind: '페이지', label: '오늘일정 · ' + (+mm[2]) + '월 ' + (+mm[3]) + '일', href: 'today.html?d=' + sub };
    if (pg === 'schedule' && (mm = /^(\d{4})-(\d{2})$/.exec(sub))) return { kind: '페이지', label: '월간일정 · ' + mm[1] + '년 ' + (+mm[2]) + '월', href: 'schedule.html?m=' + sub };
    return { kind: '페이지', label: (PAGE_CMT[pg] || pg) + ' 페이지', href: pg + '.html' };
  }
  if (aid.indexOf('board:') === 0) { const id = aid.slice(6), t = boards && boards[id]; return { kind: '자유게시판', label: t ? '자유게시판 · ' + t : '자유게시판 글', href: 'board.html?id=' + encodeURIComponent(id) }; }
  if (aid.indexOf('join:') === 0) { const id = aid.slice(5), t = boards && boards['join:' + id]; return { kind: '조인게시판', label: t ? '조인게시판 · ' + t : '조인게시판 글', href: 'join.html?id=' + encodeURIComponent(id) }; }
  const n = newsById && newsById[aid];
  return n ? { kind: '뉴스', label: n.title, href: 'article.html?id=' + encodeURIComponent(aid) } : { kind: '뉴스', label: '(삭제되었거나 비공개된 기사)', href: '', gone: true };
}
/* 댓글 상자: el 안에 목록 + 입력창을 그림 */
function cmBox(el, aid, opt) {
  opt = opt || {};
  const me = Auth.get(), nx = encodeURIComponent(opt.next || ((location.pathname.split('/').pop() || 'index.html') + location.search));
  el.innerHTML = '<h3>' + esc(opt.title || '댓글') + ' <span class="cc"></span></h3>' +
    (me ? '<div class="cform"><textarea maxlength="1000" placeholder="' + esc(opt.ph || '댓글을 입력하세요 (1000자 이내)') + '"></textarea><div class="bar"><small>' + esc(me.name) + '님으로 작성</small><button type="button" class="btn green cs">댓글 등록</button></div><div class="cm-msg"></div></div>'
      : '<div class="cneed">댓글은 회원만 쓸 수 있습니다.<br><a class="btn green" href="login.html?next=' + nx + '">로그인</a><a class="btn green" href="signup.html?next=' + nx + '">회원가입</a></div>') +
    '<div class="cl"><div class="loading">불러오는 중...</div></div>';
  const q = s => el.querySelector(s);
  const draw = async () => {
    try {
      const r = await api('comments', { aid });
      q('.cc').textContent = r.items.length ? '(' + r.items.length + ')' : '';
      if (CMC.counts) { CMC.counts[aid] = r.items.length; cmPaint(); }
      q('.cl').innerHTML = r.items.length ? r.items.map(c => '<div class="citem"><div class="ch"><b>' + esc(c.nick) + '</b><span>' + esc(c.at) + '</span>' + (c.mine ? '<button type="button" data-id="' + esc(c.id) + '">삭제</button>' : '') + '</div><div class="ct">' + esc(c.text) + '</div></div>').join('') : '<div class="empty" style="padding:18px">첫 댓글을 남겨 보세요.</div>';
    } catch (e) { q('.cl').innerHTML = '<div class="empty" style="padding:18px">댓글을 불러오지 못했습니다.<br><small>' + esc(e.message) + '</small></div>'; }
  };
  draw();
  q('.cl').onclick = async e => {
    const b = e.target.closest('button[data-id]'); if (!b || !confirm('이 댓글을 삭제할까요?')) return;
    try { await api('cdelete', { cid: b.dataset.id }); draw(); } catch (err) { alert(err.message); }
  };
  const send = q('.cs'); if (!send) return;
  const ta = q('textarea'), m = q('.cm-msg');
  ta.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) send.click(); });
  send.onclick = async () => {
    const t = ta.value.trim(); if (!t) { m.innerHTML = '<div class="msg err">댓글 내용을 입력해 주세요.</div>'; return; }
    send.disabled = true; send.textContent = '등록 중...'; m.innerHTML = '';
    try { await api('cpost', { aid, text: t }); ta.value = ''; await draw(); }
    catch (err) { m.innerHTML = '<div class="msg err">' + esc(err.message) + '</div>'; if (!Auth.get()) setTimeout(() => location.reload(), 1500); }
    send.disabled = false; send.textContent = '댓글 등록';
  };
}
/* 뉴스 항목의 [댓글] 버튼 -> 그 기사 댓글 창 (기사 화면의 댓글과 같은 댓글) */
function cmOpen(aid, title, href) {
  const old = document.getElementById('cmm'); if (old) old.remove();
  document.body.insertAdjacentHTML('beforeend', '<div id="cmm" role="dialog" aria-modal="true"><div class="box"><button type="button" class="x" aria-label="닫기" title="닫기">&times;</button><div class="cm-t">' + esc(title || '댓글') + '</div>' + (href ? '<a class="go" href="' + esc(href) + '">' + (/^(join|board):/.test(String(aid)) ? '글 보기' : '기사 보기') + ' &rsaquo;</a>' : '') + '<section class="card comments"></section></div></div>');
  const md = document.getElementById('cmm');
  const close = () => { md.remove(); document.removeEventListener('keydown', esc1); };
  const esc1 = e => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', esc1);
  md.addEventListener('click', e => { if (e.target === md || e.target.closest('.x')) close(); });
  cmBox(md.querySelector('section'), aid, { title: '댓글' });
  const t = md.querySelector('textarea'); if (t && matchMedia('(pointer:fine)').matches) t.focus();
}
document.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('.cmb[data-cid]'); if (!b) return;
  e.preventDefault(); e.stopPropagation();
  cmOpen(b.dataset.cid, b.dataset.title || '', b.dataset.href || '');
}, true);
/* 페이지 맨 아래 댓글 (오늘일정·월간일정·자유게시판·조인게시판·회사소개) */
/* 오늘일정은 날짜별, 월간일정은 달별로 댓글이 따로 달림 (페이지가 pgnCm(key, label)을 부름) */
const CM_P2 = n => String(n).padStart(2, '0');
function cmDayKey(d) { return { key: d.getFullYear() + '-' + CM_P2(d.getMonth() + 1) + '-' + CM_P2(d.getDate()), label: (d.getMonth() + 1) + '월 ' + d.getDate() + '일(' + WD[d.getDay()] + ') 일정' }; }
function cmMonKey(y, m) { return { key: y + '-' + CM_P2(m + 1), label: y + '년 ' + (m + 1) + '월 월간일정' }; }
const CM_DATED = { today: () => cmDayKey(today0()), schedule: () => { const t = today0(); return cmMonKey(t.getFullYear(), t.getMonth()); } };
const CM_OLD = { 'page:today:2026-10-10': 'page:today', 'page:schedule:2026-10': 'page:schedule' };   // 날짜 구분 전(10/10)에 달린 댓글 이어서 보기
const CM_NEW = { 'today': 'today:2026-10-10', 'schedule': 'schedule:2026-10' };
function pageComments(active) {
  const name = PAGE_CMT[active]; if (!name || active === 'board') return;   // 자유게시판은 맨 아래 페이지 댓글 없음 (글마다 댓글은 그대로)
  const sp = new URLSearchParams(location.search);
  if (sp.get('id') || sp.get('write') || sp.get('edit')) return;   // 글 보기·쓰기 화면은 글마다 댓글이 따로 있음
  const w = document.createElement('div'); w.className = 'wrap pgcm';
  w.innerHTML = '<section class="card comments" id="pgcm"></section>';
  const place = () => { const f = document.querySelector('footer.site'); if (f && f.previousElementSibling !== w) f.before(w); };
  let cur = '';
  const show = (key, label) => {
    const id = 'page:' + active + (key ? ':' + key : ''); if (id === cur) return; cur = id;
    const nm = label || name, nx = key ? active + '.html?' + (active === 'today' ? 'd=' : 'm=') + key : '';
    cmBox(w.firstChild, CM_OLD[id] || id, { title: nm + ' 댓글', ph: nm + '에 대한 의견을 남겨 주세요 (1000자 이내)', next: nx });
  };
  if (CM_DATED[active]) window.pgnCm = (key, label) => show(key, label);
  setTimeout(() => {
    place();
    if (!cur) { if (CM_DATED[active]) { const k = CM_DATED[active](); show(k.key, k.label); } else show(); }
    new MutationObserver(place).observe(document.body, { childList: true });   // 페이지 내용이 나중에 붙어도 댓글은 항상 맨 아래
  }, 0);
}
