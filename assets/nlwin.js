/* 뉴스레터 창 정리 (2026-11-15 사용자 지시 "뉴스레터를 열어 창이 여러개 열려 원문으로 가려고 할때 열어져있는 창을 자동으로 닫히게 하고 원문으로 바로가게", "휴대폰에서 그럴때도 포함")
   1) 뉴스레터 화면: 링크를 누르면 새 창을 계속 만들지 않고 '뉴스레터 보기 창' 하나에서만 엶.
      뉴스레터 화면으로 돌아오면(탭 전환·뒤로가기) 그 창과 뉴스레터에서 열린 창을 모두 자동으로 닫음.
   2) 뉴스레터에서 열린 홈페이지 화면: 아래에 '뉴스레터 원문으로' 단추. 누르면 뉴스레터에서 열린 창을 모두 닫고 뉴스레터로 돌아감.
      창을 닫을 수 없는 브라우저에서는 이 창에서 뉴스레터를 바로 엶.
   홈페이지 기사 속(iframe) 뉴스레터는 app.js가 같은 창 이동으로 처리하므로 여기서는 아무것도 하지 않음. */
(function () {
  if (window.__pgnNlWin) return; window.__pgnNlWin = 1;
  try { if (window.top !== window.self) return; } catch (e) { return; }
  var NAME = 'pgn_nlview', CH = 'pgn_nl', KEY = 'pgn_nlsrc', LS = 'pgn_nl_close';
  var NL_RE = /\/assets\/newsletter_vol\d+_\d{8}(_mobile|_email)?\.html/;
  function bc() { try { return new BroadcastChannel(CH); } catch (e) { return null; } }
  function closeAllKids() {
    var c = bc(); if (c) { try { c.postMessage({ t: 'close' }); c.close(); } catch (e) {} }
    try { localStorage.setItem(LS, String(Date.now())); } catch (e) {}
  }

  if (NL_RE.test(location.pathname)) {
    /* ---- 1) 뉴스레터 화면 ---- */
    var win = null, openedAt = 0;
    document.addEventListener('click', function (ev) {
      if (ev.defaultPrevented || ev.button !== 0 || ev.ctrlKey || ev.metaKey || ev.shiftKey || ev.altKey) return;
      var a = ev.target && ev.target.closest && ev.target.closest('a[href]'); if (!a) return;
      var h = a.getAttribute('href') || '';
      if (!h || h.charAt(0) === '#' || /^(javascript|tel|sms|mailto|intent|kakaotalk|nmap):/i.test(h)) return;
      ev.preventDefault();
      var w = null; try { w = window.open(a.href, NAME); } catch (e) {}
      if (w) { win = w; openedAt = Date.now(); try { w.focus(); } catch (e) {} }
      else location.href = a.href;   // 새 창이 막힌 브라우저: 이 창에서 열고, 뒤로가기로 돌아옴
    }, true);
    var back = function () {
      if (Date.now() - openedAt < 1500) return;   // 방금 연 창이 바로 닫히지 않게
      try { if (win && !win.closed) win.close(); } catch (e) {}
      win = null; closeAllKids();
    };
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') back(); });
    window.addEventListener('pageshow', function (e) { if (e.persisted) back(); });
    window.addEventListener('focus', back);
    return;
  }

  /* ---- 2) 뉴스레터에서 열린 화면 ---- */
  var src = '';
  try {
    var r = document.referrer || '';
    if (NL_RE.test(r)) { src = r.split('#')[0]; sessionStorage.setItem(KEY, src); }
    else src = sessionStorage.getItem(KEY) || '';
  } catch (e) {}
  if (!src) { try { var o = window.opener; if (o && !o.closed && NL_RE.test(o.location.pathname)) src = o.location.href.split('#')[0]; } catch (e) {} }
  if (!src && window.name !== NAME) return;   // 뉴스레터와 상관없는 화면
  if (src) { try { sessionStorage.setItem(KEY, src); } catch (e) {} }

  function selfClose() { try { window.close(); } catch (e) {} }
  var c = bc(); if (c) c.onmessage = function (m) { if (m && m.data && m.data.t === 'close') selfClose(); };
  window.addEventListener('storage', function (e) { if (e.key === LS) selfClose(); });

  function goBack() {
    closeAllKids();   // 뉴스레터에서 열린 다른 창도 모두 닫기
    try { if (window.opener && !window.opener.closed) window.opener.focus(); } catch (e) {}
    selfClose();
    setTimeout(function () {   // 창이 안 닫히는 브라우저: 이 창에서 뉴스레터 원문을 바로 엶
      if (window.closed) return;
      if (src) location.href = src; else if (history.length > 1) history.back();
    }, 400);
  }
  function addBtn() {
    if (document.getElementById('pgn-nlback')) return;
    var st = document.createElement('style');
    st.textContent = '#pgn-nlback{position:fixed;left:12px;bottom:calc(14px + env(safe-area-inset-bottom,0px));z-index:9990;display:inline-flex;align-items:center;gap:6px;'
      + 'min-height:46px;padding:0 18px 0 14px;border:0;border-radius:999px;background:#14342A;color:#F0D9A6;'
      + "font-family:'Pretendard Variable',Pretendard,'Noto Sans KR',sans-serif;font-size:15.5px;font-weight:700;letter-spacing:-.01em;"
      + 'box-shadow:0 4px 14px rgba(0,0,0,.28);cursor:pointer;-webkit-tap-highlight-color:transparent}'
      + '#pgn-nlback:active{transform:scale(.97)}#pgn-nlback b{font-size:19px;line-height:1;margin-top:-2px}'
      + 'body.pgn-nlpad{padding-bottom:76px}';
    document.head.appendChild(st);
    var b = document.createElement('button');
    b.id = 'pgn-nlback'; b.type = 'button'; b.title = '열린 창을 닫고 뉴스레터로 돌아갑니다';
    b.innerHTML = '<b>&lsaquo;</b>뉴스레터 원문으로';
    b.addEventListener('click', goBack);
    document.body.appendChild(b); document.body.classList.add('pgn-nlpad');
  }
  if (document.body) addBtn(); else document.addEventListener('DOMContentLoaded', addBtn);
})();
