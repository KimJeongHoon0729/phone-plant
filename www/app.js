// ===== 폰 키우기: 메인 로직 =====
// 흐름: 시작 → 폰을 엎으면 시간이 쌓이고 식물이 자람 → 목표 시간 도달하면 꽃 핌(성공)
//       중간에 폰을 들면 5초 안에 다시 엎어야 함, 못 하면 시듦(실패)

const GRACE_SECONDS = 5;      // 폰을 들었을 때 다시 엎을 때까지 기다려주는 시간
const $ = id => document.getElementById(id);

let goalMin = 30;
let session = null;  // 진행 중인 회차 정보
let faceDown = false;
let sensorWorks = false;
let tickTimer = null;

// ---------- 화면 전환 ----------
function show(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  $('screen-' + name).classList.add('active');
}

function goHome() {
  $('today-minutes').textContent = Store.todayMinutes();
  show('home');
}

// ---------- 목표 시간 선택 ----------
$('goals').addEventListener('click', e => {
  const btn = e.target.closest('button');
  if (!btn) return;
  document.querySelectorAll('#goals button').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  goalMin = Number(btn.dataset.min);
});

// ---------- 기울기 센서 ----------
// 폰이 화면을 바닥으로 향하면 beta 값이 ±180 근처가 돼요.
function onOrientation(e) {
  if (e.beta === null) return;
  sensorWorks = true;
  $('sim').classList.add('hidden');
  const b = Math.abs(e.beta), g = Math.abs(e.gamma || 0);
  // 살짝 흔들려도 상태가 왔다갔다 하지 않도록 기준을 두 개 둬요
  if (!faceDown && b > 150 && g < 35) setFaceDown(true);
  else if (faceDown && b < 130) setFaceDown(false);
}

async function startSensor() {
  // 아이폰은 버튼을 누른 순간에 권한을 물어봐야 해요
  if (typeof DeviceOrientationEvent !== 'undefined' &&
      typeof DeviceOrientationEvent.requestPermission === 'function') {
    try {
      const res = await DeviceOrientationEvent.requestPermission();
      if (res !== 'granted') {
        alert('동작 접근을 허용해야 폰을 엎었는지 알 수 있어요. 앱을 다시 열고 허용해 주세요.');
      }
    } catch (e) { /* 무시하고 테스트 모드로 */ }
  }
  window.addEventListener('deviceorientation', onOrientation);
  // 1.5초 동안 센서 값이 안 오면 (예: 컴퓨터) 테스트 모드 버튼을 보여줘요
  setTimeout(() => { if (!sensorWorks) $('sim').classList.remove('hidden'); }, 1500);
}

$('btn-sim').addEventListener('click', () => setFaceDown(!faceDown));

// ---------- 회차 진행 ----------
// session = { goalMs, grownMs, started, lastAt, graceUntil, hiddenAt, hiddenFaceDown }
function startSession() {
  session = {
    goalMs: goalMin * 60 * 1000,
    goalMin,
    grownMs: 0,          // 엎어져 있던 시간 합계
    started: faceDown,   // 처음 한 번 엎었는지 (이미 엎어져 있으면 바로 시작)
    lastAt: Date.now(),
    graceUntil: null,
  };
  Store.saveSession(session);
  show('grow');
  render();
  clearInterval(tickTimer);
  tickTimer = setInterval(tick, 250);
}

function setFaceDown(v) {
  faceDown = v;
  if (!session) return;
  tick(); // 상태가 바뀌기 직전까지의 시간을 먼저 정리해요
  if (v) {
    session.started = true;
    session.graceUntil = null;
  } else if (session.started) {
    session.graceUntil = Date.now() + GRACE_SECONDS * 1000;
    if (navigator.vibrate) navigator.vibrate(200);
  }
  Store.saveSession(session);
  render();
}

function tick() {
  if (!session) return;
  const now = Date.now();
  if (faceDown && session.started) session.grownMs += now - session.lastAt;
  session.lastAt = now;

  if (session.grownMs >= session.goalMs) return finish(true);
  if (session.graceUntil && now >= session.graceUntil) return finish(false);
  render();
}

function finish(success) {
  clearInterval(tickTimer);
  const minutes = Math.floor(Math.min(session.grownMs, session.goalMs) / 60000);
  Store.addResult(success ? session.goalMin : minutes, success);
  Store.clearSession();

  drawPlant($('plant-result'), session.grownMs / session.goalMs, !success);
  if (success) {
    $('result-title').textContent = '꽃이 피었어요! 🌸';
    $('result-text').textContent = `${session.goalMin}분 동안 폰을 내려놓았어요.`;
  } else {
    $('result-title').textContent = '식물이 시들었어요 🥀';
    $('result-text').textContent = `${minutes}분 버텼어요. 다음엔 끝까지 가봐요!`;
  }
  session = null;
  show('result');
}

function render() {
  if (!session) return;
  const p = session.grownMs / session.goalMs;
  drawPlant($('plant'), p, false);
  const remain = Math.max(0, session.goalMs - session.grownMs);
  const s = Math.ceil(remain / 1000);
  $('timer').textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  $('bar-fill').style.width = (p * 100).toFixed(1) + '%';

  if (!session.started) {
    $('grow-status').textContent = '폰을 화면이 바닥을 향하게 엎어주세요';
  } else if (faceDown) {
    $('grow-status').textContent = '자라는 중… 화면을 꺼도 괜찮아요 🌿';
  } else {
    $('grow-status').textContent = '폰을 들었어요!';
  }
  if (session.graceUntil) {
    const left = Math.max(0, Math.ceil((session.graceUntil - Date.now()) / 1000));
    $('grace').textContent = `${left}초 안에 다시 엎지 않으면 시들어요`;
    $('grace').classList.remove('hidden');
  } else {
    $('grace').classList.add('hidden');
  }
}

$('btn-start').addEventListener('click', async () => {
  await startSensor();
  startSession();
});
$('btn-giveup').addEventListener('click', () => {
  if (session && confirm('그만두면 식물이 시들어요. 그만둘까요?')) finish(false);
});

// ---------- 화면 꺼짐 / 다른 앱으로 이동 ----------
// 웹앱은 화면이 꺼지면 멈춰요. 그래서 꺼질 때 상태를 저장하고, 다시 켜질 때 계산해요.
// - 엎어둔 상태에서 꺼짐 → 꺼져 있던 시간도 자란 시간으로 쳐요
// - 들고 있던 상태에서 앱을 나감 → 시들어요
document.addEventListener('visibilitychange', () => {
  if (!session) return;
  if (document.hidden) {
    tick();
    session.hiddenAt = Date.now();
    session.hiddenFaceDown = faceDown && session.started;
    Store.saveSession(session);
  } else {
    resumeFromHidden();
  }
});

function resumeFromHidden() {
  if (!session || !session.hiddenAt) return;
  const away = Date.now() - session.hiddenAt;
  const wasDown = session.hiddenFaceDown;
  const wasStarted = session.started;
  session.hiddenAt = null;
  session.lastAt = Date.now();
  if (wasDown) {
    session.grownMs += away;
    if (session.grownMs >= session.goalMs) return finish(true);
    // 다시 켰다는 건 폰을 봤다는 뜻이라, 다시 엎을 시간을 줘요
    faceDown = false;
    session.graceUntil = Date.now() + GRACE_SECONDS * 1000;
  } else if (wasStarted) {
    return finish(false);
  }
  Store.saveSession(session);
  render();
}

// ---------- 기록 화면 ----------
function renderHistory() {
  const records = Store.load();
  const days = Object.keys(records).sort().reverse();
  const list = $('history-list');
  if (days.length === 0) {
    list.innerHTML = '<li class="empty">아직 기록이 없어요</li>';
    return;
  }
  list.innerHTML = days.map(d => {
    const r = records[d];
    return `<li><div style="text-align:left"><div>${d}</div>
      <div class="sub">성공 ${r.success}번 · 시듦 ${r.fail}번</div></div>
      <div class="min">${r.minutes}분</div></li>`;
  }).join('');
}
$('btn-history').addEventListener('click', () => { renderHistory(); show('history'); });
$('btn-back').addEventListener('click', goHome);
$('btn-reset').addEventListener('click', () => {
  if (confirm('모든 기록을 지울까요? 되돌릴 수 없어요.')) { Store.reset(); renderHistory(); }
});
$('btn-again').addEventListener('click', startSession);
$('btn-home').addEventListener('click', goHome);

// ---------- 앱 시작 ----------
// 앱이 완전히 꺼졌다 다시 열린 경우에도 진행 중이던 회차를 이어가요
(function init() {
  const saved = Store.loadSession();
  if (saved) {
    session = saved;
    goalMin = saved.goalMin;
    if (!session.hiddenAt) session.hiddenAt = session.lastAt;
    show('grow');
    window.addEventListener('deviceorientation', onOrientation);
    setTimeout(() => { if (!sensorWorks) $('sim').classList.remove('hidden'); }, 1500);
    tickTimer = setInterval(tick, 250);
    resumeFromHidden();
  } else {
    goHome();
  }
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
