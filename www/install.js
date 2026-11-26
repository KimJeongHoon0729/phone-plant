// ===== 홈 화면에 추가 안내 =====
// - 안드로이드 크롬: "추가" 버튼을 누르면 바로 설치 창이 떠요.
// - 아이폰 사파리: 자동 설치는 안 돼서, 공유 버튼 → 홈 화면에 추가 방법을 알려줘요.
// - 카카오톡 등 앱 안 브라우저: 설치가 안 돼서, 일반 브라우저로 열도록 안내해요.
// - 이미 홈 화면에서 열었으면 안 보여요. "닫기"를 누르면 3일 동안 안 보여요.
(function () {
  const box = document.getElementById('install');
  const desc = document.getElementById('install-desc');
  const btn = document.getElementById('btn-install');
  const KEY = 'phonePlant.installDismissed';
  const ua = navigator.userAgent;

  const installed = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  if (installed) return;
  try {
    const t = Number(localStorage.getItem(KEY));
    if (t && Date.now() - t < 3 * 24 * 3600 * 1000) return;
  } catch (e) {}

  const isIOS = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isKakao = /KAKAOTALK/i.test(ua);
  const isInApp = isKakao || /Instagram|FBAN|FBAV|NAVER|Line\//i.test(ua);
  const isMobile = isIOS || /Android/i.test(ua);
  let deferred = null;

  function open() {
    // 홈 화면에서만 보여줘요 (키우는 중에는 방해하지 않게)
    if (document.getElementById('screen-home').classList.contains('active')) {
      box.classList.remove('hidden');
      document.body.classList.add('has-install');
    }
  }
  function close(remember) {
    box.classList.add('hidden');
    document.body.classList.remove('has-install');
    if (remember) try { localStorage.setItem(KEY, String(Date.now())); } catch (e) {}
  }

  document.getElementById('btn-install-close').addEventListener('click', () => close(true));

  if (isInApp) {
    desc.textContent = '이 화면에선 설치가 안 돼요. 브라우저로 열어주세요';
    btn.textContent = '열기';
    btn.addEventListener('click', () => {
      if (isKakao) location.href = 'kakaotalk://web/openExternal?url=' + encodeURIComponent(location.href);
      else if (/Android/i.test(ua)) location.href = 'intent://' + location.href.replace(/^https?:\/\//, '') + '#Intent;scheme=https;package=com.android.chrome;end';
      else alert('오른쪽 아래(또는 위) 메뉴에서 "Safari로 열기"를 눌러주세요.');
    });
    setTimeout(open, 800);
  } else if (isIOS) {
    desc.innerHTML = '아래 <svg class="ios-share" viewBox="0 0 14 16"><path d="M7 1v9M3.5 4.5L7 1l3.5 3.5M2 7v8h10V7" stroke="#5B9BF2" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg> 공유 버튼 → "홈 화면에 추가"';
    btn.classList.add('hidden');
    setTimeout(open, 800);
  } else {
    // 안드로이드 크롬 등: 브라우저가 설치 가능하다고 알려주면 버튼을 보여줘요
    window.addEventListener('beforeinstallprompt', e => {
      e.preventDefault();
      deferred = e;
      desc.textContent = '앱처럼 바로 열 수 있어요';
      btn.classList.remove('hidden');
      open();
    });
    btn.addEventListener('click', async () => {
      if (!deferred) return;
      deferred.prompt();
      const { outcome } = await deferred.userChoice;
      deferred = null;
      close(outcome !== 'accepted');
    });
    // 크롬인데 설치 창을 못 띄우는 경우(삼성 인터넷 일부 등)는 메뉴 안내
    if (isMobile) setTimeout(() => {
      if (!deferred && box.classList.contains('hidden')) {
        desc.textContent = '브라우저 메뉴(⋮)에서 "홈 화면에 추가"를 눌러주세요';
        btn.classList.add('hidden');
        open();
      }
    }, 4000);
  }
  window.addEventListener('appinstalled', () => close(true));

  // 시작 버튼을 누르면 안내를 숨겨요
  document.getElementById('btn-start').addEventListener('click', () => box.classList.add('hidden'));
})();
