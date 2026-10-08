// Tierra realista (mapa diurno, luces nocturnas, nubes, océanos especulares, atmósfera),
// Luna y Marte con mapas reales.
import * as THREE from 'three';

const loader = new THREE.TextureLoader();
const cache = new Map();

function tex(path, srgb = true) {
  if (!cache.has(path)) {
    const t = loader.load(path);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    cache.set(path, t);
  }
  return cache.get(path);
}

const earthVertex = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormalW;
  varying vec3 vPosW;
  void main() {
    vUv = uv;
    vNormalW = normalize(mat3(modelMatrix) * normal);
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vPosW = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const earthFragment = /* glsl */ `
  uniform sampler2D dayMap;
  uniform sampler2D nightMap;
  uniform sampler2D brcMap; // R: relieve, G: rugosidad, B: nubes
  uniform vec3 sunDir;
  varying vec2 vUv;
  varying vec3 vNormalW;
  varying vec3 vPosW;
  void main() {
    vec3 n = normalize(vNormalW);
    vec3 v = normalize(cameraPosition - vPosW);
    float ndl = dot(n, sunDir);
    vec3 brc = texture2D(brcMap, vUv).rgb;
    float clouds = smoothstep(0.18, 1.0, brc.b);
    float rough = brc.g;

    vec3 day = texture2D(dayMap, vUv).rgb;
    day = mix(day, vec3(0.95), clouds * 0.85);
    vec3 lit = day * (max(ndl, 0.0) * 1.35 + 0.015);

    vec3 h = normalize(sunDir + v);
    float spec = pow(max(dot(n, h), 0.0), 70.0) * (1.0 - rough) * (1.0 - clouds) * smoothstep(0.0, 0.2, ndl);
    lit += vec3(1.0, 0.92, 0.8) * spec * 0.9;

    vec3 night = texture2D(nightMap, vUv).rgb * (1.0 - clouds * 0.8) * 1.8;
    float dayMix = smoothstep(-0.18, 0.22, ndl);

    float fres = pow(1.0 - max(dot(n, v), 0.0), 2.5);
    vec3 atmo = vec3(0.32, 0.56, 1.0) * fres * smoothstep(-0.25, 0.5, ndl) * 1.1;
    // tono cálido del terminador
    atmo += vec3(1.0, 0.45, 0.2) * fres * (1.0 - abs(ndl) * 4.0) * step(-0.25, ndl) * 0.25;

    vec3 color = mix(night, lit, dayMix) + max(atmo, 0.0);
    gl_FragColor = vec4(color, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const atmoVertex = /* glsl */ `
  varying vec3 vNormalW;
  varying vec3 vPosW;
  void main() {
    vNormalW = normalize(mat3(modelMatrix) * normal);
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vPosW = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const atmoFragment = /* glsl */ `
  uniform vec3 sunDir;
  varying vec3 vNormalW;
  varying vec3 vPosW;
  void main() {
    vec3 n = normalize(vNormalW);
    vec3 v = normalize(cameraPosition - vPosW);
    float rim = pow(clamp(1.0 + dot(v, n) * 1.15, 0.0, 1.0), 3.0);
    float sun = smoothstep(-0.35, 0.45, dot(n, sunDir));
    vec3 col = mix(vec3(1.0, 0.5, 0.25), vec3(0.35, 0.62, 1.0), smoothstep(0.0, 0.35, dot(n, sunDir)));
    gl_FragColor = vec4(col * rim * sun * 1.4, rim * sun);
    #include <colorspace_fragment>
  }
`;

/** Tierra con mapas reales. sunDir debe estar en coordenadas de mundo. */
export function createEarth(radius, segments = 128) {
  const group = new THREE.Group();
  const sunDir = { value: new THREE.Vector3(1, 0.3, 0.5).normalize() };
  const surface = new THREE.Mesh(
    new THREE.SphereGeometry(radius, segments, segments / 2),
    new THREE.ShaderMaterial({
      uniforms: {
        dayMap: { value: tex('/textures/earth_day_4096.jpg') },
        nightMap: { value: tex('/textures/earth_night_4096.jpg') },
        brcMap: { value: tex('/textures/earth_bump_roughness_clouds_4096.jpg', false) },
        sunDir,
      },
      vertexShader: earthVertex,
      fragmentShader: earthFragment,
    }),
  );
  const atmosphere = new THREE.Mesh(
    new THREE.SphereGeometry(radius * 1.035, segments, segments / 2),
    new THREE.ShaderMaterial({
      uniforms: { sunDir },
      vertexShader: atmoVertex,
      fragmentShader: atmoFragment,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  group.add(surface, atmosphere);
  group.userData.surface = surface;
  group.userData.setSun = (dir) => sunDir.value.copy(dir).normalize();
  return group;
}

export function createMoon(radius, segments = 96) {
  return new THREE.Mesh(
    new THREE.SphereGeometry(radius, segments, segments / 2),
    new THREE.MeshStandardMaterial({ map: tex('/textures/moon_1024.jpg'), roughness: 1, metalness: 0 }),
  );
}

export function createMars(radius, segments = 96) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(
    new THREE.SphereGeometry(radius, segments, segments / 2),
    new THREE.MeshStandardMaterial({ map: tex('/textures/mars_nasa_1440.jpg'), roughness: 1, metalness: 0 }),
  ));
  return g;
}

/** Brillo suave para el Sol, motores y marcadores. */
let glowTex;
export function glowSprite(color, size) {
  if (!glowTex) {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const ctx = c.getContext('2d');
    const grd = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.25, 'rgba(255,255,255,0.35)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, 128, 128);
    glowTex = new THREE.CanvasTexture(c);
  }
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  s.scale.setScalar(size);
  return s;
}

export function starfield(n = 5000, radius = 9000) {
  const pos = new Float32Array(n * 3);
  const col = new Float32Array(n * 3);
  const v = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    v.randomDirection().multiplyScalar(radius * (0.9 + Math.random() * 0.2));
    pos.set([v.x, v.y, v.z], i * 3);
    const warm = Math.random();
    const b = 0.45 + Math.random() ** 3 * 0.55;
    col.set([b, b * (0.92 + warm * 0.06), b * (0.86 + (1 - warm) * 0.14)], i * 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return new THREE.Points(geo, new THREE.PointsMaterial({ size: 1.5, sizeAttenuation: false, vertexColors: true, depthWrite: false }));
}
