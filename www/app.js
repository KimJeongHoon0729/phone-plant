// ===== 폰 키우기: 메인 로직 =====
// 흐름: 시작 → 폰을 엎으면 시간이 쌓이고 식물이 자람 → 목표 시간 도달하면 꽃 핌(성공)
//       중간에 폰을 들면 5초 안에 다시 엎어야 함, 못 하면 시듦(실패)

const GRACE_SECONDS = 5;          // 폰을 들었을 때 다시 엎을 때까지 기다려주는 시간
const RETURN_GRACE_SECONDS = 10;  // 꺼진 화면을 다시 켰을 때 (잠금 해제 시간 포함)
const $ = id => document.getElementById(id);

let goalMin = 30;
let session = null;  // 진행 중인 회차 정보
let faceDown = false;
let sensorWorks = false;
let tickTimer = null;
let wakeLock = null;

// 화면에 보이는 식물 상태 (실제 값을 부드럽게 따라가요 → 애니메이션처럼 보임)
const shown = { g: 0, w: 0 };
const target = { g: 0, w: 0 };
let lastLeafDrop = 0;

// ---------- 화면 켜둠 유지 ----------
// 웹앱은 화면이 꺼지면 센서와 타이머가 멈춰요. 그래서 키우는 동안은 화면이 자동으로
// 꺼지지 않게 하고, 대신 엎어두면 화면을 까맣게 바꿔서 배터리를 아껴요.
async function keepAwake() {
  try {
    if ('wakeLock' in navigator && !wakeLock && document.visibilityState === 'visible') {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    }
  } catch (e) { /* 지원하지 않는 기기면 그냥 넘어가요 */ }
}
function releaseAwake() {
  if (wakeLock) { wakeLock.release().catch(() => {}); wakeLock = null; }
}

// ---------- 화면 전환 ----------
function show(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  $('screen-' + name).classList.add('active');
}

function goHome() {
  $('today-minutes').textContent = Store.todayMinutes();
  drawPlant($('plant-home'), 0.5, 0);
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
  shown.g = target.g = 0; shown.w = target.w = 0;
  show('grow');
  keepAwake();
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
    session.graceStart = Date.now();
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
  releaseAwake();
  $('dim').classList.add('hidden');
  const minutes = Math.floor(Math.min(session.grownMs, session.goalMs) / 60000);
  Store.addResult(success ? session.goalMin : minutes, success);
  Store.clearSession();

  const resultSvg = $('plant-result');
  resultSvg._ready = false;  // 새로 그려서 꽃 피는 애니메이션이 처음부터 나오게
  $('screen-result').classList.toggle('bloom', success);
  if (success) {
    drawPlant(resultSvg, 1, 0, { pop: true });
    setTimeout(() => celebrate($('fx')), 300);
    if (navigator.vibrate) navigator.vibrate([80, 60, 80]);
  } else {
    drawPlant(resultSvg, Math.max(shown.g, 0.3), 1, { dead: true });
  }
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
  target.g = p;
  // 폰을 든 동안: 남은 시간이 줄어들수록 점점 시들어요
  target.w = session.graceUntil
    ? clamp01((Date.now() - (session.graceStart || Date.now())) / (session.graceUntil - (session.graceStart || Date.now() - 1))) * 0.95
    : 0;
  // 엎어져 있는 동안은 화면을 까맣게 (OLED 화면 배터리 절약)
  $('dim').classList.toggle('hidden', !(faceDown && session.started));
  const remain = Math.max(0, session.goalMs - session.grownMs);
  const s = Math.ceil(remain / 1000);
  $('timer').textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  $('bar-fill').style.width = (p * 100).toFixed(1) + '%';

  if (!session.started) {
    $('grow-status').textContent = '화면은 끄지 말고 그대로 엎어주세요. 엎으면 화면이 알아서 까매져요';
  } else if (faceDown) {
    $('grow-status').textContent = '자라는 중… 🌿';
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

// ---------- 식물 애니메이션 ----------
// 1초에 60번 정도, 보이는 식물을 실제 상태 쪽으로 조금씩 움직여요
function animate(now) {
  if (session && $('screen-grow').classList.contains('active')) {
    shown.g += (target.g - shown.g) * 0.06;
    shown.w += (target.w - shown.w) * (target.w > shown.w ? 0.12 : 0.05);
    drawPlant($('plant'), shown.g, shown.w);
    // 많이 시들면 잎이 한 장씩 떨어져요
    if (shown.w > 0.3 && shown.g > 0.15 && now - lastLeafDrop > 700) {
      lastLeafDrop = now;
      dropLeaf($('grow-stage'));
    }
  }
  requestAnimationFrame(animate);
}
requestAnimationFrame(animate);

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
    keepAwake();
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
    session.graceStart = Date.now();
    session.graceUntil = Date.now() + RETURN_GRACE_SECONDS * 1000;
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
    keepAwake();
    resumeFromHidden();
  } else {
    goHome();
  }
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
