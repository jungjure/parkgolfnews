/* 장소 길안내 공용 코드 (2026-11-16, 사용자 지시 "장소를 누르면 ... 이걸 항상 네이버지도앱으로 바로 나오게 해줘")
   휴대폰에서 장소 링크(place.html?n=이름&lat=위도&lng=경도&id=번호)를 누르면, 누른 그 순간에 네이버 지도 앱을 바로 열어
   자동차 길안내(출발 = 내 위치, 도착 = 장소)를 띄움. 중간 화면(홈페이지)·웹 빠른길찾기를 거치지 않음.
   - 앱 주소: 네이버 nmap://route/car?dlat&dlng&dname&appname (안드로이드는 intent://…;package=com.nhn.android.nmap, 앱이 없으면 플레이스토어)
              카카오 kakaomap://route?ep=위도,경도&by=CAR (장소 화면의 카카오 버튼을 누를 때만)
   - 좌표가 없는 장소는 회원 서버(geo)로 좌표를 찾은 뒤 엶(최대 3초)
   - 2.5초 안에 앱이 안 열리면 장소 화면(place.html, 앱 버튼·설치 안내)으로 감. 웹 길찾기로 자동으로 가지 않음
   - 컴퓨터는 지도 앱이 없으므로 그대로 장소 화면(현재 위치 -> 웹 자동차 길찾기)으로 감
   쓰는 곳: place.html, 뉴스레터(nlwin.js가 불러옴), 홈페이지(app.js가 불러옴). 길안내 코드는 이 파일과 place.html에만 둠. */
(function () {
  if (window.pgnNavi) return;
  var ua = navigator.userAgent || '';
  var ios = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var android = /Android/i.test(ua), phone = ios || android || /Mobile/i.test(ua);
  var GEO = 'https://script.google.com/macros/s/AKfycby4zEPx3AB25E7x4peqc9UTlYsGgywDjew64Xh8Va7VhM4zMG8clQGM0eCUZIQqsW2tVg/exec';
  var APPNAME = 'parkgolfnews.org';
  function parse(href) {
    try {
      var u = new URL(href, location.href);
      if (!/(^|\.)parkgolfnews\.org$/.test(u.hostname) && u.hostname !== location.hostname) return null;
      if (!/\/place\.html$/.test(u.pathname)) return null;
      var s = u.searchParams;
      return { u: u, n: (s.get('n') || '').trim() || '장소', lat: parseFloat(s.get('lat')), lng: parseFloat(s.get('lng')), id: s.get('id') || '' };
    } catch (e) { return null; }
  }
  function has(p) { return isFinite(p.lat) && isFinite(p.lng); }
  function appUrl(kind, p) {
    var en = encodeURIComponent(String(p.n).replace(/[,\/;^|]/g, ' ')), scheme, pkg, path;
    if (kind === 'kakao') { scheme = 'kakaomap'; pkg = 'net.daum.android.map'; path = has(p) ? ('route?ep=' + p.lat + ',' + p.lng + '&by=CAR') : ('search?q=' + en); }
    else { scheme = 'nmap'; pkg = 'com.nhn.android.nmap'; path = has(p) ? ('route/car?dlat=' + p.lat + '&dlng=' + p.lng + '&dname=' + en + '&appname=' + APPNAME) : ('search?query=' + en + '&appname=' + APPNAME); }
    if (android) return 'intent://' + path + '#Intent;scheme=' + scheme + ';action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;package=' + pkg + ';end';
    return scheme + '://' + path;
  }
  function geo(p) {
    if (has(p)) return Promise.resolve(p);
    var t = new Promise(function (r) { setTimeout(function () { r(p); }, 3000); });
    var f = fetch(GEO, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action: 'geo', q: p.n }) })
      .then(function (r) { return r.json(); })
      .then(function (j) { if (j && j.ok && !j.none && isFinite(j.lat) && isFinite(j.lng)) { p.lat = +j.lat; p.lng = +j.lng; if (j.n && /파크골프|구장|공원|체육/.test(j.n)) p.n = j.n; } return p; })
      .catch(function () { return p; });
    return Promise.race([f, t]);
  }
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
    s.set('n', p.n); if (has(p)) { s.set('lat', p.lat); s.set('lng', p.lng); }
    for (var k in extra) s.set(k, extra[k]);
    return 'https://parkgolfnews.org/place.html?' + s.toString();
  }
  /* 장소 링크를 눌렀을 때: 휴대폰이면 네이버 지도 앱을 바로 엶. 처리했으면 true */
  function open(href) {
    var p = parse(href); if (!p || !phone) return false;
    geo(p).then(function () { launch('naver', p, function () { location.href = placePage(p, { noapp: '1' }); }); });
    return true;
  }
  if (phone && !/\/place\.html$/.test(location.pathname)) {
    try { if (window.top !== window.self) { window.pgnNavi = { open: open, appUrl: appUrl, parse: parse, launch: launch, geo: geo, phone: phone, ios: ios, android: android }; return; } } catch (e) {}
    /* window 단계(가장 먼저)에서 장소 링크 클릭을 잡아, 다른 클릭 처리(뉴스레터 창 열기 등)보다 먼저 앱을 엶 */
    window.addEventListener('click', function (ev) {
      if (ev.defaultPrevented || ev.button || ev.ctrlKey || ev.metaKey || ev.shiftKey || ev.altKey) return;
      var a = ev.target && ev.target.closest && ev.target.closest('a[href]'); if (!a) return;
      if (!parse(a.href)) return;
      ev.preventDefault(); ev.stopImmediatePropagation();
      open(a.href);
    }, true);
  }
  window.pgnNavi = { open: open, appUrl: appUrl, parse: parse, launch: launch, geo: geo, phone: phone, ios: ios, android: android };
})();
