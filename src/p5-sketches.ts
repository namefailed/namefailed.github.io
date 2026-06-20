/** Built-in p5.js example sketches — global-mode strings executed inside a sandboxed iframe. */

export interface P5Example {
  label: string
  code: string
}

/**
 * Stable filename for a sketch label — used both for the dropdown's display
 * and to seed `/home/namefailed/p5.js/` in the VFS. Slug rules: lowercase,
 * non-alphanumerics become single hyphens, no leading/trailing hyphens.
 */
export function sketchFilename(label: string): string {
  const slug = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `${slug}.js`
}

/** All built-in sketches. Seeded into `~/p5.js/` in the VFS on first visit. */
export const P5_EXAMPLES: P5Example[] = [
  {
    label: 'Flow Field',
    code: `
const PARTICLE_COUNT = 800;
const SCALE = 20;
const SPEED = 2;
let particles = [];
let cols, rows;
let t = 0;

function setup() {
  createCanvas(windowWidth, windowHeight);
  colorMode(HSB, 360, 100, 100, 100);
  cols = floor(width / SCALE) + 1;
  rows = floor(height / SCALE) + 1;
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    particles.push({ x: random(width), y: random(height), prev: null });
  }
  background(240, 20, 10);
}

function draw() {
  fill(240, 20, 10, 8);
  noStroke();
  rect(0, 0, width, height);

  for (let p of particles) {
    const col = floor(p.x / SCALE);
    const row = floor(p.y / SCALE);
    const idx = col + row * cols;
    const angle = noise(col * 0.12, row * 0.12, t) * TWO_PI * 2;
    const vx = cos(angle) * SPEED;
    const vy = sin(angle) * SPEED;

    const hue = (degrees(angle) + t * 40) % 360;
    stroke(hue, 70, 95, 60);
    strokeWeight(1.2);
    if (p.prev) line(p.prev.x, p.prev.y, p.x, p.y);

    p.prev = { x: p.x, y: p.y };
    p.x += vx;
    p.y += vy;

    if (p.x < 0 || p.x > width || p.y < 0 || p.y > height) {
      p.x = random(width);
      p.y = random(height);
      p.prev = null;
    }
  }
  t += 0.004;
}

function windowResized() { resizeCanvas(windowWidth, windowHeight); background(240, 20, 10); }
`,
  },

  {
    label: 'Lissajous',
    code: `
let t = 0;
let trail = [];
const MAX_TRAIL = 2000;

function setup() {
  createCanvas(windowWidth, windowHeight);
  colorMode(HSB, 360, 100, 100, 100);
  background(0, 0, 8);
}

function draw() {
  background(0, 0, 8, 18);

  const a = 3, b = 4, delta = t * 0.3;
  const r = min(width, height) * 0.42;
  const cx = width / 2, cy = height / 2;

  const x = cx + r * sin(a * t + delta);
  const y = cy + r * sin(b * t);
  trail.push({ x, y, hue: (t * 30) % 360 });
  if (trail.length > MAX_TRAIL) trail.shift();

  noFill();
  for (let i = 1; i < trail.length; i++) {
    const alpha = map(i, 0, trail.length, 0, 90);
    stroke(trail[i].hue, 80, 95, alpha);
    strokeWeight(map(i, 0, trail.length, 0.5, 2));
    line(trail[i-1].x, trail[i-1].y, trail[i].x, trail[i].y);
  }

  fill((t * 30) % 360, 60, 100, 80);
  noStroke();
  ellipse(x, y, 6, 6);

  t += 0.018;
}

function windowResized() { resizeCanvas(windowWidth, windowHeight); trail = []; background(0, 0, 8); }
`,
  },

  {
    label: 'Game of Life',
    code: `
const CELL = 10;
let grid, next;
let cols, rows;
let gen = 0;
const INTERVAL = 6;
let frame = 0;

function setup() {
  createCanvas(windowWidth, windowHeight);
  init();
  textFont('monospace');
  textSize(10);
}

function init() {
  cols = floor(width / CELL);
  rows = floor(height / CELL);
  grid = Array.from({ length: cols }, () =>
    Array.from({ length: rows }, () => (random() < 0.3 ? 1 : 0))
  );
  next = Array.from({ length: cols }, () => new Array(rows).fill(0));
  gen = 0;
  frame = 0;
}

function draw() {
  background(30, 30, 46);

  for (let x = 0; x < cols; x++) {
    for (let y = 0; y < rows; y++) {
      if (grid[x][y]) {
        fill(137, 220, 235);
        noStroke();
        rect(x * CELL + 1, y * CELL + 1, CELL - 2, CELL - 2, 2);
      }
    }
  }

  if (frame % INTERVAL === 0) step();
  frame++;

  fill(166, 173, 200, 180);
  noStroke();
  text('gen ' + gen + '  |  click to reset', 10, height - 8);
}

function step() {
  for (let x = 0; x < cols; x++) {
    for (let y = 0; y < rows; y++) {
      let n = 0;
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          if (dx === 0 && dy === 0) continue;
          const nx = (x + dx + cols) % cols;
          const ny = (y + dy + rows) % rows;
          n += grid[nx][ny];
        }
      }
      next[x][y] = grid[x][y]
        ? (n === 2 || n === 3 ? 1 : 0)
        : (n === 3 ? 1 : 0);
    }
  }
  [grid, next] = [next, grid];
  gen++;
}

function mousePressed() { init(); }

function windowResized() { resizeCanvas(windowWidth, windowHeight); init(); }
`,
  },

  {
    label: 'Fractal Tree',
    code: `
let angle;
let windOffset = 0;

function setup() {
  createCanvas(windowWidth, windowHeight);
  colorMode(HSB, 360, 100, 100, 100);
  angleMode(RADIANS);
}

function draw() {
  background(240, 20, 10);
  windOffset += 0.008;

  translate(width / 2, height);
  branch(height * 0.22, 0);
}

function branch(len, depth) {
  const wind = noise(windOffset + depth * 0.3) * 0.6 - 0.3;
  const hue = map(len, 0, height * 0.22, 25, 120);
  const sat = map(len, 0, height * 0.22, 60, 20);
  const bright = map(len, 0, height * 0.22, 60, 95);
  const w = map(len, 0, height * 0.22, 0.5, 6);

  stroke(hue, sat, bright, 90);
  strokeWeight(w);
  line(0, 0, 0, -len);
  translate(0, -len);

  if (len < 5) return;

  const nextLen = len * 0.68;
  const spread = map(len, 0, height * 0.22, 0.2, 0.55) + wind;

  push(); rotate(-spread); branch(nextLen, depth + 1); pop();
  push(); rotate( spread); branch(nextLen, depth + 1); pop();
}

function windowResized() { resizeCanvas(windowWidth, windowHeight); }
`,
  },

  {
    label: 'Plasma',
    code: `
let t = 0;

function setup() {
  createCanvas(windowWidth, windowHeight);
  colorMode(HSB, 360, 100, 100);
  pixelDensity(1);
  noSmooth();
}

function draw() {
  loadPixels();
  const w = width, h = height;
  const d = pixelDensity();

  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      const nx = x / w * 4;
      const ny = y / h * 4;
      const v =
        sin(nx * 2 + t) +
        sin(ny * 2 + t * 0.7) +
        sin((nx + ny) * 1.5 + t * 1.3) +
        sin(sqrt(nx * nx + ny * ny + 1) * 2 - t);

      const hue = ((v * 45 + 180) + t * 20) % 360;
      const idx = 4 * (x + y * w);
      const [r, g, b] = hsvToRgb(hue / 360, 0.8, 0.95);
      pixels[idx]     = r;
      pixels[idx + 1] = g;
      pixels[idx + 2] = b;
      pixels[idx + 3] = 255;
    }
  }
  updatePixels();
  t += 0.03;
}

function hsvToRgb(h, s, v) {
  const i = floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const tv = v * (1 - (1 - f) * s);
  const mod = i % 6;
  const r = [v, q, p, p, tv, v][mod];
  const g = [tv, v, v, q, p, p][mod];
  const b = [p, p, tv, v, v, q][mod];
  return [r * 255, g * 255, b * 255];
}

function windowResized() { resizeCanvas(windowWidth, windowHeight); }
`,
  },

  {
    label: 'Bouncing Balls',
    code: `
const COUNT = 60;
const GRAVITY = 0.18;
let balls = [];

function setup() {
  createCanvas(windowWidth, windowHeight);
  colorMode(HSB, 360, 100, 100, 100);
  for (let i = 0; i < COUNT; i++) spawn();
}

function spawn() {
  const r = random(8, 26);
  balls.push({
    x: random(r, width - r),
    y: random(r, height * 0.4),
    vx: random(-3, 3),
    vy: random(-2, 2),
    r,
    hue: random(360),
  });
}

function draw() {
  background(240, 25, 8, 30);
  noStroke();

  for (const b of balls) {
    b.vy += GRAVITY;
    b.x += b.vx;
    b.y += b.vy;

    if (b.x < b.r) { b.x = b.r; b.vx *= -0.92; }
    if (b.x > width - b.r) { b.x = width - b.r; b.vx *= -0.92; }
    if (b.y > height - b.r) {
      b.y = height - b.r;
      b.vy *= -0.85;
      b.vx *= 0.98;
    }

    fill(b.hue, 70, 95, 80);
    circle(b.x, b.y, b.r * 2);
    fill(0, 0, 100, 30);
    circle(b.x - b.r * 0.3, b.y - b.r * 0.3, b.r * 0.5);
  }
}

function mousePressed() {
  for (let i = 0; i < 5; i++) {
    balls.push({
      x: mouseX, y: mouseY,
      vx: random(-6, 6), vy: random(-9, -3),
      r: random(8, 22), hue: random(360),
    });
  }
  if (balls.length > 200) balls.splice(0, balls.length - 200);
}

function windowResized() { resizeCanvas(windowWidth, windowHeight); }
`,
  },

  {
    label: 'Mandelbrot',
    code: `
let cx = -0.5, cy = 0;
let zoom = 1;
const MAX_ITER = 80;

function setup() {
  createCanvas(windowWidth, windowHeight);
  colorMode(HSB, 360, 100, 100);
  pixelDensity(1);
  noSmooth();
  render();
  textFont('monospace');
  textSize(11);
}

function render() {
  loadPixels();
  const w = width, h = height;
  const aspect = w / h;
  const span = 3 / zoom;

  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      const x0 = cx + (px / w - 0.5) * span * aspect;
      const y0 = cy + (py / h - 0.5) * span;
      let x = 0, y = 0, iter = 0;
      while (x * x + y * y <= 4 && iter < MAX_ITER) {
        const xt = x * x - y * y + x0;
        y = 2 * x * y + y0;
        x = xt;
        iter++;
      }
      const idx = 4 * (px + py * w);
      if (iter === MAX_ITER) {
        pixels[idx] = pixels[idx + 1] = pixels[idx + 2] = 10;
      } else {
        const t = iter / MAX_ITER;
        const [r, g, b] = hsv(((t * 360 + 220) % 360) / 360, 0.85, 0.95);
        pixels[idx] = r;
        pixels[idx + 1] = g;
        pixels[idx + 2] = b;
      }
      pixels[idx + 3] = 255;
    }
  }
  updatePixels();
}

function draw() {
  // static — render() is invoked on click + resize only
  fill(0, 0, 100, 75);
  noStroke();
  rect(0, height - 22, 280, 22);
  fill(0, 0, 0);
  text('click = zoom in  ·  right-click = zoom out', 10, height - 7);
}

function mousePressed() {
  const aspect = width / height;
  const span = 3 / zoom;
  cx += (mouseX / width - 0.5) * span * aspect;
  cy += (mouseY / height - 0.5) * span;
  zoom *= (mouseButton === RIGHT) ? 0.5 : 2;
  render();
  return false;
}

function hsv(h, s, v) {
  const i = floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const tv = v * (1 - (1 - f) * s);
  const m = i % 6;
  const r = [v, q, p, p, tv, v][m];
  const g = [tv, v, v, q, p, p][m];
  const b = [p, p, tv, v, v, q][m];
  return [r * 255, g * 255, b * 255];
}

function windowResized() { resizeCanvas(windowWidth, windowHeight); render(); }
`,
  },

  {
    label: 'Noise Terrain',
    code: `
const COLS = 80, ROWS = 60;
let cellW, cellH;
let scrollY = 0;

function setup() {
  createCanvas(windowWidth, windowHeight, WEBGL);
  colorMode(HSB, 360, 100, 100, 100);
  recalcCells();
  noStroke();
}

function recalcCells() {
  cellW = width / COLS;
  cellH = height / ROWS;
}

function draw() {
  background(240, 25, 10);
  rotateX(PI / 3);
  translate(-width / 2, -height / 2, 0);
  scrollY += 0.015;

  for (let y = 0; y < ROWS - 1; y++) {
    beginShape(TRIANGLE_STRIP);
    for (let x = 0; x < COLS; x++) {
      const e1 = elevation(x, y);
      const e2 = elevation(x, y + 1);
      const hueA = map(e1, -100, 100, 200, 30);
      const hueB = map(e2, -100, 100, 200, 30);
      fill(hueA, 55, 90);
      vertex(x * cellW, y * cellH, e1);
      fill(hueB, 55, 90);
      vertex(x * cellW, (y + 1) * cellH, e2);
    }
    endShape();
  }
}

function elevation(x, y) {
  return map(noise(x * 0.12, y * 0.12 + scrollY), 0, 1, -100, 100);
}

function windowResized() { resizeCanvas(windowWidth, windowHeight); recalcCells(); }
`,
  },

  {
    label: 'Spirograph',
    code: `
let t = 0;
let R = 200, r = 60, d = 100;

function setup() {
  createCanvas(windowWidth, windowHeight);
  colorMode(HSB, 360, 100, 100, 100);
  background(240, 25, 8);
}

function draw() {
  translate(width / 2, height / 2);
  background(240, 25, 8, 6);

  // Slow drift in parameters for a hypnotic effect
  R = 180 + sin(t * 0.07) * 60;
  r = 50 + cos(t * 0.05) * 30;
  d = 80 + sin(t * 0.03) * 40;

  const k = r / R;
  const steps = 600;
  noFill();
  for (let i = 0; i < steps; i++) {
    const u = (i / steps) * TWO_PI + t * 0.02;
    const x = (R - r) * cos(u) + d * cos(((R - r) / r) * u);
    const y = (R - r) * sin(u) - d * sin(((R - r) / r) * u);
    const hue = ((i / steps) * 360 + t * 20) % 360;
    stroke(hue, 75, 95, 70);
    strokeWeight(1.4);
    point(x, y);
  }

  t += 1;
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  background(240, 25, 8);
}
`,
  },
]
