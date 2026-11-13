/* 파크톡 (2026-11-13)
   - marathon82.com 러닝톡처럼 오른쪽에서 열리는 창 (휴대폰은 화면 전체). 머리 부분 슬로건 줄의 [파크톡] 버튼으로 어느 화면에서나 열림
   - 글쓰기 버튼 없이 맨 아래 입력창에 바로 쓰면 바로 대화에 보임 (카카오톡 단체방처럼, 최신 대화가 맨 아래)
   - 읽기는 누구나, 입력은 로그인한 회원만. 분류(질문·동행·조인·대회 정보·자유)를 골라 보낼 수 있고, 분류 칩과 검색으로 걸러 봄
   - 서버(회원 서버): tklist(3초마다, 바뀐 게 없으면 same) / tkpost / tkdel(내 메시지, 관리자는 전부)
   - 글꼴은 따로 지정하지 않음(inherit = 사이트 기본 Pretendard) */
(function () {
  if (window.PGNTalk) return;
  const CATS = ['질문', '동행·조인', '대회 정보', '자유'];
  const esc2 = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const MOB = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  const st = document.createElement('style');
  st.textContent =
    '#tk{position:fixed;inset:0;z-index:9990;display:none}#tk.on{display:block}' +
    '#tk .tk-dim{position:absolute;inset:0;background:rgba(0,0,0,.45)}' +
    '#tk .tk-p{position:absolute;top:0;right:0;bottom:0;width:min(600px,100%);background:#fff;display:flex;flex-direction:column;box-shadow:-6px 0 24px rgba(0,0,0,.18);font-family:inherit;color:#111}' +
    '#tk .tk-top{display:flex;align-items:center;justify-content:space-between;padding:12px 16px 4px 28px;font-size:.95rem;color:#333;flex:none}' +
    '#tk .tk-x{border:0;background:none;width:40px;height:40px;border-radius:50%;cursor:pointer;color:#333;display:flex;align-items:center;justify-content:center;padding:0}#tk .tk-x:hover{background:#f2f2f2}' +
    '#tk .tk-hd{padding:4px 28px 10px;flex:none}#tk .tk-hd h2{margin:0;font-size:1.9rem;font-weight:900;letter-spacing:-.02em;line-height:1.25;border:0;padding:0;color:#111}#tk .tk-hd h2::before{display:none}' +
    '#tk .tk-hd p{margin:6px 0 12px;color:#555;font-size:.95rem;line-height:1.5;word-break:keep-all}' +
    '#tk .tk-chips{display:flex;gap:7px;flex-wrap:wrap;margin-bottom:10px}#tk .tk-chips button,#tk .tk-mc button{font-family:inherit;font-size:.93rem;font-weight:700;background:#fff;color:#222;border:1px solid #d6d6d6;border-radius:8px;padding:6px 12px;cursor:pointer;line-height:1.3}' +
    '#tk .tk-chips button.on,#tk .tk-mc button.on{border:2px solid #111;padding:5px 11px}' +
    '#tk .tk-s{position:relative;max-width:420px}#tk .tk-s svg{position:absolute;left:12px;top:50%;transform:translateY(-50%);color:#777}#tk .tk-s input{width:100%;padding:9px 12px 9px 38px;border:1px solid #d6d6d6;border-radius:9px;font-family:inherit;font-size:.97rem;background:#fff;color:#111}#tk .tk-s input:focus{outline:0;border-color:#111}' +
    '#tk .tk-log{flex:1;min-height:0;overflow-y:auto;border-top:1px solid #e6e6e6;padding:4px 20px 10px;-webkit-overflow-scrolling:touch;overscroll-behavior:contain}' +
    '#tk .tk-day{text-align:center;margin:14px 0 6px}#tk .tk-day span{display:inline-block;font-size:.8rem;color:#666;background:#f2f3f5;border-radius:999px;padding:3px 12px}' +
    '#tk .tk-m{padding:11px 8px;border-bottom:1px solid #eee}#tk .tk-m.me{background:#fffbe3;border-radius:8px}#tk .tk-m.pend{opacity:.55}' +
    '#tk .tk-t{display:flex;align-items:flex-start;gap:8px}#tk .tk-tag{flex:none;font-size:.78rem;font-weight:700;color:#444;border:1px solid #d6d6d6;border-radius:5px;padding:1px 6px;line-height:1.45;margin-top:2px;background:#fff;white-space:nowrap}' +
    '#tk .tk-t b{font-size:1.02rem;font-weight:700;line-height:1.5;color:#111;white-space:pre-wrap;word-break:break-word;overflow-wrap:anywhere}#tk .tk-m.del .tk-t b{color:#999;font-weight:400}' +
    '#tk .tk-meta{display:flex;align-items:center;flex-wrap:wrap;gap:4px 10px;margin-top:5px;font-size:.84rem;color:#777}#tk .tk-meta .nk{color:#333;font-weight:700}#tk .tk-adm{font-size:.72rem;font-weight:800;color:#fff;background:var(--g700,#1d6b44);border-radius:4px;padding:1px 5px;margin-left:4px}' +
    '#tk .tk-del{border:0;background:none;color:#999;font-family:inherit;font-size:.82rem;cursor:pointer;padding:0;text-decoration:underline}#tk .tk-del:hover{color:#c62828}' +
    '#tk .tk-empty{text-align:center;color:#777;padding:40px 10px;line-height:1.7}' +
    '#tk .tk-new{position:absolute;left:50%;transform:translateX(-50%);bottom:150px;border:0;background:#111;color:#fff;font-family:inherit;font-weight:700;font-size:.9rem;border-radius:999px;padding:8px 16px;cursor:pointer;box-shadow:0 3px 10px rgba(0,0,0,.25)}#tk .tk-new[hidden]{display:none}' +
    '#tk .tk-in{flex:none;border-top:1px solid #e6e6e6;padding:10px 16px calc(12px + env(safe-area-inset-bottom));background:#fff}' +
    '#tk .tk-mc{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px;align-items:center}#tk .tk-mc small{color:#777;font-size:.8rem;margin-right:2px}#tk .tk-mc button{font-size:.84rem;padding:4px 10px}#tk .tk-mc button.on{padding:3px 9px}' +
    '#tk form{display:flex;gap:8px;align-items:flex-end}#tk textarea{flex:1;min-width:0;resize:none;border:1px solid #cfcfcf;border-radius:12px;padding:10px 12px;font-family:inherit;font-size:1rem;line-height:1.5;max-height:120px;color:#111;background:#fff}#tk textarea:focus{outline:0;border-color:#111}' +
    '#tk .tk-send{flex:none;border:0;background:#111;color:#fff;font-family:inherit;font-weight:800;font-size:1rem;border-radius:12px;padding:11px 18px;cursor:pointer}#tk .tk-send:disabled{opacity:.45;cursor:default}' +
    '#tk .tk-err{color:#c62828;font-size:.85rem;margin-top:6px;line-height:1.5}#tk .tk-err:empty{display:none}#tk .tk-cnt{font-size:.78rem;color:#999;text-align:right;margin-top:3px}' +
    '#tk .tk-login{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;font-size:.97rem;color:#333}#tk .tk-login div{display:flex;gap:8px}' +
    '#tk .tk-login a{display:inline-block;border-radius:10px;padding:10px 16px;font-weight:800;text-decoration:none;background:#111;color:#fff}#tk .tk-login a.sub{background:#fff;color:#111;border:1px solid #cfcfcf}' +
    '@media(max-width:640px){#tk .tk-top{padding:8px 8px 0 18px}#tk .tk-hd{padding:0 18px 8px}#tk .tk-hd h2{font-size:1.6rem}#tk .tk-hd p{margin:4px 0 10px;font-size:.9rem}#tk .tk-log{padding:2px 12px 8px}#tk .tk-in{padding:8px 12px calc(10px + env(safe-area-inset-bottom))}#tk .tk-s{max-width:none}}' +
    'html.tk-lock,html.tk-lock body{overflow:hidden}';
  document.head.appendChild(st);

  let box = null, timer = 0, v = '', items = [], cat = '전체', kw = '', isOpen = false, pageMode = false, pushed = false, myCat = '자유', sending = false, admin = false, first = true;
  const me = () => (typeof Auth !== 'undefined' && Auth.get()) || null;
  const X = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  const MAG = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>';
  const WD = ['일', '월', '화', '수', '목', '금', '토'];
  const dayOf = at => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(at || ''); if (!m) return ''; const d = new Date(+m[1], m[2] - 1, +m[3]); return (+m[2]) + '월 ' + (+m[3]) + '일 (' + WD[d.getDay()] + ')'; };
  const timeOf = at => { const m = / (\d{2}):(\d{2})/.exec(at || ''); if (!m) return ''; let h = +m[1]; const ap = h < 12 ? '오전' : '오후'; h = h % 12 || 12; return ap + ' ' + h + ':' + m[2]; };

  function inputHtml() {
    const u = me();
    if (!u) {
      const nx = encodeURIComponent((location.pathname.split('/').pop() || 'index.html') + location.search);
      return '<div class="tk-login"><span>로그인하면 바로 대화할 수 있어요.</span><div><a href="login.html?next=' + nx + '">로그인</a><a class="sub" href="signup.html?next=' + nx + '">회원가입</a></div></div>';
    }
    return '<div class="tk-mc" id="tkMc"><small>분류</small>' + CATS.map(c => '<button type="button" data-c="' + c + '"' + (c === myCat ? ' class="on"' : '') + '>' + c + '</button>').join('') + '</div>' +
      '<form id="tkF" autocomplete="off"><textarea id="tkT" rows="1" maxlength="300" placeholder="' + esc2(u.name || '') + '님, 메시지를 입력하세요" aria-label="메시지 입력"></textarea><button class="tk-send" id="tkS" type="submit">전송</button></form>' +
      '<div class="tk-err" id="tkE"></div>';
  }
  function build() {
    box = document.createElement('div');
    box.id = 'tk'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-label', '파크톡');
    box.innerHTML = '<div class="tk-dim"></div><aside class="tk-p"><div class="tk-top"><span>파크톡</span><button type="button" class="tk-x" aria-label="닫기">' + X + '</button></div>' +
      '<div class="tk-hd"><h2>파크톡</h2><p>대회 질문, 동행·조인 구하기, 대회 정보를 나누는 곳이에요.</p>' +
      '<div class="tk-chips" id="tkC">' + ['전체'].concat(CATS).map(c => '<button type="button" data-c="' + c + '"' + (c === cat ? ' class="on"' : '') + '>' + c + '</button>').join('') + '</div>' +
      '<div class="tk-s">' + MAG + '<input id="tkQ" type="search" placeholder="대회: 대회 이름으로 찾기" aria-label="대회 이름으로 찾기"></div></div>' +
      '<div class="tk-log" id="tkL" aria-live="polite"><div class="tk-empty">대화를 불러오는 중...</div></div><button type="button" class="tk-new" id="tkN" hidden>새 메시지 ↓</button>' +
      '<div class="tk-in" id="tkI">' + inputHtml() + '</div></aside>';
    document.body.appendChild(box);
    box.querySelector('.tk-x').onclick = closePanel;
    box.querySelector('.tk-dim').onclick = closePanel;
    box.querySelector('#tkC').onclick = e => { const b = e.target.closest('[data-c]'); if (!b) return; cat = b.dataset.c; box.querySelectorAll('#tkC button').forEach(x => x.classList.toggle('on', x === b)); draw(true); };
    box.querySelector('#tkQ').oninput = e => { kw = e.target.value; draw(true); };
    box.querySelector('#tkN').onclick = () => toBottom();
    box.querySelector('#tkL').addEventListener('scroll', () => { if (nearBottom()) box.querySelector('#tkN').hidden = true; });
    box.querySelector('#tkL').onclick = async e => {
      const b = e.target.closest('.tk-del'); if (!b) return;
      if (!confirm('이 메시지를 지울까요?')) return;
      try { const r = await api('tkdel', { id: b.dataset.id }); take(r, false); } catch (er) { err(er.message); }
    };
    wireInput();
    document.addEventListener('keydown', e => { if (isOpen && e.key === 'Escape') closePanel(); });
  }
  function wireInput() {
    const f = box.querySelector('#tkF'); if (!f) return;
    const ta = box.querySelector('#tkT');
    box.querySelector('#tkMc').onclick = e => { const b = e.target.closest('[data-c]'); if (!b) return; myCat = b.dataset.c; box.querySelectorAll('#tkMc button').forEach(x => x.classList.toggle('on', x === b)); ta.focus(); };
    const grow = () => { ta.style.height = 'auto'; ta.style.height = Math.min(120, ta.scrollHeight + 2) + 'px'; };
    ta.addEventListener('input', () => { grow(); err(''); });
    ta.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && e.keyCode !== 229 && !MOB) { e.preventDefault(); send(); } });   /* PC: Enter 보내기, Shift+Enter 줄바꿈. 휴대폰: 전송 버튼 */
    f.onsubmit = e => { e.preventDefault(); send(); };
  }
  function err(t) { const e = box && box.querySelector('#tkE'); if (e) e.textContent = t || ''; }
  const logEl = () => box.querySelector('#tkL');
  const nearBottom = () => { const l = logEl(); return l.scrollHeight - l.scrollTop - l.clientHeight < 80; };
  const toBottom = () => { const l = logEl(); l.scrollTop = l.scrollHeight; box.querySelector('#tkN').hidden = true; };
  function rowHtml(x, pend) {
    const can = !x.del && !pend && (x.mine || admin);
    return '<div class="tk-m' + (x.mine ? ' me' : '') + (x.del ? ' del' : '') + (pend ? ' pend' : '') + '"><div class="tk-t"><span class="tk-tag">' + esc2(x.cat || '자유') + '</span><b>' + (x.del ? '삭제된 메시지입니다.' : esc2(x.text)) + '</b></div>' +
      '<div class="tk-meta"><span class="nk">' + esc2(x.nick) + (x.adm ? '<span class="tk-adm">운영자</span>' : '') + '</span><span>' + (pend ? '보내는 중...' : timeOf(x.at)) + '</span>' + (can ? '<button type="button" class="tk-del" data-id="' + esc2(x.id) + '">삭제</button>' : '') + '</div></div>';
  }
  function draw(stick) {
    if (!box) return;
    const l = logEl(), atB = first || stick === true || nearBottom();
    const k = kw.trim().toLowerCase().replace(/\s+/g, '');
    const f = items.filter(x => (cat === '전체' || (x.cat || '자유') === cat) && (!k || (!x.del && String(x.text).toLowerCase().replace(/\s+/g, '').includes(k))));
    let h = '', day = '';
    f.forEach(x => { const d = dayOf(x.at); if (d && d !== day) { day = d; h += '<div class="tk-day"><span>' + d + '</span></div>'; } h += rowHtml(x); });
    l.innerHTML = h || '<div class="tk-empty">' + (items.length ? '조건에 맞는 대화가 없습니다.' : '아직 대화가 없습니다.<br>' + (me() ? '아래 입력창에 첫 메시지를 남겨 보세요.' : '로그인하고 첫 메시지를 남겨 보세요.')) + '</div>';
    if (atB) toBottom();
    first = false;
  }
  function take(r, fromPoll) {
    if (!r || r.same) return;
    const before = items.length ? items[items.length - 1].id : '';
    v = r.v || ''; admin = !!r.admin; items = r.items || [];
    const grown = items.length && items[items.length - 1].id !== before;
    const atB = nearBottom();
    draw();
    if (fromPoll && grown && !atB) box.querySelector('#tkN').hidden = false;
  }
  async function poll() {
    clearTimeout(timer);
    if (!isOpen) return;
    try { take(await api('tklist', { v }), true); }
    catch (e) { if (!items.length) logEl().innerHTML = '<div class="tk-empty">대화를 불러오지 못했습니다.<br><small>' + esc2(e.message) + '</small></div>'; }
    if (isOpen) timer = setTimeout(poll, document.hidden ? 15000 : 3000);
  }
  async function send() {
    const ta = box.querySelector('#tkT'), b = box.querySelector('#tkS');
    const text = ta.value.replace(/\s+$/, '').replace(/^\s+/, '');
    if (!text || sending) return;
    if (!me()) { err('로그인이 필요합니다.'); return; }
    sending = true; b.disabled = true; err('');
    const l = logEl(); const tmp = document.createElement('div');
    tmp.innerHTML = rowHtml({ text, cat: myCat, nick: me().name || '나', mine: true }, true); l.appendChild(tmp.firstChild); toBottom();
    ta.value = ''; ta.style.height = 'auto';
    try { const r = await api('tkpost', { text, cat: myCat }); take(r, false); toBottom(); }
    catch (e) { draw(); ta.value = text; err(e.message); if (/로그인/.test(e.message) && !me()) box.querySelector('#tkI').innerHTML = inputHtml(); }
    sending = false; b.disabled = false; if (!MOB) ta.focus();
  }
  function openPanel(o) {
    o = o || {};
    if (!box) build();
    pageMode = !!o.page;
    box.querySelector('#tkI').innerHTML = inputHtml(); wireInput();   /* 로그인 상태가 바뀌었을 수 있음 */
    box.classList.add('on'); document.documentElement.classList.add('tk-lock'); isOpen = true; first = true;
    if (!pageMode && !pushed) { try { history.pushState({ pgnTalk: 1 }, ''); pushed = true; } catch (e) {} }   /* 휴대폰 뒤로 가기 = 닫기 */
    draw(); poll();
    if (!MOB) setTimeout(() => { const t = box.querySelector('#tkT'); if (t) t.focus(); }, 50);
  }
  function hide() { if (!box) return; box.classList.remove('on'); document.documentElement.classList.remove('tk-lock'); isOpen = false; clearTimeout(timer); }
  function closePanel() {
    if (pageMode) { location.href = 'index.html'; return; }
    hide();
    if (pushed) { pushed = false; try { history.back(); } catch (e) {} }
  }
  window.addEventListener('popstate', () => { if (isOpen && !pageMode) { pushed = false; hide(); } });
  document.addEventListener('visibilitychange', () => { if (isOpen && !document.hidden) poll(); });
  window.PGNTalk = { open: openPanel, close: closePanel };
})();
