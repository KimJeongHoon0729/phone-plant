// ===== 식물 그리기 =====
// growth: 0(씨앗) ~ 1(꽃 활짝)   wilt: 0(싱싱) ~ 1(완전히 시듦)
// 숫자가 조금씩 바뀌면 그림도 조금씩 바뀌어서, 서서히 자라고 서서히 시드는 것처럼 보여요.

const PlantColors = {
  stem: ['#8CC69A', '#B49A6A'],
  leaf: ['#A8DBAF', '#CDB487'],
  leafDark: ['#7FC08E', '#A88E60'],
  petal: ['#FFC2CF', '#C9A79C'],
  petal2: ['#F7A0B2', '#B48E82'],
  center: ['#FFD66E', '#A89060'],
};

function mixColor(a, b, t) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ch = (p, s) => (p >> s) & 255;
  const m = s => Math.round(ch(pa, s) + (ch(pb, s) - ch(pa, s)) * t);
  return `rgb(${m(16)},${m(8)},${m(0)})`;
}
const clamp01 = v => Math.max(0, Math.min(1, v));
const ease = t => 1 - Math.pow(1 - clamp01(t), 3); // 처음엔 빠르게, 끝엔 부드럽게

// 처음 한 번 틀(화분 + 흔들리는 그룹)을 만들어 두고, 이후엔 안쪽만 바꿔요.
// 그래야 살랑살랑 흔들리는 애니메이션이 끊기지 않아요.
function setupPlant(svg) {
  svg.setAttribute('viewBox', '0 0 200 240');
  svg.innerHTML = `
    <defs>
      <radialGradient id="${svg.id}-halo"><stop offset="0" stop-color="#FFE7A8" stop-opacity=".9"/><stop offset="1" stop-color="#FFE7A8" stop-opacity="0"/></radialGradient>
    </defs>
    <ellipse cx="100" cy="232" rx="62" ry="6" fill="#F1DDCF"/>
    <g class="halo-wrap"></g>
    <g class="sway"><g class="body"></g></g>
    <g class="pot">
      <path d="M58 188h84l-9 42H67z" fill="#F7C6B5"/>
      <rect x="52" y="178" width="96" height="16" rx="8" fill="#F29E8E"/>
      <ellipse cx="100" cy="181" rx="42" ry="4" fill="#8B6A55"/>
      <g class="face"></g>
    </g>`;
  svg._ready = true;
}

function drawPlant(svg, growth, wilt = 0, opts = {}) {
  if (!svg._ready) setupPlant(svg);
  const g = clamp01(growth), w = clamp01(wilt);
  const c = k => mixColor(PlantColors[k][0], PlantColors[k][1], w);
  const body = svg.querySelector('.body');
  let out = '';

  // ----- 씨앗 / 새싹 -----
  if (g < 0.04) {
    const s = 0.6 + g * 10;
    out += `<ellipse cx="100" cy="176" rx="${7 * s}" ry="${4.5 * s}" fill="#B98552"/>`;
    out += `<path d="M97 173q3-4 6 0" stroke="${c('stem')}" stroke-width="2" fill="none" opacity="${g * 25}"/>`;
  } else {
    // ----- 줄기 -----
    const H = 18 + ease((g - 0.04) / 0.96) * 112;  // 줄기 길이
    const baseX = 100, baseY = 180;
    const tipX = baseX + w * 0.55 * H;              // 시들면 옆으로 휘고
    const tipY = baseY - H * (1 - 0.55 * w);        // 아래로 처져요
    const cX = baseX + w * 0.1 * H, cY = baseY - H * 0.75;
    const pt = t => ({
      x: (1 - t) * (1 - t) * baseX + 2 * (1 - t) * t * cX + t * t * tipX,
      y: (1 - t) * (1 - t) * baseY + 2 * (1 - t) * t * cY + t * t * tipY,
    });
    out += `<path d="M${baseX} ${baseY} Q${cX} ${cY} ${tipX} ${tipY}" stroke="${c('stem')}" stroke-width="${3 + g * 3}" fill="none" stroke-linecap="round"/>`;

    // ----- 잎: 자라면서 하나씩 돋아나요 -----
    const slots = [0.22, 0.34, 0.47, 0.58, 0.7, 0.8];
    slots.forEach((t, i) => {
      const appear = 0.06 + i * 0.12;               // 이 잎이 나기 시작하는 시점
      const s = ease((g - appear) / 0.16);          // 0 → 1로 커져요
      if (s <= 0) return;
      // 시들면 위쪽 잎부터 떨어져요
      if (w > 0.75 && i >= slots.length - Math.round((w - 0.75) / 0.25 * 4)) return;
      const p = pt(t);
      const side = i % 2 === 0 ? -1 : 1;
      const size = (0.75 + 0.35 * (1 - t)) * s;
      const angle = -28 + w * 75;                   // 싱싱하면 위로, 시들면 축 처짐
      out += `<g transform="translate(${p.x} ${p.y}) scale(${side} 1) rotate(${angle}) scale(${size})">
        <path d="M0 0C10-14 32-16 46-4C34 8 12 10 0 0z" fill="${c('leaf')}"/>
        <path d="M2 0C16-4 28-6 40-4" stroke="${c('leafDark')}" stroke-width="1.6" fill="none" stroke-linecap="round"/>
      </g>`;
    });

    // ----- 꽃봉오리 → 꽃 -----
    const bud = ease((g - 0.72) / 0.2);
    const bloom = g >= 1 ? 1 : ease((g - 0.92) / 0.08);
    const headRot = w * 110;                         // 시들면 고개를 푹 숙여요
    if (bud > 0) {
      out += `<g transform="translate(${tipX} ${tipY}) rotate(${headRot})">`;
      if (bloom <= 0) {
        out += `<ellipse cx="0" cy="-${4 * bud}" rx="${5 * bud}" ry="${8 * bud}" fill="${c('petal2')}"/>`;
        out += `<path d="M-${5 * bud} 0q${5 * bud} 6 ${10 * bud} 0" fill="${c('leaf')}"/>`;
      } else {
        out += flowerSVG(bloom, w, c, opts.pop ? 'pop' : '');
      }
      out += `</g>`;
    }
    // 다 자라면 옆에 작은 꽃 두 송이가 더 피어요
    if (g >= 1) {
      [[0.58, -1], [0.7, 1]].forEach(([t, side], k) => {
        const p = pt(t);
        const x = p.x + side * 34, y = p.y - 16 + w * 30;
        out += `<path d="M${p.x} ${p.y}Q${p.x + side * 18} ${p.y - 18 + w * 20} ${x} ${y}" stroke="${c('stem')}" stroke-width="3" fill="none" stroke-linecap="round"/>`;
        out += `<g transform="translate(${x} ${y}) rotate(${w * 90 * side}) scale(.55)">${flowerSVG(1, w, c, opts.pop ? 'pop pop-' + (k + 1) : '')}</g>`;
      });
    }
  }
  body.innerHTML = out;

  // 다 자랐을 때 뒤에서 은은하게 빛나는 후광
  svg.querySelector('.halo-wrap').innerHTML = g >= 1 && w < 0.3
    ? `<circle class="halo" cx="100" cy="70" r="80" fill="url(#${svg.id}-halo)"/>` : '';

  // 흔들림: 싱싱할 때만
  svg.querySelector('.sway').classList.toggle('still', w > 0.05 || g < 0.04);
  drawFace(svg.querySelector('.face'), w, g, opts);
}

function flowerSVG(bloom, w, c, cls) {
  const n = 8, r = 6 + 12 * bloom;
  const lost = Math.round(clamp01((w - 0.5) / 0.5) * 6); // 많이 시들면 꽃잎이 떨어져요
  let s = `<g class="${cls}">`;
  for (let k = 0; k < n - lost; k++) {
    const a = (k / n) * 360;
    s += `<ellipse cx="0" cy="${-r}" rx="${r * 0.55}" ry="${r * 0.95}" fill="${k % 2 ? c('petal') : c('petal2')}" transform="rotate(${a})"/>`;
  }
  s += `<circle r="${r * 0.55}" fill="${c('center')}"/>`;
  s += `<circle r="${r * 0.25}" cx="-${r * 0.15}" cy="-${r * 0.15}" fill="#fff" opacity="${0.5 * (1 - w)}"/>`;
  return s + '</g>';
}

// 화분 얼굴: 싱싱하면 웃고, 시들수록 울상이 돼요
function drawFace(el, w, g, opts) {
  let f = '';
  const eyeY = 205;
  if (opts.dead) {
    f += `<path d="M80 ${eyeY - 3}l6 6M86 ${eyeY - 3}l-6 6M114 ${eyeY - 3}l6 6M120 ${eyeY - 3}l-6 6" stroke="#5B4A42" stroke-width="2.4" stroke-linecap="round"/>`;
  } else if (w < 0.15 && g >= 1) {
    // 다 자라면 행복한 눈 ^ ^
    f += `<path d="M78 ${eyeY + 2}q5-6 10 0M112 ${eyeY + 2}q5-6 10 0" stroke="#5B4A42" stroke-width="2.6" fill="none" stroke-linecap="round"/>`;
  } else {
    f += `<circle cx="83" cy="${eyeY}" r="3" fill="#5B4A42"/><circle cx="117" cy="${eyeY}" r="3" fill="#5B4A42"/>`;
    f += `<circle cx="82" cy="${eyeY - 1}" r="1" fill="#fff"/><circle cx="116" cy="${eyeY - 1}" r="1" fill="#fff"/>`;
    if (w > 0.15) { // 걱정하는 눈썹
      const t = Math.min(1, w * 1.5) * 5;
      f += `<path d="M77 ${eyeY - 7}l10 ${-t}M123 ${eyeY - 7}l-10 ${-t}" stroke="#5B4A42" stroke-width="2" stroke-linecap="round"/>`;
    }
  }
  // 입: 웃음(+) → 일자 → 울상(-)
  const curve = 6 - w * 13;
  f += `<path d="M93 ${216 - Math.max(0, -curve) / 2}q7 ${curve} 14 0" stroke="#5B4A42" stroke-width="2.4" fill="none" stroke-linecap="round"/>`;
  // 볼터치
  f += `<ellipse cx="72" cy="${eyeY + 9}" rx="6" ry="3.5" fill="#F29E8E" opacity="${0.55 * (1 - w)}"/><ellipse cx="128" cy="${eyeY + 9}" rx="6" ry="3.5" fill="#F29E8E" opacity="${0.55 * (1 - w)}"/>`;
  // 식은땀 / 눈물
  if (w > 0.35 && !opts.dead) f += `<path d="M128 194q4 7 0 10q-4-3 0-10z" fill="#9CCDEB" opacity="${Math.min(1, (w - 0.35) * 3)}"/>`;
  el.innerHTML = f;
}

// 시들 때 잎이 한 장씩 팔랑팔랑 떨어지는 효과
function dropLeaf(container) {
  const d = document.createElement('div');
  d.className = 'falling-leaf';
  d.style.left = (35 + Math.random() * 30) + '%';
  d.style.top = (25 + Math.random() * 25) + '%';
  d.style.setProperty('--drift', (Math.random() * 60 - 30) + 'px');
  d.innerHTML = `<svg viewBox="0 0 46 20" width="26"><path d="M0 10C10-4 32-6 46 6C34 18 12 20 0 10z" fill="#CDB487"/></svg>`;
  container.appendChild(d);
  setTimeout(() => d.remove(), 2200);
}

// 꽃이 활짝 필 때 꽃잎 꽃가루가 화면에 흩날리는 효과
function celebrate(container) {
  const colors = ['#FFC2CF', '#F7A0B2', '#FFD66E', '#A8DBAF', '#FBD9CF'];
  for (let i = 0; i < 36; i++) {
    const d = document.createElement('div');
    d.className = 'confetti';
    d.style.left = Math.random() * 100 + '%';
    d.style.background = colors[i % colors.length];
    d.style.animationDelay = (Math.random() * 0.8) + 's';
    d.style.animationDuration = (2.2 + Math.random() * 1.6) + 's';
    d.style.setProperty('--drift', (Math.random() * 120 - 60) + 'px');
    d.style.setProperty('--spin', (Math.random() * 720 - 360) + 'deg');
    container.appendChild(d);
    setTimeout(() => d.remove(), 5000);
  }
}
