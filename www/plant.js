// 식물 그림을 그리는 코드예요. progress는 0(씨앗) ~ 1(꽃 핌) 사이 숫자예요.
// withered가 true면 시든 모습으로 그려요.
function drawPlant(svg, progress, withered) {
  const p = Math.max(0, Math.min(1, progress));
  const stem = withered ? '#8a7a4a' : '#4caf6a';
  const leaf = withered ? '#9c8a52' : '#6fd08c';
  const petal = withered ? '#7a6a5a' : '#ffb3c7';
  const center = withered ? '#6a5a3a' : '#ffd25e';

  // 줄기 높이: 진행률에 따라 0 ~ 120
  const h = p < 0.1 ? 0 : 20 + (p - 0.1) / 0.9 * 100;
  const topY = 180 - h;
  // 시들면 줄기 끝이 옆으로 휘어요
  const bend = withered ? 40 : 0;
  const tipX = 100 + bend;
  const tipY = withered ? topY + 30 : topY;

  let out = '';
  // 화분
  out += '<path d="M55 185 h90 l-10 45 h-70 z" fill="#c0714a"/>';
  out += '<rect x="50" y="178" width="100" height="12" rx="4" fill="#d6875c"/>';
  out += '<ellipse cx="100" cy="182" rx="44" ry="5" fill="#5a3a26"/>';

  if (p < 0.1) {
    // 씨앗
    out += `<ellipse cx="100" cy="178" rx="8" ry="5" fill="${withered ? '#6a5a3a' : '#a0703a'}"/>`;
  } else {
    out += `<path d="M100 180 Q${100 + bend / 3} ${(180 + tipY) / 2} ${tipX} ${tipY}" stroke="${stem}" stroke-width="5" fill="none" stroke-linecap="round"/>`;
    // 잎: 진행률이 올라갈수록 개수가 늘어요
    const leaves = p < 0.3 ? 1 : p < 0.55 ? 2 : 4;
    for (let i = 0; i < leaves; i++) {
      const t = (i + 1) / (leaves + 1);
      const y = 180 - h * t + (withered ? 10 * t : 0);
      const x = 100 + (bend / 3) * t;
      const side = i % 2 === 0 ? -1 : 1;
      const droop = withered ? 25 : -10;
      out += `<path d="M${x} ${y} q${side * 22} ${droop - 12} ${side * 38} ${droop}
               q${-side * 20} 12 ${-side * 38} ${-droop}z" fill="${leaf}"/>`;
    }
    // 꽃: 80% 이상부터 봉오리, 100%면 활짝
    if (p >= 0.8) {
      const r = p >= 1 ? 16 : 8;
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2;
        out += `<circle cx="${tipX + Math.cos(a) * r}" cy="${tipY + Math.sin(a) * r}" r="${r * 0.75}" fill="${petal}"/>`;
      }
      out += `<circle cx="${tipX}" cy="${tipY}" r="${r * 0.6}" fill="${center}"/>`;
    }
  }
  svg.innerHTML = out;
}
