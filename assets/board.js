/* 자유게시판 · 독자칼럼 · 파크톡(2026-11-13) 공용 화면 (2026-11-03)
   - 밴드 글쓰기처럼 한 화면에서 글을 쓰고 사진을 여러 장 붙임 (글 사이에도 넣을 수 있음, 위·아래 이동, 삭제)
   - 사진은 브라우저에서 긴 변 1280px JPEG로 줄인 뒤 한 장씩 회원 서버(bimg)로 올림 → 관리자 Google Drive 전용 폴더
   - 읽기는 누구나, 쓰기·수정·삭제·댓글·신고는 로그인 회원 (서버에서도 같은 규칙)
   - 글꼴은 따로 지정하지 않음(inherit = 사이트 기본 Pretendard) */
(async () => {
  const CFG = Object.assign({ kind: '자유', page: 'board.html', name: '자유게시판', active: 'board' }, window.PGN_BOARD || {});
  const OTHER = { '자유': 'board.html', '칼럼': 'column.html', '톡': 'talk.html' };
  /* 파크톡 (2026-11-13): 러닝톡처럼 분류(질문·동행·조인·대회 정보·자유) + 대회 이름 + 좋아요. 자유게시판을 대신함 */
  const TALK = CFG.kind === '톡', TCATS = ['질문', '동행·조인', '대회 정보', '자유'];
  const HEART = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z"/></svg>';
  const BUBBLE = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1.1-4.6A8 8 0 1 1 21 12z"/></svg>';
  const PEN = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>';
  const MAG = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>';
  const tDay = s => { const m = /^\d{4}-(\d{2})-(\d{2})/.exec(s || ''); return m ? (+m[1]) + '월 ' + (+m[2]) + '일' : esc(s || ''); };
  const PGS = {}, pgnStatic = n => PGS[n] || (PGS[n] = fetch('data/' + n + '.json?t=' + Math.floor(Date.now() / 6e4)).then(r => r.ok ? r.json() : null).catch(() => null));   /* 홈페이지에 미리 만들어 둔 목록 파일 (서버보다 훨씬 빠름) */
  const PHOTO_MAX = 10, LONG = 1280, MAXB = 850 * 1024, TEXT_MAX = CFG.kind === '칼럼' ? 10000 : 3000;
  /* 파일 첨부·동영상·유튜브 (2026-11-03): window.PGN_BOARD 에 media: true 를 넣은 게시판에서만 켜짐 (지금은 독자칼럼만) */
  const MEDIA = !!CFG.media, FILE_MAX = 20 * 1024 * 1024, VIDEO_MAX = 100 * 1024 * 1024, FILE_N = 5, VIDEO_N = 3, CHUNK = 8 * 1024 * 1024;
  const FILE_EXT = ['pdf', 'hwp', 'hwpx', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv', 'zip', 'jpg', 'jpeg', 'png', 'gif'], VIDEO_EXT = ['mp4', 'mov', 'm4v', 'webm'];
  const extOf = n => ((/\.([a-z0-9]{1,5})$/i.exec(n || '') || [])[1] || '').toLowerCase();
  const fmtSize = s => s >= 1048576 ? (s / 1048576).toFixed(s >= 10485760 ? 0 : 1) + 'MB' : Math.max(1, Math.round(s / 1024)) + 'KB';
  const DL = id => 'https://drive.google.com/uc?export=download&id=' + encodeURIComponent(id);
  const ytId = s => { const m = /(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/|v\/))([A-Za-z0-9_-]{11})/.exec(String(s || '').trim()); return m ? m[1] : ''; };
  const FCOL = { pdf: '#d93025', hwp: '#1a5fb4', hwpx: '#1a5fb4', doc: '#2b579a', docx: '#2b579a', xls: '#1d6f42', xlsx: '#1d6f42', csv: '#1d6f42', ppt: '#c43e1c', pptx: '#c43e1c', zip: '#6b4f1d', txt: '#555', jpg: '#0f766e', jpeg: '#0f766e', png: '#0f766e', gif: '#0f766e' };
  const fic = n => { const e = extOf(n); return '<span class="fic" style="background:' + (FCOL[e] || '#555') + '">' + esc((e || '파일').toUpperCase()) + '</span>'; };
  const VIC = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2.5" y="5" width="14" height="14" rx="2"/><path d="M16.5 10l5-3v10l-5-3z"/></svg>';
  const FIC = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11.5l-8.6 8.6a5 5 0 0 1-7.1-7.1l8.6-8.6a3.3 3.3 0 0 1 4.7 4.7l-8.6 8.6a1.7 1.7 0 0 1-2.4-2.4l7.9-7.9"/></svg>';
  const YIC = '<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><rect x="1.5" y="5" width="21" height="14" rx="4" fill="#ff0000"/><path d="M10 9l5 3-5 3z" fill="#fff"/></svg>';
  const IMGURL = (id, w) => 'https://lh3.googleusercontent.com/d/' + encodeURIComponent(id) + '=w' + (w || 1280);
  const IMGALT = (id, w) => 'https://drive.google.com/thumbnail?id=' + encodeURIComponent(id) + '&sz=w' + (w || 1280);
  window.pgnImgErr = img => { if (!img.dataset.alt) { img.dataset.alt = 1; img.src = IMGALT(img.dataset.id, img.dataset.w); } };
  const imgTag = (id, w, extra) => '<img src="' + IMGURL(id, w) + '" data-id="' + esc(id) + '" data-w="' + (w || 1280) + '" loading="lazy" alt="첨부 사진" onerror="pgnImgErr(this)"' + (extra || '') + '>';
  const CAM = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13.5" r="3.6"/></svg>';

  const st = document.createElement('style');
  st.textContent =
    '.bd{max-width:860px;margin:0 auto;padding:22px 0 10px}' +
    '.bd .rules{background:var(--g50);border:1px solid var(--g100);border-radius:12px;padding:12px 16px;font-size:.88rem;line-height:1.7;color:#345;margin-bottom:14px}.bd .rules b{color:var(--g900)}' +
    '.bd .tools{display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap}.bd .tools input{flex:1;min-width:160px;padding:10px 13px;border:2px solid var(--line);border-radius:10px;font-size:1rem;font-family:inherit}.bd .tools .btn{padding:9px 20px;white-space:nowrap}' +
    '.bitem{display:flex;gap:12px;align-items:flex-start;padding:13px 16px;border-top:1px solid var(--line);color:inherit}.bitem:first-child{border-top:0}.bitem:hover{background:var(--g50)}' +
    '.bitem .bx{flex:1;min-width:0}.bitem .bt{font-weight:800;font-size:1.02rem;word-break:break-all}' +
    '.bitem .bex{font-size:.92rem;line-height:1.55;margin-top:3px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;word-break:break-all}' +
    '.bitem .bm{font-size:.85rem;color:var(--muted);margin-top:3px}.bitem .bf{display:flex;align-items:center;justify-content:space-between;gap:8px}.bitem .bf .cmb{margin-top:3px;flex:none}' +
    '.bitem .bth{flex:none;width:88px;height:88px;border-radius:10px;overflow:hidden;background:var(--g50);position:relative}.bitem .bth img{width:100%;height:100%;object-fit:cover;display:block}' +
    '.bitem .bth i{position:absolute;right:4px;bottom:4px;background:rgba(0,0,0,.62);color:#fff;font-style:normal;font-size:.75rem;font-weight:700;border-radius:999px;padding:1px 7px}' +
    '.bpost{padding:22px}.bpost h1{margin:0 0 6px;font-size:1.4rem;line-height:1.4;word-break:break-all}' +
    '.bpost .bm{font-size:.9rem;color:var(--muted);padding-bottom:12px;border-bottom:1px solid var(--line);margin-bottom:16px}' +
    '.bpost .bcont{min-height:80px}.bpost .bbody{white-space:pre-wrap;word-break:break-word;line-height:1.8;font-size:1.03rem}' +
    '.bpost .bbody+.bbody{margin-top:12px}.bpost figure.bimg{margin:14px 0;text-align:center}' +
    '.bpost figure.bimg img{max-width:100%;height:auto;border-radius:10px;cursor:zoom-in;display:inline-block;background:var(--g50);min-height:60px}' +
    '.bpost .bar{display:flex;gap:8px;flex-wrap:wrap;margin-top:22px}.bpost .bar .btn{padding:8px 18px;font-size:.95rem}' +
    '.btn.red{background:#fff;color:var(--red);border-color:var(--red)}' +
    '.bed{border:2px solid var(--line);border-radius:12px;padding:4px;background:#fff}.bed:focus-within{border-color:var(--g600)}' +
    '.bed textarea.bta{display:block;width:100%;border:0;outline:0;resize:none;min-height:52px;padding:10px 11px;font-family:inherit;font-size:1.03rem;line-height:1.7;background:transparent;overflow:hidden;color:inherit}' +
    '.bed .bk.img{position:relative;margin:6px 4px;border-radius:10px;overflow:hidden;background:var(--g50);text-align:center;min-height:90px}' +
    '.bed .bk.img img{display:block;max-width:100%;max-height:300px;margin:0 auto}' +
    '.bed .bk.img .ic{position:absolute;top:6px;right:6px;display:flex;gap:6px}' +
    '.bed .bk.img .ic button{width:42px;height:42px;border-radius:50%;border:0;background:rgba(0,0,0,.62);color:#fff;font-family:inherit;font-size:1.15rem;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0}' +
    '.bed .bk.img .ic button:disabled{opacity:.35;cursor:default}.bed .bk.img .no{position:absolute;top:8px;left:8px;background:rgba(0,0,0,.62);color:#fff;border-radius:999px;font-size:.8rem;font-weight:700;padding:2px 9px}' +
    '.bed .bk.img .st{position:absolute;left:0;right:0;bottom:0;background:rgba(0,0,0,.6);color:#fff;font-size:.88rem;padding:6px}.bed .bk.img.err .st{background:rgba(200,30,30,.88)}' +
    '.btools{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:10px 0 2px}' +
    '.bphoto{display:inline-flex;align-items:center;gap:7px;border:2px solid var(--g700);background:#fff;color:var(--g900);border-radius:999px;padding:9px 18px;font-family:inherit;font-weight:800;font-size:1rem;cursor:pointer;line-height:1.3}.bphoto:hover{background:var(--g50)}.bphoto:disabled{opacity:.45;cursor:default}' +
    '.btools .cnt{font-size:.88rem;color:var(--muted)}.btools .hint{flex-basis:100%;font-size:.82rem;color:var(--muted);line-height:1.5;overflow-wrap:anywhere;word-break:keep-all}' +
    '.bed .bk.med{position:relative;margin:6px 4px;border-radius:10px;background:var(--g50);min-height:64px;padding:10px 150px 10px 12px;display:flex;align-items:center;gap:10px;overflow:hidden}' +
    '.bed .bk.med .ic{position:absolute;top:50%;right:6px;transform:translateY(-50%);display:flex;gap:6px}.bed .bk.med .no{display:none}' +
    '.bed .bk.med .ic button{width:40px;height:40px;border-radius:50%;border:0;background:rgba(0,0,0,.62);color:#fff;font-family:inherit;font-size:1.1rem;font-weight:700;cursor:pointer;padding:0}.bed .bk.med .ic button:disabled{opacity:.35;cursor:default}' +
    '.bed .bk.med .mt{min-width:0;flex:1}.bed .bk.med .mt b{display:block;font-size:.95rem;word-break:break-all}.bed .bk.med .mt small{color:var(--muted);font-size:.82rem}' +
    '.bed .bk.med .pv{flex:none;width:96px;height:60px;border-radius:8px;object-fit:cover;background:#000;display:block}' +
    '.bed .bk.med .st{display:block;color:var(--g800);font-size:.85rem;font-weight:700;margin-top:2px}.bed .bk.med.err{background:#fdecea}.bed .bk.med.err .st{color:var(--red)}' +
    '.bed .bk.med .bar2{height:6px;border-radius:3px;background:#dfe9e2;margin-top:5px;overflow:hidden}.bed .bk.med .bar2 i{display:block;height:100%;background:var(--g700)}' +
    '@media(max-width:600px){.bed .bk.med{padding:10px 12px 58px}.bed .bk.med .ic{top:auto;bottom:8px;right:8px;transform:none}.bed .bk.med .pv{width:76px;height:48px}.bed .bk.med .fic{min-width:40px;height:40px}}' +
    '.fic{flex:none;display:inline-flex;align-items:center;justify-content:center;min-width:46px;height:46px;padding:0 4px;border-radius:9px;color:#fff;font-size:.78rem;font-weight:800;letter-spacing:.02em}' +
    '.bmed2{display:flex;gap:8px;flex-wrap:wrap}.ytrow{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:8px}.ytrow input{flex:1;min-width:200px;padding:9px 12px;border:2px solid var(--line);border-radius:10px;font-family:inherit;font-size:1rem}' +
    '.ytrow .btn{padding:8px 16px;font-size:.95rem}.ytrow[hidden]{display:none}' +
    '.bpost a.bfile{display:flex;align-items:center;gap:12px;margin:12px 0;padding:12px 14px;border:1px solid var(--line);border-radius:12px;color:inherit;background:#fff}.bpost a.bfile:hover{background:var(--g50);border-color:var(--g600)}' +
    '.bpost a.bfile span.ft{flex:1;min-width:0}.bpost a.bfile b{display:block;word-break:keep-all;overflow-wrap:anywhere;font-size:1rem}.bpost a.bfile small{color:var(--muted);font-size:.85rem}' +
    '.bpost a.bfile em{flex:none;font-style:normal;font-weight:800;color:#fff;background:var(--g700);border-radius:999px;padding:6px 14px;font-size:.9rem}' +
    '.bpost .bvid,.bpost .byt{margin:14px 0}.bpost .r169{position:relative;width:100%;padding-top:56.25%;background:#000;border-radius:10px;overflow:hidden}' +
    '.bpost .r169 iframe{position:absolute;inset:0;width:100%;height:100%;border:0}.bpost .vcap{font-size:.85rem;color:var(--muted);margin-top:6px;line-height:1.5}' +
    '#blb{position:fixed;inset:0;background:rgba(0,0,0,.92);z-index:10000;display:flex;align-items:center;justify-content:center}#blb img{max-width:100vw;max-height:100vh;object-fit:contain}' +
    '#blb button{position:absolute;border:0;background:rgba(255,255,255,.18);color:#fff;font-family:inherit;font-size:1.8rem;width:50px;height:50px;border-radius:50%;cursor:pointer;line-height:1;padding:0}' +
    '.tk-hd{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;margin:4px 0 16px}.tk-hd h1{margin:0;font-size:2rem;font-weight:900;letter-spacing:-.02em;line-height:1.2;color:#111}.tk-hd p{margin:6px 0 0;color:#555;font-size:.98rem;line-height:1.5;word-break:keep-all}' +
    '.tk-w{flex:none;display:inline-flex;align-items:center;gap:7px;background:#111;color:#fff;border-radius:10px;padding:12px 18px;font-weight:800;font-size:1rem;text-decoration:none;white-space:nowrap}.tk-w:hover{background:#333;color:#fff}' +
    '.tk-chips{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px}.tk-chips button{font-family:inherit;font-size:.98rem;font-weight:700;background:#fff;color:#222;border:1px solid #d6d6d6;border-radius:9px;padding:8px 14px;cursor:pointer;line-height:1.3}.tk-chips button.on{border:2px solid #111;padding:7px 13px}' +
    '.tk-s{position:relative;margin-bottom:16px;max-width:400px}.tk-s svg{position:absolute;left:12px;top:50%;transform:translateY(-50%);color:#777}.tk-s input{width:100%;padding:11px 12px 11px 40px;border:1px solid #d6d6d6;border-radius:10px;font-family:inherit;font-size:1rem;background:#fff}.tk-s input:focus{outline:0;border-color:#111}' +
    '.tk-list{border-top:1px solid #e3e3e3}.tk-it{display:block;padding:16px 8px;border-bottom:1px solid #e3e3e3;color:inherit;text-decoration:none}.tk-it:hover{background:#fafafa}' +
    '.tk-t{display:flex;align-items:flex-start;gap:8px}.tk-tag{flex:none;font-size:.8rem;font-weight:700;color:#444;border:1px solid #d6d6d6;border-radius:5px;padding:2px 7px;line-height:1.4;margin-top:2px;white-space:nowrap;background:#fff}' +
    '.tk-t b{font-size:1.05rem;font-weight:800;line-height:1.45;color:#111;word-break:break-all}.tk-m{display:flex;align-items:center;flex-wrap:wrap;gap:4px 10px;margin-top:7px;font-size:.88rem;color:#666}.tk-m .tk-ev{color:#222;font-weight:700}.tk-m .ic{display:inline-flex;align-items:center;gap:3px}' +
    '.tk-pg{display:flex;justify-content:center;gap:6px;flex-wrap:wrap;margin:18px 0}.tk-rules{font-size:.82rem;color:#777;line-height:1.6;margin-top:18px}' +
    '.tk-like{display:inline-flex;align-items:center;gap:6px;font-family:inherit;font-size:.95rem;font-weight:700;border:1px solid #d6d6d6;background:#fff;color:#333;border-radius:999px;padding:7px 16px;cursor:pointer}.tk-like.on{color:#e0245e;border-color:#e0245e}.tk-like.on svg{fill:#e0245e}' +
    '.tk-cats{display:flex;gap:8px;flex-wrap:wrap}.tk-cats label{cursor:pointer;position:relative}.tk-cats input{position:absolute;left:0;top:0;width:1px;height:1px;opacity:0;pointer-events:none;margin:0}.tk-cats span{display:inline-block;font-size:.98rem;font-weight:700;border:1px solid #d6d6d6;border-radius:9px;padding:8px 14px;background:#fff}.tk-cats input:checked+span{border:2px solid #111;padding:7px 13px}.tk-cats input:focus-visible+span{outline:2px solid var(--g600)}' +
    '@media(max-width:600px){.tk-hd h1{font-size:1.7rem}.tk-w{padding:10px 14px}.tk-s{max-width:none}}' +
    '#blb .x{top:12px;right:12px}#blb .p{left:10px;top:calc(50% - 25px)}#blb .n{right:10px;top:calc(50% - 25px)}#blb .c{position:absolute;bottom:14px;left:0;right:0;text-align:center;color:#fff;font-size:.95rem}';
  document.head.appendChild(st);

  await layout(CFG.active);
  const me = Auth.get() || {}, isAdmin = me.role === 'admin', guest = !Auth.get();   /* 손님도 목록·글·댓글은 볼 수 있음 */
  document.querySelector('footer.site').insertAdjacentHTML('beforebegin', '<div class="wrap"><main class="bd" id="bd"></main></div>');
  const bd = $('#bd'), q = new URLSearchParams(location.search);
  const RULES = (CFG.kind === '칼럼'
    ? '<div class="rules"><b>독자칼럼 이용 안내</b><br>파크골프에 관한 생각, 경험, 제안, 여행·구장 이야기를 자유롭게 써 주세요. 글 사이사이에 사진을 여러 장 붙일 수 있습니다.' + (MEDIA ? ' 동영상(직접 올리기 또는 유튜브 링크)과 문서 파일도 넣을 수 있습니다.' : '') + '<br>'
    : TALK ? '<div class="rules"><b>파크톡 이용 안내</b><br>대회 질문, 동행·조인 구하기, 대회 정보, 자유로운 이야기를 나누는 곳입니다. 분류를 고르고, 관련 대회가 있으면 대회 이름을 적어 주세요. 제목만 써도 되고 사진도 붙일 수 있습니다.<br>'
    : '<div class="rules"><b>자유게시판 이용 안내</b><br>회원끼리 파크골프 이야기, 질문, 후기, 모임 소식을 자유롭게 나누는 곳입니다. 사진도 여러 장 붙일 수 있습니다.<br>') +
    (CFG.kind === '칼럼' ? '&middot; <b>독자칼럼은 운영자가 승인한 회원만 쓸 수 있습니다.</b> 처음이시면 로그인 후 [칼럼 쓰기 신청]을 눌러 주세요. 읽기와 댓글은 누구나(댓글은 회원) 할 수 있습니다.<br>' : '') + '아래 내용은 올릴 수 없으며 자동으로 차단되거나 신고·삭제될 수 있습니다.<br>&middot; 욕설·비방·혐오 표현, 선정적이거나 음란한 내용<br>&middot; 도박·불법 광고, 폭력·자해를 부추기는 내용, 개인정보 노출(다른 사람 얼굴·전화번호·차량번호가 보이는 사진 포함), 인터넷 주소(링크)<br>&middot; 회원 3명이 신고하면 글이 자동으로 숨겨지고 운영자가 확인합니다.</div>';
  const go = p => { location.href = CFG.page + (p ? '?' + p : ''); };
  const say = (el, t, k) => { el.innerHTML = t ? '<div class="msg ' + (k || 'err') + '">' + esc(t) + '</div>' : ''; };
  const errOut = e => { if (!Auth.get() && (q.get('write') || q.get('edit'))) { location.replace('login.html?next=' + encodeURIComponent(loginNext())); } return e.message; };
  /* 독자칼럼 쓰기 승인 (2026-11-04): 승인 회원·관리자만 글쓰기. 아니면 [칼럼 쓰기 신청] (개선요청 '칼럼 신청'으로 운영자에게 전달) */
  const NEED_OK = CFG.kind === '칼럼';
  let canP = null;
  const canWrite = () => { if (!NEED_OK || isAdmin) return Promise.resolve({ can: true }); if (guest) return Promise.resolve({ can: false, guest: true }); if (!canP) canP = api('bcan').catch(() => ({ can: false })); return canP; };
  const applyBox = (el, st) => {
    if (st.pending) { el.innerHTML = '<div class="msg ok">칼럼 쓰기 신청이 접수되어 운영자가 확인 중입니다. 승인되면 다음 접속 때 알려 드립니다.</div>'; return; }
    el.innerHTML = '<div class="card bpost capply"><b>독자칼럼은 승인된 회원만 쓸 수 있습니다.</b><p style="margin:6px 0 10px">어떤 칼럼을 쓰고 싶은지 간단히 적어 신청해 주세요. 운영자가 확인 후 승인합니다.</p>' +
      '<textarea id="caText" maxlength="1000" style="width:100%;min-height:110px;padding:11px 13px;border:2px solid var(--line);border-radius:10px;font-size:1rem;font-family:inherit" placeholder="예) 동호회 활동과 구장 탐방기를 연재하고 싶습니다."></textarea>' +
      '<div id="caMsg"></div><button type="button" class="btn green" id="caGo" style="margin-top:8px">칼럼 쓰기 신청</button></div>';
    $('#caGo').onclick = async () => {
      const t = $('#caText').value.trim(), b = $('#caGo');
      if (t.length < 5) { say($('#caMsg'), '신청 내용을 5자 이상 적어 주세요.'); return; }
      b.disabled = true; b.textContent = '보내는 중...';
      try { await api('reqpost', { cat: '칼럼 신청', title: '독자칼럼 쓰기 신청', text: t }); canP = null; applyBox(el, { pending: true }); }
      catch (e) { say($('#caMsg'), errOut(e)); b.disabled = false; b.textContent = '칼럼 쓰기 신청'; }
    };
  };
  const blocksOf = p => (p.blocks && p.blocks.length) ? p.blocks : [{ t: p.text || '' }];

  /* ---------- 목록 ---------- */
  async function showList() {
    if (TALK) return showTalkList();
    document.title = CFG.name + ' - 파크골프뉴스';
    bd.innerHTML = '<h2 class="sec">' + esc(CFG.name) + '</h2>' + RULES +
      '<div class="tools"><input id="bs" placeholder="제목·글쓴이 검색"><a class="btn green" id="bw" href="' + CFG.page + '?write=1">글쓰기</a></div><div id="capw"></div><div class="card" id="blist"><div class="loading">불러오는 중...</div></div><div class="pager" id="bpg"></div>';
    let all = [], page = 1, kw = '';
    const PER = 15;
    const draw = () => {
      const k = kw.trim().toLowerCase();
      const f = k ? all.filter(x => x.title.toLowerCase().includes(k) || x.nick.toLowerCase().includes(k)) : all;
      const pages = Math.max(1, Math.ceil(f.length / PER)); if (page > pages) page = pages;
      { const n1 = f.length; window.PGN_SHARE = () => new URLSearchParams(location.search).get('id') ? '' : '파크골프뉴스 ' + CFG.name + ' 총 ' + n1 + '건입니다.'; }   /* 공유 문구 */
      $('#blist').innerHTML = f.length ? f.slice((page - 1) * PER, page * PER).map(x =>
        '<a class="bitem" href="' + CFG.page + '?id=' + esc(x.id) + '"><div class="bx"><div class="bt">' + esc(x.title) + (x.status === '숨김' ? ' <span class="tag hide">숨김</span>' : '') + (isAdmin && x.reports ? ' <span class="tag 접수">신고 ' + x.reports + '</span>' : '') + '</div>' +
        (x.ex ? '<div class="bex">' + esc(x.ex) + '</div>' : '') +
        '<div class="bf"><div class="bm">' + esc(x.nick) + ' · ' + esc(x.at.slice(5)) + (x.pc ? ' · 사진 ' + x.pc + '장' : '') + (x.vc ? ' · 동영상 ' + x.vc : '') + (x.fc ? ' · 파일 ' + x.fc : '') + '</div><button type="button" class="cmb" data-cid="board:' + esc(x.id) + '" data-title="' + esc(x.title) + '" data-href="' + CFG.page + '?id=' + esc(x.id) + '" aria-label="댓글 보기·쓰기"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1.1-4.6A8 8 0 1 1 21 12z"/></svg>댓글 <b>' + (x.cm || 0) + '</b></button></div></div>' +
        (x.th ? '<div class="bth">' + imgTag(x.th, 240) + (x.pc > 1 ? '<i>+' + (x.pc - 1) + '</i>' : '') + '</div>' : x.yt ? '<div class="bth"><img src="https://i.ytimg.com/vi/' + esc(x.yt) + '/mqdefault.jpg" alt="" loading="lazy"><i>영상</i></div>' : '') + '</a>').join('')
        : '<div class="empty">' + (k ? '검색 결과가 없습니다.' : '아직 글이 없습니다. 첫 글을 남겨 보세요.') + '</div>';
      $('#bpg').innerHTML = pages > 1 ? Array.from({ length: pages }, (_, i) => '<button class="btn ' + (i + 1 === page ? 'green' : 'gray') + '" data-p="' + (i + 1) + '" style="padding:6px 14px">' + (i + 1) + '</button>').join('') : '';
    };
    $('#bpg').onclick = e => { const b = e.target.closest('[data-p]'); if (b) { page = +b.dataset.p; draw(); window.scrollTo(0, 0); } };
    $('#bs').oninput = e => { kw = e.target.value; page = 1; draw(); };
    if (NEED_OK && !guest && !isAdmin) canWrite().then(st => { if (st.can) return; const w = $('#bw'); if (!w) return; w.textContent = st.pending ? '신청 확인 중' : '칼럼 쓰기 신청'; w.removeAttribute('href'); w.style.cursor = 'pointer'; w.onclick = () => { applyBox($('#capw'), st); $('#capw').scrollIntoView({ block: 'center' }); }; });
    /* 빠른 목록 (11/4): 이 기기에 저장한 목록 -> 홈페이지 data/board.json (0.1초) 을 먼저 보여 주고, 서버 목록이 오면 바꿔 그림 */
    const useList = (items, keep) => { all = (items || []).filter(x => !x.kind || x.kind === CFG.kind); CMC.counts = Object.assign(CMC.counts || {}, Object.fromEntries(all.map(x => ['board:' + x.id, x.cm || 0]))); CMC.p = CMC.p || Promise.resolve(); draw(); };
    const lk = 'pgn_bl_' + CFG.kind; let shown = false, fresh = false;
    try { const c = JSON.parse(localStorage.getItem(lk) || 'null'); if (c && c.length) { useList(c); shown = true; } } catch (e) {}
    pgnStatic('board').then(j => { const it = j && j[CFG.kind]; if (!it || fresh) return; useList(it); shown = true; try { localStorage.setItem(lk, JSON.stringify(it)); } catch (e) {} }).catch(() => {});
    try {
      const r = await api('blist', { kind: CFG.kind }); fresh = true; useList(r.items);   /* 댓글 수는 목록에서 받은 값 사용 */
    } catch (e) { if (!shown) $('#blist').innerHTML = '<div class="empty">목록을 불러오지 못했습니다.<br><small>' + esc(errOut(e)) + '</small></div>'; }
  }

  /* ---------- 파크톡 목록 (러닝톡 모양: 제목·설명·글쓰기, 분류 칩, 대회 이름 검색, 분류 표·제목·대회·글쓴이·날짜·댓글·좋아요) ---------- */
  async function showTalkList() {
    document.title = CFG.name + ' - 파크골프뉴스';
    const q0 = new URLSearchParams(location.search);
    let all = [], page = 1, kw = q0.get('ev') || '', cat = TCATS.includes(q0.get('c')) ? q0.get('c') : '전체', lk = {};
    const PER = 20;
    bd.innerHTML = '<div class="tk-hd"><div><h1>' + esc(CFG.name) + '</h1><p>대회 질문, 동행·조인 구하기, 대회 정보를 나누는 곳이에요.</p></div><a class="tk-w" id="bw" href="' + CFG.page + '?write=1">' + PEN + '글쓰기</a></div>' +
      '<div class="tk-chips" id="tkc">' + ['전체'].concat(TCATS).map(c => '<button type="button" data-c="' + c + '"' + (c === cat ? ' class="on"' : '') + '>' + c + '</button>').join('') + '</div>' +
      '<div class="tk-s">' + MAG + '<input id="bs" type="search" placeholder="대회: 대회 이름으로 찾기" aria-label="대회 이름으로 찾기" value="' + esc(kw) + '"></div>' +
      '<div class="tk-list" id="blist"><div class="loading">불러오는 중...</div></div><div class="tk-pg" id="bpg"></div>' +
      '<p class="tk-rules">욕설·비방, 선정적인 내용, 도박·불법 광고, 개인정보(전화번호 등), 인터넷 주소(링크)는 올릴 수 없으며 자동으로 차단되거나 신고·삭제될 수 있습니다. 회원 3명이 신고하면 글이 숨겨집니다.</p>';
    const draw = () => {
      const k = kw.trim().toLowerCase().replace(/\s+/g, '');
      const f = all.filter(x => (cat === '전체' || (x.cat || '자유') === cat) && (!k || ((x.ev || '') + (x.title || '')).toLowerCase().replace(/\s+/g, '').includes(k)));
      const pages = Math.max(1, Math.ceil(f.length / PER)); if (page > pages) page = pages;
      { const n1 = f.length; window.PGN_SHARE = () => new URLSearchParams(location.search).get('id') ? '' : '파크골프뉴스 ' + CFG.name + ' 총 ' + n1 + '건입니다.'; }
      $('#blist').innerHTML = f.length ? f.slice((page - 1) * PER, page * PER).map(x => {
        const nL = Math.max(x.lk || 0, (lk['talk:' + x.id] || {}).like || 0);
        return '<a class="tk-it" href="' + CFG.page + '?id=' + esc(x.id) + '"><div class="tk-t"><span class="tk-tag">' + esc(x.cat || '자유') + '</span><b>' + esc(x.title) + (x.status === '숨김' ? ' <span class="tag hide">숨김</span>' : '') + (isAdmin && x.reports ? ' <span class="tag 접수">신고 ' + x.reports + '</span>' : '') + '</b></div>' +
          '<div class="tk-m">' + (x.ev ? '<span class="tk-ev">' + esc(x.ev) + '</span>' : '') + '<span>' + esc(x.nick) + '</span><span>' + tDay(x.at) + '</span>' + (x.pc ? '<span>사진 ' + x.pc + '</span>' : '') +
          (x.cm ? '<span class="ic">' + BUBBLE + x.cm + '</span>' : '') + (nL ? '<span class="ic">' + HEART + nL + '</span>' : '') + '</div></a>';
      }).join('') : '<div class="empty">' + (k || cat !== '전체' ? '조건에 맞는 글이 없습니다.' : '아직 글이 없습니다. 첫 글을 남겨 보세요.') + '</div>';
      $('#bpg').innerHTML = pages > 1 ? Array.from({ length: pages }, (_, i) => '<button class="btn ' + (i + 1 === page ? 'green' : 'gray') + '" data-p="' + (i + 1) + '" style="padding:6px 14px">' + (i + 1) + '</button>').join('') : '';
    };
    $('#bpg').onclick = e => { const b = e.target.closest('[data-p]'); if (b) { page = +b.dataset.p; draw(); window.scrollTo(0, 0); } };
    $('#bs').oninput = e => { kw = e.target.value; page = 1; draw(); };
    $('#tkc').onclick = e => { const b = e.target.closest('[data-c]'); if (!b) return; cat = b.dataset.c; page = 1; $('#tkc').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); draw(); };
    const useList = items => { all = (items || []).filter(x => x.kind === '톡'); CMC.counts = Object.assign(CMC.counts || {}, Object.fromEntries(all.map(x => ['board:' + x.id, x.cm || 0]))); CMC.p = CMC.p || Promise.resolve(); draw(); };
    const lsk = 'pgn_bl_' + CFG.kind; let shown = false, fresh = false;
    try { const c = JSON.parse(localStorage.getItem(lsk) || 'null'); if (c && c.length) { useList(c); shown = true; } } catch (e) {}
    pgnStatic('board').then(j => { const it = j && j[CFG.kind]; if (!it || fresh) return; useList(it); shown = true; try { localStorage.setItem(lsk, JSON.stringify(it)); } catch (e) {} }).catch(() => {});
    pgnStatic('counts').then(j => { if (j && j.rx) { lk = j.rx; draw(); } }).catch(() => {});
    try { const r = await api('blist', { kind: CFG.kind }); fresh = true; useList(r.items); try { localStorage.setItem(lsk, JSON.stringify(r.items)); } catch (e) {} }
    catch (e) { if (!shown) $('#blist').innerHTML = '<div class="empty">목록을 불러오지 못했습니다.<br><small>' + esc(errOut(e)) + '</small></div>'; }
  }

  /* ---------- 사진 크게 보기 ---------- */
  function lightbox(ids, k) {
    const old = document.getElementById('blb'); if (old) old.remove();
    const m = document.createElement('div'); m.id = 'blb'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-label', '사진 크게 보기');
    const draw = () => { m.innerHTML = imgTag(ids[k], 1600, '') + '<button type="button" class="x" aria-label="닫기">×</button>' + (ids.length > 1 ? '<button type="button" class="p" aria-label="이전 사진">‹</button><button type="button" class="n" aria-label="다음 사진">›</button><div class="c">' + (k + 1) + ' / ' + ids.length + '</div>' : ''); };
    const close = () => { m.remove(); document.removeEventListener('keydown', key); };
    const key = e => { if (e.key === 'Escape') close(); else if (e.key === 'ArrowLeft' && ids.length > 1) { k = (k + ids.length - 1) % ids.length; draw(); } else if (e.key === 'ArrowRight' && ids.length > 1) { k = (k + 1) % ids.length; draw(); } };
    m.onclick = e => {
      if (e.target.closest('.p')) { k = (k + ids.length - 1) % ids.length; draw(); return; }
      if (e.target.closest('.n')) { k = (k + 1) % ids.length; draw(); return; }
      close();
    };
    let sx = null; m.addEventListener('touchstart', e => { sx = e.touches[0].clientX; }, { passive: true });
    m.addEventListener('touchend', e => { if (sx == null || ids.length < 2) return; const dx = e.changedTouches[0].clientX - sx; sx = null; if (Math.abs(dx) > 50) { k = (k + (dx < 0 ? 1 : ids.length - 1)) % ids.length; draw(); } });
    document.addEventListener('keydown', key);
    draw(); document.body.appendChild(m);
  }

  /* ---------- 글 보기 ---------- */
  async function showView(id) {
    bd.innerHTML = '<div class="loading">불러오는 중...</div>';
    /* 빠른 글 보기 (11/4): 홈페이지 data/bpost.json 에 있으면 바로 그림. 로그인 회원은 서버 값으로 내 글·신고 여부를 확인해 다르면 다시 그림 */
    let p = await pgnStatic('bpost').then(j => j && j[id]).catch(() => null);
    if (p && !guest) { const s0 = p; api('bget', { id }).then(r => { const q = r.item; if (q.mine || q.reported || isAdmin || q.status !== s0.status || q.edited !== s0.edited || q.title !== s0.title || q.text !== s0.text || JSON.stringify(q.blocks) !== JSON.stringify(s0.blocks)) viewWith(q, id); }).catch(() => {}); }
    if (!p) {
      try { p = (await api('bget', { id })).item; }
      catch (e) { bd.innerHTML = '<div class="empty">' + esc(errOut(e)) + '<br><br><a class="btn green" href="' + CFG.page + '">목록으로</a></div>'; return; }
    }
    viewWith(p, id);
  }
  function viewWith(p, id) {
    if (p.kind && p.kind !== CFG.kind && OTHER[p.kind]) { location.replace(OTHER[p.kind] + location.search); return; }   /* 다른 게시판 글이면 그 게시판으로 */
    document.title = p.title + ' - ' + CFG.name;
    const btns = [];
    if (p.mine) btns.push('<a class="btn green" href="' + CFG.page + '?edit=' + esc(p.id) + '">수정</a>');
    if (p.mine || isAdmin) btns.push('<button class="btn red" id="bdel">삭제</button>');
    if (!guest && !p.mine && !isAdmin && p.status === '정상') btns.push('<button class="btn gray" id="brep"' + (p.reported ? ' disabled' : '') + '>' + (p.reported ? '신고함' : '신고') + '</button>');
    if (isAdmin) btns.push('<button class="btn gray" id="bhide">' + (p.status === '숨김' ? '숨김 해제' : '숨기기') + '</button>');
    const bl = blocksOf(p), ids = bl.filter(b => b.i).map(b => b.i);
    const body = bl.map(b => b.i ? '<figure class="bimg">' + imgTag(b.i, 1280, ' data-k="' + ids.indexOf(b.i) + '"') + '</figure>'
      : b.f ? '<a class="bfile" href="' + DL(b.f) + '" rel="nofollow" title="내려받기">' + fic(b.n) + '<span class="ft"><b>' + esc(b.n || '첨부파일') + '</b><small>' + esc((extOf(b.n) || '파일').toUpperCase()) + ' · ' + fmtSize(b.s || 0) + '</small></span><em>내려받기</em></a>'
      : b.v ? '<div class="bvid"><div class="r169"><iframe src="https://drive.google.com/file/d/' + encodeURIComponent(b.v) + '/preview" allow="autoplay; fullscreen" allowfullscreen loading="lazy" title="' + esc(b.n || '동영상') + '"></iframe></div><div class="vcap">' + esc(b.n || '동영상') + ' · ' + fmtSize(b.s || 0) + '<br>영상이 바로 안 나오면 올린 직후라 Google 드라이브가 처리 중인 것입니다. 몇 분 뒤 다시 열어 주세요.</div></div>'
      : b.y ? '<div class="byt"><div class="r169"><iframe src="https://www.youtube-nocookie.com/embed/' + encodeURIComponent(b.y) + '?rel=0&playsinline=1" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowfullscreen loading="lazy" title="유튜브 영상"></iframe></div></div>'
      : '<div class="bbody">' + esc(b.t || '') + '</div>').join('');
    bd.innerHTML = '<h2 class="sec">' + esc(CFG.name) + '</h2><article class="card bpost">' + (TALK ? '<div class="tk-t" style="margin-bottom:6px"><span class="tk-tag">' + esc(p.cat || '자유') + '</span>' + (p.ev ? '<a class="tk-m" style="margin:0" href="' + CFG.page + '?ev=' + encodeURIComponent(p.ev) + '"><span class="tk-ev">' + esc(p.ev) + '</span></a>' : '') + '</div>' : '') + '<h1>' + esc(p.title) + (p.status === '숨김' ? ' <span class="tag hide">숨김</span>' : '') + '</h1>' +
      '<div class="bm">' + esc(p.nick) + ' · ' + esc(p.at) + (p.edited ? ' (수정 ' + esc(p.edited) + ')' : '') + (isAdmin && p.reports ? ' · 신고 ' + p.reports + '건' : '') + '</div>' +
      (p.status === '숨김' ? '<div class="msg warn">' + (p.mine ? '신고가 쌓여 다른 회원에게는 보이지 않는 글입니다. 운영자가 확인 중입니다.' : '신고가 쌓여 숨겨진 글입니다.') + '</div>' : '') +
      '<div class="bcont">' + body + '</div>' + (TALK ? '<div style="margin-top:18px"><button type="button" class="tk-like" id="tklike" aria-pressed="false">' + HEART + '좋아요 <b>0</b></button></div>' : '') + '<div id="bmsg"></div><div class="bar">' + btns.join('') + '<a class="btn gray" href="' + CFG.page + '">목록</a></div></article>' +
      '<section class="card comments" id="cm"><h3>댓글 <span id="ccount"></span></h3><div id="cbox"></div><div id="clist"><div class="loading">불러오는 중...</div></div></section>';
    bd.querySelector('.bcont').onclick = e => { const im = e.target.closest('figure.bimg img'); if (im) lightbox(ids, +im.dataset.k || 0); };
    const msg = $('#bmsg');
    if ($('#bdel')) $('#bdel').onclick = async () => { if (!confirm('이 글을 삭제할까요?' + (bl.some(b => b.i || b.f || b.v) ? '\n붙인 사진·파일·동영상도 함께 지워집니다.' : ''))) return; try { await api('bdelete', { id }); go(); } catch (e) { say(msg, errOut(e)); } };
    if ($('#brep')) $('#brep').onclick = async () => {
      if (!confirm('이 글을 신고할까요?\n선정적이거나 욕설·비방 등 운영 원칙에 어긋나는 글만 신고해 주세요.')) return;
      try { const r = await api('breport', { id }); say(msg, r.hidden ? '신고가 접수되어 글이 숨겨졌습니다. 운영자가 확인합니다.' : '신고를 접수했습니다. 감사합니다.', 'ok'); $('#brep').disabled = true; $('#brep').textContent = '신고함'; }
      catch (e) { say(msg, errOut(e)); }
    };
    if ($('#bhide')) $('#bhide').onclick = async () => { try { await api('bset', { id, status: p.status === '숨김' ? '정상' : '숨김' }); showView(id); } catch (e) { say(msg, errOut(e)); } };
    loadComments('board:' + id);
    if (TALK) {   /* 좋아요: 뉴스 반응과 같은 저장소(반응 탭, 기사ID talk:번호, 종류 like). 누르면 켜고, 다시 누르면 끔 */
      const lb = $('#tklike'), aid = 'talk:' + id;
      const paint = (c, mine) => { lb.querySelector('b').textContent = (c && c.like) || 0; lb.classList.toggle('on', mine === 'like'); lb.setAttribute('aria-pressed', mine === 'like'); };
      paint({ like: p.lk || 0 }, '');
      pgnStatic('counts').then(j => { if (j && j.rx && j.rx[aid]) paint(j.rx[aid], ''); }).catch(() => {});
      if (!guest) api('rlist', { aid }).then(r => paint((r.counts || {})[aid], (r.mine || {})[aid])).catch(() => {});
      lb.onclick = async () => {
        if (guest) { showLoginGate(false, CFG.page + '?id=' + id); return; }
        lb.disabled = true;
        try { const r = await api('react', { aid, kind: 'like' }); paint((r.counts || {})[aid], (r.mine || {})[aid]); } catch (e) { say(msg, errOut(e)); }
        lb.disabled = false;
      };
    }
  }

  async function loadComments(aid) {
    const nx = encodeURIComponent(CFG.page + '?id=' + aid.slice(6));
    $('#cbox').innerHTML = guest ? '<div class="cneed">댓글은 회원만 쓸 수 있습니다.<br><a class="btn green" href="login.html?next=' + nx + '">로그인</a><a class="btn green" href="signup.html?next=' + nx + '">회원가입</a></div>' : '<div class="cform"><textarea id="ctext" maxlength="1000" placeholder="댓글을 입력하세요 (1000자 이내, 욕설·선정적인 표현·링크는 올릴 수 없습니다)"></textarea><div class="bar"><small>' + esc(me.name) + '님으로 작성</small><button class="btn green" id="csend">댓글 등록</button></div><div id="cmsg"></div></div>';
    const draw = async () => {
      try {
        const r = await api('comments', { aid });
        $('#ccount').textContent = r.items.length ? '(' + r.items.length + ')' : '';
        $('#clist').innerHTML = r.items.length ? r.items.map(c => '<div class="citem"><div class="ch"><b>' + esc(c.nick) + '</b><span>' + esc(c.at) + '</span>' + (c.mine ? '<button data-id="' + esc(c.id) + '">삭제</button>' : '') + '</div><div class="ct">' + esc(c.text) + '</div></div>').join('') : '<div class="empty" style="padding:18px">첫 댓글을 남겨 보세요.</div>';
      } catch (e) { $('#clist').innerHTML = '<div class="empty" style="padding:18px">댓글을 불러오지 못했습니다.<br><small>' + esc(e.message) + '</small></div>'; }
    };
    await draw();
    $('#clist').onclick = async e => {
      const b = e.target.closest('button[data-id]'); if (!b || !confirm('이 댓글을 삭제할까요?')) return;
      try { await api('cdelete', { cid: b.dataset.id }); draw(); } catch (err) { alert(err.message); }
    };
    if (!guest) $('#csend').onclick = async () => {
      const send = $('#csend'), t = $('#ctext').value.trim(), m = $('#cmsg');
      if (!t) { say(m, '댓글 내용을 입력해 주세요.'); return; }
      send.disabled = true; send.textContent = '등록 중...'; m.innerHTML = '';
      try { await api('cpost', { aid, text: t }); $('#ctext').value = ''; await draw(); }
      catch (err) { say(m, errOut(err)); }
      send.disabled = false; send.textContent = '댓글 등록';
    };
  }

  /* ---------- 사진 줄이기: 긴 변 1280px, JPEG, 850KB 이하 ---------- */
  async function shrink(file) {
    if (!/^image\//.test(file.type || 'image/')) throw new Error('사진 파일만 올릴 수 있습니다.');
    if (file.size > 40 * 1024 * 1024) throw new Error('사진 파일이 너무 큽니다 (40MB 이하).');
    let src, w0, h0;
    try { src = await createImageBitmap(file, { imageOrientation: 'from-image' }); w0 = src.width; h0 = src.height; }
    catch (e) {
      src = await new Promise((res, rej) => { const u = URL.createObjectURL(file), im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error('이 사진은 열 수 없습니다. (JPG·PNG 사진을 골라 주세요)')); im.src = u; });
      w0 = src.naturalWidth; h0 = src.naturalHeight;
    }
    const s = Math.min(1, LONG / Math.max(w0, h0)), w = Math.max(1, Math.round(w0 * s)), h = Math.max(1, Math.round(h0 * s));
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.drawImage(src, 0, 0, w, h);
    for (const qq of [0.82, 0.72, 0.62, 0.5]) { const url = c.toDataURL('image/jpeg', qq); if (Math.floor((url.length - 23) * 3 / 4) <= MAXB) return url; }
    throw new Error('사진을 줄이지 못했습니다.');
  }

  /* ---------- 밴드식 편집기: 글 칸과 사진·파일·동영상·유튜브 칸을 차례로 쌓음 ---------- */
  function makeEditor(host, init, onChange) {
    const ed = document.createElement('div'); ed.className = 'bed'; host.appendChild(ed);
    let lastTa = null, lastPos = null;
    const queue = []; let busy = false;
    const autoH = ta => { ta.style.height = 'auto'; ta.style.height = Math.max(52, ta.scrollHeight + 2) + 'px'; };
    const mkTa = v => { const d = document.createElement('div'); d.className = 'bk txt'; const ta = document.createElement('textarea'); ta.className = 'bta'; ta.rows = 1; ta.value = v || ''; d.appendChild(ta); return d; };
    const mkBlk = o => { const d = document.createElement('div'); d.className = 'bk ' + (o.type === 'img' ? 'img' : 'med ' + o.type); d._o = o; o.node = d; paint(o); return d; };
    const isMed = d => d && !d.classList.contains('txt');
    const ctl = o => '<div class="ic"><button type="button" data-a="up" aria-label="위로 옮기기" title="위로">↑</button><button type="button" data-a="dn" aria-label="아래로 옮기기" title="아래로">↓</button>' + (o.state === 'err' && o.type !== 'yt' ? '<button type="button" data-a="re" aria-label="다시 올리기" title="다시 올리기">↻</button>' : '') + '<button type="button" data-a="x" aria-label="빼기" title="빼기">×</button></div>';
    function paint(o) {
      const d = o.node; if (!d) return;
      d.classList.toggle('err', o.state === 'err');
      const what = o.type === 'img' ? '사진' : o.type === 'vid' ? '동영상' : '파일';
      const st = o.state === 'up' ? what + ' 올리는 중...' + (o.pct != null ? ' ' + o.pct + '%' : '') : o.state === 'wait' ? '올릴 차례를 기다리는 중...' : o.state === 'err' ? (o.err || '올리지 못했습니다') + ' (↻ 다시 올리기)' : '';
      if (o.type === 'img') {
        d.innerHTML = '<img src="' + esc(o.src) + '" alt="첨부 사진 미리보기"' + (o.id && !o.local ? ' data-id="' + esc(o.id) + '" data-w="640" onerror="pgnImgErr(this)"' : '') + '><span class="no"></span>' + ctl(o) + (st ? '<div class="st">' + esc(st) + '</div>' : '');
      } else if (o.type === 'yt') {
        d.innerHTML = '<img class="pv" src="https://i.ytimg.com/vi/' + esc(o.y) + '/mqdefault.jpg" alt="">' + '<div class="mt"><b>' + YIC + ' 유튜브 영상</b><small>글 화면에서 바로 재생됩니다</small></div>' + ctl(o);
      } else {
        const pv = o.type === 'vid' ? (o.blob ? '<video class="pv" muted playsinline preload="metadata" src="' + o.blob + '#t=0.5"></video>' : '<span class="fic" style="background:#0b4d2c">' + VIC + '</span>') : fic(o.name);
        d.innerHTML = pv + '<div class="mt"><b>' + esc(o.name || '') + '</b><small>' + (o.type === 'vid' ? '동영상 · ' : '첨부파일 · ') + fmtSize(o.size || 0) + '</small>' + (st ? '<span class="st">' + esc(st) + '</span>' : '') + (o.state === 'up' && o.pct != null ? '<div class="bar2"><i style="width:' + o.pct + '%"></i></div>' : '') + '</div>' + ctl(o);
      }
      number();
    }
    function number() {
      let k = 0;
      [...ed.children].filter(isMed).forEach(d => { if (d.classList.contains('img')) { const n = d.querySelector('.no'); if (n) n.textContent = '사진 ' + (++k); } const u = d.querySelector('[data-a=up]'), dn = d.querySelector('[data-a=dn]'); if (u) u.disabled = !d.previousElementSibling; if (dn) dn.disabled = !d.nextElementSibling || (d.nextElementSibling.classList.contains('txt') && !d.nextElementSibling.nextElementSibling && !d.nextElementSibling.querySelector('textarea').value.trim()); });
    }
    function normalize() {
      let kids = [...ed.children];
      for (let i = kids.length - 1; i > 0; i--) {   /* 붙어 있는 글 칸은 하나로 */
        if (kids[i].classList.contains('txt') && kids[i - 1].classList.contains('txt')) {
          const a = kids[i - 1].querySelector('textarea'), b = kids[i].querySelector('textarea');
          a.value = [a.value.replace(/\s+$/, ''), b.value.replace(/^\s+/, '')].filter(Boolean).join('\n'); if (lastTa === b) { lastTa = a; lastPos = a.value.length; }
          kids[i].remove();
        }
      }
      kids = [...ed.children];
      if (!kids.length || !kids[kids.length - 1].classList.contains('txt')) ed.appendChild(mkTa(''));   /* 맨 끝에는 늘 글 칸 */
      const tas = [...ed.querySelectorAll('textarea.bta')];
      const add = MEDIA ? '[사진 추가]·[동영상 추가]·[파일 첨부]·[유튜브 링크]' : '[사진 추가]';
      tas.forEach((ta, i) => { ta.placeholder = i === 0 ? (CFG.kind === '칼럼' ? '칼럼 내용을 쓰세요. 아래 ' + add + '를 누르면 커서가 있는 자리에 들어갑니다.' : '내용을 쓰세요. 아래 ' + add + '를 누르면 커서가 있는 자리에 사진이 들어갑니다.') : '여기에 글을 이어서 쓸 수 있습니다'; autoH(ta); });
      number(); onChange && onChange();
    }
    /* 큰 파일·동영상: 서버가 발급한 Drive 이어올리기 주소로 8MB씩 직접 올림 */
    async function upBig(o) {
      const init = await api('bupinit', { type: o.type === 'vid' ? 'video' : 'file', name: o.name, size: o.file.size, mime: o.file.type || '', kind: CFG.kind });
      const size = o.file.size; let off = 0, res = null, tries = 0;
      while (off < size) {
        const end = Math.min(off + CHUNK, size);
        let r;
        try { r = await fetch(init.url, { method: 'PUT', headers: { 'Content-Range': 'bytes ' + off + '-' + (end - 1) + '/' + size }, body: o.file.slice(off, end) }); }
        catch (e) {   /* 연결이 끊기면 어디까지 올라갔는지 물어보고 이어서 */
          if (++tries > 4) throw new Error('연결이 끊겨 올리지 못했습니다.');
          await new Promise(z => setTimeout(z, 1500 * tries));
          try { const s = await fetch(init.url, { method: 'PUT', headers: { 'Content-Range': 'bytes */' + size } }); if (s.status === 308) { const rg = s.headers.get('Range'); off = rg ? +rg.split('-')[1] + 1 : 0; continue; } if (s.ok) { res = await s.json(); break; } } catch (e2) {}
          continue;
        }
        if (r.status === 308) { const rg = r.headers.get('Range'); off = rg ? +rg.split('-')[1] + 1 : end; o.pct = Math.round(off / size * 100); paint(o); continue; }
        if (r.ok) { res = await r.json(); break; }
        throw new Error('올리지 못했습니다. (' + r.status + ')');
      }
      if (!res || !res.id) throw new Error('올리지 못했습니다.');
      o.pct = 100; paint(o);
      const d = await api('bupdone', { id: res.id });
      o.id = d.id; o.name = d.name; o.size = d.size; o.file = null;
    }
    async function pump() {
      if (busy) return; busy = true;
      while (queue.length) {
        const o = queue.shift(); if (!o.node || !o.node.isConnected) continue;
        o.state = 'up'; o.pct = o.type === 'img' ? null : 0; paint(o);
        try {
          if (o.type === 'img') { const r = await api('bimg', { data: o.data }); o.id = r.id; o.data = null; }
          else await upBig(o);
          o.state = 'ok';
        } catch (e) { o.state = 'err'; o.err = e.message; }
        paint(o); onChange && onChange();
      }
      busy = false;
    }
    const all = () => [...ed.children].filter(isMed).map(d => d._o);
    const count = t => all().filter(o => !t || (t === 'vid' ? (o.type === 'vid' || o.type === 'yt') : o.type === t)).length;
    /* 커서가 있던 글 칸을 커서 자리에서 나누고 그 사이에 넣음 (커서가 없으면 맨 끝) */
    function place(objs) {
      const ta = lastTa && ed.contains(lastTa) ? lastTa : null;
      let ref;
      if (ta) {
        const pos = lastPos == null ? ta.value.length : lastPos, before = ta.value.slice(0, pos).replace(/\s+$/, ''), rest = ta.value.slice(pos).replace(/^\s*\n/, '');
        ta.value = before; ref = ta.parentNode;
        objs.forEach(o => { const n = mkBlk(o); ref.after(n); ref = n; });
        const nt = mkTa(rest); ref.after(nt); lastTa = nt.querySelector('textarea'); lastPos = 0;
        if (!before && ta.parentNode.previousElementSibling) ta.parentNode.remove();   /* 사이에 생긴 빈 글 칸은 정리 */
      } else {
        const last = ed.lastElementChild; ref = last && last.classList.contains('txt') && !last.querySelector('textarea').value.trim() ? last.previousElementSibling : ed.lastElementChild;
        objs.forEach(o => { const n = mkBlk(o); if (ref) ref.after(n); else ed.prepend(n); ref = n; });
      }
      normalize();
    }
    async function addFiles(files) {
      const room = PHOTO_MAX - count('img'); let list = [...files];
      if (!list.length) return '';
      let note = '';
      if (list.length > room) { note = '사진은 글 하나에 ' + PHOTO_MAX + '장까지 붙일 수 있어 ' + Math.max(0, room) + '장만 넣었습니다.'; list = list.slice(0, Math.max(0, room)); }
      const objs = [];
      for (const f of list) {
        try { const data = await shrink(f); objs.push({ type: 'img', src: data, data, local: true, state: 'wait' }); }
        catch (e) { note = (note ? note + ' ' : '') + (f.name ? f.name + ': ' : '') + e.message; }
      }
      if (!objs.length) return note;
      place(objs); objs.forEach(o => queue.push(o)); pump();
      return note;
    }
    function addBig(files, type) {
      const isV = type === 'vid', exts = isV ? VIDEO_EXT : FILE_EXT, max = isV ? VIDEO_MAX : FILE_MAX, lim = isV ? VIDEO_N : FILE_N;
      let room = lim - count(type), note = ''; const objs = [];
      for (const f of [...files]) {
        const e = extOf(f.name);
        if (!exts.includes(e)) { note += f.name + ': ' + (isV ? 'mp4, mov, m4v, webm 동영상만 올릴 수 있습니다. ' : '올릴 수 없는 파일 형식입니다. '); continue; }
        if (f.size > max) { note += f.name + ': ' + (isV ? '동영상은 ' + (max >> 20) + 'MB까지입니다. 더 큰 영상은 유튜브에 올린 뒤 [유튜브 링크]로 넣어 주세요. ' : '파일은 ' + (max >> 20) + 'MB까지입니다. '); continue; }
        if (room <= 0) { note += (isV ? '동영상(유튜브 포함)은 ' : '파일은 ') + '글 하나에 ' + lim + '개까지입니다. '; break; }
        room--; objs.push({ type, file: f, name: f.name, size: f.size, state: 'wait', blob: isV ? URL.createObjectURL(f) : '' });
      }
      if (objs.length) { place(objs); objs.forEach(o => queue.push(o)); pump(); }
      return note.trim();
    }
    function addYt(url) {
      const y = ytId(url); if (!y) return '유튜브 주소를 알아보지 못했습니다. (예: https://youtu.be/…, https://www.youtube.com/watch?v=…)';
      if (count('vid') >= VIDEO_N) return '동영상(유튜브 포함)은 글 하나에 ' + VIDEO_N + '개까지입니다.';
      place([{ type: 'yt', y, state: 'ok' }]); return '';
    }
    ed.addEventListener('input', e => { if (e.target.matches('textarea.bta')) { autoH(e.target); lastTa = e.target; lastPos = e.target.selectionStart; onChange && onChange(); } });
    const mark = e => { if (e.target.matches && e.target.matches('textarea.bta')) { lastTa = e.target; lastPos = e.target.selectionStart; } };
    ['focusin', 'click', 'keyup', 'select'].forEach(t => ed.addEventListener(t, mark));
    ed.addEventListener('focusout', mark);
    if (MEDIA) ed.addEventListener('paste', e => {   /* 유튜브 주소만 붙여 넣으면 바로 영상 칸으로 */
      const ta = e.target.closest && e.target.closest('textarea.bta'); if (!ta) return;
      const s = (e.clipboardData && e.clipboardData.getData('text') || '').trim();
      if (!/^\S+$/.test(s) || !ytId(s)) return;
      e.preventDefault(); lastTa = ta; lastPos = ta.selectionStart; const n = addYt(s); if (n) alert(n);
    });
    ed.addEventListener('click', e => {
      const b = e.target.closest('.ic button'); if (!b) return;
      const d = b.closest('.bk'), o = d._o, a = b.dataset.a;
      if (a === 'x') { if (o.state === 'ok' && !confirm('이 ' + (o.type === 'img' ? '사진' : o.type === 'file' ? '파일' : '동영상') + '을 글에서 뺄까요?')) return; d.remove(); }
      else if (a === 'up' && d.previousElementSibling) d.previousElementSibling.before(d);
      else if (a === 'dn' && d.nextElementSibling) d.nextElementSibling.after(d);
      else if (a === 're') { o.state = 'wait'; paint(o); queue.push(o); pump(); return; }
      normalize(); d.isConnected && d.scrollIntoView({ block: 'nearest' });
    });
    ed.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); host.closest('form') && host.closest('form').requestSubmit(); } });
    /* 처음 내용 */
    (init || []).forEach(b => {
      if (b.i) ed.appendChild(mkBlk({ type: 'img', id: b.i, src: IMGURL(b.i, 640), state: 'ok' }));
      else if (b.f) ed.appendChild(mkBlk({ type: 'file', id: b.f, name: b.n, size: b.s, state: 'ok' }));
      else if (b.v) ed.appendChild(mkBlk({ type: 'vid', id: b.v, name: b.n, size: b.s, state: 'ok' }));
      else if (b.y) ed.appendChild(mkBlk({ type: 'yt', y: b.y, state: 'ok' }));
      else ed.appendChild(mkTa(b.t || ''));
    });
    normalize();
    return {
      addFiles, addBig, addYt, count,
      text: () => [...ed.querySelectorAll('textarea.bta')].map(t => t.value.trim()).filter(Boolean).join('\n\n'),
      pending: () => all().some(o => o.state === 'up' || o.state === 'wait'),
      failed: () => all().some(o => o.state === 'err'),
      blocks: () => [...ed.children].map(d => { if (!isMed(d)) return { t: d.querySelector('textarea').value }; const o = d._o; return o.type === 'img' ? { i: o.id } : o.type === 'file' ? { f: o.id } : o.type === 'vid' ? { v: o.id } : { y: o.y }; }).filter(b => b.i || b.f || b.v || b.y || (b.t && b.t.trim())),
      focus: () => { const t = ed.querySelector('textarea.bta'); if (t) t.focus(); }
    };
  }

  /* ---------- 글쓰기 / 수정 ---------- */
  async function showForm(editId) {
    let old = null;
    if (editId) {
      bd.innerHTML = '<div class="loading">불러오는 중...</div>';
      try { old = (await api('bget', { id: editId })).item; if (!old.mine) throw new Error('본인이 쓴 글만 고칠 수 있습니다.'); }
      catch (e) { bd.innerHTML = '<div class="empty">' + esc(errOut(e)) + '<br><br><a class="btn green" href="' + CFG.page + '">목록으로</a></div>'; return; }
      if (old.kind && old.kind !== CFG.kind && OTHER[old.kind]) { location.replace(OTHER[old.kind] + location.search); return; }
    }
    if (NEED_OK && !isAdmin) {
      const st = await canWrite();
      if (!st.can) { document.title = '칼럼 쓰기 신청 - ' + CFG.name; bd.innerHTML = '<h2 class="sec">' + esc(CFG.name) + '</h2>' + RULES + '<div id="capw"></div><p style="text-align:center"><a href="' + CFG.page + '" style="color:var(--muted)">목록으로</a></p>'; applyBox($('#capw'), st); return; }
    }
    document.title = (editId ? '글 수정' : '글쓰기') + ' - ' + CFG.name;
    const mediaBtns = MEDIA ? '<button type="button" class="bphoto" id="bvd">' + VIC + '동영상 추가</button><input type="file" id="bvfile" accept="video/*,.mp4,.mov,.m4v,.webm" hidden>' +
      '<button type="button" class="bphoto" id="bat">' + FIC + '파일 첨부</button><input type="file" id="bafile" accept="' + FILE_EXT.map(e => '.' + e).join(',') + '" multiple hidden>' +
      '<button type="button" class="bphoto" id="byt">' + YIC + '유튜브 링크</button>' : '';
    const mediaHint = MEDIA ? '<span class="hint">동영상: mp4·mov·m4v·webm, 한 개 ' + (VIDEO_MAX >> 20) + 'MB까지(더 크면 유튜브에 올린 뒤 [유튜브 링크]), 동영상·유튜브 합쳐 글 하나에 ' + VIDEO_N + '개.<br>파일: pdf·hwp·hwpx·doc·docx·xls·xlsx·ppt·pptx·txt·csv·zip·jpg·png·gif, 한 개 ' + (FILE_MAX >> 20) + 'MB까지, 글 하나에 ' + FILE_N + '개. 실행 파일·웹페이지 파일 등은 올릴 수 없습니다.</span>' : '';
    bd.innerHTML = '<h2 class="sec">' + esc(CFG.name) + ' ' + (editId ? '글 수정' : '글쓰기') + '</h2>' + RULES +
      '<div class="card bpost"><form id="bf" autocomplete="off">' +
      (TALK ? '<div class="field"><span>분류</span><div class="tk-cats" id="tkcat">' + TCATS.map((c, i) => '<label><input type="radio" name="tkc" value="' + c + '"' + (i === 0 ? ' checked' : '') + '><span>' + c + '</span></label>').join('') + '</div></div>' +
        '<label class="field"><span>대회 이름 (선택)</span><input id="bev" maxlength="60" placeholder="관련 대회가 있으면 적어 주세요 (예: 제1회 순창 고추장배)"></label>' : '') +
      '<label class="field"><span>제목</span><input id="bt" maxlength="80" required placeholder="제목 (80자 이내)"></label>' +
      '<div class="field"><span>내용</span><div id="bedh"></div>' +
      '<div class="btools"><button type="button" class="bphoto" id="bph">' + CAM + '사진 추가</button><input type="file" id="bfile" accept="image/*" multiple hidden>' + mediaBtns + '<span class="cnt" id="bc"></span>' +
      '<span class="hint">사진은 한 글에 ' + PHOTO_MAX + '장까지, 자동으로 줄여서(긴 변 ' + LONG + 'px) 올라갑니다. ↑ ↓ 로 순서를 바꾸고 × 로 뺄 수 있습니다.</span>' + mediaHint + '</div>' +
      (MEDIA ? '<div class="ytrow" id="ytrow" hidden><input id="yturl" inputmode="url" placeholder="유튜브 주소를 붙여 넣으세요 (예: https://youtu.be/…)"><button type="button" class="btn green" id="ytok">넣기</button><button type="button" class="btn gray" id="ytx">취소</button></div>' : '') +
      '<div id="bpmsg"></div></div>' +
      '<div id="bmsg"></div><button class="btn green big" id="bgo" type="submit">' + (editId ? '수정 저장' : '등록') + '</button>' +
      '<p style="text-align:center;margin:10px 0 0"><a href="' + (editId ? CFG.page + '?id=' + esc(editId) : CFG.page) + '" style="color:var(--muted)">취소</a></p></form></div>';
    let dirty = false, E = null;
    const upd = () => {
      if (!E) return; const n = E.text().length, c = E.count('img');
      $('#bc').textContent = '글자 ' + n + ' / ' + TEXT_MAX + '자 · 사진 ' + c + ' / ' + PHOTO_MAX + '장' + (MEDIA ? ' · 동영상 ' + E.count('vid') + ' / ' + VIDEO_N + ' · 파일 ' + E.count('file') + ' / ' + FILE_N : '');
      $('#bph').disabled = c >= PHOTO_MAX; if (MEDIA) { $('#bvd').disabled = $('#byt').disabled = E.count('vid') >= VIDEO_N; $('#bat').disabled = E.count('file') >= FILE_N; }
    };
    E = makeEditor($('#bedh'), old ? blocksOf(old) : [{ t: '' }], () => { dirty = true; upd(); });
    dirty = false; upd();
    if (old) $('#bt').value = old.title;
    if (TALK && old) { const r0 = bd.querySelector('input[name=tkc][value="' + (old.cat || '자유') + '"]'); if (r0) r0.checked = true; $('#bev').value = old.ev || ''; }
    if (TALK && !old && q.get('ev')) $('#bev').value = q.get('ev');
    if (TALK) { $('#bev').oninput = () => { dirty = true; }; bd.querySelectorAll('input[name=tkc]').forEach(r => { r.onchange = () => { dirty = true; }; }); }
    $('#bt').oninput = () => { dirty = true; };
    $('#bph').onclick = () => $('#bfile').click();
    $('#bfile').onchange = async e => {
      const fs = e.target.files; if (!fs || !fs.length) return;
      const b = $('#bph'); b.disabled = true; say($('#bpmsg'), '');
      const note = await E.addFiles(fs); e.target.value = '';
      if (note) say($('#bpmsg'), note, 'warn');
      upd();
    };
    if (MEDIA) {
      $('#bvd').onclick = () => $('#bvfile').click();
      $('#bat').onclick = () => $('#bafile').click();
      $('#bvfile').onchange = e => { const n = E.addBig(e.target.files || [], 'vid'); e.target.value = ''; say($('#bpmsg'), n, 'warn'); upd(); };
      $('#bafile').onchange = e => { const n = E.addBig(e.target.files || [], 'file'); e.target.value = ''; say($('#bpmsg'), n, 'warn'); upd(); };
      $('#byt').onclick = () => { $('#ytrow').hidden = false; $('#yturl').focus(); };
      $('#ytx').onclick = () => { $('#ytrow').hidden = true; $('#yturl').value = ''; };
      const ytGo = () => { const n = E.addYt($('#yturl').value); say($('#bpmsg'), n, 'warn'); if (!n) { $('#ytrow').hidden = true; $('#yturl').value = ''; } upd(); };
      $('#ytok').onclick = ytGo; $('#yturl').onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); ytGo(); } };
    }
    addEventListener('beforeunload', ev => { if (dirty) { ev.preventDefault(); ev.returnValue = ''; } });
    $('#bf').onsubmit = async ev => {
      ev.preventDefault(); const b = $('#bgo'), m = $('#bmsg'); m.innerHTML = '';
      const tx = E.text();
      if (tx.length > TEXT_MAX) { say(m, '내용은 ' + TEXT_MAX + '자까지 쓸 수 있습니다. (지금 ' + tx.length + '자)'); return; }
      if (tx.length < 5 && !E.count() && !TALK) { say(m, '내용을 5자 이상 입력해 주세요.'); return; }
      b.disabled = true; b.textContent = '사진·파일 올리는 중...';
      for (let i = 0; E.pending() && i < 4000; i++) await new Promise(r => setTimeout(r, 300));
      if (E.failed()) { say(m, '올리지 못한 사진·파일·동영상이 있습니다. ↻ 로 다시 올리거나 × 로 빼 주세요.'); b.disabled = false; b.textContent = editId ? '수정 저장' : '등록'; return; }
      b.textContent = '확인 중...';
      try {
        const data = { title: $('#bt').value, text: tx, blocks: E.blocks(), kind: CFG.kind };
        if (TALK) { data.cat = (bd.querySelector('input[name=tkc]:checked') || {}).value || '자유'; data.ev = ($('#bev').value || '').trim(); }
        if (editId) { await api('bupdate', { id: editId, ...data }); dirty = false; go(); }
        else { await api('bpost', data); dirty = false; go(); }   /* 등록·수정 뒤에는 예전처럼 목록으로 */
        return;
      } catch (e) { say(m, errOut(e)); }
      b.disabled = false; b.textContent = editId ? '수정 저장' : '등록';
    };
  }

  if (q.get('id')) showView(q.get('id'));
  else if (q.get('edit')) showForm(q.get('edit'));
  else if (q.get('write')) showForm('');
  else showList();
})();
