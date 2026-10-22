import gsap from "gsap";
import { Mesh, Program, Renderer, Triangle } from "ogl";

export const MAX_BALLS = 10;

export interface BallSpec {
  /** 0..1 amber flicker for "needs you". */
  alert: number;
  color: [number, number, number];
  id: string;
  /** Target radius in scene units (center ball is ~0.5). */
  radius: number;
}

interface Ball extends BallSpec {
  leaving: boolean;
  orbit: number;
  phase: number;
  speed: number;
  tilt: number;
  x: number;
  y: number;
  z: number;
}

const vertex = /* glsl */ `#version 300 es
  in vec2 position;
  in vec2 uv;
  out vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 0.0, 1.0);
  }
`;

const fragment = /* glsl */ `#version 300 es
  precision highp float;
  uniform float uTime;
  uniform vec2 uResolution;
  uniform int uCount;
  uniform vec4 uBalls[${MAX_BALLS}];
  uniform vec4 uColors[${MAX_BALLS}]; // rgb, alert
  uniform float uEnergy;
  in vec2 vUv;
  out vec4 fragColor;

  float smin(float a, float b, float k) {
    float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
    return mix(b, a, h) - k * h * (1.0 - h);
  }

  float sdf(vec3 p) {
    float d = 1e5;
    for (int i = 0; i < ${MAX_BALLS}; i++) {
      if (i >= uCount) break;
      vec4 b = uBalls[i];
      if (b.w < 0.001) continue;
      float wob = sin(p.y * 6.0 + uTime * 1.6 + float(i)) * 0.012 * (1.0 + uEnergy * 3.0);
      d = smin(d, length(p - b.xyz) - b.w + wob, 0.32);
    }
    return d;
  }

  vec3 normalAt(vec3 p) {
    vec2 e = vec2(0.002, 0.0);
    return normalize(vec3(sdf(p + e.xyy) - sdf(p - e.xyy), sdf(p + e.yxy) - sdf(p - e.yxy), sdf(p + e.yyx) - sdf(p - e.yyx)));
  }

  vec4 colorAt(vec3 p) {
    vec3 acc = vec3(0.0);
    float wsum = 0.0;
    float alert = 0.0;
    for (int i = 0; i < ${MAX_BALLS}; i++) {
      if (i >= uCount) break;
      vec4 b = uBalls[i];
      if (b.w < 0.001) continue;
      float w = 1.0 / pow(max(length(p - b.xyz) - b.w * 0.5, 0.02), 3.0);
      acc += uColors[i].rgb * w;
      alert = max(alert, uColors[i].a * w);
      wsum += w;
    }
    return vec4(acc / max(wsum, 1e-4), clamp(alert / max(wsum, 1e-4), 0.0, 1.0));
  }

  void main() {
    vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution) / uResolution.y;
    vec3 ro = vec3(0.0, 0.0, 3.2);
    vec3 rd = normalize(vec3(uv, -1.6));
    float t = 0.0;
    float hit = 0.0;
    for (int i = 0; i < 72; i++) {
      vec3 p = ro + rd * t;
      float d = sdf(p);
      if (d < 0.001) { hit = 1.0; break; }
      t += d;
      if (t > 6.0) break;
    }
    if (hit < 0.5) {
      fragColor = vec4(0.0);
      return;
    }
    vec3 p = ro + rd * t;
    vec3 n = normalAt(p);
    vec4 c = colorAt(p);
    vec3 base = c.rgb;
    float pulse = 0.5 + 0.5 * sin(uTime * 6.0);
    base = mix(base, vec3(1.0, 0.68, 0.25), c.a * (0.5 + 0.5 * pulse));

    vec3 l = normalize(vec3(-0.5, 0.8, 0.7));
    float diff = clamp(dot(n, l), 0.0, 1.0);
    float fres = pow(1.0 - clamp(dot(n, -rd), 0.0, 1.0), 2.5);
    vec3 h = normalize(l - rd);
    float spec = pow(clamp(dot(n, h), 0.0, 1.0), 60.0);
    // Thin-film iridescence on the rim.
    vec3 film = 0.5 + 0.5 * cos(6.2831 * (fres * 1.3 + vec3(0.0, 0.33, 0.67)) + uTime * 0.3);

    vec3 col = base * (0.55 + 0.6 * diff);
    col = mix(col, film, fres * 0.55);
    col += spec * 0.7;
    fragColor = vec4(col, 1.0);
  }
`;

export class PulseBlob {
  private readonly renderer: Renderer;
  private readonly mesh: Mesh;
  private balls: Ball[] = [];
  /** Monotonic spawn index so each satellite gets its own orbit and phase. */
  private spawned = 0;
  private raf = 0;
  private readonly start = performance.now();
  private readonly ro: ResizeObserver;
  private readonly uniforms: {
    [key: string]: { value: number | number[] };
    uBalls: { value: number[] };
    uColors: { value: number[] };
    uCount: { value: number };
    uEnergy: { value: number };
    uResolution: { value: number[] };
    uTime: { value: number };
  };

  private readonly host: HTMLElement;
  private readonly speed: number;

  constructor(host: HTMLElement, speed = 1) {
    this.host = host;
    this.speed = speed;
    this.renderer = new Renderer({
      alpha: true,
      dpr: Math.min(window.devicePixelRatio, 2),
      premultipliedAlpha: false,
    });
    const gl = this.renderer.gl;
    gl.clearColor(0, 0, 0, 0);
    host.appendChild(gl.canvas);
    gl.canvas.style.width = "100%";
    gl.canvas.style.height = "100%";
    // Plain arrays: OGL resolves `name[0]` uniforms only when value is an Array.
    this.uniforms = {
      uBalls: { value: new Array<number>(MAX_BALLS * 4).fill(0) },
      uColors: { value: new Array<number>(MAX_BALLS * 4).fill(0) },
      uCount: { value: 0 },
      uEnergy: { value: 0 },
      uResolution: { value: [1, 1] },
      uTime: { value: 0 },
    };
    const program = new Program(gl, {
      fragment,
      transparent: true,
      uniforms: this.uniforms,
      vertex,
    });
    this.mesh = new Mesh(gl, { geometry: new Triangle(gl), program });
    this.ro = new ResizeObserver(this.resize);
    this.ro.observe(host);
    this.resize();
    this.loop();
  }

  private readonly resize = () => {
    const w = this.host.clientWidth;
    const h = this.host.clientHeight;
    this.renderer.setSize(w, h);
    this.uniforms.uResolution.value = [
      this.renderer.gl.canvas.width,
      this.renderer.gl.canvas.height,
    ];
  };

  /** Reconcile balls by id: new ones grow from the core, removed ones shrink away. */
  setBalls(specs: BallSpec[]) {
    const ids = new Set(specs.map((s) => s.id));
    for (const ball of this.balls) {
      if (!(ids.has(ball.id) || ball.leaving)) {
        ball.leaving = true;
        gsap.to(ball, {
          duration: 1.2,
          ease: "power2.in",
          onComplete: () => {
            this.balls = this.balls.filter((b) => b !== ball);
          },
          orbit: ball.orbit * 1.8,
          radius: 0,
        });
      }
    }
    for (const spec of specs) {
      const existing = this.balls.find((b) => b.id === spec.id && !b.leaving);
      if (existing) {
        gsap.to(existing, {
          alert: spec.alert,
          duration: 0.6,
          radius: spec.radius,
        });
        gsap.to(existing.color, {
          0: spec.color[0],
          1: spec.color[1],
          2: spec.color[2],
          duration: 0.8,
        });
        continue;
      }
      if (this.balls.length >= MAX_BALLS) {
        continue;
      }
      const isCore = spec.id === "core";
      const i = isCore ? 0 : ++this.spawned;
      const ball: Ball = {
        ...spec,
        color: [...spec.color],
        leaving: false,
        orbit: isCore ? 0 : 0.8 + (i % 3) * 0.11,
        phase: i * 2.399,
        radius: 0,
        speed: isCore ? 0 : 0.35 + (i % 4) * 0.08,
        tilt: (i % 2 ? 1 : -1) * (0.4 + (i % 3) * 0.25),
        x: 0,
        y: 0,
        z: 0,
      };
      this.balls.push(ball);
      gsap.to(ball, {
        duration: 1.4,
        ease: "elastic.out(1, 0.5)",
        radius: spec.radius,
      });
    }
  }

  energy(value: number) {
    gsap.to(this.uniforms.uEnergy, { duration: 0.6, value });
  }

  private readonly loop = () => {
    const t = ((performance.now() - this.start) / 1000) * this.speed;
    this.uniforms.uTime.value = t;
    const balls = this.uniforms.uBalls.value;
    const colors = this.uniforms.uColors.value;
    this.balls.slice(0, MAX_BALLS).forEach((b, i) => {
      const a = b.phase + t * b.speed;
      b.x = Math.cos(a) * b.orbit;
      b.y = Math.sin(a) * b.orbit * Math.sin(b.tilt) * 0.8;
      b.z = Math.sin(a) * b.orbit * Math.cos(b.tilt) * 0.6;
      const breathe = b.id === "core" ? 1 + Math.sin(t * 1.2) * 0.04 : 1;
      balls.splice(i * 4, 4, b.x, b.y, b.z, b.radius * breathe);
      colors.splice(i * 4, 4, b.color[0], b.color[1], b.color[2], b.alert);
    });
    this.uniforms.uCount.value = Math.min(this.balls.length, MAX_BALLS);
    this.renderer.render({ scene: this.mesh });
    this.raf = requestAnimationFrame(this.loop);
  };

  dispose() {
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    gsap.killTweensOf(this.balls);
    const gl = this.renderer.gl;
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    gl.canvas.remove();
  }
}
