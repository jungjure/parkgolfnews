/* 장소 길안내 공용 코드 (2026-11-16, 사용자 지시 "장소를 누르면 ... 이걸 항상 네이버지도앱으로 바로 나오게 해줘")
   휴대폰에서 장소 링크(place.html?n=이름&lat=위도&lng=경도&id=번호)를 누르면, 누른 그 순간에 네이버 지도 앱을 바로 열어
   자동차 길안내(출발 = 내 위치, 도착 = 장소)를 띄움. 중간 화면(홈페이지)·웹 빠른길찾기를 거치지 않음.
   - 앱 주소: 네이버 nmap://route/car?dlat&dlng&dname&appname (안드로이드는 intent://…;package=com.nhn.android.nmap, 앱이 없으면 플레이스토어)
              카카오 kakaomap://route?ep=위도,경도&by=CAR (장소 화면의 카카오 버튼을 누를 때만)
   - 좌표가 없는 장소는 회원 서버(geo)로 좌표를 찾은 뒤 엶(최대 3초)
   - 카톡 안 브라우저에서는 앱을 바로 열지 않고, 누른 순간 기본 인터넷 앱으로 장소 화면을 열어 거기서 앱을 엶(카톡이 도착지를 빼먹기 때문)
   - 2.5초 안에 앱이 안 열리면 장소 화면(place.html, 앱 버튼·설치 안내)으로 감. 웹 길찾기로 자동으로 가지 않음
   - 컴퓨터는 지도 앱이 없으므로 그대로 장소 화면(현재 위치 -> 웹 자동차 길찾기)으로 감
   - (2026-11-16 사용자 "일정에 있는 장소도 네이버지도앱과 카카오앱에 장소를 자동차이동으로 표시하게") 장소 주소에 go=kakao 가 있으면 카카오맵 앱,
     go=naver(또는 없음)이면 네이버 지도 앱으로 자동차 길안내. 일정 카드의 [네이버] [카카오] 단추가 이 주소를 씀
   - (2026-11-21 사용자 "기사나 뉴스레터 뉴스에서 장소를 네이버지도로 띄우면 현재위치만 나오는데 ... 항상 그 위치를 찾아갈수있도록")
     좌표 찾기: 이 기기에 저장된 좌표(pgn_geo5:, app.js가 기사를 열 때 미리 받아 둠) -> 없으면 회원 서버 geo(최대 4.5초).
     주소의 a=(괄호 속 다른 이름)도 함께 넘겨 찾음. 좌표를 끝내 못 찾으면 다른 이름(a)으로 앱 검색
   쓰는 곳: place.html, 뉴스레터(nlwin.js가 불러옴), 홈페이지(app.js가 불러옴). 길안내 코드는 이 파일과 place.html에만 둠. */
(function () {
  if (window.pgnNavi) return;
  var ua = navigator.userAgent || '';
  var ios = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var android = /Android/i.test(ua), phone = ios || android || /Mobile/i.test(ua);
  var inKakao = phone && /KAKAOTALK/i.test(ua);   // 카톡 안 브라우저: 여기서 앱을 열면 카톡이 장소(도착지)를 빼고 넘겨 앱에 현재 위치만 나옴
  var GEO = 'https://script.google.com/macros/s/AKfycby4zEPx3AB25E7x4peqc9UTlYsGgywDjew64Xh8Va7VhM4zMG8clQGM0eCUZIQqsW2tVg/exec';
  var APPNAME = 'parkgolfnews.org';
  function parse(href) {
    try {
      var u = new URL(href, location.href);
      if (!/(^|\.)parkgolfnews\.org$/.test(u.hostname) && u.hostname !== location.hostname) return null;
      if (!/\/place\.html$/.test(u.pathname)) return null;
      var s = u.searchParams;
      return { u: u, n: (s.get('n') || '').trim() || '장소', a: (s.get('a') || '').trim(), lat: parseFloat(s.get('lat')), lng: parseFloat(s.get('lng')), id: s.get('id') || '', go: s.get('go') === 'kakao' ? 'kakao' : 'naver' };
    } catch (e) { return null; }
  }
  function has(p) { return isFinite(p.lat) && isFinite(p.lng); }
  function appUrl(kind, p) {
    var en = encodeURIComponent(String(has(p) ? p.n : (p.a || p.n)).replace(/[,\/;^|]/g, ' ')), scheme, pkg, path;
    if (kind === 'kakao') { scheme = 'kakaomap'; pkg = 'net.daum.android.map'; path = has(p) ? ('route?ep=' + p.lat + ',' + p.lng + '&by=CAR') : ('search?q=' + en); }
    else { scheme = 'nmap'; pkg = 'com.nhn.android.nmap'; path = has(p) ? ('route/car?dlat=' + p.lat + '&dlng=' + p.lng + '&dname=' + en + '&appname=' + APPNAME) : ('search?query=' + en + '&appname=' + APPNAME); }
    if (android) return 'intent://' + path + '#Intent;scheme=' + scheme + ';action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;package=' + pkg + ';end';
    return scheme + '://' + path;
  }
  function geoQ(p) { return p.a ? p.n + ' (' + p.a + ')' : p.n; }
  function geo(p) {
    if (has(p)) return Promise.resolve(p);
    var q = geoQ(p), c = null;
    try { c = JSON.parse(localStorage.getItem('pgn_geo5:' + q) || 'null'); } catch (e) {}
    if (c && !c.none && isFinite(c.lat) && isFinite(c.lng)) { p.lat = +c.lat; p.lng = +c.lng; return Promise.resolve(p); }
    var t = new Promise(function (r) { setTimeout(function () { r(p); }, 4500); });
    var f = geoAsk(q).then(function (v) { if (v && !v.none) { p.lat = v.lat; p.lng = v.lng; } return p; });
    return Promise.race([f, t]);
  }
  /* ---- 좌표 미리 채우기 (2026-11-21 사용자 "기사나 뉴스레터 뉴스에서 장소를 네이버지도로 띄우면 현재위치만 나오는데 ... 항상 그 위치를 찾아갈수있도록", "이 코드를 올릴수 있는 가장 상위에 놔줘")
     이 파일(navi.js)이 모든 화면(홈페이지 app.js·기사 iframe·뉴스레터 nlwin.js·place.html)에 들어가므로 여기 한 곳에만 둠.
     화면이 열리면 좌표가 없는 장소 링크(place.html?n=이름[&a=괄호 속 다른 이름])의 좌표를 회원 서버 geo로 미리 받아 링크에 lat·lng 를 넣음
     -> 누르는 순간 좌표가 있으므로 지도 앱·웹이 이름 검색(못 찾으면 현재 위치만 보임) 대신 그 장소로 바로 감.
     결과는 이 기기에 7일 보관(pgn_geo5:이름), 못 찾은 이름은 1일. 서버에는 한 번에 3개까지만 물어봄 ---- */
  var geoMem = {}, geoWait = [], geoRun = 0;
  function geoAsk(q) {
    if (geoMem[q]) return geoMem[q];
    return (geoMem[q] = new Promise(function (res) { geoWait.push({ q: q, res: res }); geoNext(); }));
  }
  function geoNext() {
    while (geoRun < 3 && geoWait.length) {
      (function (it) {
        geoRun++;
        fetch(GEO, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action: 'geo', q: it.q }) })
          .then(function (r) { return r.json(); })
          .then(function (j) {
            var v = (j && j.ok && !j.none && isFinite(j.lat) && isFinite(j.lng)) ? { lat: +j.lat, lng: +j.lng, t: Date.now() } : (j && j.ok ? { none: 1, t: Date.now() } : null);
            if (v) { try { localStorage.setItem('pgn_geo5:' + it.q, JSON.stringify(v)); } catch (e) {} }
            it.res(v);
          }, function () { delete geoMem[it.q]; it.res(null); })
          .then(function () { geoRun--; geoNext(); });
      })(geoWait.shift());
    }
  }
  function warm(root) {
    var list; try { list = (root || document).querySelectorAll('a[href*="place.html?"]'); } catch (e) { return; }
    Array.prototype.forEach.call(list, function (a) {
      var u; try { u = new URL(a.href); } catch (e) { return; }
      if (!/\/place\.html$/.test(u.pathname) || u.searchParams.get('lat') || a.getAttribute('data-pg-geo')) return;
      var n = (u.searchParams.get('n') || '').trim(), al = (u.searchParams.get('a') || '').trim(); if (!n) return;
      var q = al ? n + ' (' + al + ')' : n, c = null;
      a.setAttribute('data-pg-geo', '1');
      function put(v) { if (v && !v.none && isFinite(v.lat) && isFinite(v.lng)) { u.searchParams.set('lat', v.lat); u.searchParams.set('lng', v.lng); a.href = u.toString(); } }
      try { c = JSON.parse(localStorage.getItem('pgn_geo5:' + q) || 'null'); } catch (e) {}
      if (c && Date.now() - c.t < (c.none ? 864e5 : 7 * 864e5)) { put(c); return; }
      geoAsk(q).then(function (v) { if (v) put(v); else a.removeAttribute('data-pg-geo'); });
    });
  }
  function warmStart() {
    if (/\/place\.html$/.test(location.pathname) || !document.body) return;
    warm(document);
    var tm = 0;
    try { new MutationObserver(function () { if (!tm) tm = setTimeout(function () { tm = 0; warm(document); }, 300); }).observe(document.body, { childList: true, subtree: true }); } catch (e) {}
  }
  if (document.body) warmStart(); else document.addEventListener('DOMContentLoaded', warmStart);
  /* 앱 열기. 2.5초 안에 이 화면이 가려지지 않으면(앱이 안 열림) onFail */
  function launch(kind, p, onFail) {
    var left = false;
    function gone() { left = true; }
    document.addEventListener('visibilitychange', function () { if (document.hidden) gone(); });
    window.addEventListener('pagehide', gone); window.addEventListener('blur', gone);
    location.href = appUrl(kind, p);
    setTimeout(function () { if (!left && !document.hidden && onFail) onFail(); }, 2500);
  }
  function placePage(p, extra) {
    var s = new URLSearchParams(p.u.search);
    s.set('n', p.n); if (p.a) s.set('a', p.a); if (has(p)) { s.set('lat', p.lat); s.set('lng', p.lng); }
    for (var k in extra) s.set(k, extra[k]);
    return 'https://parkgolfnews.org/place.html?' + s.toString();
  }
  /* 장소 링크를 눌렀을 때: 휴대폰이면 네이버 지도 앱을 바로 엶. 처리했으면 true */
  /* 카톡 안: 누른 그 순간(사용자 터치가 있어야 카톡이 허락함) 장소 화면을 휴대폰 기본 인터넷 앱(크롬·삼성 인터넷·사파리)으로 열고(go=naver),
     거기서 네이버 지도 앱을 엶 -> 도착지가 그대로 앱에 들어감 (2026-11-16 사용자 "네비게이션이 바로 떠. 그런데 장소값을 못 불러와") */
  function outOfKakao(p, kind) {
    var left = false;
    document.addEventListener('visibilitychange', function () { if (document.hidden) left = true; });
    location.href = 'kakaotalk://web/openExternal?url=' + encodeURIComponent(placePage(p, { go: kind || 'naver' }));
    setTimeout(function () { if (!left && !document.hidden) location.href = placePage(p, { kk: '1' }); }, 1500);
  }
  function open(href) {
    var p = parse(href); if (!p || !phone) return false;
    if (inKakao) { outOfKakao(p, p.go); return true; }
    geo(p).then(function () { launch(p.go, p, function () { location.href = placePage(p, { noapp: '1' }); }); });
    return true;
  }
  if (phone && !/\/place\.html$/.test(location.pathname)) {
    try { if (window.top !== window.self) { window.pgnNavi = { open: open, appUrl: appUrl, parse: parse, launch: launch, geo: geo, outOfKakao: outOfKakao, phone: phone, inKakao: inKakao, ios: ios, android: android }; return; } } catch (e) {}
    /* window 단계(가장 먼저)에서 장소 링크 클릭을 잡아, 다른 클릭 처리(뉴스레터 창 열기 등)보다 먼저 앱을 엶 */
    window.addEventListener('click', function (ev) {
      if (ev.defaultPrevented || ev.button || ev.ctrlKey || ev.metaKey || ev.shiftKey || ev.altKey) return;
      var a = ev.target && ev.target.closest && ev.target.closest('a[href]'); if (!a) return;
      if (!parse(a.href)) return;
      ev.preventDefault(); ev.stopImmediatePropagation();
      open(a.href);
    }, true);
  }
  window.pgnNavi = { open: open, appUrl: appUrl, parse: parse, launch: launch, geo: geo, outOfKakao: outOfKakao, phone: phone, inKakao: inKakao, ios: ios, android: android };
})();
