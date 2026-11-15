/* 지도 앱 바로 열기 (2026-11-15 사용자 지시 "네이버지도와 카카오지도로 직접 연결하게 해줘", "자동차로 설정하게 해주고")
   휴대폰에서 네이버 지도 앱 / 카카오맵 앱을 바로 열고, 도착지 = 구장, 출발지 = 내 위치, 이동수단 = 자동차 로 길찾기를 띄움.
   - 네이버 지도: nmap://route/car?dlat&dlng&dname&appname  (네이버 지도 앱 공식 URL Scheme, 출발지를 비우면 현위치)
   - 카카오맵:   kakaomap://route?ep=위도,경도&by=CAR        (카카오맵 공식 URL Scheme, 출발지를 비우면 현위치)
   - 안드로이드는 intent:// 형식(앱 패키지 지정), 아이폰은 nmap:// · kakaomap:// 형식.
   - 2초 안에 앱이 안 열리면(앱 미설치 등) onFail 을 부름 (웹 길찾기 화면 등으로 이동). */
(function () {
  if (window.pgnMapApp) return;
  var ua = navigator.userAgent || '';
  var ios = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var android = /Android/i.test(ua);
  var APPNAME = 'parkgolfnews.org';
  function url(kind, n, lat, lng, fb) {
    var has = !isNaN(lat) && !isNaN(lng), en = encodeURIComponent(n || '');
    var scheme, pkg, path;
    if (kind === 'kakao') {
      scheme = 'kakaomap'; pkg = 'net.daum.android.map';
      path = has ? ('route?ep=' + lat + ',' + lng + '&by=CAR') : ('search?q=' + en);
    } else {
      scheme = 'nmap'; pkg = 'com.nhn.android.nmap';
      path = has ? ('route/car?dlat=' + lat + '&dlng=' + lng + '&dname=' + en + '&appname=' + APPNAME) : ('search?query=' + en + '&appname=' + APPNAME);
    }
    if (android) return 'intent://' + path + '#Intent;scheme=' + scheme + ';action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;package=' + pkg + (fb ? ';S.browser_fallback_url=' + encodeURIComponent(fb) : '') + ';end';
    return scheme + '://' + path;
  }
  function open(kind, n, lat, lng, onFail, fb) {
    var left = false;
    function hid() { if (document.hidden) left = true; }
    document.addEventListener('visibilitychange', hid);
    window.addEventListener('pagehide', function () { left = true; });
    window.addEventListener('blur', function () { left = true; });
    setTimeout(function () {
      document.removeEventListener('visibilitychange', hid);
      if (!left && !document.hidden && onFail) onFail();
    }, 2000);
    location.href = url(kind, n, lat, lng, fb);
  }
  window.pgnMapApp = { url: url, open: open, mobile: ios || android || /Mobile/i.test(ua) };
})();
