/* ═══════════════════════════════════════════════════════════════
   Wellbeing Index — behaviour
   Backend: FastAPI at https://mental-health-score-prediction-1-kqwt.onrender.com, POST /predict
   ═══════════════════════════════════════════════════════════════ */

const API_BASE = 'https://mental-health-score-prediction-1-kqwt.onrender.com';

const $  = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

const form      = $('#scoreForm');
const submitBtn = $('#submitBtn');
const btnLabel  = submitBtn.querySelector('.btn__label');

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ───────────────────────────────────────────────────────────────
   1 · Slider readouts + track fill
   ─────────────────────────────────────────────────────────────── */

function paintSlider(input) {
  const min = parseFloat(input.min) || 0;
  const max = parseFloat(input.max) || 100;
  const val = parseFloat(input.value) || 0;
  input.style.setProperty('--pct', `${((val - min) / (max - min)) * 100}%`);
}

const OUTPUT_FOR = {
  avg_daily_usage_hours:   'out_usage',
  daily_unlocks:           'out_unlocks',
  study_hours:             'out_study',
  physical_activity_hours: 'out_move',
  sleep_hours_per_night:   'out_sleep',
};

function syncReadouts() {
  $$('.rng').forEach((input) => {
    paintSlider(input);
    const out = document.getElementById(OUTPUT_FOR[input.id]);
    if (!out) return;
    out.textContent = input.dataset.unit
      ? `${parseFloat(input.value)} ${input.dataset.unit}`
      : input.value;
  });
}

/* ───────────────────────────────────────────────────────────────
   2 · Day split bar
   ─────────────────────────────────────────────────────────────── */

const HOURS = () => ({
  screen: parseFloat($('#avg_daily_usage_hours').value) || 0,
  study:  parseFloat($('#study_hours').value) || 0,
  move:   parseFloat($('#physical_activity_hours').value) || 0,
  sleep:  parseFloat($('#sleep_hours_per_night').value) || 0,
});

function paintSplit() {
  const h = HOURS();
  const used = h.screen + h.study + h.move + h.sleep;
  const rest = Math.max(0, 24 - used);
  const denom = Math.max(24, used);

  const widths = { ...h, rest };
  for (const [key, value] of Object.entries(widths)) {
    const seg = document.querySelector(`.split__seg[data-seg="${key}"]`);
    if (seg) seg.style.width = `${(value / denom) * 100}%`;
    const tag = document.querySelector(`[data-key="${key}"]`);
    if (tag) tag.textContent = `${Math.round(value * 10) / 10}h`;
  }

  const over = used > 24;
  $('#splitTotal').textContent = over
    ? `${Math.round(used * 10) / 10} h entered`
    : `${Math.round(rest * 10) / 10} h unspent`;

  const warn = $('#splitWarn');
  warn.hidden = !over;
  if (over) {
    warn.textContent =
      `Your hours total ${Math.round(used * 10) / 10} — more than a day holds. ` +
      `The model will still score it, but the result may not mean much.`;
  }
}

/* ───────────────────────────────────────────────────────────────
   3 · Radar chart — balance profile
   Each axis is normalised 0–1 from the user's own inputs.
   ─────────────────────────────────────────────────────────────── */

const RADAR = {
  cx: 150, cy: 130, r: 84,
  axes: ['Screen', 'Study', 'Movement', 'Sleep', 'Calm'],
};

const STRESS_SCORE = { 'Low': 1, 'Medium': 0.66, 'High': 0.33, 'Very High': 0.1 };

function profile() {
  const h = HOURS();
  const stress = (document.querySelector('input[name="stress_level"]:checked') || {}).value;

  return [
    clamp01(1 - h.screen / 12),              // less screen time scores higher
    clamp01(h.study / 6),                    // 6h of study is a full score
    clamp01(h.move / 3),                     // 3h of movement is a full score
    clamp01(1 - Math.abs(h.sleep - 8) / 8),  // closest to 8h scores highest
    STRESS_SCORE[stress] ?? 0.5,
  ];
}

function clamp01(n) { return Math.max(0, Math.min(1, n)); }

function pointAt(index, value) {
  const angle = (Math.PI * 2 * index) / RADAR.axes.length - Math.PI / 2;
  return [
    RADAR.cx + Math.cos(angle) * RADAR.r * value,
    RADAR.cy + Math.sin(angle) * RADAR.r * value,
  ];
}

function buildRadarGrid() {
  const grid = $('#radarGrid');
  const labels = $('#radarLabels');
  grid.innerHTML = '';
  labels.innerHTML = '';

  // concentric rings
  [0.25, 0.5, 0.75, 1].forEach((ring) => {
    const pts = RADAR.axes
      .map((_, i) => pointAt(i, ring).map((n) => n.toFixed(1)).join(','))
      .join(' ');
    const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    poly.setAttribute('points', pts);
    poly.setAttribute('class', 'radar__ring');
    grid.appendChild(poly);
  });

  // spokes + labels
  RADAR.axes.forEach((name, i) => {
    const [x, y] = pointAt(i, 1);

    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', RADAR.cx);
    line.setAttribute('y1', RADAR.cy);
    line.setAttribute('x2', x);
    line.setAttribute('y2', y);
    line.setAttribute('class', 'radar__spoke');
    grid.appendChild(line);

    const [lx, ly] = pointAt(i, 1.19);
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', lx);
    text.setAttribute('y', ly);
    text.setAttribute('class', 'radar__label');
    text.setAttribute('text-anchor', anchorFor(lx));
    text.setAttribute('dominant-baseline', 'middle');
    text.textContent = name;
    labels.appendChild(text);

    const [vx, vy] = pointAt(i, 1.19);
    const val = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    val.setAttribute('x', vx);
    val.setAttribute('y', vy + 13);
    val.setAttribute('class', 'radar__val');
    val.setAttribute('text-anchor', anchorFor(vx));
    val.setAttribute('dominant-baseline', 'middle');
    val.setAttribute('data-axis', String(i));
    labels.appendChild(val);
  });
}

function anchorFor(x) {
  if (x > RADAR.cx + 12) return 'start';
  if (x < RADAR.cx - 12) return 'end';
  return 'middle';
}

function paintRadar() {
  const values = profile();

  $('#radarShape').setAttribute(
    'points',
    values.map((v, i) => pointAt(i, Math.max(v, 0.04)).map((n) => n.toFixed(1)).join(',')).join(' ')
  );

  const dots = $('#radarDots');
  dots.innerHTML = '';
  values.forEach((v, i) => {
    const [x, y] = pointAt(i, Math.max(v, 0.04));
    const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    c.setAttribute('cx', x);
    c.setAttribute('cy', y);
    c.setAttribute('r', 3.6);
    c.setAttribute('class', 'radar__dot');
    dots.appendChild(c);

    const tag = document.querySelector(`.radar__val[data-axis="${i}"]`);
    if (tag) tag.textContent = `${Math.round(v * 100)}%`;
  });
}

/* ───────────────────────────────────────────────────────────────
   4 · Gauge
   Arc path length ≈ 415 (270° sweep, r = 88)
   ─────────────────────────────────────────────────────────────── */

/* Semicircle: centre (120, 150), r = 88 → length = π·88 ≈ 276.5 */
const ARC_LEN = 277;
const ARC = { cx: 120, cy: 150, r: 88 };

function paintGauge(score) {
  const frac = clamp01((score - 1) / 9);
  $('#gaugeFill').style.strokeDashoffset = String(ARC_LEN * (1 - frac));

  // θ sweeps π → 0 as the score climbs, tracing left to right over the top.
  const theta = Math.PI * (1 - frac);
  const knob = $('#gaugeKnob');
  knob.setAttribute('cx', ARC.cx + Math.cos(theta) * ARC.r);
  knob.setAttribute('cy', ARC.cy - Math.sin(theta) * ARC.r);
  knob.classList.remove('is-off');
}

function resetGauge() {
  $('#gaugeFill').style.strokeDashoffset = String(ARC_LEN);
  $('#gaugeKnob').classList.add('is-off');
}

function countTo(target) {
  const el = $('#scoreValue');
  if (reduceMotion) { el.textContent = target.toFixed(2); return; }

  const start = performance.now();
  const dur = 1100;

  function frame(now) {
    const t = Math.min(1, (now - start) / dur);
    const eased = 1 - Math.pow(1 - t, 3);
    el.textContent = (target * eased).toFixed(2);
    if (t < 1) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

/* ───────────────────────────────────────────────────────────────
   5 · Verdict bands
   ─────────────────────────────────────────────────────────────── */

const BANDS = [
  { max: 4,    cls: 'band--low',  label: 'Under strain',
    text: 'The model reads this as a demanding day. Sleep and time away from the screen are usually the two levers that move most.' },
  { max: 6,    cls: 'band--mid',  label: 'Mixed',
    text: 'Parts of this day are working, parts are not. Compare the balance profile against where you want your hours to go.' },
  { max: 8,    cls: 'band--good', label: 'Holding up',
    text: 'A reasonably balanced day by the model’s reckoning. These habits are worth keeping steady.' },
  { max: 99,   cls: 'band--high', label: 'Doing well',
    text: 'Sleep, study, movement and screen time sit in a balance the model associates with feeling well.' },
];

function showVerdict(score) {
  const band = BANDS.find((b) => score < b.max);
  const el = $('#verdictBand');
  el.textContent = band.label;
  el.className = `verdict__band ${band.cls}`;
  $('#verdictText').textContent = band.text;
  $('#verdict').hidden = false;
}

/* ───────────────────────────────────────────────────────────────
   6 · Panel state
   ─────────────────────────────────────────────────────────────── */

function setBusy(busy) {
  submitBtn.disabled = busy;
  submitBtn.classList.toggle('is-busy', busy);
  btnLabel.textContent = busy ? 'Calculating…' : 'Calculate my score';
  if (busy) {
    $('#scoreValue').textContent = '…';
    $('#scoreDen').textContent = 'asking the model';
  }
}

function hideAlert() { $('#alertBox').hidden = true; }

function showAlert(title, body, items) {
  $('#alertTitle').textContent = title;
  $('#alertBody').textContent = body;

  const list = $('#alertList');
  list.innerHTML = '';
  if (items && items.length) {
    items.forEach((t) => {
      const li = document.createElement('li');
      li.textContent = t;
      list.appendChild(li);
    });
    list.hidden = false;
  } else {
    list.hidden = true;
  }

  $('#alertBox').hidden = false;
  $('#scoreValue').textContent = '\u2014';
  $('#scoreDen').textContent = 'no score yet';
  $('#verdict').hidden = true;
  resetGauge();
}

/* ───────────────────────────────────────────────────────────────
   7 · Form reading + validation
   ─────────────────────────────────────────────────────────────── */

function readForm() {
  return {
    age:                     parseInt($('#age').value, 10),
    gender:                  $('#gender').value,
    country:                 $('#country').value.trim(),
    academic_level:          $('#academic_level').value,
    most_used_platform:      $('#most_used_platform').value,
    purpose_of_use:          $('#purpose_of_use').value,
    avg_daily_usage_hours:   parseFloat($('#avg_daily_usage_hours').value),
    daily_unlocks:           parseInt($('#daily_unlocks').value, 10),
    study_hours:             parseFloat($('#study_hours').value),
    physical_activity_hours: parseFloat($('#physical_activity_hours').value),
    sleep_hours_per_night:   parseFloat($('#sleep_hours_per_night').value),
    stress_level:            (document.querySelector('input[name="stress_level"]:checked') || {}).value,
  };
}

function validate(p) {
  const bad = {};
  if (!Number.isFinite(p.age) || p.age < 10 || p.age > 100) bad.age = 'Enter an age between 10 and 100.';
  if (!p.country) bad.country = 'Enter a country.';
  if (!p.stress_level) bad.stress_level = 'Pick a stress level.';
  return bad;
}

function clearErrors() {
  $$('.field').forEach((f) => f.classList.remove('is-bad'));
  $$('.err').forEach((e) => { e.textContent = ''; });
}

function showErrors(bad) {
  for (const [name, msg] of Object.entries(bad)) {
    const slot = document.querySelector(`[data-err="${name}"]`);
    if (!slot) continue;
    slot.textContent = msg;
    slot.closest('.field')?.classList.add('is-bad');
  }
  document.querySelector('.field.is-bad')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

/* FastAPI 422 → {detail: [{loc, msg}, …]} */
function readValidationDetail(detail) {
  if (!Array.isArray(detail)) return [];
  return detail.map((d) => {
    const field = Array.isArray(d.loc) ? d.loc.filter((x) => x !== 'body').join('.') : '';
    return `${field || 'request'} — ${d.msg}`;
  });
}

/* ───────────────────────────────────────────────────────────────
   8 · Server health badge
   ─────────────────────────────────────────────────────────────── */

async function pingServer() {
  const badge = $('#navStatus');
  const text  = $('#navStatusText');
  try {
    const r = await fetch(`${API_BASE}/`, { method: 'GET' });
    if (!r.ok) throw new Error();
    badge.classList.add('is-up');
    badge.classList.remove('is-down');
    text.textContent = 'Model online';
  } catch {
    badge.classList.add('is-down');
    badge.classList.remove('is-up');
    text.textContent = 'Server offline';
  }
}

/* ───────────────────────────────────────────────────────────────
   9 · Submit
   ─────────────────────────────────────────────────────────────── */

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearErrors();
  hideAlert();

  const payload = readForm();
  const bad = validate(payload);

  if (Object.keys(bad).length) {
    showErrors(bad);
    showAlert('Check these fields', 'A few values need fixing first.', Object.values(bad));
    return;
  }

  setBusy(true);
  $('#scoreIdle').hidden = true;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);

  try {
    const res = await fetch(`${API_BASE}/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: ctrl.signal,
    });

    clearTimeout(timer);

    let data = null;
    try { data = await res.json(); } catch { /* non-JSON */ }

    if (!res.ok) {
      if (res.status === 422) {
        showAlert('The server rejected these values',
                  'Some fields did not match what the model expects.',
                  readValidationDetail(data?.detail));
      } else {
        showAlert('Couldn’t get a score',
                  typeof data?.detail === 'string' ? data.detail : `Server replied ${res.status}.`);
      }
      return;
    }

    const score = data?.predicted_mental_health_score;
    if (typeof score !== 'number' || Number.isNaN(score)) {
      showAlert('Unexpected reply',
                'The server answered without a score. Check the uvicorn terminal for the real error.');
      return;
    }

    $('#scoreDen').textContent = 'out of 10';
    $('#scoreChip').hidden = false;
    countTo(score);
    paintGauge(score);
    showVerdict(score);

  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') {
      showAlert('Request timed out',
                'The server took longer than 15 seconds. It may still be loading the model.');
    } else {
      showAlert('Can’t reach the server',
                `No response from ${API_BASE}. Start it with:  python -m uvicorn main:app --reload --port 2200`);
    }
    pingServer();
  } finally {
    setBusy(false);
  }
});

/* ───────────────────────────────────────────────────────────────
   10 · Wiring
   ─────────────────────────────────────────────────────────────── */

$$('.rng').forEach((input) => {
  input.addEventListener('input', () => {
    syncReadouts();
    paintSplit();
    paintRadar();
  });
});

$$('input[name="stress_level"]').forEach((r) =>
  r.addEventListener('change', paintRadar)
);

$('#resetBtn').addEventListener('click', () => {
  form.reset();
  clearErrors();
  hideAlert();
  syncReadouts();
  paintSplit();
  paintRadar();

  $('#scoreValue').textContent = '\u2014';
  $('#scoreDen').textContent = 'out of 10';
  $('#verdict').hidden = true;
  $('#scoreChip').hidden = true;
  $('#scoreIdle').hidden = false;
  resetGauge();
});

/* start */
buildRadarGrid();
syncReadouts();
paintSplit();
paintRadar();
pingServer();