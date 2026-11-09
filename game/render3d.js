// CHIPA CITY — motor 3D (Three.js): cámara cenital con perspectiva, como los clásicos de los 90.
// La lógica del juego vive en game.js (todo en 2D); este archivo solo dibuja.
'use strict';
window.createRender3D = function (G) {
  const T = window.THREE;
  if (!T) return null;
  let renderer;
  try {
    renderer = new T.WebGLRenderer({ canvas: G.canvas, antialias: false, powerPreference: 'high-performance' });
  } catch (e) { console.warn('WebGL no disponible, sigo en 2D', e); return null; }
  renderer.setClearColor(0x2a5aa8, 1);
  renderer.outputEncoding = T.LinearEncoding;
  renderer.setPixelRatio(1);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  const scene = new T.Scene();
  const FOV = 32, TAN = Math.tan(FOV / 2 * Math.PI / 180);
  const camera = new T.PerspectiveCamera(FOV, 1, 4, 9000);
  camera.up.set(0, 1, 0);
  const GL2 = renderer.capabilities.isWebGL2;

  // ------------------------------------------------------------ luz: tarde dorada correntina
  // El sol baja por el noroeste (hemisferio sur): las sombras caen hacia el sureste, como en el 2D.
  // Todo en coordenadas de Three: x = este, y = norte, z = arriba (el mundo 2D tiene la y hacia el sur).
  const LIGHT = {
    el: 34 * Math.PI / 180, az: 128 * Math.PI / 180,     // elevación y acimut (desde el este, antihorario)
    sun: new T.Color(1.0, 0.82, 0.6), sunI: 1.25,
    sky: new T.Color(0.62, 0.72, 0.92), ground: new T.Color(0.52, 0.44, 0.34), hemiI: 0.78,
    fog: new T.Color(0.98, 0.8, 0.62), fogMax: 0.16, fogH: 70,
  };
  const SUNDIR = new T.Vector3(Math.cos(LIGHT.el) * Math.cos(LIGHT.az), Math.cos(LIGHT.el) * Math.sin(LIGHT.az), Math.sin(LIGHT.el)).normalize();
  const sun = new T.DirectionalLight(LIGHT.sun, LIGHT.sunI);
  sun.castShadow = true;
  const SHADOW_RES = 2048;
  sun.shadow.mapSize.set(SHADOW_RES, SHADOW_RES);
  sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.5;
  sun.shadow.camera.near = 1; sun.shadow.camera.far = 6000;
  scene.add(sun); scene.add(sun.target);
  const hemi = new T.HemisphereLight(LIGHT.sky, LIGHT.ground, LIGHT.hemiI);
  hemi.position.set(0, 0, 1); scene.add(hemi);
  const _v = new T.Vector3(), _r = new T.Vector3(), _u = new T.Vector3();
  // La cámara de sombras sigue a la vista: cubre solo lo visible (más lo que puede tirar sombra adentro)
  // y se mueve de a un texel para que los bordes no "titilen" al andar.
  function aimSun(cx, cy, gw, gh, maxH) {
    const D = 3000, sc = sun.shadow.camera;
    sun.target.position.set(cx, cy, 0); sun.position.set(cx + SUNDIR.x * D, cy + SUNDIR.y * D, SUNDIR.z * D);
    sc.position.copy(sun.position); sc.lookAt(sun.target.position); sc.updateMatrixWorld(true);
    const inv = sc.matrixWorldInverse;
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const dx of [-0.5, 0.5]) for (const dy of [-0.5, 0.5]) for (const z of [0, maxH]) {
      _v.set(cx + dx * gw, cy + dy * gh, z).applyMatrix4(inv);
      x0 = Math.min(x0, _v.x); x1 = Math.max(x1, _v.x); y0 = Math.min(y0, _v.y); y1 = Math.max(y1, _v.y);
    }
    // tamaño cuantizado (para que el texel no cambie cuadro a cuadro) y centro pegado a la grilla de texels
    const q = 128, hw = Math.ceil((x1 - x0) / 2 / q) * q + 16, hh = Math.ceil((y1 - y0) / 2 / q) * q + 16;
    const tx = 2 * hw / SHADOW_RES, ty = 2 * hh / SHADOW_RES;
    const mx = (x0 + x1) / 2, my = (y0 + y1) / 2, sx = Math.round(mx / tx) * tx, sy = Math.round(my / ty) * ty;
    sc.left = sx - hw; sc.right = sx + hw; sc.bottom = sy - hh; sc.top = sy + hh;
    sc.updateProjectionMatrix();
  }

  // ------------------------------------------------------------ post-proceso propio (sin EffectComposer)
  // escena -> target de baja resolución (pixel nítido) -> neblina + nubes + luz volumétrica + bloom + gradación -> pantalla
  const RT_TYPE = GL2 ? T.HalfFloatType : T.UnsignedByteType;
  const POST = { pixel: 0, bloom: 0.55, vol: 0.22, clouds: 0.2, vignette: 0.32, exposure: 1.0, enabled: true };
  function rt(w, h, nearestF) {
    const f = nearestF ? T.NearestFilter : T.LinearFilter;
    return new T.WebGLRenderTarget(Math.max(1, w), Math.max(1, h), { minFilter: f, magFilter: f, type: RT_TYPE, depthBuffer: false, stencilBuffer: false });
  }
  let rtScene = null, rtVol = null, rtB = [], devW = 1, devH = 1, inW = 1, inH = 1, pixK = 1;
  function makeTargets() {
    for (const r of [rtScene, rtVol, ...rtB]) if (r) r.dispose();
    rtScene = new T.WebGLRenderTarget(inW, inH, { minFilter: T.NearestFilter, magFilter: T.NearestFilter, type: RT_TYPE, stencilBuffer: false });
    rtScene.depthTexture = new T.DepthTexture(inW, inH);
    rtScene.depthTexture.type = T.UnsignedIntType;
    rtVol = rt(inW >> 1, inH >> 1);
    rtB = [rt(inW >> 1, inH >> 1), rt(inW >> 2, inH >> 2), rt(inW >> 2, inH >> 2), rt(inW >> 3, inH >> 3), rt(inW >> 3, inH >> 3)];
  }
  const fsScene = new T.Scene(), fsCam = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const fsGeo = new T.BufferGeometry();
  fsGeo.setAttribute('position', new T.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
  const fsMesh = new T.Mesh(fsGeo, null); fsMesh.frustumCulled = false; fsScene.add(fsMesh);
  const FS_VERT = 'varying vec2 vUv; void main(){ vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }';
  const fsMat = (frag, uniforms) => new T.ShaderMaterial({ vertexShader: FS_VERT, fragmentShader: frag, uniforms, depthTest: false, depthWrite: false });
  function pass(mat, target) { fsMesh.material = mat; renderer.setRenderTarget(target); renderer.render(fsScene, fsCam); }
  // utilidades GLSL compartidas: ruido, reconstrucción de la posición y consulta del mapa de sombras del sol
  const GLSL_COMMON = `
    #include <packing>
    uniform sampler2D uShadowMap; uniform mat4 uShadowMatrix; uniform float uHasShadow;
    uniform vec3 uSunDir; uniform float uTime;
    float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
    float vnoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), f.x), mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), f.x), f.y); }
    float fbm(vec2 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { s += a * vnoise(p); p = p * 2.03 + 17.1; a *= 0.5; } return s; }
    float ign(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
    float sunVis(vec3 wp) {
      if (uHasShadow < 0.5) return 1.0;
      vec4 sc = uShadowMatrix * vec4(wp, 1.0); vec3 c = sc.xyz / sc.w;
      if (c.x < 0.0 || c.x > 1.0 || c.y < 0.0 || c.y > 1.0 || c.z > 1.0) return 1.0;
      return step(c.z - 0.0015, unpackRGBAToDepth(texture2D(uShadowMap, c.xy)));
    }`;
  const shadowUniforms = () => ({ uShadowMap: { value: null }, uShadowMatrix: { value: sun.shadow.matrix }, uHasShadow: { value: 0 }, uSunDir: { value: SUNDIR }, uTime: { value: 0 } });
  const camUniforms = () => ({ tDepth: { value: null }, uNear: { value: 4 }, uFar: { value: 9000 }, uTanY: { value: TAN }, uAspect: { value: 1 }, uCamPos: { value: new T.Vector3() } });
  const GLSL_WPOS = `
    uniform sampler2D tDepth; uniform float uNear, uFar, uTanY, uAspect; uniform vec3 uCamPos;
    vec3 worldAt(vec2 uv, out float vz) {
      float d = texture2D(tDepth, uv).x;
      vz = -perspectiveDepthToViewZ(d, uNear, uFar);
      vec2 ndc = uv * 2.0 - 1.0;
      return vec3(uCamPos.x + ndc.x * vz * uTanY * uAspect, uCamPos.y + ndc.y * vz * uTanY, uCamPos.z - vz);
    }`;
  // luz volumétrica: la neblina baja (los primeros ~35 m) se ilumina donde le da el sol y queda oscura en la sombra de los edificios
  const volMat = fsMat(`
    varying vec2 vUv; ${GLSL_COMMON} ${GLSL_WPOS}
    uniform vec3 uVolCol; uniform float uFogH, uTop; uniform float uFrame;
    void main() {
      float vz; vec3 wp = worldAt(vUv, vz);
      if (wp.z >= uTop) { gl_FragColor = vec4(0.0); return; }
      vec3 ro = uCamPos, rd = wp - ro;
      float t0 = clamp((ro.z - uTop) / max(1.0, ro.z - wp.z), 0.0, 1.0);
      float j = ign(gl_FragCoord.xy + uFrame * 5.588238), acc = 0.0;
      const int N = 10;
      for (int i = 0; i < N; i++) {
        vec3 p = ro + rd * mix(t0, 1.0, (float(i) + j) / float(N));
        acc += sunVis(p) * exp(-max(p.z, 0.0) / uFogH);
      }
      float len = (uTop - max(wp.z, 0.0)) / uTop;
      gl_FragColor = vec4(uVolCol * (acc / float(N)) * len, 1.0);
    }`, { ...shadowUniforms(), ...camUniforms(), uVolCol: { value: new T.Color() }, uFogH: { value: LIGHT.fogH }, uTop: { value: 130 }, uFrame: { value: 0 } });
  // bloom: brillo -> mitad -> cuarto -> octavo, con desenfoque separable
  const brightMat = fsMat(`
    varying vec2 vUv; uniform sampler2D tSrc; uniform vec2 uTexel; uniform float uThr;
    void main() {
      vec3 c = texture2D(tSrc, vUv + uTexel * vec2(-0.5, -0.5)).rgb + texture2D(tSrc, vUv + uTexel * vec2(0.5, -0.5)).rgb
             + texture2D(tSrc, vUv + uTexel * vec2(-0.5, 0.5)).rgb + texture2D(tSrc, vUv + uTexel * vec2(0.5, 0.5)).rgb;
      c *= 0.25;
      float l = max(c.r, max(c.g, c.b)), k = max(0.0, l - uThr); k = k * k / (k + 0.25);
      gl_FragColor = vec4(c * (k / max(l, 1e-4)), 1.0);
    }`, { tSrc: { value: null }, uTexel: { value: new T.Vector2() }, uThr: { value: 0.82 } });
  const copyMat = fsMat(`varying vec2 vUv; uniform sampler2D tSrc; uniform vec2 uTexel;
    void main() { gl_FragColor = 0.25 * (texture2D(tSrc, vUv + uTexel * vec2(-1.0, -1.0)) + texture2D(tSrc, vUv + uTexel * vec2(1.0, -1.0)) + texture2D(tSrc, vUv + uTexel * vec2(-1.0, 1.0)) + texture2D(tSrc, vUv + uTexel * vec2(1.0, 1.0))); }`,
    { tSrc: { value: null }, uTexel: { value: new T.Vector2() } });
  const blurMat = fsMat(`varying vec2 vUv; uniform sampler2D tSrc; uniform vec2 uDir;
    void main() {
      vec4 s = texture2D(tSrc, vUv) * 0.2270270270;
      s += (texture2D(tSrc, vUv + uDir * 1.3846153846) + texture2D(tSrc, vUv - uDir * 1.3846153846)) * 0.3162162162;
      s += (texture2D(tSrc, vUv + uDir * 3.2307692308) + texture2D(tSrc, vUv - uDir * 3.2307692308)) * 0.0702702703;
      gl_FragColor = s;
    }`, { tSrc: { value: null }, uDir: { value: new T.Vector2() } });
  const finalMat = fsMat(`
    varying vec2 vUv; ${GLSL_COMMON} ${GLSL_WPOS}
    uniform sampler2D tScene, tVol, tB1, tB2; uniform vec2 uIn; uniform float uPix;
    uniform vec3 uFogCol; uniform float uFogMax, uFogH, uBloom, uClouds, uVig, uExp, uVolOn;
    void main() {
      vec2 ip = floor(gl_FragCoord.xy / uPix) + 0.5, uv = ip / uIn;
      vec3 col = texture2D(tScene, uv).rgb;
      float vz; vec3 wp = worldAt(uv, vz);
      float h = clamp(wp.z, 0.0, 2000.0);
      // sombras de nubes que pasan (solo donde pega el sol)
      if (uClouds > 0.0) {
        vec2 cp = (wp.xy + uSunDir.xy / uSunDir.z * (900.0 - h)) * 0.0011 + vec2(uTime * 0.012, uTime * 0.005);
        float cl = smoothstep(0.5, 0.78, fbm(cp));
        col *= 1.0 - uClouds * cl * sunVis(wp);
      }
      // neblina de altura: el suelo queda un poco velado, las terrazas altas se despegan
      float fog = uFogMax * exp(-h / uFogH);
      col = mix(col, uFogCol * (0.75 + 0.25 * col), fog);
      col += texture2D(tVol, uv).rgb * uVolOn;
      col += (texture2D(tB1, vUv).rgb * 0.7 + texture2D(tB2, vUv).rgb * 0.9) * uBloom;
      // gradación: hombro suave, cálido en las luces y apenas verde-azulado en las sombras
      col *= uExp;
      col = mix(col, 0.8 + 0.2 * (1.0 - exp(-(col - 0.8) / 0.2)), step(0.8, col));
      float l = dot(col, vec3(0.299, 0.587, 0.114));
      col = mix(vec3(l), col, 1.12);
      col *= mix(vec3(0.94, 0.99, 1.06), vec3(1.05, 1.0, 0.92), smoothstep(0.15, 0.75, l));
      col = col * col * (3.0 - 2.0 * col) * 0.22 + col * 0.78;
      vec2 q = vUv - 0.5; q.x *= uIn.x / uIn.y * 0.75;
      col *= 1.0 - uVig * smoothstep(0.25, 0.85, length(q));
      col += (ign(gl_FragCoord.xy) - 0.5) / 255.0;
      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }`, { ...shadowUniforms(), ...camUniforms(), tScene: { value: null }, tVol: { value: null }, tB1: { value: null }, tB2: { value: null },
    uIn: { value: new T.Vector2(1, 1) }, uPix: { value: 1 }, uFogCol: { value: LIGHT.fog }, uFogMax: { value: LIGHT.fogMax }, uFogH: { value: LIGHT.fogH },
    uBloom: { value: POST.bloom }, uClouds: { value: POST.clouds }, uVig: { value: POST.vignette }, uExp: { value: POST.exposure }, uVolOn: { value: 1 } });
  const SHADOW_USERS = [volMat, finalMat];
  let tNow = 0;
  const { TS, CPX, FLOOR } = G, TT = G.T;
  const KEY = (cx, cy) => cy * 4096 + cx;
  const nearest = t => { t.magFilter = T.NearestFilter; t.minFilter = T.NearestFilter; t.generateMipmaps = false; return t; };
  const unitPlane = new T.PlaneGeometry(1, 1);
  const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
  const mul = (c, k) => [c[0] * k, c[1] * k, c[2] * k];
  let frame = 0;

  // ------------------------------------------------------------ texturas pixel art (blancas: se tiñen por vértice)
  function cv(w, h, fn) { const c = document.createElement('canvas'); c.width = w; c.height = h; fn(c.getContext('2d')); return c; }
  const R = (g, col, x, y, w, h) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
  const lcg = s => () => ((s = (s * 16807) % 2147483647) / 2147483647);
  function win(g, x, y, w, h, reja) {
    R(g, '#5a5a62', x - 1, y - 1, w + 2, h + 2); R(g, '#34465e', x, y, w, h);
    R(g, '#7a92b0', x, y, 2, 1); R(g, '#7a92b0', x, y, 1, 2);
    if (reja) for (let i = x + 1; i < x + w; i += 2) R(g, '#e6e6e6', i, y, 1, h);
  }
  // cada textura = un piso de alto (12 px = 3 m) y varios módulos de 16 px (3 m) de ancho
  const FAC = {
    casa: { w: 64, c: cv(64, 12, g => {
      R(g, '#fff', 0, 0, 64, 12); R(g, '#dcdcdc', 0, 0, 64, 1); R(g, '#9c9c9c', 0, 10, 64, 2);
      for (let m = 0; m < 4; m++) {
        const x = m * 16;
        if (m === 1) { R(g, '#5a3a20', x + 4, 2, 8, 10); R(g, '#8a5a34', x + 5, 3, 6, 9); R(g, '#e0c060', x + 9, 7, 1, 1); }
        else { win(g, x + 3, 3, 10, 6, true); R(g, '#c8c8c8', x + 2, 9, 12, 1); }
      }
    }) },
    comercio: { w: 64, c: cv(64, 12, g => {
      R(g, '#fff', 0, 0, 64, 12);
      R(g, '#d83838', 0, 0, 32, 3); R(g, '#2a6ad8', 32, 0, 32, 3);
      for (let x = 3; x < 30; x += 4) R(g, '#fff', x, 1, 2, 1);
      for (let x = 35; x < 62; x += 3) R(g, '#ffe080', x, 1, 2, 1);
      R(g, '#444', 1, 4, 30, 8); R(g, '#3a5a7a', 2, 5, 28, 7); R(g, '#6a8aaa', 3, 5, 6, 1); R(g, '#2a3a4a', 13, 6, 6, 6);
      R(g, '#6e6e6e', 33, 4, 30, 8); for (let y = 5; y < 12; y += 2) R(g, '#a8a8a8', 34, y, 28, 1);
    }) },
    depto: { w: 32, c: cv(32, 12, g => {
      R(g, '#fff', 0, 0, 32, 12);
      win(g, 2, 2, 12, 6, false); R(g, '#e8e8e8', 1, 7, 14, 1);
      for (let x = 1; x < 15; x += 2) R(g, '#cfcfcf', x, 8, 1, 3);
      R(g, '#a8a8a8', 0, 11, 16, 1);
      win(g, 18, 2, 11, 7, false); R(g, '#c8c8cc', 24, 9, 5, 2); R(g, '#8a8a90', 25, 9, 1, 2);
    }) },
    casa2: { w: 32, c: cv(32, 12, g => {
      R(g, '#fff', 0, 0, 32, 12); R(g, '#dcdcdc', 0, 0, 32, 1);
      win(g, 5, 3, 7, 6, false); R(g, '#8a7058', 3, 3, 2, 6); R(g, '#8a7058', 12, 3, 2, 6);
      win(g, 21, 4, 5, 4, false);
    }) },
    trasera: { w: 32, c: cv(32, 12, g => {
      R(g, '#fff', 0, 0, 32, 12); win(g, 5, 3, 6, 4, true); R(g, '#9a9a9a', 24, 0, 1, 12); R(g, '#d8d8d8', 0, 11, 32, 1);
    }) },
    medianera: { w: 32, c: cv(32, 12, g => {
      R(g, '#ececec', 0, 0, 32, 12); const r = lcg(7);
      for (let i = 0; i < 40; i++) R(g, r() < 0.5 ? '#d6d6d6' : '#f8f8f8', Math.floor(r() * 32), Math.floor(r() * 12), 1 + Math.floor(r() * 2), 1);
      R(g, '#d0d0d0', 9, 0, 1, 12);
    }) },
  };
  const ROOFTEX = {
    chapa: cv(16, 16, g => { R(g, '#fff', 0, 0, 16, 16); for (let x = 1; x < 16; x += 2) R(g, '#c4c4c4', x, 0, 1, 16); }),
    teja: cv(16, 16, g => {
      R(g, '#fff', 0, 0, 16, 16);
      for (let y = 3; y < 16; y += 4) { R(g, '#a4a4a4', 0, y, 16, 1); R(g, '#f6f6f6', 0, y - 3, 16, 1); }
      for (let y = 0; y < 16; y += 4) for (let x = (y / 4 % 2) * 2; x < 16; x += 4) R(g, '#c8c8c8', x, y + 1, 1, 2);
    }),
    losa: cv(16, 16, g => { R(g, '#fff', 0, 0, 16, 16); const r = lcg(3); for (let i = 0; i < 30; i++) R(g, r() < 0.6 ? '#d6d6d6' : '#ececec', Math.floor(r() * 16), Math.floor(r() * 16), 1, 1); }),
    membrana: cv(16, 16, g => { R(g, '#fff', 0, 0, 16, 16); R(g, '#e0e0e0', 15, 0, 1, 16); R(g, '#f0f0f0', 0, 8, 16, 1); }),
  };
  const DECK = cv(64, 32, g => {
    R(g, '#76767c', 0, 0, 64, 32); const r = lcg(11);
    for (let i = 0; i < 120; i++) R(g, r() < 0.5 ? '#828288' : '#6a6a70', Math.floor(r() * 64), Math.floor(r() * 32), 1, 1);
    R(g, '#e8e8e8', 4, 0, 1, 32); R(g, '#e8e8e8', 59, 0, 1, 32);
    R(g, '#e0c040', 31, 0, 2, 14);
  });
  const rep = c => { const t = nearest(new T.CanvasTexture(c)); t.wrapS = t.wrapT = T.RepeatWrapping; return t; };
  const mats = {};
  const facMat = k => mats[k] || (mats[k] = new T.MeshLambertMaterial({ map: rep(FAC[k].c), vertexColors: true, side: T.DoubleSide }));
  const roofMat = k => mats['r_' + k] || (mats['r_' + k] = new T.MeshLambertMaterial({ map: rep(ROOFTEX[k]), vertexColors: true, side: T.DoubleSide }));
  const plainMat = new T.MeshLambertMaterial({ vertexColors: true, side: T.DoubleSide });
  const deckMat = new T.MeshLambertMaterial({ map: rep(DECK), side: T.DoubleSide });
  const lineMat = new T.LineBasicMaterial({ vertexColors: true });
  const groundShadowMat = new T.MeshBasicMaterial({ color: 0x0a0018, transparent: true, opacity: 0.32, depthWrite: false, side: T.DoubleSide });

  // ------------------------------------------------------------ geometría
  const Geo = () => ({ pos: [], uv: [], col: [] });
  function pv(g, x, y, z, u, v, c) { g.pos.push(x, -y, z); g.uv.push(u, v); g.col.push(c[0], c[1], c[2]); }
  function quad(g, ax, ay, bx, by, z0, z1, u0, u1, v0, v1, c) {
    pv(g, ax, ay, z0, u0, v0, c); pv(g, bx, by, z0, u1, v0, c); pv(g, bx, by, z1, u1, v1, c);
    pv(g, ax, ay, z0, u0, v0, c); pv(g, bx, by, z1, u1, v1, c); pv(g, ax, ay, z1, u0, v1, c);
  }
  // quad general por 4 esquinas 3D (para tableros y techos inclinados)
  function quad4(g, a, b, c, d, col, uv) {
    const U = uv || [[0, 0], [1, 0], [1, 1], [0, 1]];
    pv(g, a[0], a[1], a[2], U[0][0], U[0][1], col); pv(g, b[0], b[1], b[2], U[1][0], U[1][1], col); pv(g, c[0], c[1], c[2], U[2][0], U[2][1], col);
    pv(g, a[0], a[1], a[2], U[0][0], U[0][1], col); pv(g, c[0], c[1], c[2], U[2][0], U[2][1], col); pv(g, d[0], d[1], d[2], U[3][0], U[3][1], col);
  }
  // caja orientada: centro (cx,cy), eje (ux,uy), medio largo hl, medio ancho hw
  function obox(g, cx, cy, ux, uy, hl, hw, z0, z1, top, side) {
    const vx = -uy, vy = ux;
    const C = [[cx - ux * hl - vx * hw, cy - uy * hl - vy * hw], [cx + ux * hl - vx * hw, cy + uy * hl - vy * hw],
               [cx + ux * hl + vx * hw, cy + uy * hl + vy * hw], [cx - ux * hl + vx * hw, cy - uy * hl + vy * hw]];
    const shades = [1, 0.82, 0.66, 0.9];
    for (let i = 0; i < 4; i++) { const a = C[i], b = C[(i + 1) % 4]; quad(g, a[0], a[1], b[0], b[1], z0, z1, 0, 0, 0, 0, mul(side, shades[i])); }
    quad4(g, [C[0][0], C[0][1], z1], [C[1][0], C[1][1], z1], [C[2][0], C[2][1], z1], [C[3][0], C[3][1], z1], top);
  }
  const box = (g, x, y, z, w, d, h, top, side) => obox(g, x + w / 2, y + d / 2, 1, 0, w / 2, d / 2, z, z + h, top, side);
  function toMesh(g, mat) {
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.Float32BufferAttribute(g.pos, 3));
    geo.setAttribute('uv', new T.Float32BufferAttribute(g.uv, 2));
    geo.setAttribute('color', new T.Float32BufferAttribute(g.col, 3));
    geo.computeVertexNormals(); // sin índices: normal plana por triángulo (look facetado)
    geo.computeBoundingSphere();
    const m = new T.Mesh(geo, mat); m.matrixAutoUpdate = false; m.updateMatrix();
    m.castShadow = true; m.receiveShadow = true;
    return m;
  }
  function toLines(l) {
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.Float32BufferAttribute(l.pos, 3));
    geo.setAttribute('color', new T.Float32BufferAttribute(l.col, 3));
    geo.computeBoundingSphere();
    const m = new T.LineSegments(geo, lineMat); m.matrixAutoUpdate = false; m.updateMatrix(); return m;
  }

  // ------------------------------------------------------------ edificios
  const PAINT_CASA = ['#f2efe6', '#efe2c4', '#e8d3a8', '#f0c8a8', '#d8e6ee', '#d4e8cc', '#f2d0d0', '#e6e0f0', '#d8c8a8', '#e0e0e0', '#f4e4a0', '#c8dcd0'].map(rgb);
  const PAINT_DEPTO = ['#e8e4dc', '#d8d4cc', '#c8c4bc', '#e0d4c0', '#bcc4cc', '#d0c8c0', '#e4dcd0'].map(rgb);
  const PAINT_MED = ['#c8c2b8', '#b8b2a8', '#d4c8b8', '#c4a088'].map(rgb);
  const BCENT = new Map();
  for (const bd of G.BLD) {
    const k = KEY(Math.floor((bd.minx + bd.maxx) / 2 / CPX), Math.floor((bd.miny + bd.maxy) / 2 / CPX));
    let l = BCENT.get(k); if (!l) BCENT.set(k, l = []); l.push(bd);
  }
  // ------------------------------------------------------------ edificios emblemáticos (fichas en landmarks.js)
  const LM = window.LANDMARKS || {};
  const MPX = FLOOR / 3; // píxeles por metro en altura (los pisos de 3 m miden FLOOR px)
  function lmFacade(spec) { // un "piso" de fachada, 48 px de ancho (≈9 m), 24 px de alto
    return cv(48, 24, g => {
      const W2 = spec.wall, Tr = spec.trim, glass = '#3a4a62', dark = '#2a3446';
      R(g, W2, 0, 0, 48, 24);
      if (spec.style === 'lamas') { // lamas verticales grises con paños de vidrio (IOSCor)
        R(g, '#2e4a6a', 16, 0, 16, 24); R(g, '#5a7a9a', 16, 0, 16, 1); for (let x = 16; x < 32; x += 4) R(g, '#4a6a8a', x, 0, 1, 24);
        for (let x = 0; x < 48; x += 2) if (x < 16 || x >= 32) { R(g, Tr, x, 0, 1, 24); R(g, '#00000030', x + 1, 0, 1, 24); }
        R(g, '#00000020', 0, 23, 48, 1);
        return;
      }
      if (spec.style === 'canopy') { // techo de estación de servicio: blanco con franja de color
        R(g, '#f4f4f0', 0, 0, 48, 24); R(g, Tr, 0, 9, 48, 5); R(g, '#f0a020', 0, 7, 48, 2); R(g, '#00000018', 0, 22, 48, 2);
        return;
      }
      if (spec.style === 'balcones') { // torres: vidrio con losas y barandas blancas en cada piso
        for (let x = 0; x < 48; x += 8) R(g, '#ffffff30', x, 0, 1, 20);
        R(g, '#ffffff22', 0, 2, 48, 1);
        R(g, Tr, 0, 19, 48, 5); R(g, '#00000026', 0, 23, 48, 1);
        for (let x = 2; x < 48; x += 4) R(g, '#00000018', x, 20, 1, 3);
        return;
      }
      if (spec.style === 'castillo') { // ladrillo con fajas claras y ventanitas enrejadas (la vieja cárcel)
        for (let y = 0; y < 24; y += 3) { R(g, '#00000020', 0, y, 48, 1); for (let x = (y / 3 % 2) * 3; x < 48; x += 6) R(g, '#00000016', x, y, 1, 3); }
        R(g, Tr, 0, 0, 48, 3); R(g, Tr, 0, 20, 48, 2);
        for (let x = 0; x < 48; x += 4) R(g, '#00000030', x, 3, 2, 1);
        for (let x = 6; x < 48; x += 12) { R(g, Tr, x - 1, 8, 5, 9); R(g, '#2a2420', x, 9, 3, 7); R(g, Tr, x, 8, 3, 1); R(g, '#8a8070', x + 1, 9, 1, 7); }
        return;
      }
      if (spec.style === 'perforado') { // blanco con ranuras chicas (el CIT de La Unidad)
        const r = lcg(19);
        for (let i = 0; i < 26; i++) R(g, '#3a3e48', Math.floor(r() * 46), Math.floor(r() * 21), 1, 3);
        R(g, '#00000012', 0, 23, 48, 1);
        return;
      }
      if (spec.style === 'casita') { // casa blanca de barrio: ventana con persianas de madera y otra con rejas
        R(g, '#d8d4cc', 0, 21, 48, 3); R(g, '#00000010', 0, 0, 48, 1);
        R(g, '#e8e4dc', 5, 6, 14, 12); R(g, '#7a6048', 6, 7, 12, 10);
        for (let y = 8; y < 17; y += 2) R(g, '#5a4434', 6, y, 12, 1);
        R(g, '#4a382a', 11, 7, 1, 10); R(g, '#c8c4bc', 5, 17, 14, 1);
        R(g, '#e8e4dc', 29, 7, 11, 10); R(g, '#34465e', 30, 8, 9, 8);
        for (let x = 31; x < 39; x += 2) R(g, '#d8d8d8', x, 8, 1, 8);
        R(g, '#00000014', 22, 2, 2, 19);
        return;
      }
      if (spec.style === 'ladrillo') { // ladrillo visto con marcos claros
        for (let y = 0; y < 24; y += 3) { R(g, '#00000022', 0, y, 48, 1); for (let x = (y / 3 % 2) * 3; x < 48; x += 6) R(g, '#00000018', x, y, 1, 3); }
        R(g, Tr, 0, 0, 48, 2);
        for (let x = 4; x < 48; x += 16) { R(g, Tr, x - 2, 5, 12, 14); R(g, glass, x, 7, 8, 10); R(g, Tr, x + 3, 7, 2, 10); R(g, Tr, x - 3, 18, 14, 2); }
        return;
      }
      if (spec.style === 'moderno') { // ventanas corridas horizontales
        R(g, Tr, 0, 0, 48, 2);
        R(g, '#2c3a50', 0, 7, 48, 9); R(g, '#5a7898', 0, 7, 48, 1);
        for (let x = 0; x < 48; x += 8) R(g, Tr, x, 7, 1, 9);
        R(g, Tr, 0, 16, 48, 2);
        return;
      }
      if (spec.style === 'vidrio') { // muro cortina
        R(g, '#3a5878', 0, 0, 48, 24);
        for (let x = 0; x < 48; x += 6) R(g, '#7aa0c0', x, 0, 1, 24);
        R(g, '#a8c4dc', 0, 0, 48, 1); R(g, '#24364c', 0, 20, 48, 4); R(g, '#7aa0c0', 3, 3, 2, 2); R(g, '#7aa0c0', 27, 9, 2, 2);
        return;
      }
      if (spec.style === 'paneles') { // paneles de hormigón y ventanas chicas
        for (let x = 0; x < 48; x += 12) { R(g, x % 24 ? '#00000014' : '#ffffff18', x, 0, 12, 24); R(g, '#00000030', x, 0, 1, 24); }
        R(g, '#00000030', 0, 12, 48, 1);
        for (let x = 3; x < 48; x += 12) R(g, glass, x, 15, 6, 5);
        return;
      }
      if (spec.style === 'colonial') { // paredes blancas, ventanas con dintel de ladrillo
        R(g, '#9a948c', 0, 21, 48, 3);
        for (let x = 5; x < 48; x += 16) { R(g, Tr, x - 2, 4, 10, 2); R(g, glass, x, 7, 6, 9); R(g, '#e0e0e0', x + 2, 7, 1, 9); R(g, '#e0e0e0', x, 11, 6, 1); }
        return;
      }
      if (spec.style === 'escuela') {
        R(g, Tr, 0, 0, 48, 2); R(g, Tr, 0, 21, 48, 1);
        for (let x = 4; x < 48; x += 12) { R(g, Tr, x - 1, 5, 8, 13); R(g, glass, x, 6, 6, 11); R(g, Tr, x + 2, 6, 1, 11); R(g, Tr, x, 11, 6, 1); }
        return;
      }
      // pilastras y cornisa
      for (let x = 0; x < 48; x += 16) R(g, Tr, x, 0, 2, 24);
      R(g, Tr, 0, 0, 48, 3); R(g, Tr, 0, 22, 48, 2);
      for (let x = 0; x < 48; x += 4) R(g, '#00000018', x, 3, 2, 1);
      if (spec.style === 'iglesia') { // ventanales altos en arco
        for (let x = 6; x < 48; x += 16) {
          R(g, Tr, x - 1, 6, 6, 15); R(g, dark, x, 8, 4, 12); R(g, dark, x + 1, 7, 2, 1); R(g, '#5a7090', x, 8, 1, 3);
        }
      } else if (spec.style === 'teatro') { // ventanas con balconcito
        for (let x = 5; x < 48; x += 16) {
          R(g, Tr, x - 1, 4, 8, 13); R(g, glass, x, 6, 6, 9); R(g, Tr, x + 2, 6, 1, 9);
          R(g, Tr, x - 2, 15, 10, 1); for (let k = x - 2; k < x + 8; k += 2) R(g, Tr, k, 16, 1, 3); R(g, Tr, x - 2, 19, 10, 1);
        }
      } else { // clasico: ventanas en arco con marco
        for (let x = 5; x < 48; x += 16) {
          R(g, Tr, x - 1, 5, 8, 15); R(g, glass, x, 7, 6, 12); R(g, glass, x + 1, 6, 4, 1); R(g, Tr, x + 2, 7, 1, 12); R(g, '#6a82a2', x, 7, 1, 3);
        }
      }
    });
  }
  const lmMats = {};
  const lmMat = name => lmMats[name] || (lmMats[name] = new T.MeshLambertMaterial({ map: rep(lmFacade(LM[name])), vertexColors: true, side: T.DoubleSide }));
  function obbOf(bd) { // rectángulo orientado mínimo que contiene al edificio
    const p = bd.pts, n = bd.n; let best = null;
    for (let k = 0, j = n - 1; k < n; j = k++) {
      const dx = p[2 * k] - p[2 * j], dy = p[2 * k + 1] - p[2 * j + 1], l = Math.hypot(dx, dy); if (l < 1) continue;
      const ux = dx / l, uy = dy / l, vx = -uy, vy = ux;
      let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity;
      for (let i = 0; i < n; i++) { const a = p[2 * i] * ux + p[2 * i + 1] * uy, b = p[2 * i] * vx + p[2 * i + 1] * vy; a0 = Math.min(a0, a); a1 = Math.max(a1, a); b0 = Math.min(b0, b); b1 = Math.max(b1, b); }
      const area = (a1 - a0) * (b1 - b0);
      if (!best || area < best.area) {
        const ca = (a0 + a1) / 2, cb = (b0 + b1) / 2;
        best = { area, cx: ux * ca + vx * cb, cy: uy * ca + vy * cb, ax: ux, ay: uy, bx: vx, by: vy, la: (a1 - a0) / 2, lb: (b1 - b0) / 2 };
      }
    }
    if (best.lb > best.la) best = { ...best, ax: best.bx, ay: best.by, bx: -best.ax, by: -best.ay, la: best.lb, lb: best.la };
    return best;
  }
  const tri3 = (g, a, b, c, col) => { pv(g, a[0], a[1], a[2], 0, 0, col); pv(g, b[0], b[1], b[2], 0, 0, col); pv(g, c[0], c[1], c[2], 0, 0, col); };
  function pyramid(g, cx, cy, ux, uy, hw, z0, z1, col) {
    const vx = -uy, vy = ux, C = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => [cx + ux * a * hw + vx * b * hw, cy + uy * a * hw + vy * b * hw, z0]);
    const top = [cx, cy, z1], sh = [1, 0.8, 0.62, 0.9];
    for (let i = 0; i < 4; i++) tri3(g, C[i], C[(i + 1) % 4], top, mul(col, sh[i]));
  }
  function dome(g, cx, cy, ux, uy, r, z0, h, col) { // cúpula escalonada (se ve bien en pixel art)
    for (let k = 0; k < 5; k++) {
      const rr = Math.max(1, r * Math.cos(k / 5 * Math.PI / 2));
      obox(g, cx, cy, ux, uy, rr, rr, z0 + h * k / 5, z0 + h * (k + 1) / 5, mul(col, 1.05), mul(col, 0.85));
    }
    obox(g, cx, cy, ux, uy, 1, 1, z0 + h, z0 + h + 6, [0.85, 0.85, 0.8], [0.6, 0.6, 0.58]); // linterna y cruz
  }
  const STREETISH = t => !(t === TT.BLOCK || t === TT.OSMB || t === TT.YARD);
  function buildLandmark(bd, name, getG, lines) {
    const spec = LM[name], p = bd.pts, n = bd.n, h = spec.height * MPX, st = spec.storey * MPX;
    const wall = rgb(spec.wall), trim = rgb(spec.trim), rc = rgb(spec.roof.color), fac = getG('lm_' + name);
    const o = obbOf(bd), plain = getG('plain'), z0 = (spec.base || 0) * MPX;
    // techo inclinado a lo largo del eje largo (la torre "vela"): alto en el extremo sur, más bajo en el otro
    const sgnA = (o.ay > 0.05 || (Math.abs(o.ay) <= 0.05 && o.ax > 0)) ? 1 : -1;
    let zTop = spec.slopeTop ? (x, y) => h * (spec.slopeTop + (1 - spec.slopeTop) * ((((x - o.cx) * o.ax + (y - o.cy) * o.ay) * sgnA / o.la) + 1) / 2) : () => h;
    // tribuna: la pendiente baja hacia la cancha más cercana (f = 0 junto al campo, 1 en la pared de atrás)
    let trib = null;
    if (spec.tribuna) {
      let pc = [o.cx, o.cy], bestD = Infinity;
      for (const q of G.PROPS.pitches || []) {
        const x = ((q[0] + q[2] + q[4] + q[6]) / 4 + 0.5) * TS, y = ((q[1] + q[3] + q[5] + q[7]) / 4 + 0.5) * TS, d = Math.hypot(x - o.cx, y - o.cy);
        if (d < bestD) { bestD = d; pc = [x, y]; }
      }
      const dx = pc[0] - o.cx, dy = pc[1] - o.cy, da = dx * o.ax + dy * o.ay, db = dx * o.bx + dy * o.by, useA = Math.abs(da) > Math.abs(db);
      trib = { ux: useA ? o.ax : o.bx, uy: useA ? o.ay : o.by, L: useA ? o.la : o.lb, sg: Math.sign(useA ? da : db) || 1,
               vx: useA ? o.bx : o.ax, vy: useA ? o.by : o.ay, M: useA ? o.lb : o.la };
      const low = spec.tribuna.low ?? 0.15;
      trib.f = (x, y) => Math.min(1, Math.max(0, (1 - ((x - o.cx) * trib.ux + (y - o.cy) * trib.uy) * trib.sg / trib.L) / 2));
      trib.at = (f, m) => [o.cx + trib.ux * trib.sg * trib.L * (1 - 2 * f) + trib.vx * m, o.cy + trib.uy * trib.sg * trib.L * (1 - 2 * f) + trib.vy * m];
      trib.z = f => h * (low + (1 - low) * f);
      zTop = (x, y) => trib.z(trib.f(x, y));
    }
    for (let k = 0, j = n - 1; k < n; j = k++) {
      const ax = p[2 * j], ay = p[2 * j + 1], bx = p[2 * k], by = p[2 * k + 1], len = Math.hypot(bx - ax, by - ay); if (len < 1) continue;
      const nxo = (by - ay) / len * bd.sign, nyo = -(bx - ax) / len * bd.sign;
      const light = 0.74 + 0.26 * Math.max(0, -(nxo * 0.6 + nyo * 0.8)), za = zTop(ax, ay), zb = zTop(bx, by);
      quad4(fac, [ax, ay, z0], [bx, by, z0], [bx, by, zb], [ax, ay, za], [light, light, light], [[0, 0], [len / 48, 0], [len / 48, (zb - z0) / st], [0, (za - z0) / st]]);
      if (z0 > 0) quad4(plain, [ax, ay, z0], [bx, by, z0], [bx, by, z0 + 1], [ax, ay, z0 + 1], mul(wall, 0.5)); // canto inferior
    }
    if (spec.roof.shape === 'gable') { // techo a dos aguas sobre el rectángulo, con el triángulo del frente
      const rh = Math.min(o.lb * 0.7, 22), C = (sa, sb, z) => [o.cx + o.ax * o.la * sa + o.bx * o.lb * sb, o.cy + o.ay * o.la * sa + o.by * o.lb * sb, z];
      const R0 = [o.cx - o.ax * o.la, o.cy - o.ay * o.la, h + rh], R1 = [o.cx + o.ax * o.la, o.cy + o.ay * o.la, h + rh];
      quad4(plain, C(-1, -1, h), C(1, -1, h), R1, R0, mul(rc, 0.95));
      quad4(plain, C(1, 1, h), C(-1, 1, h), R0, R1, mul(rc, 0.72));
      tri3(plain, C(-1, -1, h), C(-1, 1, h), R0, mul(trim, 0.9));
      tri3(plain, C(1, 1, h), C(1, -1, h), R1, mul(trim, 0.8));
      const oc = mul(rc, 0.5); lines.pos.push(R0[0], -R0[1], R0[2] + 0.3, R1[0], -R1[1], R1[2] + 0.3); lines.col.push(...oc, ...oc);
    } else if (spec.roof.shape === 'hip') { // cuatro aguas (tejas, pizarra)
      const rh = Math.min(o.lb * 0.75, spec.roof.rise || 22), r0 = Math.max(0, o.la - o.lb);
      const C = (sa, sb) => [o.cx + o.ax * o.la * sa + o.bx * o.lb * sb, o.cy + o.ay * o.la * sa + o.by * o.lb * sb, h];
      const R0 = [o.cx - o.ax * r0, o.cy - o.ay * r0, h + rh], R1 = [o.cx + o.ax * r0, o.cy + o.ay * r0, h + rh];
      quad4(plain, C(-1, -1), C(1, -1), R1, R0, mul(rc, 0.95));
      quad4(plain, C(1, 1), C(-1, 1), R0, R1, mul(rc, 0.7));
      tri3(plain, C(-1, 1), C(-1, -1), R0, mul(rc, 0.84));
      tri3(plain, C(1, -1), C(1, 1), R1, mul(rc, 0.62));
      const oc = mul(rc, 0.5);
      for (const [a, b] of [[R0, R1], [C(-1, -1), R0], [C(-1, 1), R0], [C(1, -1), R1], [C(1, 1), R1]]) { lines.pos.push(a[0], -a[1], a[2] + 0.3, b[0], -b[1], b[2] + 0.3); lines.col.push(...oc, ...oc); }
    } else if (spec.roof.shape === 'vault') { // bóveda de chapa (estadios, mercados)
      const rv = Math.min(o.lb * 0.8, spec.roof.rise || 30), N = 8, P = [];
      for (let k = 0; k <= N; k++) { const t = Math.PI * k / N; P.push([-Math.cos(t) * o.lb, h + Math.sin(t) * rv]); }
      for (let k = 0; k < N; k++) {
        const [b0, z0] = P[k], [b1, z1] = P[k + 1], sh = 0.7 + 0.3 * Math.max(0, Math.cos(Math.PI * (k + 0.5) / N) * -1 + 0.5);
        const A = s2 => [o.cx + o.ax * o.la * s2 + o.bx * b0, o.cy + o.ay * o.la * s2 + o.by * b0, z0];
        const B = s2 => [o.cx + o.ax * o.la * s2 + o.bx * b1, o.cy + o.ay * o.la * s2 + o.by * b1, z1];
        quad4(plain, A(-1), A(1), B(1), B(-1), mul(rc, Math.min(1.05, sh)));
        for (const s2 of [-1, 1]) tri3(plain, [o.cx + o.ax * o.la * s2, o.cy + o.ay * o.la * s2, h], A(s2), B(s2), mul(trim, s2 > 0 ? 0.8 : 0.95));
        if (k % 2 === 0) { const oc = mul(rc, 0.6), a = A(-1), b = A(1); lines.pos.push(a[0], -a[1], a[2] + 0.3, b[0], -b[1], b[2] + 0.3); lines.col.push(...oc, ...oc); }
      }
    } else { // techo plano con balaustrada
      const contour = []; for (let k = 0; k < n; k++) contour.push(new T.Vector2(p[2 * k], p[2 * k + 1]));
      let faces = []; try { faces = T.ShapeUtils.triangulateShape(contour, []); } catch (e) { /* forma rara */ }
      for (const f of faces) for (const i of f) pv(plain, p[2 * i], p[2 * i + 1], zTop(p[2 * i], p[2 * i + 1]), 0, 0, rc);
      if (spec.parapet && !spec.slopeTop) {
        const pc = rgb(spec.parapet);
        for (let k = 0, j = n - 1; k < n; j = k++) { // balaustrada con grosor: desde arriba se lee como un borde claro
          const ax = p[2 * j], ay = p[2 * j + 1], bx = p[2 * k], by = p[2 * k + 1], l = Math.hypot(bx - ax, by - ay); if (l < 1) continue;
          const ux = (bx - ax) / l, uy = (by - ay) / l, nxo = uy * bd.sign, nyo = -ux * bd.sign;
          obox(plain, (ax + bx) / 2 - nxo * 2, (ay + by) / 2 - nyo * 2, ux, uy, l / 2 + 2, 2, h, h + 5, pc, mul(pc, 0.78));
          for (let d = 4; d < l - 2; d += 6) obox(plain, ax + ux * d - nxo * 2, ay + uy * d - nyo * 2, ux, uy, 0.6, 2.2, h + 5, h + 6, mul(pc, 0.7), mul(pc, 0.6));
        }
      }
    }
    if (trib) { // gradas: escalones con butacas en bloques de colores, borde blanco atrás y (opcional) cabina de prensa
      const T2 = spec.tribuna, HPM = TS / (G.MD.tileMeters || 2.25), cols = (T2.seats || ['#c8302a', '#2a4aa8']).map(rgb);
      const back = T2.back ?? 0.08, f0 = 0.03, rows = Math.max(3, Math.round(2 * trib.L * (1 - back - f0) / (0.9 * HPM))), df = (1 - back - f0) / rows;
      const blk = (T2.block || 7) * HPM, M = trib.M - 1.2 * HPM, nb = Math.max(1, Math.round(2 * M / blk));
      for (let r = 0; r < rows; r++) {
        const fa = f0 + r * df, fb = fa + df, za = trib.z(fa), zb = trib.z(fb) + 0.3;
        for (let k = 0; k < nb; k++) {
          const m0 = -M + 2 * M * k / nb + (k ? 0.6 : 0), m1 = -M + 2 * M * (k + 1) / nb, c = mul(cols[(k + (T2.stagger && r >= rows / 2 ? 1 : 0)) % cols.length], r % 2 ? 0.9 : 1);
          const A = trib.at(fa, m0), B = trib.at(fa, m1), C2 = trib.at(fb, m1), D = trib.at(fb, m0);
          quad4(plain, [A[0], A[1], zb], [B[0], B[1], zb], [C2[0], C2[1], zb], [D[0], D[1], zb], c);
          quad4(plain, [A[0], A[1], za], [B[0], B[1], za], [B[0], B[1], zb], [A[0], A[1], zb], mul(c, 0.6));
        }
      }
      const rim = rgb(T2.rim || '#f2f2ec'), [bx, by] = trib.at(1 - back / 2, 0);
      obox(plain, bx, by, trib.vx, trib.vy, trib.M, trib.L * back, h, h + 1.6 * MPX, rim, mul(rim, 0.8));
      if (T2.press) { // cabina de prensa en el medio, arriba de todo
        const [qx, qy] = trib.at(0.9, 0);
        obox(plain, qx, qy, trib.vx, trib.vy, 6 * HPM, 2.6 * HPM, h, h + 3 * MPX, rim, [0.22, 0.28, 0.36]);
        obox(plain, qx, qy, trib.vx, trib.vy, 6.6 * HPM, 3 * HPM, h + 3 * MPX, h + 3.8 * MPX, rim, mul(rim, 0.8));
      }
    }
    if (spec.crenel) { // almenas sobre el borde
      const cc = rgb(spec.crenel);
      for (let k = 0, j = n - 1; k < n; j = k++) {
        const ax = p[2 * j], ay = p[2 * j + 1], bx = p[2 * k], by = p[2 * k + 1], l = Math.hypot(bx - ax, by - ay); if (l < 1) continue;
        const ux = (bx - ax) / l, uy = (by - ay) / l, nxo = uy * bd.sign, nyo = -ux * bd.sign;
        obox(plain, (ax + bx) / 2 - nxo * 1.2, (ay + by) / 2 - nyo * 1.2, ux, uy, l / 2, 1.2, h, h + 2, cc, mul(cc, 0.8));
        for (let d = 2; d < l - 1; d += 6) obox(plain, ax + ux * d - nxo * 1.2, ay + uy * d - nyo * 1.2, ux, uy, 1.5, 1.2, h + 2, h + 5, cc, mul(cc, 0.78));
      }
    }
    if (spec.frame) { // aristas blancas que enmarcan la torre de vidrio
      const fc = rgb(spec.frame);
      for (const [sa, sb] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        const x = o.cx + o.ax * (o.la - 1.5) * sa + o.bx * (o.lb - 1.5) * sb, y = o.cy + o.ay * (o.la - 1.5) * sa + o.by * (o.lb - 1.5) * sb;
        obox(plain, x, y, o.ax, o.ay, 1.8, 1.8, z0, h + 3, fc, mul(fc, 0.82));
      }
    }
    if (spec.pyramid) pyramid(plain, o.cx, o.cy, o.ax, o.ay, Math.min(o.la, o.lb) * 0.38, h, h + spec.pyramid.h * MPX, rgb(spec.pyramid.color));
    if (spec.spike) { // mástil en la punta alta de la vela
      const x = o.cx + o.ax * sgnA * o.la * 0.85, y = o.cy + o.ay * sgnA * o.la * 0.85;
      obox(plain, x, y, o.ax, o.ay, 1, 1, h - 2, h + 22, [0.92, 0.92, 0.9], [0.7, 0.7, 0.68]);
    }
    if (spec.tank) { // tanque de agua de hormigón sobre el techo
      const tx = o.cx + o.ax * o.la * 0.3, ty = o.cy + o.ay * o.la * 0.3;
      obox(plain, tx, ty, o.ax, o.ay, 4, 4, h, h + 7, [0.78, 0.76, 0.72], [0.6, 0.58, 0.55]);
      obox(plain, tx, ty, o.ax, o.ay, 4.6, 4.6, h + 7, h + 8, [0.86, 0.84, 0.8], [0.7, 0.68, 0.64]);
    }
    if (spec.statues) { // remates en las esquinas y al medio de los lados largos
      for (const [sa, sb] of [[-1, -1], [1, -1], [1, 1], [-1, 1], [0, -1], [0, 1]]) {
        const x = o.cx + o.ax * (o.la - 3) * sa + o.bx * (o.lb - 3) * sb, y = o.cy + o.ay * (o.la - 3) * sa + o.by * (o.lb - 3) * sb;
        obox(plain, x, y, o.ax, o.ay, 2.5, 2.5, h, h + 6, trim, mul(trim, 0.8));    // pedestal
        obox(plain, x, y, o.ax, o.ay, 1.5, 1.5, h + 6, h + 14, mul(trim, 0.92), mul(trim, 0.7)); // figura
      }
    }
    if (spec.towers) { // torres al frente: el extremo corto que da a la calle o a la plaza
      // una torre sola se agranda (más alta y ancha) para que se lea desde la cámara cenital
      const tw = spec.towers, solo = tw.layout === 'single', half = tw.w * MPX / 2 * (solo ? 1.6 : 1), th = tw.h * MPX + (solo ? Math.min(tw.h * MPX * 0.4, 32) : 0), cap = rgb(tw.capColor);
      const out = s => G.tileAtPx(o.cx + o.ax * s * (o.la + 26), o.cy + o.ay * s * (o.la + 26));
      const s = STREETISH(out(1)) || !STREETISH(out(-1)) ? 1 : -1;
      const fx = o.cx + o.ax * s * (o.la - half), fy = o.cy + o.ay * s * (o.la - half);
      const spots = tw.layout === 'twin' ? [1, -1].map(k => [fx + o.bx * k * (o.lb - half), fy + o.by * k * (o.lb - half)])
        : tw.layout === 'center' ? [[o.cx, o.cy]] : [[fx, fy]];
      for (const [x, y] of spots) {
        obox(plain, x, y, o.ax, o.ay, half, half, 0, th * 0.72, mul(wall, 1), mul(wall, 0.8));
        obox(plain, x, y, o.ax, o.ay, half + 1, half + 1, th * 0.72 - 3, th * 0.72, trim, mul(trim, 0.85)); // cornisa
        obox(plain, x, y, o.ax, o.ay, half * 0.82, half * 0.82, th * 0.72, th * 0.9, mul(wall, 1.02), mul(wall, 0.82)); // campanario
        for (const [ua, ub] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { // aberturas del campanario
          const ex = x + (o.ax * ua + o.bx * ub) * (half * 0.82 + 0.4), ey = y + (o.ay * ua + o.by * ub) * (half * 0.82 + 0.4);
          obox(plain, ex, ey, o.ax, o.ay, ub ? half * 0.35 : 0.5, ua ? half * 0.35 : 0.5, th * 0.75, th * 0.86, [0.16, 0.18, 0.24], [0.16, 0.18, 0.24]);
        }
        if (tw.clock) for (const [ua, ub] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { // reloj en las cuatro caras
          const ex = x + (o.ax * ua + o.bx * ub) * (half + 0.4), ey = y + (o.ay * ua + o.by * ub) * (half + 0.4), zc = th * 0.6;
          obox(plain, ex, ey, o.ax, o.ay, ub ? half * 0.5 : 0.6, ua ? half * 0.5 : 0.6, zc - half * 0.5, zc + half * 0.5, [0.97, 0.97, 0.94], [0.97, 0.97, 0.94]);
          obox(plain, ex + (o.ax * ua + o.bx * ub) * 0.5, ey + (o.ay * ua + o.by * ub) * 0.5, o.ax, o.ay, ub ? 0.6 : 0.7, ua ? 0.6 : 0.7, zc - 1, zc + 2, [0.1, 0.1, 0.12], [0.1, 0.1, 0.12]);
        }
        const z = th * 0.9;
        if (tw.cap === 'dome') dome(plain, x, y, o.ax, o.ay, half * 0.8, z, half * 1.4, cap);
        else if (tw.cap === 'spire') { pyramid(plain, x, y, o.ax, o.ay, half * 0.82, z, z + th * 0.45, cap); obox(plain, x, y, o.ax, o.ay, 0.6, 0.6, z + th * 0.45, z + th * 0.45 + 7, [0.9, 0.86, 0.6], [0.7, 0.66, 0.4]); }
        else pyramid(plain, x, y, o.ax, o.ay, half * 0.9, z, z + half * 1.6, cap);
        if (spec.style === 'iglesia') { // cruz de hierro en la punta, con los brazos en cruz también vistos desde arriba
          const zc = tw.cap === 'dome' ? z + half * 1.4 + 6 : tw.cap === 'spire' ? z + th * 0.45 + 7 : z + half * 1.6, cH = Math.max(9, half * 1.1), gold = [0.95, 0.82, 0.4];
          obox(plain, x, y, o.ax, o.ay, 0.7, 0.7, zc, zc + cH, gold, mul(gold, 0.75));
          obox(plain, x, y, o.ax, o.ay, cH * 0.36, 0.6, zc + cH * 0.62, zc + cH * 0.78, gold, mul(gold, 0.75));
          obox(plain, x, y, o.ax, o.ay, 0.6, cH * 0.36, zc + cH * 0.62, zc + cH * 0.78, gold, mul(gold, 0.75));
        }
      }
    }
  }
  function details(bd, h, pal, g) {
    const W2 = bd.maxx - bd.minx, H2 = bd.maxy - bd.miny;
    if (bd.floors >= 5 && W2 > 40 && H2 > 40) { // sala de máquinas
      const w = Math.round(Math.min(40, W2 * 0.3)), d = Math.round(Math.min(40, H2 * 0.3));
      const x = Math.round(bd.minx + W2 * (0.25 + G.hash(bd.id, 3, 1) * 0.3)), y = Math.round(bd.miny + H2 * (0.25 + G.hash(bd.id, 4, 1) * 0.3));
      if (G.rectInside(bd, x, y, w + 4, d + 4)) box(g, x, y, h, w, d, 10, rgb(pal[2]), rgb(pal[3]));
    }
    const count = bd.m2 < 250 ? (G.hash(bd.id, 5, 1) < 0.55 ? 1 : 0) : Math.min(7, Math.floor(bd.m2 / 220));
    let placed = 0;
    for (let t = 0; t < count * 4 && placed < count; t++) {
      const x = Math.round(bd.minx + 2 + G.hash(bd.id, t, 11) * (W2 - 10)), y = Math.round(bd.miny + 2 + G.hash(bd.id, t, 12) * (H2 - 10));
      if (!G.rectInside(bd, x, y, 7, 7)) continue;
      placed++;
      if (bd.m2 < 250 || G.hash(bd.id, t, 13) < 0.45) box(g, x, y, h, 5, 5, 6, [0.25, 0.25, 0.3], [0.11, 0.11, 0.14]); // tanque negro
      else box(g, x, y, h, 6, 5, 4, [0.8, 0.82, 0.86], [0.6, 0.62, 0.68]); // aire acondicionado
    }
  }
  // faroles: amarillos de doble brazo en los parterres (como en la 3 de Abril) y grises de un brazo en las veredas;
  // semáforos amarillos (como los de Corrientes) donde OSM marca uno
  const SIGNALS = [];
  for (let i = 0; i + 1 < G.SIGNALS.length; i += 2) SIGNALS.push([(G.SIGNALS[i] + 0.5) * TS, (G.SIGNALS[i + 1] + 0.5) * TS]);
  function furniture(cx, cy, g) {
    const x0 = cx * G.CH, y0 = cy * G.CH, yellow = rgb('#e0c030'), gray = rgb('#7a7a82'), head = rgb('#d8d8d0');
    const RL = G.T_ALL.ROADLIKE;
    for (let ly = 0; ly < G.CH; ly++) for (let lx = 0; lx < G.CH; lx++) {
      const tx = x0 + lx, ty = y0 + ly, t = G.tileAt(tx, ty), px = tx * TS + TS / 2, py = ty * TS + TS / 2;
      if (t === G.T_ALL.MEDIAN && G.hash(tx, ty, 51) < 0.07) {
        const alongX = G.tileAt(tx, ty - 1) !== t || G.tileAt(tx, ty + 1) !== t; // la calle está arriba/abajo
        const ax = alongX ? 0 : 1, ay = alongX ? 1 : 0;
        obox(g, px, py, 1, 0, 1.5, 1.5, 0, 46, yellow, mul(yellow, 0.75));
        obox(g, px, py, ax, ay, 12, 1, 44, 46, yellow, mul(yellow, 0.8));
        for (const sg of [1, -1]) box(g, px + ax * 12 * sg - 2.5, py + ay * 12 * sg - 2.5, 41, 5, 5, 3, head, mul(head, 0.7));
      } else if (t === G.T_ALL.SIDE && G.hash(tx, ty, 52) < 0.03) {
        let dx = 0, dy = 0;
        if (RL[G.tileAt(tx + 1, ty)]) dx = 1; else if (RL[G.tileAt(tx - 1, ty)]) dx = -1; else if (RL[G.tileAt(tx, ty + 1)]) dy = 1; else if (RL[G.tileAt(tx, ty - 1)]) dy = -1; else continue;
        obox(g, px - dx * 4, py - dy * 4, 1, 0, 1, 1, 0, 38, gray, mul(gray, 0.75));
        obox(g, px + dx * 2, py + dy * 2, dx || 1, dy, dx ? 6 : 1, dx ? 1 : 6, 36, 38, gray, mul(gray, 0.8));
        box(g, px + dx * 8 - 2, py + dy * 8 - 2, 33, 4, 4, 3, head, mul(head, 0.7));
      }
    }
    for (const [sx, sy] of SIGNALS) {
      if (Math.floor(sx / CPX) !== cx || Math.floor(sy / CPX) !== cy) continue;
      // poste en la esquina de vereda más cercana y brazo hacia el cruce
      let best = null;
      for (let r = 1; r < 7 && !best; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        const tx = Math.floor(sx / TS) + dx, ty = Math.floor(sy / TS) + dy;
        if (G.tileAt(tx, ty) === G.T_ALL.SIDE && (!best || dx * dx + dy * dy < best[2])) best = [tx * TS + TS / 2, ty * TS + TS / 2, dx * dx + dy * dy];
      }
      if (!best) continue;
      const [bx, by] = best, vx = sx - bx, vy = sy - by, l = Math.hypot(vx, vy) || 1, ux = vx / l, uy = vy / l, armL = Math.min(26, l * 0.6);
      obox(g, bx, by, 1, 0, 1.5, 1.5, 0, 34, rgb('#e0c030'), rgb('#a88c20'));
      obox(g, bx + ux * armL / 2, by + uy * armL / 2, ux, uy, armL / 2, 1, 32, 34, rgb('#e0c030'), rgb('#a88c20'));
      const hx = bx + ux * armL, hy = by + uy * armL;
      obox(g, hx, hy, ux, uy, 3, 3, 20, 31, rgb('#e8c828'), rgb('#b09018'));
      box(g, hx - 1, hy - 3, 31, 2, 2, 1, rgb('#ff3020'), rgb('#ff3020'));
      box(g, hx - 1, hy - 1, 31, 2, 2, 1, rgb('#ffb020'), rgb('#ffb020'));
      box(g, hx - 1, hy + 1, 31, 2, 2, 1, rgb('#30e060'), rgb('#30e060'));
    }
  }
  function buildBlock(cx, cy) {
    const group = new T.Group(), list = BCENT.get(KEY(cx, cy)) || [];
    const geos = {}, getG = k => geos[k] || (geos[k] = Geo()), lines = { pos: [], col: [] };
    for (const bd of list) {
      if (bd.name && LM[bd.name]) { buildLandmark(bd, bd.name, getG, lines); continue; }
      const p = bd.pts, n = bd.n, h = bd.floors * FLOOR, id = bd.id;
      const tall = bd.floors >= 3;
      const centro = Math.max(0, 1 - Math.hypot((bd.minx + bd.maxx) / 2 - G.SPAWN.x, (bd.miny + bd.maxy) / 2 - G.SPAWN.y) / 9000);
      const paints = tall ? PAINT_DEPTO : PAINT_CASA, paint = paints[Math.floor(G.hash(id, 2, 9) * paints.length)];
      const med = PAINT_MED[Math.floor(G.hash(id, 6, 9) * PAINT_MED.length)];
      const groundT = G.hash(id, 3, 9) < 0.15 + 0.45 * centro ? 'comercio' : 'casa';
      const upperT = tall ? 'depto' : 'casa2';
      for (let k = 0, j = n - 1; k < n; j = k++) {
        const ax = p[2 * j], ay = p[2 * j + 1], bx = p[2 * k], by = p[2 * k + 1];
        const len = Math.hypot(bx - ax, by - ay); if (len < 1) continue;
        const nxo = (by - ay) / len * bd.sign, nyo = -(bx - ax) / len * bd.sign;
        const t = G.tileAtPx((ax + bx) / 2 + nxo * 4, (ay + by) / 2 + nyo * 4);
        const light = 0.72 + 0.28 * Math.max(0, -(nxo * 0.6 + nyo * 0.8)); // luz desde el noroeste
        const u0 = Math.floor(G.hash(id, k, 5) * 4) / 4;
        if (t === TT.BLOCK || t === TT.OSMB) { // medianera contra el vecino
          quad(getG('medianera'), ax, ay, bx, by, 0, h, u0, u0 + len / FAC.medianera.w, 0, h / FLOOR, mul(med, light));
          continue;
        }
        const back = t === TT.YARD, c = mul(paint, light);
        const gt = back ? 'trasera' : groundT, ut = back ? 'trasera' : upperT;
        quad(getG(gt), ax, ay, bx, by, 0, FLOOR, u0, u0 + len / FAC[gt].w, 0, 1, c);
        if (h > FLOOR) quad(getG(ut), ax, ay, bx, by, FLOOR, h, u0, u0 + len / FAC[ut].w, 0, (h - FLOOR) / FLOOR, c);
      }
      // techo
      const contour = []; for (let k = 0; k < n; k++) contour.push(new T.Vector2(p[2 * k], p[2 * k + 1]));
      let faces = []; try { faces = T.ShapeUtils.triangulateShape(contour, []); } catch (e) { /* polígono raro */ }
      const pal = G.roofPal(bd), rc = rgb(pal[0]), rg = getG('r_' + bd.style);
      for (const f of faces) for (const i of f) pv(rg, p[2 * i], p[2 * i + 1], h, p[2 * i] / 16, p[2 * i + 1] / 16, rc);
      const oc = rgb(pal[1]);
      for (let k = 0, j = n - 1; k < n; j = k++) {
        lines.pos.push(p[2 * j], -p[2 * j + 1], h + 0.3, p[2 * k], -p[2 * k + 1], h + 0.3);
        lines.col.push(oc[0], oc[1], oc[2], oc[0], oc[1], oc[2]);
      }
      details(bd, h, pal, getG('plain'));
    }
    furniture(cx, cy, getG('plain'));
    for (const k in geos) group.add(toMesh(geos[k], k === 'plain' ? plainMat : k.startsWith('r_') ? roofMat(k.slice(2)) : k.startsWith('lm_') ? lmMat(k.slice(3)) : facMat(k)));
    if (lines.pos.length) group.add(toLines(lines));
    return group;
  }
  const blocks = new Map();
  let builtBlocks = 0;
  function getBlock(cx, cy) {
    const k = KEY(cx, cy);
    let b = blocks.get(k);
    if (!b) {
      if (builtBlocks >= 2) return null; // como mucho 2 manzanas nuevas por cuadro
      builtBlocks++;
      b = { group: buildBlock(cx, cy), used: frame };
      blocks.set(k, b); scene.add(b.group);
      if (blocks.size > 110) {
        let ok = -1, ou = Infinity;
        for (const [kk, v] of blocks) if (v.used < ou && v.used < frame) { ou = v.used; ok = kk; }
        const old = blocks.get(ok);
        if (old) { scene.remove(old.group); old.group.traverse(o => o.geometry && o.geometry.dispose()); blocks.delete(ok); }
      }
    }
    b.used = frame; b.group.visible = true;
    return b;
  }

  // ------------------------------------------------------------ puentes (el General Belgrano, atirantado)
  // Referencia: torres en "A" con los tensores en abanico desde el vértice, vano central de ~245 m
  // corrido hacia la costa correntina (~517 m del agua), pilas cada ~80 m y defensas triangulares rojas.
  const bridgeGroup = new T.Group(); scene.add(bridgeGroup);
  function prism(g, pts, z0, z1, top, side) { // prisma vertical de base poligonal convexa
    const n = pts.length, shades = [1, 0.84, 0.68, 0.9, 0.78, 0.95];
    for (let i = 0; i < n; i++) { const a = pts[i], b = pts[(i + 1) % n]; quad(g, a[0], a[1], b[0], b[1], z0, z1, 0, 0, 0, 0, mul(side, shades[i % 6])); }
    for (let i = 1; i + 1 < n; i++) { pv(g, pts[0][0], pts[0][1], z1, 0, 0, top); pv(g, pts[i][0], pts[i][1], z1, 0, 0, top); pv(g, pts[i + 1][0], pts[i + 1][1], z1, 0, 0, top); }
  }
  function leg(g, bx, by, tx, ty, z1, ux, uy, w, col) { // pata inclinada de sección w x w, del agua al vértice
    const hx = tx - bx, hy = ty - by, hl = Math.hypot(hx, hy) || 1, h = [hx / hl, hy / hl];
    const off = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([su, sh]) => [ux * su * w / 2 + h[0] * sh * w / 2, uy * su * w / 2 + h[1] * sh * w / 2]);
    const shades = [1, 0.8, 0.66, 0.9];
    for (let i = 0; i < 4; i++) {
      const a = off[i], b = off[(i + 1) % 4];
      quad4(g, [bx + a[0], by + a[1], 0], [bx + b[0], by + b[1], 0], [tx + b[0], ty + b[1], z1], [tx + a[0], ty + a[1], z1], mul(col, shades[i]));
    }
  }
  function leg3(g, B, Tp, cx, cy, w, col) { // pata de sección w x w entre dos puntos 3D (cx,cy = eje transversal)
    const hx = Tp[0] - B[0], hy = Tp[1] - B[1], hl = Math.hypot(hx, hy) || 1, h = [hx / hl, hy / hl];
    const off = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([su, sh]) => [cx * su * w / 2 + h[0] * sh * w / 2, cy * su * w / 2 + h[1] * sh * w / 2]);
    const shades = [1, 0.8, 0.66, 0.9];
    for (let i = 0; i < 4; i++) {
      const a = off[i], c = off[(i + 1) % 4];
      quad4(g, [B[0] + a[0], B[1] + a[1], B[2]], [B[0] + c[0], B[1] + c[1], B[2]], [Tp[0] + c[0], Tp[1] + c[1], Tp[2]], [Tp[0] + a[0], Tp[1] + a[1], Tp[2]], mul(col, shades[i]));
    }
  }
  (function buildBridges() {
    const gp = Geo(), gd = Geo(), gs = Geo(), cables = { pos: [], col: [] };
    const concrete = rgb('#b4b0a8'), concreteD = rgb('#8a867e'), rail = rgb('#e0e0d8'), pyl = rgb('#dedad2'), cableC = rgb('#f2f2f2');
    const red = rgb('#c0604a'), redD = rgb('#8a3e32');
    for (const b of G.BRIDGES) {
      const hw = b.wpx / 2, step = 16, S = [];
      for (let s = 0; s <= b.L; s += step) S.push(s);
      if (S[S.length - 1] < b.L) S.push(b.L);
      const P = S.map(s => G.bridgePoint(b, s));
      const N = P.map((q, i) => {
        const a = P[Math.max(0, i - 1)], c = P[Math.min(P.length - 1, i + 1)];
        const dx = c.x - a.x, dy = c.y - a.y, l = Math.hypot(dx, dy) || 1;
        return { ux: dx / l, uy: dy / l, nx: -dy / l, ny: dx / l };
      });
      const Nat = s => N[Math.min(N.length - 1, Math.max(0, Math.round(s / step)))];
      const Z = S.map(s => G.bridgeZ(b, s));
      let nextPier = 0;
      for (let i = 0; i + 1 < S.length; i++) {
        const z0 = Math.max(0.7, Z[i]), z1 = Math.max(0.7, Z[i + 1]);
        if (Z[i] < 0.2 && Z[i + 1] < 0.2) continue; // ya en el piso: lo dibuja el mapa
        const a = P[i], c = P[i + 1], na = N[i], nc = N[i + 1];
        const aL = [a.x + na.nx * hw, a.y + na.ny * hw], aR = [a.x - na.nx * hw, a.y - na.ny * hw];
        const cL = [c.x + nc.nx * hw, c.y + nc.ny * hw], cR = [c.x - nc.nx * hw, c.y - nc.ny * hw];
        const v0 = S[i] / 32, v1 = S[i + 1] / 32;
        quad4(gd, [aR[0], aR[1], z0], [aL[0], aL[1], z0], [cL[0], cL[1], z1], [cR[0], cR[1], z1], [1, 1, 1], [[0, v0], [1, v0], [1, v1], [0, v1]]);
        for (const [A, C, sh] of [[aL, cL, 0.9], [aR, cR, 0.7]]) {
          if (z0 < 3 && z1 < 3) continue; // en la punta de la rampa no hay costados ni barandas
          quad4(gp, [A[0], A[1], Math.max(0, z0 - 9)], [C[0], C[1], Math.max(0, z1 - 9)], [C[0], C[1], z1], [A[0], A[1], z0], mul(concrete, sh));
          quad4(gp, [A[0], A[1], z0], [C[0], C[1], z1], [C[0], C[1], z1 + 5], [A[0], A[1], z0 + 5], mul(rail, sh));
        }
        const o0 = z0 * 0.42, o1 = z1 * 0.42;
        quad4(gs, [aR[0] + o0, aR[1] + o0, 0.6], [aL[0] + o0, aL[1] + o0, 0.6], [cL[0] + o1, cL[1] + o1, 0.6], [cR[0] + o1, cR[1] + o1, 0.6], [0, 0, 0]);
        // pilas cada ~80 m (una columna ancha bajo el tablero)
        if (S[i] >= nextPier && z0 > 18) {
          nextPier = S[i] + 427;
          obox(gp, a.x, a.y, na.nx, na.ny, hw * 0.72, 7, 0, z0 - 9, concrete, concreteD);
          quad4(gs, [a.x - na.nx * hw * 0.7, a.y - na.ny * hw * 0.7, 0.7], [a.x + na.nx * hw * 0.7, a.y + na.ny * hw * 0.7, 0.7],
                [a.x + na.nx * hw * 0.7 + z0 * 0.42, a.y + na.ny * hw * 0.7 + z0 * 0.42, 0.7], [a.x - na.nx * hw * 0.7 + z0 * 0.42, a.y - na.ny * hw * 0.7 + z0 * 0.42, 0.7], [0, 0, 0]);
        }
      }
      if (!b.pylons) continue;
      // ¿dónde empieza el agua del lado de Corrientes (el extremo este)?
      const eastAtEnd = P[P.length - 1].x > P[0].x;
      let sShore = null;
      for (let k = 0; k < S.length; k++) {
        const i = eastAtEnd ? S.length - 1 - k : k;
        if (G.tileAt(Math.floor(P[i].x / TS), Math.floor(P[i].y / TS)) === TT.BRIDGEW) { sShore = S[i]; break; }
      }
      const sC = sShore === null ? b.L / 2 : sShore + (eastAtEnd ? -2757 : 2757);
      const HP = b.pylonPx;
      for (const sp of [sC - 653, sC + 653]) {
        // Cada torre: dos marcos en "A", uno a cada lado del tablero, con las patas abiertas a lo largo del puente,
        // sobre una base maciza de hormigón; arriba los une un cabezal y los tensores bajan desde la cabeza de cada A.
        const q = G.bridgePoint(b, sp), nn = Nat(sp), zd = G.bridgeZ(b, sp), off = hw + 14, spread = 70, base = 22;
        const brown = rgb('#7a5a48');
        obox(gp, q.x, q.y, nn.ux, nn.uy, spread + 24, off + 18, 0, base, mul(brown, 1.05), mul(brown, 0.78));
        quad4(gs, [q.x - nn.nx * (off + 18), q.y - nn.ny * (off + 18), 0.8], [q.x + nn.nx * (off + 18), q.y + nn.ny * (off + 18), 0.8],
              [q.x + nn.nx * (off + 18) + 9, q.y + nn.ny * (off + 18) + 9, 0.8], [q.x - nn.nx * (off + 18) + 9, q.y - nn.ny * (off + 18) + 9, 0.8], [0, 0, 0]);
        const tops = [];
        for (const sgn of [1, -1]) {
          const cx = q.x + nn.nx * off * sgn, cy = q.y + nn.ny * off * sgn, apex = [cx, cy, HP];
          for (const dir of [1, -1]) leg3(gp, [cx + nn.ux * spread * dir, cy + nn.uy * spread * dir, base], apex, nn.nx, nn.ny, 9, pyl);
          const f = (zd - 16 - base) / (HP - base), half = spread * (1 - f);
          obox(gp, cx, cy, nn.ux, nn.uy, half, 4, zd - 22, zd - 12, pyl, mul(pyl, 0.85)); // tirante a la altura del tablero
          obox(gp, cx, cy, nn.ux, nn.uy, 9, 6, HP - 26, HP + 6, pyl, mul(pyl, 0.8));     // cabeza de la A (anclaje de tensores)
          tops.push([cx, cy]);
          const sx = HP * 0.42; // sombra de la A sobre el agua
          tri3(gs, [cx + nn.ux * spread, cy + nn.uy * spread, 0.8], [cx - nn.ux * spread, cy - nn.uy * spread, 0.8], [cx + sx, cy + sx, 0.8], [0, 0, 0]);
        }
        obox(gp, q.x, q.y, nn.nx, nn.ny, off, 5, HP - 14, HP + 2, pyl, mul(pyl, 0.88)); // cabezal que une las dos A
        obox(gp, q.x, q.y, nn.nx, nn.ny, off, 6, zd - 24, zd - 12, pyl, mul(pyl, 0.88)); // travesaño bajo el tablero
        // tensores: de la cabeza de cada A al borde del tablero de su mismo lado, hacia los dos lados del puente
        for (let k = 1; k <= 12; k++) for (const dir of [1, -1]) {
          const s2 = sp + dir * (40 + k * 50);
          if (s2 < 0 || s2 > b.L) continue;
          const d = G.bridgePoint(b, s2), nd = Nat(s2), ez = G.bridgeZ(b, s2) + 5;
          for (const sgn of [1, -1]) {
            const [tx, ty] = tops[sgn > 0 ? 0 : 1];
            cables.pos.push(tx, -ty, HP - 22 + k * 1.3, d.x + nd.nx * (hw - 2) * sgn, -(d.y + nd.ny * (hw - 2) * sgn), ez);
            cables.col.push(...cableC, ...cableC);
          }
        }
      }
      // defensas triangulares rojas que protegen las pilas del canal de navegación
      const defensa = (sp, dist, base, len) => {
        const q = G.bridgePoint(b, sp), nn = Nat(sp);
        for (const sgn of [1, -1]) {
          const cx = q.x + nn.nx * dist * sgn, cy = q.y + nn.ny * dist * sgn;
          const tri = [[cx - nn.ux * base / 2, cy - nn.uy * base / 2], [cx + nn.ux * base / 2, cy + nn.uy * base / 2],
                       [cx + nn.nx * len * sgn, cy + nn.ny * len * sgn]];
          prism(gp, sgn > 0 ? tri : [tri[1], tri[0], tri[2]], 0, 20, red, redD);
          quad4(gs, [tri[0][0] + 8, tri[0][1] + 8, 0.7], [tri[1][0] + 8, tri[1][1] + 8, 0.7], [tri[2][0] + 8, tri[2][1] + 8, 0.7], [tri[2][0] + 8, tri[2][1] + 8, 0.7], [0, 0, 0]);
        }
      };
      for (const sp of [sC - 653, sC + 653]) defensa(sp, 190, 180, 250);
      for (const sp of [sC - 1472, sC + 1472]) defensa(sp, 330, 130, 170);
    }
    if (gd.pos.length) bridgeGroup.add(toMesh(gd, deckMat));
    if (gp.pos.length) bridgeGroup.add(toMesh(gp, plainMat));
    // (las sombras falsas pintadas en el agua ya no hacen falta: ahora las tira el sol)
    if (cables.pos.length) bridgeGroup.add(toLines(cables));
  })();

  // ------------------------------------------------------------ pórtico de carteles de la Av. 3 de Abril
  function signCanvas(lines, w, h, bg) {
    return cv(w, h, g => {
      g.fillStyle = bg; g.fillRect(0, 0, w, h);
      g.fillStyle = '#f4f4f0'; g.fillRect(1, 1, w - 2, 1); g.fillRect(1, h - 2, w - 2, 1); g.fillRect(1, 1, 1, h - 2); g.fillRect(w - 2, 1, 1, h - 2);
      g.font = 'bold 9px monospace'; g.textAlign = 'center'; g.textBaseline = 'top';
      lines.forEach((t, i) => g.fillText(t, w / 2, 4 + i * 11));
      // flecha hacia abajo
      const ax = w / 2, ay = h - 11;
      g.fillRect(ax - 1, ay, 3, 5); g.fillRect(ax - 4, ay + 5, 9, 1); g.fillRect(ax - 3, ay + 6, 7, 1); g.fillRect(ax - 2, ay + 7, 5, 1); g.fillRect(ax - 1, ay + 8, 3, 1);
    });
  }
  const signMat = c => new T.MeshLambertMaterial({ map: nearest(new T.CanvasTexture(c)), side: T.DoubleSide });
  function panel(group, mat, cx, cy, ux, uy, nx, ny, w, ztop, depth, drop) {
    const g = Geo(), wh = w / 2;
    quad4(g, [cx - nx * wh - ux * depth, cy - ny * wh - uy * depth, ztop - drop], [cx + nx * wh - ux * depth, cy + ny * wh - uy * depth, ztop - drop],
          [cx + nx * wh, cy + ny * wh, ztop], [cx - nx * wh, cy - ny * wh, ztop], [1, 1, 1], [[0, 0], [1, 0], [1, 1], [0, 1]]);
    group.add(toMesh(g, mat));
  }
  if (G.GANTRY) {
    const gg = G.GANTRY, ux = gg.ux, uy = gg.uy, nx = -uy, ny = ux, span = gg.half + 8, gp = Geo();
    const yellow = rgb('#d8c030'), steel = rgb('#9a9aa2');
    for (const s of [1, -1]) obox(gp, gg.x + nx * span * s, gg.y + ny * span * s, ux, uy, 3, 3, 0, 56, steel, mul(steel, 0.8));
    obox(gp, gg.x, gg.y, nx, ny, span, 3, 50, 56, steel, mul(steel, 0.85));
    obox(gp, gg.x - ux * 6, gg.y - uy * 6, nx, ny, span, 2, 44, 48, steel, mul(steel, 0.75));
    const furn = new T.Group(); scene.add(furn);
    furn.add(toMesh(gp, plainMat));
    const w = span * 0.92;
    panel(furn, signMat(signCanvas(['PROV. DEL CHACO', 'AV. COSTANERA'], 96, 40, '#1e8a5c')), gg.x - nx * w / 2, gg.y - ny * w / 2, ux, uy, nx, ny, w - 4, 52, 30, 16);
    panel(furn, signMat(signCanvas(['CALLE SANTA FE', 'CENTRO'], 96, 40, '#1e8a5c')), gg.x + nx * w / 2, gg.y + ny * w / 2, ux, uy, nx, ny, w - 4, 52, 30, 16);
    // cartel de velocidad máxima en la vereda, antes del pórtico
    const vx = gg.x + nx * (span + 10) - ux * 70, vy = gg.y + ny * (span + 10) - uy * 70, gv = Geo();
    obox(gv, vx, vy, ux, uy, 1.5, 1.5, 0, 30, steel, mul(steel, 0.8));
    furn.add(toMesh(gv, plainMat));
    const vel = cv(32, 40, g => {
      g.fillStyle = '#f4f4f0'; g.fillRect(0, 0, 32, 40); g.fillStyle = '#222'; g.fillRect(0, 0, 32, 1); g.fillRect(0, 39, 32, 1); g.fillRect(0, 0, 1, 40); g.fillRect(31, 0, 1, 40);
      g.fillStyle = '#d02020'; g.beginPath(); g.arc(16, 12, 10, 0, 7); g.fill(); g.fillStyle = '#f4f4f0'; g.beginPath(); g.arc(16, 12, 7, 0, 7); g.fill();
      g.fillStyle = '#111'; g.font = 'bold 9px monospace'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('40', 16, 13);
      g.font = 'bold 5px monospace'; g.fillText('VELOCIDAD', 16, 27); g.fillText('MAXIMA', 16, 32); g.fillStyle = '#c02020'; g.fillText('RADAR', 16, 37);
    });
    panel(furn, signMat(vel), vx, vy, ux, uy, nx, ny, 14, 32, 14, 8);
  }

  // ------------------------------------------------------------ props armados a mano (rejas, chimenea, ruinas)
  function prism8(g, cx, cy, r, z0, z1, top, side) {
    const C = []; for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 + Math.PI / 8; C.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); }
    const shades = [0.7, 0.62, 0.72, 0.85, 1, 1, 0.95, 0.8];
    for (let i = 0; i < 8; i++) { const a = C[i], b = C[(i + 1) % 8]; quad(g, a[0], a[1], b[0], b[1], z0, z1, 0, 0, 0, 0, mul(side, shades[i])); }
    for (let i = 1; i < 7; i++) { pv(g, C[0][0], C[0][1], z1, 0, 0, top); pv(g, C[i][0], C[i][1], z1, 0, 0, top); pv(g, C[i + 1][0], C[i + 1][1], z1, 0, 0, top); }
  }
  (function buildProps() {
    const PR = G.PROPS || {}, gp = Geo(), gs = Geo(), MPXp = FLOOR / 3, px = t => (t + 0.5) * TS;
    const white = rgb('#eeece6'), iron0 = rgb('#3a3632'), conc = rgb('#a8a49c'), redIron = rgb('#c0302a');
    for (const [x1t, y1t, x2t, y2t, kind] of PR.fences || []) {
      const x1 = px(x1t), y1 = px(y1t), x2 = px(x2t), y2 = px(y2t), l = Math.hypot(x2 - x1, y2 - y1) || 1, ux = (x2 - x1) / l, uy = (y2 - y1) / l;
      const cx = (x1 + x2) / 2, cy = (y1 + y2) / 2;
      if (kind === 'wall') { obox(gp, cx, cy, ux, uy, l / 2, 1, 0, 6, white, mul(white, 0.82)); continue; }
      const cancha = kind === 'cancha', iron = cancha ? redIron : iron0;   // alambrado rojo alrededor de la cancha
      const base = kind === 'porch' || cancha ? 1 : 4, top = kind === 'porch' ? 6 : cancha ? 9 : 11;
      obox(gp, cx, cy, ux, uy, l / 2, 1, 0, base, white, mul(white, 0.82));
      for (let d = 1; d < l; d += cancha ? 8 : 3) obox(gp, x1 + ux * d, y1 + uy * d, ux, uy, 0.4, 0.4, base, top, iron, iron);
      if (cancha) obox(gp, cx, cy, ux, uy, l / 2, 0.3, top * 0.55, top * 0.55 + 0.6, iron, iron);
      obox(gp, cx, cy, ux, uy, l / 2, 0.5, top - 1, top, iron, iron);
      if (kind === 'rail') for (let d = 0; d <= l; d += 14) obox(gp, x1 + ux * d, y1 + uy * d, ux, uy, 1.4, 1.4, 0, top + 1, white, mul(white, 0.8)); // pilares
    }
    for (const [x1t, y1t, x2t, y2t] of PR.ruins || []) { // cimientos de la fábrica vieja
      const x1 = px(x1t), y1 = px(y1t), x2 = px(x2t), y2 = px(y2t), l = Math.hypot(x2 - x1, y2 - y1) || 1;
      obox(gp, (x1 + x2) / 2, (y1 + y2) / 2, (x2 - x1) / l, (y2 - y1) / l, l / 2, 1.5, 0, 3, conc, mul(conc, 0.75));
    }
    for (const [xt, yt, hm] of PR.chimneys || []) { // chimenea de ladrillo con anillos
      const x = px(xt), y = px(yt), H = hm * MPXp, baseH = 4 * MPXp, bs = 1.7 * MPXp;
      obox(gp, x, y, 1, 0, bs, bs, 0, baseH, rgb('#c8a284'), rgb('#a8805e'));
      obox(gp, x, y, 1, 0, bs + 0.8, bs + 0.8, baseH - 1.5, baseH, rgb('#e0d4c4'), rgb('#c0b4a4'));
      const segs = 14, r0 = 1.5 * MPXp, r1 = 0.9 * MPXp;
      for (let k = 0; k < segs; k++) {
        const z0 = baseH + (H - baseH) * k / segs, z1 = baseH + (H - baseH) * (k + 1) / segs, r = r0 + (r1 - r0) * (k + 0.5) / segs;
        const band = k % 3 === 2;
        prism8(gp, x, y, r, z0, z1, rgb('#6a3a2a'), rgb(band ? '#c88a62' : '#a8583a'));
      }
      prism8(gp, x, y, r1 + 1.2, H, H + 3, rgb('#2a1a14'), rgb('#7a4a36')); // corona
      const sx = H * 0.42;
      quad4(gs, [x - r0, y, 0.6], [x + r0, y, 0.6], [x + r1 + sx, y + sx, 0.6], [x - r1 + sx, y + sx, 0.6], [0, 0, 0]);
    }
    const HPMp = TS / (G.MD.tileMeters || 2.25);
    for (const [xt, yt, bx, by, dx, dy] of PR.goals || []) { // arcos de fútbol (7,32 x 2,44 m) con la red atrás
      const x = px(xt), y = px(yt), hw = 3.66 * HPMp, H = 2.44 * MPXp, dp = 1.8 * HPMp, net = rgb('#d8d8d0');
      for (const s of [-1, 1]) {
        obox(gp, x + bx * hw * s, y + by * hw * s, bx, by, 0.5, 0.5, 0, H, white, white);
        obox(gp, x + bx * hw * s + dx * dp / 2, y + by * hw * s + dy * dp / 2, dx, dy, dp / 2, 0.3, 0, 0.6, net, net);
      }
      obox(gp, x, y, bx, by, hw + 0.5, 0.5, H - 0.8, H, white, white);
      obox(gp, x + dx * dp, y + dy * dp, bx, by, hw, 0.3, 0, 0.6, net, net);
      quad4(gp, [x + bx * hw, y + by * hw, H], [x - bx * hw, y - by * hw, H], [x - bx * hw + dx * dp, y - by * hw + dy * dp, 0.6], [x + bx * hw + dx * dp, y + by * hw + dy * dp, 0.6], mul(net, 0.9));
    }
    for (const [xt, yt, hm] of PR.floodlights || []) { // torres de iluminación, mirando a la cancha más cercana
      const x = px(xt), y = px(yt), H = hm * MPXp, gray = rgb('#9a9aa2');
      let fx = 0, fy = 1, best = Infinity;
      for (const q of PR.pitches || []) {
        const qx = px((q[0] + q[2] + q[4] + q[6]) / 4), qy = px((q[1] + q[3] + q[5] + q[7]) / 4), d = Math.hypot(qx - x, qy - y);
        if (d < best) { best = d; fx = (qx - x) / d; fy = (qy - y) / d; }
      }
      obox(gp, x, y, 1, 0, 0.9, 0.9, 0, H, gray, mul(gray, 0.75));
      obox(gp, x + fx * 1.5, y + fy * 1.5, -fy, fx, 2.6 * HPMp, 0.7 * HPMp, H, H + 2.6 * MPXp, mul(gray, 0.8), mul(gray, 0.6));
      for (let i = -1; i <= 1; i++) for (let j = 0; j < 2; j++)
        obox(gp, x + fx * 3 - fy * i * 1.7 * HPMp, y + fy * 3 + fx * i * 1.7 * HPMp, -fy, fx, 0.7 * HPMp, 0.4, H + (0.4 + j * 1.2) * MPXp, H + (1.2 + j * 1.2) * MPXp, rgb('#fff6c8'), rgb('#f4e8a0'));
      const sx = H * 0.42; quad4(gs, [x - 1, y, 0.6], [x + 1, y, 0.6], [x + 1 + sx, y + sx, 0.6], [x - 1 + sx, y + sx, 0.6], [0, 0, 0]);
    }
    for (const [xt, yt, hm] of PR.pillars || []) obox(gp, px(xt), px(yt), 1, 0, 1.4, 1.4, 0, hm * MPXp, rgb('#f2f2ee'), rgb('#c8c8c4'));
    for (const [xt, yt, rm, hm] of PR.turrets || []) { // torreones redondos con almenas (La Unidad)
      const x = px(xt), y = px(yt), r = rm * MPXp, H = hm * MPXp, brick = rgb('#b8664a'), cream = rgb('#e6d2a8');
      prism8(gp, x, y, r, 0, H - 3, brick, brick);
      prism8(gp, x, y, r + 1, H - 3, H, cream, cream);
      for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; obox(gp, x + Math.cos(a) * r, y + Math.sin(a) * r, Math.cos(a + Math.PI / 2), Math.sin(a + Math.PI / 2), 1.6, 1, H, H + 3, cream, mul(cream, 0.8)); }
      const sx = H * 0.42; quad4(gs, [x - r, y, 0.6], [x + r, y, 0.6], [x + r + sx, y + sx, 0.6], [x - r + sx, y + sx, 0.6], [0, 0, 0]);
    }
    for (const [xt, yt, hm] of PR.watertowers || []) { // tanque de agua elevado
      const x = px(xt), y = px(yt), H = hm * MPXp, r = 2.6 * MPXp, w = rgb('#e8e8e4');
      for (const [dx, dy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) obox(gp, x + dx * r * 0.6, y + dy * r * 0.6, 1, 0, 0.8, 0.8, 0, H, rgb('#9a9aa0'), rgb('#7a7a80'));
      prism8(gp, x, y, r, H, H + 4 * MPXp, w, w);
      pyramid(gp, x, y, 1, 0, r * 0.9, H + 4 * MPXp, H + 5.5 * MPXp, mul(w, 0.9));
    }
    if (gp.pos.length) scene.add(toMesh(gp, plainMat));
  })();

  // ------------------------------------------------------------ sprites (autos, peatones) y capa de efectos
  // Los sprites van a la altura del techo del auto / la cabeza del peatón; debajo, una caja invisible
  // que solo existe para el mapa de sombras: así cada auto y cada peatón tira su sombra con el sol.
  const sprMats = new Map();
  function sprMat(c) {
    let m = sprMats.get(c);
    if (!m) { m = new T.MeshLambertMaterial({ map: nearest(new T.CanvasTexture(c)), alphaTest: 0.5 }); sprMats.set(c, m); }
    return m;
  }
  const shadowMat = new T.MeshBasicMaterial({ color: 0x000010, transparent: true, opacity: 0.26, depthWrite: false });
  const casterMat = new T.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
  const casterGeo = new T.BoxGeometry(1, 1, 1); casterGeo.translate(0, 0, 0.5);
  function pool(mat, geo, opts) {
    const arr = []; let used = 0;
    return {
      reset() { used = 0; },
      get(m) {
        if (used >= arr.length) { const o = new T.Mesh(geo || unitPlane, mat); Object.assign(o, opts || {}); scene.add(o); arr.push(o); }
        const o = arr[used++]; o.visible = true; if (m) o.material = m; return o;
      },
      finish() { for (let i = used; i < arr.length; i++) arr[i].visible = false; },
    };
  }
  const sprites = pool(null, null, { receiveShadow: true }), shadows = pool(shadowMat), casters = pool(casterMat, casterGeo, { castShadow: true, renderOrder: -1 });
  function place(o, x, y, z, a, w, h) { o.position.set(x, -y, z); o.rotation.set(0, 0, -a - Math.PI / 2); o.scale.set(w, h, 1); }
  function caster(x, y, z, a, l, w, h) { const o = casters.get(); o.position.set(x, -y, z); o.rotation.set(0, 0, -a); o.scale.set(l, w, h); }
  let fxTex = null, fxMesh = null;
  function makeFx() {
    if (fxMesh) { scene.remove(fxMesh); fxMesh.material.dispose(); fxTex.dispose(); }
    fxTex = nearest(new T.CanvasTexture(G.fxCanvas));
    fxMesh = new T.Mesh(unitPlane, new T.MeshBasicMaterial({ map: fxTex, transparent: true, depthWrite: false }));
    fxMesh.renderOrder = 5; scene.add(fxMesh);
  }

  // ------------------------------------------------------------ cuadro
  let iw = 400, ih = 300;
  function resize(w, h) {
    iw = w; ih = h;
    const dpr = window.devicePixelRatio || 1;
    devW = Math.max(1, Math.floor(innerWidth * dpr)); devH = Math.max(1, Math.floor(innerHeight * dpr));
    // tamaño del pixel: entero (pantalla / pixel interno), apuntando a ~500-720 líneas de alto
    pixK = POST.pixel > 0 ? POST.pixel : Math.max(1, Math.floor(devH / 500));
    if (!POST.enabled) pixK = 1;
    inW = Math.ceil(devW / pixK); inH = Math.ceil(devH / pixK);
    renderer.setSize(devW, devH, false);
    camera.aspect = devW / devH; camera.updateProjectionMatrix();
    makeTargets(); makeFx();
  }
  const CAR_H = 1.5 * FLOOR / 3, PED_H = 1.7 * FLOOR / 3;
  function render() {
    frame++; builtBlocks = 0;
    tNow = performance.now() / 1000;
    const cam = G.cam, player = G.player, zoom = cam.zoom, view = G.view;
    view.w = iw / zoom; view.h = ih / zoom; view.scale = G.baseScale * zoom;
    const baseZ = (player.car ? player.car.z : player.z) || 0;
    const camH = view.h / 2 / TAN + baseZ;
    const sh = G.shake() > 0 ? G.shake() * 8 : 0;
    const cx = cam.x + (sh ? (Math.random() * 2 - 1) * sh : 0), cy = cam.y + (sh ? (Math.random() * 2 - 1) * sh : 0);
    camera.position.set(cx, -cy, camH); camera.lookAt(cx, -cy, 0);
    camera.far = camH + 200; camera.updateProjectionMatrix();
    // zona visible a nivel del suelo (más un margen: los edificios altos se "inclinan" hacia adentro)
    const k = camH / Math.max(1, camH - baseZ), gw = view.w * k * (devW / devH) / (iw / ih), gh = view.h * k;
    const gx0 = cx - gw / 2, gy0 = cy - gh / 2;
    for (const c of G.chunks.values()) { if (c.mesh) c.mesh.visible = false; if (c.veg) c.veg.visible = false; }
    const c0x = Math.floor((gx0 - 32) / CPX), c1x = Math.floor((gx0 + gw + 32) / CPX), c0y = Math.floor((gy0 - 32) / CPX), c1y = Math.floor((gy0 + gh + 32) / CPX);
    for (let y = c0y; y <= c1y; y++) for (let x = c0x; x <= c1x; x++) {
      if (!G.inMap(x, y)) continue;
      const c = G.getChunk(x, y);
      if (!c.mesh) {
        c.tex = groundTex(c.cv);
        c.mesh = new T.Mesh(unitPlane, new T.MeshLambertMaterial({ map: c.tex }));
        c.mesh.position.set(x * CPX + CPX / 2, -(y * CPX + CPX / 2), 0); c.mesh.scale.set(CPX, CPX, 1);
        c.mesh.receiveShadow = true;
        c.mesh.matrixAutoUpdate = false; c.mesh.updateMatrix(); scene.add(c.mesh);
        if (!c.veg && (c.veg = buildVeg(c.trees))) scene.add(c.veg);
      }
      if (c.dirty) { c.tex.needsUpdate = true; c.dirty = false; }
      c.mesh.visible = true; c.seen = frame;
      if (c.veg) c.veg.visible = true;
    }
    G.prefetch(gx0, gy0, gw, gh);
    for (const b of blocks.values()) b.group.visible = false;
    const m = Math.max(gw, gh) * 0.35;
    const b0x = Math.floor((gx0 - m) / CPX), b1x = Math.floor((gx0 + gw + m) / CPX), b0y = Math.floor((gy0 - m) / CPX), b1y = Math.floor((gy0 + gh + m) / CPX);
    // primero las manzanas del centro, después las de los bordes
    const order = [];
    for (let y = b0y; y <= b1y; y++) for (let x = b0x; x <= b1x; x++) if (G.inMap(x, y)) order.push([x, y, (x * CPX + CPX / 2 - cx) ** 2 + (y * CPX + CPX / 2 - cy) ** 2]);
    order.sort((a, b) => a[2] - b[2]);
    for (const [x, y] of order) getBlock(x, y);
    // autos y peatones
    sprites.reset(); shadows.reset(); casters.reset();
    const vis = (x, y) => x > gx0 - 40 && y > gy0 - 40 && x < gx0 + gw + 40 && y < gy0 + gh + 40;
    const flash = (G.frameNo() >> 3) & 1;
    for (const c of G.cars) {
      if (!vis(c.x, c.y)) continue;
      const z = c.z || 0, tall = c.l > 30 ? 2.2 : 1; // colectivos y camiones más altos
      place(shadows.get(), c.x, c.y, z + 0.3, c.a, c.w + 1.5, c.l + 1.5);
      caster(c.x, c.y, z, c.a, c.l - 1, c.w - 1, CAR_H * tall - 0.4);
      const siren = c.cop && !c.wreck && (c.mode === 'cop' || c === player.car);
      place(sprites.get(sprMat(siren && flash ? c.sprB : c.spr)), c.x, c.y, z + CAR_H * tall, c.a, c.w, c.l);
    }
    for (const p of G.peds) {
      if (!vis(p.x, p.y)) continue;
      const img = p.dead ? p.spr.dead : p.spr.frames[Math.floor(p.anim) % 4];
      if (!p.dead) caster(p.x, p.y, p.z || 0, p.a, 2.2, 2.6, PED_H - 0.4);
      place(sprites.get(sprMat(img)), p.x, p.y, (p.z || 0) + (p.dead ? 0.7 : PED_H), p.a, img.width, img.height);
    }
    if (!player.car) {
      const img = player.dead && !player.busted ? player.spr.dead : player.spr.frames[Math.floor(player.anim) % 4];
      if (!player.dead) caster(player.x, player.y, player.z || 0, player.a, 2.2, 2.6, PED_H - 0.4);
      place(sprites.get(sprMat(img)), player.x, player.y, (player.z || 0) + (player.dead ? 0.8 : PED_H + 0.1), player.a, img.width, img.height);
    }
    sprites.finish(); shadows.finish(); casters.finish();
    // efectos (balas, partículas, pickups) en una capa 2D a la altura del jugador
    const bw = Math.min(G.fxCanvas.width, Math.ceil(view.w) + 1), bh = Math.min(G.fxCanvas.height, Math.ceil(view.h) + 1);
    const ox = Math.round(cx - view.w / 2), oy = Math.round(cy - view.h / 2);
    G.drawFX(ox, oy, bw, bh, true);
    fxTex.needsUpdate = true;
    fxTex.repeat.set(bw / G.fxCanvas.width, bh / G.fxCanvas.height);
    fxTex.offset.set(0, 1 - bh / G.fxCanvas.height);
    fxMesh.position.set(ox + bw / 2, -(oy + bh / 2), baseZ + 6.5); fxMesh.scale.set(bw, bh, 1);
    updateWorld(cx, cy, gw, gh, camH);
    // sombras: la cámara del sol cubre lo visible (con margen por los edificios altos)
    aimSun(cx, -cy, gw + 80, gh + 80, 160);
    if (!POST.enabled) { renderer.setRenderTarget(null); renderer.render(scene, camera); return; }
    renderer.setRenderTarget(rtScene); renderer.render(scene, camera);
    post(camH);
  }
  function post(camH) {
    const sm = sun.shadow.map ? sun.shadow.map.texture : null;
    for (const m of SHADOW_USERS) { const u = m.uniforms; u.uShadowMap.value = sm; u.uHasShadow.value = sm ? 1 : 0; u.uTime.value = tNow; }
    for (const m of [volMat, finalMat]) {
      const u = m.uniforms; u.tDepth.value = rtScene.depthTexture; u.uNear.value = camera.near; u.uFar.value = camera.far;
      u.uAspect.value = camera.aspect; u.uCamPos.value.copy(camera.position);
    }
    // luz volumétrica (a media resolución)
    volMat.uniforms.uVolCol.value.copy(LIGHT.sun).multiplyScalar(POST.vol);
    volMat.uniforms.uFrame.value = frame % 64;
    if (POST.vol > 0) pass(volMat, rtVol);
    // bloom
    brightMat.uniforms.tSrc.value = rtScene.texture; brightMat.uniforms.uTexel.value.set(1 / inW, 1 / inH);
    pass(brightMat, rtB[0]);
    copyMat.uniforms.tSrc.value = rtB[0].texture; copyMat.uniforms.uTexel.value.set(0.5 / rtB[0].width, 0.5 / rtB[0].height);
    pass(copyMat, rtB[1]);
    blurMat.uniforms.tSrc.value = rtB[1].texture; blurMat.uniforms.uDir.value.set(1 / rtB[1].width, 0); pass(blurMat, rtB[2]);
    blurMat.uniforms.tSrc.value = rtB[2].texture; blurMat.uniforms.uDir.value.set(0, 1 / rtB[1].height); pass(blurMat, rtB[1]);
    copyMat.uniforms.tSrc.value = rtB[1].texture; copyMat.uniforms.uTexel.value.set(0.5 / rtB[1].width, 0.5 / rtB[1].height);
    pass(copyMat, rtB[3]);
    blurMat.uniforms.tSrc.value = rtB[3].texture; blurMat.uniforms.uDir.value.set(1 / rtB[3].width, 0); pass(blurMat, rtB[4]);
    blurMat.uniforms.tSrc.value = rtB[4].texture; blurMat.uniforms.uDir.value.set(0, 1 / rtB[3].height); pass(blurMat, rtB[3]);
    const u = finalMat.uniforms;
    u.tScene.value = rtScene.texture; u.tVol.value = rtVol.texture; u.tB1.value = rtB[1].texture; u.tB2.value = rtB[3].texture;
    u.uIn.value.set(inW, inH); u.uPix.value = pixK; u.uBloom.value = POST.bloom; u.uClouds.value = POST.clouds; u.uVig.value = POST.vignette;
    u.uExp.value = POST.exposure; u.uVolOn.value = POST.vol > 0 ? 1 : 0;
    pass(finalMat, null);
  }
  // texturas del piso: pixel nítido de cerca, mipmaps al alejarse (si no, el asfalto "hierve")
  function groundTex(cv) {
    const t = new T.CanvasTexture(cv);
    t.magFilter = T.NearestFilter;
    if (GL2) { t.minFilter = T.LinearMipmapLinearFilter; t.generateMipmaps = true; t.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy()); }
    else { t.minFilter = T.LinearFilter; t.generateMipmaps = false; }
    return t;
  }
  // ------------------------------------------------------------ vegetación en volumen, con viento
  // Copas low-poly facetadas (cada cara con su tono, como hojas), mecidas por ráfagas que cruzan la ciudad.
  // Encima del jugador las copas se calan con un tramado para que no lo tapen.
  const U_TIME = { value: 0 }, U_PLY = { value: new T.Vector3() };
  const makeVegMat = (fadeR, fadeZ) => { const m = new T.MeshLambertMaterial({ vertexColors: true, side: T.DoubleSide }); m.onBeforeCompile = sh => {
    sh.uniforms.uWT = U_TIME; sh.uniforms.uPly = U_PLY;
    sh.vertexShader = 'attribute float aWind;\nuniform float uWT;\nvarying vec3 vVegW;\n' + sh.vertexShader
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        { vec2 wp = position.xy;
          float gust = 0.5 + 0.5 * sin(uWT * 0.55 - dot(wp, vec2(0.0035, 0.0026)));
          float s = sin(uWT * 1.7 + wp.x * 0.043 + wp.y * 0.029) * 0.65 + sin(uWT * 3.3 + wp.y * 0.081 - wp.x * 0.05) * 0.35;
          transformed.xy += vec2(0.8, -0.6) * aWind * (0.35 + gust) * (s + 0.7); }`)
      .replace('#include <project_vertex>', '#include <project_vertex>\n vVegW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = 'uniform vec3 uPly;\nvarying vec3 vVegW;\n' + sh.fragmentShader.replace('void main() {', `void main() {
      { float dp = length(vVegW.xy - uPly.xy);
        if (vVegW.z > uPly.z + ${fadeZ.toFixed(1)} && dp < ${fadeR.toFixed(1)}) {
          float k = 1.0 - smoothstep(${(fadeR * 0.45).toFixed(1)}, ${fadeR.toFixed(1)}, dp);
          if (fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715)))) < k * 0.85) discard; } }`);
  }; m.customProgramCacheKey = () => 'veg' + fadeR + '_' + fadeZ; return m; };
  const vegMat = makeVegMat(30, 7), bigVegMat = makeVegMat(80, 34);
  const VG = () => ({ pos: [], col: [], w: [] });
  let WF = () => 0; // peso del viento según la altura (lo fija cada planta)
  function vtx(g, x, y, z, c, w) { g.pos.push(x, -y, z); g.col.push(c[0], c[1], c[2]); g.w.push(w === undefined ? WF(z) : w); }
  function vtri(g, a, b, c, col) { vtx(g, a[0], a[1], a[2], col, a[3]); vtx(g, b[0], b[1], b[2], col, b[3]); vtx(g, c[0], c[1], c[2], col, c[3]); }
  function vquad(g, a, b, c, d, col) { vtri(g, a, b, c, col); vtri(g, a, c, d, col); }
  const icoArr = d => { const g = new T.IcosahedronGeometry(1, d), a = Array.from((g.index ? g.toNonIndexed() : g).attributes.position.array); g.dispose(); return a; };
  const ICO0 = icoArr(0), ICO1 = icoArr(1);
  function blob(g, cx, cy, cz, rx, rz, col, rnd, ico) { // copa: icosaedro deformado, más oscuro abajo
    ico = ico || ICO0; const seed = Math.floor(rnd() * 1e5);
    const J = (a, b, c) => 0.82 + 0.36 * G.hash(Math.round(a * 50) + seed, Math.round(b * 50) * 3 + Math.round(c * 50) * 7, 77);
    for (let i = 0; i < ico.length; i += 9) {
      const nz = (ico[i + 2] + ico[i + 5] + ico[i + 8]) / 3, k = (0.86 + rnd() * 0.24) * (0.74 + 0.3 * nz);
      const c = [col[0] * k, col[1] * k, col[2] * k];
      for (let j = 0; j < 9; j += 3) { const s = J(ico[i + j], ico[i + j + 1], ico[i + j + 2]); vtx(g, cx + ico[i + j] * rx * s, cy + ico[i + j + 1] * rx * s, cz + ico[i + j + 2] * rz * s, c); }
    }
  }
  function vleg(g, A, B, w, col) { // viga de sección cuadrada entre dos puntos 3D
    const dx = B[0] - A[0], dy = B[1] - A[1], dz = B[2] - A[2], l = Math.hypot(dx, dy, dz) || 1;
    let px = -dy, py = dx, pz = 0, pl = Math.hypot(px, py); if (pl < 1e-3) { px = 1; py = 0; pl = 1; }
    px /= pl; py /= pl;
    const qx = (dy * pz - dz * py) / l, qy = (dz * px - dx * pz) / l, qz = (dx * py - dy * px) / l, h = w / 2;
    const O = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => [px * a * h + qx * b * h, py * a * h + qy * b * h, pz * a * h + qz * b * h]);
    const sh = [1, 0.8, 0.66, 0.9];
    for (let i = 0; i < 4; i++) {
      const o = O[i], p = O[(i + 1) % 4];
      vquad(g, [A[0] + o[0], A[1] + o[1], A[2] + o[2]], [A[0] + p[0], A[1] + p[1], A[2] + p[2]], [B[0] + p[0], B[1] + p[1], B[2] + p[2]], [B[0] + o[0], B[1] + o[1], B[2] + o[2]], mul(col, sh[i]));
    }
  }
  const LEAF = ['#2f6a2a', '#3a7a2e', '#467f30', '#2a5e2c', '#52862f', '#3c6e34', '#5a8a38'].map(rgb);
  const BLOOM = [['#d0609a', '#e07aac', '#c85090'], ['#d0609a', '#e07aac', '#c85090'], ['#8a6ad0', '#9a7ae0', '#7a5cc0'], ['#e8c030', '#f0d040', '#d8b028']].map(p => p.map(rgb));
  const BARK = ['#6a5440', '#5e4a38', '#76604a'].map(rgb), PALMT = rgb('#8e7e64'), FROND = ['#3f7a2c', '#4a8632', '#36702a'].map(rgb);
  const HPM = TS / (G.MD.tileMeters || 2.25); // px por metro en horizontal
  function palm(g, x, y, h, rnd) {
    const Ht = 24 + rnd() * 9, lx = (rnd() - 0.5) * 4, ly = (rnd() - 0.5) * 4;
    WF = z => 0.9 * (z / Ht) ** 2;
    for (let k = 0; k < 5; k++) vleg(g, [x + lx * k / 5, y + ly * k / 5, Ht * k / 5], [x + lx * (k + 1) / 5, y + ly * (k + 1) / 5, Ht * (k + 1) / 5 + 0.4], 2.1 - k * 0.12, mul(PALMT, k % 2 ? 0.9 : 1.02));
    const tx = x + lx, ty = y + ly, fc = FROND[Math.floor(rnd() * 3)];
    for (let i = 0; i < 10; i++) {
      const a = h * 6.28 + i * 6.283 / 10 + (rnd() - 0.5) * 0.35, ca = Math.cos(a), sa = Math.sin(a), L = 11 + rnd() * 5, dead = i === 3 && rnd() < 0.5;
      const D = [0, 0.3, 0.65, 1], Z = [0, 3 + rnd() * 2, 2, dead ? -12 : -4 - rnd() * 3], Wd = [0.5, 2.6, 2.1, 0.3];
      const col = dead ? rgb('#9a8656') : mul(fc, 0.92 + rnd() * 0.16);
      for (let j = 0; j < 3; j++) {
        const P = k => [tx + ca * D[k] * L, ty + sa * D[k] * L, Ht + Z[k]], wa = 0.6 + D[j] * 2.6, wb = 0.6 + D[j + 1] * 2.6;
        const A = P(j), B = P(j + 1), fold = 0.7;
        vquad(g, [A[0] - sa * Wd[j], A[1] + ca * Wd[j], A[2] - fold, wa], [B[0] - sa * Wd[j + 1], B[1] + ca * Wd[j + 1], B[2] - fold, wb], [B[0], B[1], B[2], wb], [A[0], A[1], A[2], wa], mul(col, 0.86));
        vquad(g, [A[0], A[1], A[2], wa], [B[0], B[1], B[2], wb], [B[0] + sa * Wd[j + 1], B[1] - ca * Wd[j + 1], B[2] - fold, wb], [A[0] + sa * Wd[j], A[1] - ca * Wd[j], A[2] - fold, wa], col);
      }
    }
    WF = () => 0.5; blob(g, tx, ty, Ht - 0.5, 1.6, 1.4, rgb('#7a5a2a'), rnd); // racimo de cocos
  }
  function tree(g, x, y, r, kind, h) {
    const rnd = lcg(1 + Math.floor(h * 2e6));
    if (kind === 2) return palm(g, x, y, h, rnd);
    const R = r * 1.55 + 1.5, Ht = 8 + R * 0.45 + rnd() * 4, zc = Ht + R * 0.42, top = zc + R * 0.65;
    WF = z => 1.5 * Math.max(0, (z - Ht * 0.5) / (top - Ht * 0.5)) ** 1.6;
    vleg(g, [x, y, 0], [x + (rnd() - 0.5) * 2, y + (rnd() - 0.5) * 2, Ht + 2], 1.8, BARK[Math.floor(rnd() * 3)]);
    // lapachos rosados sobre todo, algún jacarandá y algún lapacho amarillo; la mitad de los "lapachos" ya sin flor
    if (kind === 1 && G.hash(Math.round(x), Math.round(y), 91) < 0.45) kind = 0;
    const pal = kind === 1 ? BLOOM[h < 0.62 ? 0 : h < 0.86 ? 2 : 3] : LEAF, col = pal[Math.floor(rnd() * pal.length)];
    blob(g, x, y, zc, R * 0.9, R * 0.6, col, rnd);
    const nb = 3 + (R > 10 ? 2 : 1);
    for (let i = 0; i < nb; i++) {
      const a = i / nb * 6.283 + rnd() * 0.8, d = R * (0.35 + rnd() * 0.25);
      const c2 = kind === 1 && rnd() < 0.25 ? LEAF[Math.floor(rnd() * LEAF.length)] : mul(col, 0.9 + rnd() * 0.2);
      blob(g, x + Math.cos(a) * d, y + Math.sin(a) * d, zc - R * 0.12 + rnd() * R * 0.3, R * (0.5 + rnd() * 0.18), R * (0.36 + rnd() * 0.1), c2, rnd);
    }
  }
  // La higuera / gomero de la India del Parque Mitre: un tronco hecho de cientos de raíces aéreas soldadas,
  // ramas maestras horizontales con raíces-columna que bajan al suelo y una copa en paraguas, oscura y brillante.
  function gomero(g, x, y, R, H) {
    const rnd = lcg(4242), bark = ['#8a7a68', '#7a6a58', '#9a8a74', '#6e604f', '#a09080'].map(rgb), zT = H * 0.4;
    WF = z => 0.5 * Math.max(0, (z - H * 0.45) / (H * 0.55)) ** 2;
    for (let i = 0; i < 26; i++) { // núcleo: raíces gruesas fundidas
      const a = i / 26 * 6.283 + rnd() * 0.2, rb = R * (0.06 + rnd() * 0.05), at = a + 0.5 + (rnd() - 0.5) * 0.4;
      vleg(g, [x + Math.cos(a) * rb, y + Math.sin(a) * rb, 0], [x + Math.cos(at) * rb * 0.5, y + Math.sin(at) * rb * 0.5, zT * (0.95 + rnd() * 0.2)], 4 + rnd() * 3, mul(bark[i % 5], 0.9));
    }
    for (let i = 0; i < 170; i++) { // cortina de raíces aéreas alrededor, más finas hacia afuera
      const a = rnd() * 6.283, f = Math.sqrt(rnd()), rb = R * (0.08 + 0.16 * f), at = a + (rnd() - 0.5) * 0.9, rt = rb * 0.35 + R * 0.02;
      vleg(g, [x + Math.cos(a) * rb, y + Math.sin(a) * rb, 0], [x + Math.cos(at) * rt, y + Math.sin(at) * rt, zT * (0.75 + rnd() * 0.4)], (3.2 - 2 * f) * (0.7 + rnd() * 0.5), bark[i % 5]);
    }
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * 6.283 + (rnd() - 0.5) * 0.4, L = R * (0.55 + rnd() * 0.35), z1 = H * (0.5 + rnd() * 0.12), a2 = a + (rnd() - 0.5) * 0.3;
      const pm = [x + Math.cos(a) * L * 0.5, y + Math.sin(a) * L * 0.5, z1], p1 = [x + Math.cos(a2) * L, y + Math.sin(a2) * L, z1 - H * 0.06];
      vleg(g, [x + Math.cos(a) * R * 0.08, y + Math.sin(a) * R * 0.08, zT * 0.85], pm, 5, bark[0]);
      vleg(g, pm, p1, 3.2, bark[1]);
      for (let k = 0; k < 5; k++) { // raíces columna
        const f = 0.3 + rnd() * 0.68, qx = x + Math.cos(f > 0.5 ? a2 : a) * L * f, qy = y + Math.sin(f > 0.5 ? a2 : a) * L * f, zz = z1 - (f > 0.5 ? H * 0.04 : 0) - 1;
        vleg(g, [qx + (rnd() - 0.5) * 3, qy + (rnd() - 0.5) * 3, 0], [qx, qy, zz], 0.7 + rnd() * 1.8, bark[(k + 2) % 5]);
      }
      for (let k = 0; k < 4; k++) { // raicillas colgando, todavía sin llegar al suelo
        const f = 0.4 + rnd() * 0.6, qx = x + Math.cos(a2) * L * f + (rnd() - 0.5) * 6, qy = y + Math.sin(a2) * L * f + (rnd() - 0.5) * 6;
        vleg(g, [qx, qy, z1 * (0.25 + rnd() * 0.4)], [qx, qy, z1], 0.5, bark[4]);
      }
    }
    // copa en racimos: masas grandes y, encima, matas chicas de hojas (verde oscuro brillante del gomero)
    const leaf = ['#22482a', '#2a562c', '#326232', '#284a24', '#3a6c34', '#2d5428', '#41783a'].map(rgb);
    for (let i = 0; i < 70; i++) {
      const rr = R * 0.9 * Math.sqrt(rnd()), a = rnd() * 6.283, f = rr / R, br = R * (0.13 + rnd() * 0.07);
      blob(g, x + Math.cos(a) * rr, y + Math.sin(a) * rr, H * (0.64 + 0.26 * (1 - f * f)) + (rnd() - 0.5) * H * 0.06, br, br * 0.5, mul(leaf[i % 7], 0.9), rnd, ICO1);
    }
    for (let i = 0; i < 230; i++) {
      const rr = R * Math.sqrt(rnd()), a = rnd() * 6.283, f = rr / R, br = R * (0.045 + rnd() * 0.05);
      blob(g, x + Math.cos(a) * rr, y + Math.sin(a) * rr, H * (0.7 + 0.27 * (1 - f * f)) + (rnd() - 0.3) * H * 0.08, br, br * 0.7, mul(leaf[(i * 3) % 7], 0.95 + rnd() * 0.25), rnd);
    }
  }
  function vegMesh(g, mat) {
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.Float32BufferAttribute(g.pos, 3));
    geo.setAttribute('color', new T.Float32BufferAttribute(g.col, 3));
    geo.setAttribute('aWind', new T.Float32BufferAttribute(g.w, 1));
    geo.computeVertexNormals(); geo.computeBoundingSphere();
    const m = new T.Mesh(geo, mat || vegMat); m.matrixAutoUpdate = false; m.updateMatrix(); m.castShadow = true; m.receiveShadow = true;
    return m;
  }
  const BIG = [];
  {
    const MD2 = G.MD, [S0, W0, N0] = MD2.bbox, MX0 = Math.cos((S0 + N0) / 2 * Math.PI / 180) * 111320, TM = MD2.tileMeters;
    for (const [xt, yt, rm, hm] of (G.PROPS.bigtrees || [])) BIG.push([(xt + 0.5) * TS, (yt + 0.5) * TS, rm, hm]);
    if (!BIG.length) BIG.push([((-58.82938 - W0) * MX0 / TM + 0.5) * TS, ((N0 + 27.45939) * 110574 / TM + 0.5) * TS, 20, 22]); // provisorio
    const g = VG();
    for (const [x, y, rm, hm] of BIG) gomero(g, x, y, rm * HPM, hm * MPX);
    scene.add(vegMesh(g, bigVegMat));
  }
  function buildVeg(trees) {
    if (!trees || !trees.length) return null;
    const g = VG();
    for (const [x, y, r, kind, h] of trees) {
      if (BIG.some(([bx, by, rm]) => (x - bx) ** 2 + (y - by) ** 2 < (rm * HPM * 1.05) ** 2)) continue; // bajo la higuera no crece nada
      tree(g, x, y, r, kind, h);
    }
    return g.pos.length ? vegMesh(g) : null;
  }

  // ------------------------------------------------------------ agua del Paraná
  // Plano único sobre todo el mapa: una máscara con la distancia a la costa (en tiles) dice dónde hay agua,
  // qué tan honda se ve y dónde rompe la espuma; olas animadas, cielo reflejado (fresnel), destellos del sol
  // y la sombra del puente leída del mapa de sombras.
  const water = (() => {
    const W = G.MD.w, H = G.MD.h, n = W * H, BIGD = 255;
    const din = new Uint8Array(n), dout = new Uint8Array(n);
    for (let y = 0, i = 0; y < H; y++) for (let x = 0; x < W; x++, i++) {
      const t = G.tileAt(x, y), wet = t === 4 || t === TT.BRIDGEW;
      din[i] = wet ? BIGD : 0; dout[i] = wet ? 0 : BIGD;
    }
    const chamfer = d => { // distancia en tercios de tile (3 recto, 4 diagonal), dos pasadas
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const i = y * W + x; let v = d[i]; if (!v) continue;
        if (x > 0) v = Math.min(v, d[i - 1] + 3);
        if (y > 0) { v = Math.min(v, d[i - W] + 3); if (x > 0) v = Math.min(v, d[i - W - 1] + 4); if (x < W - 1) v = Math.min(v, d[i - W + 1] + 4); }
        d[i] = v;
      }
      for (let y = H - 1; y >= 0; y--) for (let x = W - 1; x >= 0; x--) {
        const i = y * W + x; let v = d[i]; if (!v) continue;
        if (x < W - 1) v = Math.min(v, d[i + 1] + 3);
        if (y < H - 1) { v = Math.min(v, d[i + W] + 3); if (x < W - 1) v = Math.min(v, d[i + W + 1] + 4); if (x > 0) v = Math.min(v, d[i + W - 1] + 4); }
        d[i] = v;
      }
    };
    chamfer(din); chamfer(dout);
    const data = new Uint8Array(n);
    for (let i = 0; i < n; i++) data[i] = Math.max(0, Math.min(255, Math.round(128 + (din[i] - dout[i]) / 3 * 16)));
    const mask = new T.DataTexture(data, W, H, GL2 ? T.RedFormat : T.LuminanceFormat, T.UnsignedByteType);
    mask.unpackAlignment = 1; mask.magFilter = T.LinearFilter; mask.minFilter = T.LinearFilter; mask.generateMipmaps = false; mask.needsUpdate = true;
    const mat = new T.ShaderMaterial({
      uniforms: { ...shadowUniforms(), tMask: { value: mask }, uMapN: { value: new T.Vector2(W, H) }, uTS: { value: TS },
        uSunCol: { value: LIGHT.sun }, uDeep: { value: new T.Color(0.13, 0.25, 0.3) }, uShallow: { value: new T.Color(0.36, 0.38, 0.26) },
        uSky: { value: new T.Color(0.52, 0.66, 0.9) }, uHor: { value: new T.Color(1.0, 0.84, 0.66) } },
      vertexShader: 'varying vec3 vWp; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vWp = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
      fragmentShader: `varying vec3 vWp; ${GLSL_COMMON}
        uniform sampler2D tMask; uniform vec2 uMapN; uniform float uTS; uniform vec3 uSunCol, uDeep, uShallow, uSky, uHor;
        float hgt(vec2 p) {
          float t = uTime;
          return sin(dot(p, vec2(0.021, 0.034)) + t * 1.1) * 0.45 + sin(dot(p, vec2(-0.043, 0.017)) + t * 1.7) * 0.3
               + vnoise(p * 0.055 + vec2(t * 0.32, -t * 0.21)) * 1.3 + vnoise(p * 0.16 - vec2(t * 0.55, t * 0.38)) * 0.5
               + vnoise(p * 0.42 + vec2(t * 0.9, 0.0)) * 0.16;
        }
        float softVis(vec3 wp) {
          if (uHasShadow < 0.5) return 1.0;
          vec4 sc = uShadowMatrix * vec4(wp, 1.0); vec3 c = sc.xyz / sc.w;
          if (c.x < 0.0 || c.x > 1.0 || c.y < 0.0 || c.y > 1.0 || c.z > 1.0) return 1.0;
          float s = 0.0, o = 1.0 / 2048.0;
          for (int i = 0; i < 4; i++) { vec2 d = vec2(float(i - (i / 2) * 2) - 0.5, float(i / 2) - 0.5) * 1.5 * o;
            s += step(c.z - 0.002, unpackRGBAToDepth(texture2D(uShadowMap, c.xy + d))); }
          return s * 0.25;
        }
        void main() {
          vec2 tile = vec2(vWp.x, -vWp.y) / uTS;
          float sd = (texture2D(tMask, tile / uMapN).r * 255.0 - 128.0) / 16.0 - 0.5; // tiles hasta la costa
          if (sd < 0.0) discard;
          vec2 p = vWp.xy;
          float h0 = hgt(p), hx = hgt(p + vec2(1.2, 0.0)), hy = hgt(p + vec2(0.0, 1.2));
          float calm = 0.55 + 0.45 * smoothstep(0.0, 3.0, sd);
          vec3 N = normalize(vec3((h0 - hx) * 0.75 * calm, (h0 - hy) * 0.75 * calm, 1.0));
          vec3 V = normalize(cameraPosition - vWp);
          float vis = softVis(vWp);
          float ndv = max(dot(N, V), 0.0), F = 0.12 + 0.88 * pow(1.0 - ndv, 4.0);
          vec3 Rr = reflect(-V, N);
          vec3 sky = mix(uHor, uSky, smoothstep(0.55, 1.0, Rr.z)) * (0.75 + 0.25 * vis);
          float shallow = exp(-sd / 2.2);
          vec3 body = mix(uDeep, uShallow, shallow) * (0.62 + 0.38 * vis * max(dot(N, uSunDir), 0.0) / max(uSunDir.z, 0.3));
          body *= 0.92 + 0.16 * vnoise(p * 0.012 + uTime * 0.01);
          vec3 col = mix(body, sky, F * 0.55);
          // destellos dorados del sol (con la luz "levantada" para que se vean desde arriba)
          vec3 Lf = normalize(uSunDir + vec3(0.0, 0.0, 1.6));
          float rl = max(dot(Rr, Lf), 0.0), sp = pow(rl, 140.0);
          float gl = smoothstep(0.9, 0.99, vnoise(p * 0.3 + vec2(uTime * 0.9, -uTime * 0.7))) * smoothstep(0.93, 0.99, rl);
          col += uSunCol * vec3(1.0, 0.86, 0.6) * vis * (sp * 0.75 + gl * 0.8);
          // espuma en la costa: borde fijo más líneas que llegan
          float fn = vnoise(p * 0.11 + vec2(uTime * 0.25, uTime * 0.1));
          float edge = 1.0 - smoothstep(0.0, 0.3 + fn * 0.35, sd);
          float lines = smoothstep(0.82, 1.0, fract(sd * 0.75 + uTime * 0.18 + fn * 0.6)) * (1.0 - smoothstep(0.4, 2.6, sd));
          float foam = clamp(edge + lines * 0.55, 0.0, 1.0) * (0.65 + 0.35 * fn);
          col = mix(col, vec3(0.96, 0.94, 0.88) * (0.62 + 0.38 * vis), foam);
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
    const m = new T.Mesh(new T.PlaneGeometry(W * TS, H * TS), mat);
    m.position.set(W * TS / 2, -H * TS / 2, 0.45); m.receiveShadow = false; m.frustumCulled = false;
    m.matrixAutoUpdate = false; m.updateMatrix(); scene.add(m);
    return { mesh: m, mat };
  })();
  SHADOW_USERS.push(water.mat);

  // ------------------------------------------------------------ marcadores de misión (window.Chipa.markers)
  // Columna de luz translúcida, anillo que late en el piso y un rombo que flota y gira: se ven de lejos.
  const beamGeo = new T.CylinderGeometry(1, 1, 1, 28, 1, true); beamGeo.rotateX(Math.PI / 2); beamGeo.translate(0, 0, 0.5);
  const ringGeo = new T.RingGeometry(0.72, 1, 40);
  const iconGeo = new T.OctahedronGeometry(1, 0); iconGeo.scale(1, 1, 1.5);
  const beamShader = (frag) => new T.ShaderMaterial({
    uniforms: { uCol: { value: new T.Color() }, uTime: { value: 0 } }, transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide,
    vertexShader: 'varying vec2 vUv; varying vec3 vP; void main(){ vUv = uv; vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'varying vec2 vUv; varying vec3 vP; uniform vec3 uCol; uniform float uTime; void main(){ ' + frag + ' }',
  });
  const MKS = [];
  function markerObj() {
    const beam = new T.Mesh(beamGeo, beamShader(`float h = vP.z; float a = pow(1.0 - h, 1.6) * (0.55 + 0.45 * sin(h * 40.0 - uTime * 5.0));
      a *= 0.6 + 0.4 * sin(vUv.x * 6.2832 * 3.0 + uTime * 2.0); gl_FragColor = vec4(uCol * a * 0.9, 1.0);`));
    const ring = new T.Mesh(ringGeo, beamShader(`float r = length(vP.xy); float p = fract(uTime * 0.6);
      float a = smoothstep(0.72, 0.8, r) * (1.0 - smoothstep(0.92, 1.0, r)) * 1.4 + (1.0 - smoothstep(0.0, 0.08, abs(r - 0.72 - p * 0.28))) * (1.0 - p);
      gl_FragColor = vec4(uCol * a, 1.0);`));
    const glow = new T.Mesh(unitPlane, beamShader(`float r = length(vUv - 0.5) * 2.0; gl_FragColor = vec4(uCol * pow(max(0.0, 1.0 - r), 2.0) * 0.55, 1.0);`));
    const icon = new T.Mesh(iconGeo, new T.MeshBasicMaterial({ color: 0xffffff }));
    icon.castShadow = true;
    for (const o of [beam, ring, glow, icon]) { o.frustumCulled = false; scene.add(o); }
    beam.renderOrder = 6; ring.renderOrder = 6; glow.renderOrder = 6;
    return { beam, ring, glow, icon, col: new T.Color() };
  }
  function updateMarkers() {
    const list = (window.Chipa && window.Chipa.markers) || [];
    let k = 0;
    for (const mk of list) {
      if (!mk || !isFinite(mk.x) || !isFinite(mk.y)) continue;
      const o = MKS[k] || (MKS[k] = markerObj()); k++;
      o.col.set(mk.color || '#ffd040');
      const r = Math.max(14, (mk.r || 10) * 1.3), x = mk.x, y = -mk.y, ph = k * 1.7;
      o.beam.position.set(x, y, 0); o.beam.scale.set(r * 0.55, r * 0.55, 420);
      o.ring.position.set(x, y, 0.8); o.ring.scale.set(r, r, 1);
      o.glow.position.set(x, y, 0.7); o.glow.scale.set(r * 3, r * 3, 1);
      for (const m of [o.beam, o.ring, o.glow]) { m.material.uniforms.uCol.value.copy(o.col).multiplyScalar(m === o.beam ? 1.3 : 0.9); m.material.uniforms.uTime.value = tNow + ph; m.visible = true; }
      o.icon.position.set(x, y, 30 + Math.sin(tNow * 2.2 + ph) * 4); o.icon.rotation.set(0, 0, tNow * 1.8 + ph); o.icon.scale.setScalar(5.5);
      o.icon.material.color.copy(o.col).multiplyScalar(1.5); o.icon.visible = true;
    }
    for (let i = k; i < MKS.length; i++) { const o = MKS[i]; o.beam.visible = o.ring.visible = o.glow.visible = o.icon.visible = false; }
  }

  // ------------------------------------------------------------ aire: polvo dorado flotando y bandadas de pájaros
  // El polvo vive en una caja que acompaña a la cámara (todo en el shader: sin trabajo por cuadro en la CPU).
  const DUST_N = 420, dustBox = new T.Vector3(1400, 1000, 150);
  const dust = (() => {
    const pos = new Float32Array(DUST_N * 3), r = lcg(99);
    for (let i = 0; i < DUST_N; i++) { pos[3 * i] = r() * dustBox.x; pos[3 * i + 1] = r() * dustBox.y; pos[3 * i + 2] = r(); }
    const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.BufferAttribute(pos, 3));
    const mat = new T.ShaderMaterial({
      uniforms: { uTime: U_TIME, uCam: { value: new T.Vector3() }, uBox: { value: dustBox }, uSize: { value: 2 }, uCol: { value: new T.Color(1.0, 0.82, 0.55) } },
      transparent: true, depthWrite: false, blending: T.AdditiveBlending,
      vertexShader: `uniform float uTime, uSize; uniform vec3 uCam, uBox; varying float vA;
        void main() {
          vec3 p = position; float ph = p.z * 61.0;
          vec2 drift = vec2(uTime * 6.0 + sin(uTime * 0.3 + ph) * 12.0, -uTime * 4.0 + cos(uTime * 0.23 + ph) * 10.0);
          vec2 xy = mod(p.xy + drift - uCam.xy + uBox.xy * 0.5, uBox.xy) + uCam.xy - uBox.xy * 0.5;
          float z = 6.0 + p.z * uBox.z + sin(uTime * 0.5 + ph) * 6.0;
          vA = (0.35 + 0.65 * pow(0.5 + 0.5 * sin(uTime * 1.3 + ph * 3.0), 3.0));
          vec2 e = abs(xy - uCam.xy) / (uBox.xy * 0.5); vA *= 1.0 - smoothstep(0.75, 1.0, max(e.x, e.y));
          gl_Position = projectionMatrix * viewMatrix * vec4(xy, z, 1.0); gl_PointSize = uSize;
        }`,
      fragmentShader: `uniform vec3 uCol; varying float vA; void main() { vec2 c = gl_PointCoord - 0.5; float a = 1.0 - smoothstep(0.2, 0.5, length(c)); gl_FragColor = vec4(uCol * a * vA * 0.55, 1.0); }`,
    });
    const pts = new T.Points(geo, mat); pts.frustumCulled = false; pts.renderOrder = 7; scene.add(pts);
    return mat;
  })();
  // pájaros: palomas y gaviotas (blancas cerca del río) que dan vueltas sobre plazas, parque y Costanera; tiran sombra
  const birds = (() => {
    const MD2 = G.MD, [S0, W0, N0] = MD2.bbox, MX0 = Math.cos((S0 + N0) / 2 * Math.PI / 180) * 111320, TM = MD2.tileMeters;
    const ll = (lat, lon) => [((lon - W0) * MX0 / TM + 0.5) * TS, ((N0 - lat) * 110574 / TM + 0.5) * TS];
    const flocks = [[-27.4637, -58.8378, 9, 0], [-27.45939, -58.82938, 11, 0], [-27.4628, -58.8445, 9, 1], [-27.4690, -58.8530, 8, 1], [-27.4560, -58.8350, 7, 1], [-27.4710, -58.8400, 7, 0]]
      .map(([la, lo, n, gull], i) => ({ c: ll(la, lo), n, gull, ph: i * 1.9, R: 160 + i * 23, z: 90 + i * 14 }));
    const NB = flocks.reduce((s, f) => s + f.n, 0), pos = new Float32Array(NB * 6 * 3), col = new Float32Array(NB * 6 * 3);
    const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.BufferAttribute(pos, 3)); geo.setAttribute('color', new T.BufferAttribute(col, 3));
    let k = 0; for (const f of flocks) for (let i = 0; i < f.n; i++) for (let v = 0; v < 6; v++) { const c = f.gull ? (v % 3 === 2 ? 0.75 : 0.95) : (v % 3 === 2 ? 0.32 : 0.48); col[k++] = c; col[k++] = c; col[k++] = c * (f.gull ? 1 : 1.08); }
    const m = new T.Mesh(geo, new T.MeshLambertMaterial({ vertexColors: true, side: T.DoubleSide }));
    m.castShadow = true; m.frustumCulled = false; scene.add(m);
    return { flocks, pos, geo, rnd: Array.from({ length: NB }, (_, i) => [G.hash(i, 1, 5), G.hash(i, 2, 5), G.hash(i, 3, 5)]) };
  })();
  function updateBirds() {
    const { flocks, pos, rnd } = birds; let b = 0, o = 0;
    for (const f of flocks) {
      const ang = tNow * 0.16 * (f.gull ? 0.8 : 1) + f.ph;
      const cx = f.c[0] + Math.cos(ang * 0.37) * 120, cy = f.c[1] + Math.sin(ang * 0.29) * 90;
      for (let i = 0; i < f.n; i++, b++) {
        const [r1, r2, r3] = rnd[b], a = ang + (r1 - 0.5) * 0.5, R = f.R * (0.8 + r2 * 0.4);
        const x = cx + Math.cos(a) * R + (r3 - 0.5) * 30, y = cy + Math.sin(a) * R * 0.75 + (r1 - 0.5) * 30, z = f.z + (r2 - 0.5) * 30 + Math.sin(tNow + b) * 4;
        const hx = -Math.sin(a), hy = Math.cos(a) * 0.75, hl = Math.hypot(hx, hy), ux = hx / hl, uy = hy / hl, vx = -uy, vy = ux; // rumbo y ala
        const flap = Math.sin(tNow * (f.gull ? 6 : 11) + b * 1.7) * (f.gull ? 2.2 : 1.6), span = f.gull ? 7 : 5.5, L = f.gull ? 3.2 : 2.6;
        const P = (s, w, dz) => { pos[o++] = x + ux * s + vx * w; pos[o++] = -(y + uy * s + vy * w); pos[o++] = z + dz; };
        P(L, 0, 0); P(-L * 0.6, 0, 0); P(-L * 0.1, span, flap);   // ala izquierda
        P(L, 0, 0); P(-L * 0.6, 0, 0); P(-L * 0.1, -span, flap);  // ala derecha
      }
    }
    birds.geo.attributes.position.needsUpdate = true; birds.geo.computeVertexNormals();
  }

  // ------------------------------------------------------------ props del cartógrafo: lanchas, muelles, banderas, sombrillas, juegos
  const PRX = G.PROPS || {}, tpx = t => (t + 0.5) * TS;
  // banderas: paño en tiras que flamea en el vertex shader (aFlag = distancia al mástil, 0..1)
  const flagMat = new T.MeshLambertMaterial({ vertexColors: true, side: T.DoubleSide });
  flagMat.onBeforeCompile = sh => {
    sh.uniforms.uWT = U_TIME;
    sh.vertexShader = 'attribute float aFlag;\nuniform float uWT;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      { float ph = position.x * 0.37 + position.y * 0.23;
        float w = sin(uWT * 7.0 - aFlag * 7.0 + ph) * 1.1 + sin(uWT * 12.3 - aFlag * 13.0 + ph * 2.0) * 0.35;
        transformed += vec3(0.6, 0.8, 0.35) * w * aFlag; }`);
  };
  flagMat.customProgramCacheKey = () => 'flag';
  function flagCloth(fg, x, y, z, len, hgt, col) { // paño que sale del mástil a favor del viento, algo acostado para que se vea desde arriba
    const dx = 0.8, dy = 0.6, N = 6; // viento en coords 2D (y hacia el sur): hacia el este-sur
    const ax = -dy * 0.55, ay = dx * 0.55, az = -0.83; // eje "alto" del paño, inclinado
    for (let i = 0; i < N; i++) {
      const f0 = i / N, f1 = (i + 1) / N, c = mul(col, i % 2 ? 0.9 : 1);
      const P = (f, k) => [x + dx * len * f + ax * hgt * k, y + dy * len * f + ay * hgt * k, z + az * hgt * k - f * 1.5, f];
      vquad(fg, P(f0, 0), P(f1, 0), P(f1, 1), P(f0, 1), c);
    }
  }
  function flagMesh(fg) {
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.Float32BufferAttribute(fg.pos, 3)); geo.setAttribute('color', new T.Float32BufferAttribute(fg.col, 3));
    geo.setAttribute('aFlag', new T.Float32BufferAttribute(fg.w, 1)); geo.computeVertexNormals(); geo.computeBoundingSphere();
    const m = new T.Mesh(geo, flagMat); m.castShadow = true; m.receiveShadow = true; m.matrixAutoUpdate = false; m.updateMatrix(); return m;
  }
  const ANIM = []; // objetos que se mueven solos (lanchas, calesita, velas)
  (function buildCartoProps() {
    const gp = Geo(), fg = VG();
    WF = () => 0;
    // --- lanchas amarradas en el puerto deportivo: casco con proa, cubierta, parabrisas, asientos y motor fuera de borda
    const HULL = ['#f4f4f0', '#f4f4f0', '#2a5a9a', '#c83a2a', '#e8e4d8', '#1e3a5a'].map(rgb);
    for (const [xt, yt, a, lm] of PRX.boats || []) {
      const L = lm * HPM, W2 = L * 0.38, hh = 1.1 * MPX, g = Geo(), r = lcg(Math.floor(xt * 97 + yt * 13)), hull = HULL[Math.floor(r() * HULL.length)];
      const pts = [[-L / 2, -W2 / 2], [L * 0.2, -W2 / 2], [L / 2, 0], [L * 0.2, W2 / 2], [-L / 2, W2 / 2]];
      prism(g, pts, -2, hh, rgb('#e8e6de'), hull);
      prism(g, pts.map(([u, v]) => [u * 0.86, v * 0.8]), hh, hh + 0.4, rgb('#c8b48c'), rgb('#c8b48c')); // cubierta de teca
      obox(g, -L * 0.02, 0, 1, 0, L * 0.06, W2 * 0.4, hh, hh + 2.4, rgb('#34465e'), rgb('#5a7898'));      // parabrisas
      obox(g, -L * 0.2, 0, 1, 0, L * 0.1, W2 * 0.34, hh, hh + 1.2, rgb('#e8dcc0'), rgb('#c8bca0'));      // asientos
      obox(g, -L / 2 - 0.8, 0, 1, 0, 0.9, 1.1, hh - 1, hh + 2.6, rgb('#2a2a30'), rgb('#3a3a42'));         // motor
      if (r() < 0.5) obox(g, L * 0.32, 0, 1, 0, 0.4, 0.4, hh, hh + 6, rgb('#d8d8d8'), rgb('#b8b8b8'));    // mástil corto
      const m = toMesh(g, plainMat); m.matrixAutoUpdate = true;
      m.position.set(tpx(xt), -tpx(yt), 0.2); m.rotation.z = -a; scene.add(m);
      ANIM.push(t => { const ph = xt * 1.7 + yt; m.position.z = 0.1 + Math.sin(t * 1.4 + ph) * 0.45; m.rotation.x = Math.sin(t * 1.1 + ph) * 0.05; m.rotation.y = Math.sin(t * 0.9 + ph * 1.3) * 0.035; });
    }
    // --- muelles: pilotes del lado del agua y bitas para amarrar
    for (const pl of PRX.docks || []) for (let i = 0; i + 3 < pl.length; i += 2) {
      const ax = tpx(pl[i]), ay = tpx(pl[i + 1]), bx = tpx(pl[i + 2]), by = tpx(pl[i + 3]), L = Math.hypot(bx - ax, by - ay) || 1, ux = (bx - ax) / L, uy = (by - ay) / L, nx2 = -uy, ny2 = ux;
      for (const sg of [1, -1]) {
        let d = 0; while (d < 60 && G.tileAtPx(ax + ux * L / 2 + nx2 * d * sg, ay + uy * L / 2 + ny2 * d * sg) === 6) d++; // ancho del muelle de ese lado
        for (let t = 4; t < L - 2; t += 3 * HPM) {
          const x = ax + ux * t + nx2 * (d - 1) * sg, y = ay + uy * t + ny2 * (d - 1) * sg, wet = G.tileAtPx(x + nx2 * 6 * sg, y + ny2 * 6 * sg);
          if (wet !== 4 && wet !== TT.BRIDGEW) continue;
          obox(gp, x, y, ux, uy, 0.9, 0.9, -1, 4.2, rgb('#5a4430'), rgb('#4a3626'));                                                       // pilote
          if (Math.round(t / (3 * HPM)) % 2 === 0) obox(gp, x - nx2 * 3 * sg, y - ny2 * 3 * sg, ux, uy, 0.8, 0.8, 0, 2.2, rgb('#3a3a40'), rgb('#2a2a30')); // bita
        }
      }
    }
    // --- banderas rojas (Gauchito Gil): mástil de caña y paño que flamea
    for (const [xt, yt, hm, col] of PRX.flags || []) {
      const x = tpx(xt), y = tpx(yt), H = hm * MPX;
      obox(gp, x, y, 1, 0, 0.45, 0.45, 0, H + 1, rgb('#c8b890'), rgb('#a89870'));
      flagCloth(fg, x, y, H, 1.4 * HPM, 0.95 * HPM, rgb(col || '#d8201c'));
    }
    // --- sombrillas del jardín cervecero: paño en 8 gajos a rayas, mástil y mesa redonda
    for (const [xt, yt, rm] of PRX.parasols || []) {
      const x = tpx(xt), y = tpx(yt), R = rm * HPM, z1 = 2.3 * MPX, z0 = z1 - 0.5 * MPX, k = Math.floor(xt * 7 + yt * 3);
      const c1 = rgb(['#f2ece0', '#2a6a4a', '#c8302a'][k % 3]), c2 = rgb('#f6f2e8');
      obox(gp, x, y, 1, 0, 0.35, 0.35, 0, z1 + 0.6, rgb('#8a8a8a'), rgb('#6a6a6a'));
      for (let i = 0; i < 8; i++) {
        const a0 = i * Math.PI / 4, a1 = a0 + Math.PI / 4, c = i % 2 ? c1 : c2;
        tri3(gp, [x, y, z1 + 0.6], [x + Math.cos(a0) * R, y + Math.sin(a0) * R, z0], [x + Math.cos(a1) * R, y + Math.sin(a1) * R, z0], mul(c, 0.86 + 0.14 * Math.cos(a0 - 2.3)));
      }
      prism8(gp, x, y, R * 0.45, 2.1, 2.5, rgb('#7a5a3a'), rgb('#5a4028'));                       // mesa
      for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + 0.4; obox(gp, x + Math.cos(a) * R * 0.75, y + Math.sin(a) * R * 0.75, 1, 0, 0.9, 0.9, 0, 1.5, rgb('#3a3a40'), rgb('#2a2a30')); } // banquetas
    }
    // --- plaza de juegos: hamacas, tobogán y calesita (que gira) sobre el arenero
    for (const [xt, yt, rm] of PRX.playgrounds || []) {
      const x = tpx(xt), y = tpx(yt), R = rm * HPM, red = rgb('#d8402a'), yel = rgb('#e8c030'), blu = rgb('#2a6ac8'), grn = rgb('#3a9a4a'), steel = rgb('#9aa0a8');
      // hamacas: dos pórticos en A con travesaño y tres asientos colgando
      const hx = x - R * 0.45, hy = y - R * 0.3, sw = 2.2 * HPM, H = 2.4 * MPX;
      for (const s of [-1, 1]) for (const d of [-1, 1]) leg3(gp, [hx + s * sw, hy + d * 1.2 * HPM, 0], [hx + s * sw, hy, H], 1, 0, 0.7, red);
      obox(gp, hx, hy, 1, 0, sw, 0.5, H - 0.6, H + 0.2, red, mul(red, 0.8));
      for (let i = -1; i <= 1; i++) {
        const sx = hx + i * sw * 0.6;
        for (const e of [-0.6, 0.6]) obox(gp, sx + e * HPM, hy, 1, 0, 0.12, 0.12, 1.4, H, steel, steel);
        obox(gp, sx, hy, 1, 0, 0.75 * HPM, 0.25 * HPM, 1.2, 1.6, [yel, blu, grn][i + 1], mul([yel, blu, grn][i + 1], 0.8));
      }
      // tobogán: torre con techito, escalera y rampa
      const tx2 = x + R * 0.4, ty2 = y - R * 0.25, th = 1.8 * MPX, ts = 0.8 * HPM;
      for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) obox(gp, tx2 + a * ts, ty2 + b * ts, 1, 0, 0.3, 0.3, 0, th + 4, yel, mul(yel, 0.8));
      obox(gp, tx2, ty2, 1, 0, ts, ts, th - 0.4, th, blu, mul(blu, 0.8));
      pyramid(gp, tx2, ty2, 1, 0, ts * 1.25, th + 4, th + 7, red);
      for (let k = 0; k < 5; k++) obox(gp, tx2 - ts - 1 - k * 0.9, ty2, 1, 0, 0.25, ts * 0.8, 0, th * (1 - k / 5), steel, steel); // escalera
      quad4(gp, [tx2 + ts, ty2 - ts * 0.7, th], [tx2 + ts, ty2 + ts * 0.7, th], [tx2 + ts + 3 * HPM, ty2 + ts * 0.7, 0.5], [tx2 + ts + 3 * HPM, ty2 - ts * 0.7, 0.5], rgb('#f0f0f0'));
      for (const e of [-1, 1]) quad4(gp, [tx2 + ts, ty2 + e * ts * 0.7, th], [tx2 + ts + 3 * HPM, ty2 + e * ts * 0.7, 0.5], [tx2 + ts + 3 * HPM, ty2 + e * ts * 0.7, 1.6], [tx2 + ts, ty2 + e * ts * 0.7, th + 1.1], mul(red, 0.85));
      // calesita: plato de gajos de colores con pasamanos, gira
      const cg = Geo(), CR = 1.5 * HPM, cols = [red, yel, blu, grn];
      for (let i = 0; i < 8; i++) {
        const a0 = i * Math.PI / 4, a1 = a0 + Math.PI / 4;
        quad4(cg, [0, 0, 1.2], [Math.cos(a0) * CR, Math.sin(a0) * CR, 1.2], [Math.cos(a1) * CR, Math.sin(a1) * CR, 1.2], [0, 0, 1.2], cols[i % 4]);
        quad4(cg, [Math.cos(a0) * CR, Math.sin(a0) * CR, 0.4], [Math.cos(a1) * CR, Math.sin(a1) * CR, 0.4], [Math.cos(a1) * CR, Math.sin(a1) * CR, 1.2], [Math.cos(a0) * CR, Math.sin(a0) * CR, 1.2], mul(cols[i % 4], 0.7));
        if (i % 2 === 0) leg3(cg, [Math.cos(a0) * CR * 0.9, Math.sin(a0) * CR * 0.9, 1.2], [Math.cos(a0) * CR * 0.25, Math.sin(a0) * CR * 0.25, 3.4], -Math.sin(a0), Math.cos(a0), 0.3, steel);
      }
      obox(cg, 0, 0, 1, 0, 0.6, 0.6, 1.2, 3.6, steel, steel);
      const cm = toMesh(cg, plainMat); cm.matrixAutoUpdate = true; cm.position.set(x - R * 0.05, -(y + R * 0.45), 0); scene.add(cm);
      ANIM.push(t => { cm.rotation.z = t * 0.9; });
      // bancos alrededor
      for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + 0.78; obox(gp, x + Math.cos(a) * (R + 4), y + Math.sin(a) * (R + 4), -Math.sin(a), Math.cos(a), 1.6 * HPM / 2, 0.4 * HPM, 1.2, 1.8, rgb('#8a6444'), rgb('#6a4a30')); }
    }
    // --- altar del Gauchito Gil: casita roja en el centro de las banderas, banderines, velas y cintas
    const fl = (PRX.flags || []).map(([xt, yt, hm]) => [tpx(xt), tpx(yt), hm * MPX]);
    if (fl.length) {
      const ax0 = fl.reduce((s, f) => s + f[0], 0) / fl.length, ay0 = fl.reduce((s, f) => s + f[1], 0) / fl.length;
      const hasBld = G.BLD.some(b => b.name === 'Altar del Gauchito Gil');
      // frente hacia la calle más cercana
      let fx = 0, fy = 1, best = 1e9;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) for (let d = 6; d < 80; d += 3) { const t = G.tileAtPx(ax0 + dx * d, ay0 + dy * d); if (t === 1) { if (d < best) { best = d; fx = dx; fy = dy; } break; } }
      const wA = 2.6 * HPM / 2, wB = 2 * HPM / 2, H = 1.9 * MPX, redA = rgb('#c8201c'), redD = rgb('#8a1010'), gold = rgb('#f0d040');
      if (!hasBld) {
        obox(gp, ax0, ay0, -fy, fx, wA + 0.8, wB + 0.8, 0, 0.8, rgb('#d8d0c0'), rgb('#a8a090'));     // base
        obox(gp, ax0, ay0, -fy, fx, wA, wB, 0.8, H, redA, mul(redA, 0.8));
        const ux = -fy, uy = fx, C = (sa, sb, z) => [ax0 + ux * wA * sa + fx * wB * sb, ay0 + uy * wA * sa + fy * wB * sb, z];
        const R0 = [ax0 - ux * wA, ay0 - uy * wA, H + 3.2], R1 = [ax0 + ux * wA, ay0 + uy * wA, H + 3.2];
        quad4(gp, C(-1.15, -1.25, H - 0.3), C(1.15, -1.25, H - 0.3), [R1[0] - fx * 0, R1[1], R1[2]], R0, redD);
        quad4(gp, C(1.15, 1.25, H - 0.3), C(-1.15, 1.25, H - 0.3), R0, R1, mul(redD, 0.8));
        obox(gp, ax0 + fx * (wB + 0.1), ay0 + fy * (wB + 0.1), ux, uy, wA * 0.45, 0.2, 1.4, H - 0.5, rgb('#2a1a14'), rgb('#2a1a14')); // hornacina
        obox(gp, ax0 + (R0[0] + R1[0]) / 2 - ax0, ay0 + (R0[1] + R1[1]) / 2 - ay0, 1, 0, 0.3, 0.3, H + 3, H + 7, gold, gold);           // cruz
        obox(gp, ax0, ay0, ux, uy, 1.4, 0.3, H + 5.3, H + 5.9, gold, gold);
      }
      // cintas rojas atadas alrededor y botellas/ofrendas en el piso
      const rr = lcg(1234);
      for (let i = 0; i < 26; i++) { const a = rr() * 6.283, d = 6 + rr() * 9; obox(gp, ax0 + Math.cos(a) * d, ay0 + Math.sin(a) * d, Math.cos(a), Math.sin(a), 0.5, 0.3, 0, 1 + rr() * 1.2, rr() < 0.7 ? redA : rgb('#3a8a3a'), mul(redA, 0.8)); }
      // banderines: del mástil más alto a los otros, triangulitos rojos y amarillos que cuelgan
      const top = fl.reduce((m, f) => f[2] > m[2] ? f : m, fl[0]);
      for (const f of fl) {
        if (f === top) continue;
        const A = [top[0], top[1], top[2]], B = [f[0], f[1], f[2] - 0.5];
        for (let k = 0; k < 7; k++) {
          const s = (k + 0.5) / 7, sag = Math.sin(s * Math.PI) * 3, x = A[0] + (B[0] - A[0]) * s, y = A[1] + (B[1] - A[1]) * s, z = A[2] + (B[2] - A[2]) * s - sag;
          const dx = (B[0] - A[0]) / 14, dy = (B[1] - A[1]) / 14, c = k % 2 ? gold : redA;
          vtri(fg, [x - dx * 0.5, y - dy * 0.5, z, 0.3], [x + dx * 0.5, y + dy * 0.5, z, 0.3], [x + 0.6, y + 0.4, z - 2.4, 0.8], c);
        }
      }
      // velas encendidas: llamitas brillantes (bloom) y un resplandor rojo-anaranjado que titila en el piso
      const candles = new T.Group(), flame = new T.MeshBasicMaterial({ color: new T.Color(3.2, 1.7, 0.6) });
      const cgeo = new T.BoxGeometry(0.7, 0.7, 1.2), wax = new T.MeshLambertMaterial({ color: 0xf0e8d8 }), wgeo = new T.BoxGeometry(0.9, 0.9, 1.6);
      for (let i = 0; i < 14; i++) {
        const a = i / 14 * 6.283 + rr() * 0.3, d = (wA + 2.2) + rr() * 3, x = ax0 + Math.cos(a) * d, y = ay0 + Math.sin(a) * d;
        const w = new T.Mesh(wgeo, wax); w.position.set(x, -y, 0.8); candles.add(w);
        const f2 = new T.Mesh(cgeo, flame); f2.position.set(x, -y, 2.2); candles.add(f2);
      }
      scene.add(candles);
      const glow = new T.Mesh(unitPlane, beamShader(`float r = length(vUv - 0.5) * 2.0; float f = 0.85 + 0.15 * sin(uTime * 13.0) * sin(uTime * 7.3);
        gl_FragColor = vec4(uCol * pow(max(0.0, 1.0 - r), 2.2) * f, 1.0);`));
      glow.material.uniforms.uCol.value.setRGB(1.0, 0.32, 0.12); glow.position.set(ax0, -ay0, 1.0); glow.scale.set(70, 70, 1); glow.renderOrder = 6; scene.add(glow);
      const halo = new T.Mesh(unitPlane, glow.material); halo.position.set(ax0, -ay0, H + 2); halo.scale.set(34, 34, 1); halo.renderOrder = 6; scene.add(halo);
      ANIM.push(t => { glow.material.uniforms.uTime.value = t; const s = 1 + 0.05 * Math.sin(t * 9.1); glow.scale.set(70 * s, 70 * s, 1); });
    }
    if (gp.pos.length) scene.add(toMesh(gp, plainMat));
    if (fg.pos.length) scene.add(flagMesh(fg));
  })();

  function updateWorld(cx, cy) {
    U_TIME.value = tNow;
    for (const f of ANIM) f(tNow);
    dust.uniforms.uCam.value.set(cx, -cy, 0);
    updateBirds();
    const wu = water.mat.uniforms, sm = sun.shadow.map ? sun.shadow.map.texture : null;
    wu.uShadowMap.value = sm; wu.uHasShadow.value = sm ? 1 : 0; wu.uTime.value = tNow;
    const p = G.player, o = p.car || p;
    U_PLY.value.set(o.x, -o.y, (o.z || 0));
    updateMarkers();
    // texturas de piso que hace rato no se ven: se liberan de la GPU (el canvas queda en el caché del juego)
    if (frame % 60 === 0) for (const c of G.chunks.values()) if (c.mesh && frame - (c.seen || 0) > 600) evict(c);
  }
  function evict(c) {
    if (c.veg) { scene.remove(c.veg); c.veg.geometry.dispose(); c.veg = null; }
    if (!c.mesh) return;
    scene.remove(c.mesh); c.mesh.material.dispose(); c.tex.dispose(); c.mesh = null; c.tex = null;
  }
  return { render, resize, evict, info: () => renderer.info, POST, LIGHT, sun, renderer, scene, camera };
};
