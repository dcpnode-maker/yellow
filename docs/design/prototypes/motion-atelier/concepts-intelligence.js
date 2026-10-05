// Q215: illustrative, deterministic seven-second art studies, never operational UI.
// Shared tokens keep the collection coherent; silhouettes and choreography differ.
const palette = Object.freeze({
  ink: 0x20383f, ceramic: 0xf2eee4, paper: 0xfffcf4, brass: 0xb49457,
  edge: 0xd7cebd, blue: 0x7197a5, jade: 0x648d7c, mist: 0xbad3d1,
});
const clamp = value => Math.max(0, Math.min(1, value));
const ease = value => { const x = clamp(value); return x * x * (3 - 2 * x); };
const phase = (seconds, start, end) => ease((seconds - start) / (end - start));
const cycle = seconds => Math.max(0, Math.min(7, Number.isFinite(seconds) ? seconds : 0));
const mix = (a, b, t) => a + (b - a) * t;

function helpers(THREE, kit) {
  const material = (color, options = {}) => new THREE.MeshPhysicalMaterial({
    color, roughness: 0.35, metalness: 0.06, clearcoat: 0.35,
    clearcoatRoughness: 0.2, ...options,
  });
  const place = (parent, item, x, y, z, shadow = true) => {
    item.position.set(x, y, z);
    if (item.isMesh) { item.castShadow = shadow; item.receiveShadow = shadow; }
    parent.add(item);
    return item;
  };
  const box = (parent, w, h, d, color, x, y, z, radius = 0.08) =>
    place(parent, kit.roundedBox(w, h, d, radius,
      typeof color === "number" ? material(color) : color), x, y, z);
  const label = (parent, text, x, y, z, size = 0.18) =>
    place(parent, kit.label(text, { size, color: "#20383f" }), x, y, z, false);
  const pipe = (parent, points, radius, mat) => {
    const curve = new THREE.CatmullRomCurve3(points.map(point => new THREE.Vector3(...point)));
    const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 64, radius, 8, false), mat);
    parent.add(mesh);
    return mesh;
  };
  return { material, place, box, label, pipe };
}

function opticalLens(THREE, kit) {
  const root = new THREE.Group();
  const { material, place, box, label, pipe } = helpers(THREE, kit);
  const brass = material(palette.brass, { metalness: 0.83, roughness: 0.22 });
  const dark = material(palette.ink, { metalness: 0.55, roughness: 0.28 });
  const glass = material(0xddeee9, {
    transmission: 0.9, thickness: 0.38, ior: 1.47, roughness: 0.055,
    metalness: 0, clearcoat: 1, attenuationColor: new THREE.Color(0xb4d5cd),
    attenuationDistance: 3,
  });
  box(root, 6.5, 0.28, 3.8, palette.ceramic, 0, 0.1, 0, 0.22);
  box(root, 6.2, 0.045, 3.5, brass, 0, 0.265, 0, 0.16);
  box(root, 6.08, 0.07, 3.38, palette.paper, 0, 0.32, 0, 0.16);

  const document = new THREE.Group();
  root.add(document);
  document.position.set(-0.85, 2.12, -0.23);
  document.rotation.x = -0.1;
  box(document, 2.85, 3.32, 0.14, palette.paper, 0, 0, 0, 0.14);
  box(document, 2.55, 0.022, 0.02, brass, 0, 0.85, 0.09, 0.005);
  label(document, "SAMPLE / GUEST DRAFT", 0, 1.28, 0.14, 0.17);
  const profile = place(document, new THREE.Mesh(new THREE.SphereGeometry(0.25, 32, 20),
    material(palette.mist)), -0.84, 0.29, 0.12);
  profile.scale.set(1, 1.07, 0.13);
  const shoulders = place(document, new THREE.Mesh(new THREE.SphereGeometry(0.43, 32, 20),
    material(palette.mist)), -0.84, -0.2, 0.095);
  shoulders.scale.set(1, 0.57, 0.09);
  for (let i = 0; i < 7; i++) {
    const width = i < 3 ? 1.27 - i * 0.12 : 2.26 - (i % 3) * 0.2;
    box(document, width, 0.055, 0.018, i === 0 ? palette.ink : palette.edge,
      i < 3 ? 0.42 : 0, 0.46 - i * 0.25, 0.093, 0.018);
  }
  label(document, "ILLUSTRATIVE · REVIEW REQUIRED", 0, -1.39, 0.14, 0.115);

  // A mechanical overhead carriage, not a floating scan effect.
  box(root, 0.16, 3.37, 0.19, dark, 1.08, 2.03, -0.88, 0.05);
  box(root, 4.42, 0.14, 0.17, brass, -0.28, 3.77, -0.62, 0.05);
  const lens = new THREE.Group();
  root.add(lens);
  for (const z of [-0.11, 0.16]) {
    place(lens, new THREE.Mesh(new THREE.TorusGeometry(0.89, 0.065, 12, 96), brass), 0, 0, z);
  }
  const optic = place(lens, new THREE.Mesh(new THREE.SphereGeometry(0.835, 48, 32), glass), 0, 0, 0.035, false);
  optic.scale.z = 0.2;
  for (let i = 0; i < 20; i++) {
    const angle = i * Math.PI / 10;
    const tick = box(lens, 0.017, i % 5 === 0 ? 0.09 : 0.047, 0.018,
      dark, Math.cos(angle) * 0.895, Math.sin(angle) * 0.895, 0.231, 0.004);
    tick.rotation.z = angle - Math.PI / 2;
  }
  pipe(lens, [[0, 0.91, -0.09], [0, 1.26, -0.09], [0, 1.35, -1.19]], 0.042, brass);
  const carriage = box(root, 0.34, 0.24, 0.28, dark, 0, 3.77, -0.57, 0.065);
  const reviewLeaves = [];
  for (let i = 0; i < 3; i++) {
    const leaf = new THREE.Group();
    root.add(leaf);
    box(leaf, 1.36, 0.58, 0.13, palette.paper, 0, 0, 0, 0.11);
    box(leaf, 0.038, 0.31, 0.025, i === 1 ? palette.brass : palette.jade, -0.51, 0, 0.08, 0.012);
    label(leaf, ["01  DRAFT", "02  REVIEW", "03  CONFIRM"][i], 0.04, 0, 0.105, 0.12);
    reviewLeaves.push(leaf);
  }
  const update = seconds => {
    const t = cycle(seconds);
    const scan = phase(t, 0.6, 4.65) * (1 - phase(t, 6.05, 7));
    lens.position.set(mix(-1.48, 0.32, scan), 2.42, 0.57);
    lens.rotation.y = Math.sin(scan * Math.PI) * -0.1;
    carriage.position.x = lens.position.x;
    reviewLeaves.forEach((leaf, i) => {
      const opened = phase(t, 1.3 + i * 0.65, 2.2 + i * 0.65) * (1 - phase(t, 6.15, 7));
      leaf.position.set(2.04 + opened * 0.12, 2.95 - i * 0.83, -0.25 + opened * 0.32);
      leaf.rotation.y = (1 - opened) * -0.5;
    });
  };
  update(0);
  return { root, update, camera: seconds => ({
    position: [7.7 - Math.sin(cycle(seconds) / 7 * Math.PI * 2) * 0.45, 5.1, 11.9],
    target: [0, 1.95, 0], fov: 35,
  }) };
}

function candidateOrbits(THREE, kit) {
  const root = new THREE.Group();
  const { material, place, box, label, pipe } = helpers(THREE, kit);
  const brass = material(palette.brass, { metalness: 0.75, roughness: 0.25 });
  const chalk = material(palette.ceramic, { roughness: 0.45 });
  place(root, new THREE.Mesh(new THREE.CylinderGeometry(3.68, 3.78, 0.22, 96), chalk), 0, 0.05, 0);
  box(root, 2.3, 0.42, 2.13, palette.paper, 0, 0.47, 0.7, 0.24);
  box(root, 2.13, 0.07, 1.98, brass, 0, 0.71, 0.7, 0.19);
  label(root, "CURATED / STAFF DECIDES", 0, 0.31, 2.3, 0.18);

  const starts = [[-2.42, 1.75, 0.1], [0, 2.65, -1.6], [2.42, 1.55, 0.15]];
  const ends = [[0, 0.96, 0.71], [-2.56, 0.54, -0.9], [2.56, 0.54, -0.9]];
  const paths = starts.map((start, i) => new THREE.CatmullRomCurve3([
    new THREE.Vector3(...start),
    new THREE.Vector3(start[0] * 0.67 + (i === 1 ? -0.6 : 0), start[1] + 0.3, -0.35),
    new THREE.Vector3(...ends[i]),
  ]));
  paths.forEach(path => {
    const line = new THREE.Mesh(new THREE.TubeGeometry(path, 70, 0.018, 6, false),
      material(palette.brass, { metalness: 0.5, roughness: 0.35 }));
    root.add(line);
  });

  const rooms = starts.map((_, i) => {
    const room = new THREE.Group();
    root.add(room);
    const accent = [palette.jade, palette.blue, palette.brass][i];
    box(room, 1.72, 0.15, 1.46, palette.paper, 0, 0, 0, 0.14);
    box(room, 1.66, 0.12, 0.12, brass, 0, -0.06, 0.68, 0.045);
    box(room, 1.55, 0.72, 0.085, accent, 0, 0.36, -0.61, 0.04);
    box(room, 0.87, 0.21, 0.97, palette.ceramic, -0.23, 0.19, -0.01, 0.09);
    box(room, 0.82, 0.12, 0.8, palette.paper, -0.23, 0.34, -0.02, 0.055);
    box(room, 0.83, 0.018, 0.25, accent, -0.23, 0.411, 0.21, 0.008);
    for (const x of [-0.42, -0.05]) box(room, 0.29, 0.09, 0.22,
      palette.paper, x, 0.44, -0.3, 0.075);
    box(room, 0.28, 0.32, 0.29, palette.edge, 0.53, 0.23, -0.23, 0.07);
    place(room, new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.1, 0.22, 20), brass), 0.53, 0.5, -0.23);
    place(room, new THREE.Mesh(new THREE.SphereGeometry(0.1, 20, 12),
      material(palette.paper)), 0.53, 0.65, -0.23);
    label(room, ["A / TERRACE", "B / COURTYARD", "C / STUDIO"][i], 0, 1.05, 0.02, 0.16);
    return room;
  });
  // Decision markers are ordered physical positions, not orbiting electrons.
  const markers = [];
  for (let i = 0; i < 3; i++) {
    const marker = place(root, new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.025, 32),
      material([palette.jade, palette.blue, palette.brass][i])), (i - 1) * 0.45, 0.19, 2.87);
    markers.push(marker);
  }
  const update = seconds => {
    const t = cycle(seconds);
    const decide = phase(t, 1.15, 4.8) * (1 - phase(t, 6.15, 7));
    rooms.forEach((room, i) => {
      const u = i === 0 ? decide : ease(clamp(decide * 1.1));
      room.position.copy(paths[i].getPoint(u));
      room.rotation.y = mix([0.3, -0.12, -0.32][i], i === 0 ? 0 : (i - 1.5) * 0.18, decide);
      const scale = i === 0 ? 1 + decide * 0.17 : 1 - decide * 0.18;
      room.scale.setScalar(scale);
      markers[i].scale.setScalar(i === 0 ? 1 + decide * 0.35 : 1 - decide * 0.15);
    });
  };
  update(0);
  return { root, update, camera: seconds => ({
    position: [8.4 - 0.75 * Math.sin(cycle(seconds) / 7 * Math.PI), 6.7, 10.7],
    target: [0, 1.35, 0], fov: 37,
  }) };
}

function revenueTerrain(THREE, kit) {
  const root = new THREE.Group();
  const { material, place, box, label } = helpers(THREE, kit);
  const brass = material(palette.brass, { metalness: 0.77, roughness: 0.25 });
  box(root, 6.95, 0.32, 5.15, palette.ceramic, 0, 0.13, 0, 0.2);
  box(root, 6.64, 0.045, 4.91, brass, 0, 0.313, 0, 0.12);
  const height = (x, z) => 0.57
    + 1.82 * Math.exp(-((x + 1.05) ** 2 / 1.65 + (z + 0.7) ** 2 / 0.93))
    + 1.19 * Math.exp(-((x - 1.56) ** 2 / 0.95 + (z - 0.28) ** 2 / 1.2))
    + 0.34 * Math.exp(-((x + 0.18) ** 2 / 6.7 + (z - 1.1) ** 2 / 0.42));
  const nx = 72, nz = 52, width = 6.35, depth = 4.55;
  const positions = [], colors = [], indices = [];
  const low = new THREE.Color(0x85b3b2), high = new THREE.Color(0xd5ba7c);
  const color = new THREE.Color();
  for (let iz = 0; iz <= nz; iz++) for (let ix = 0; ix <= nx; ix++) {
    const x = ix / nx * width - width / 2;
    const z = iz / nz * depth - depth / 2;
    const y = height(x, z);
    positions.push(x, y, z);
    color.copy(low).lerp(high, clamp((y - 0.6) / 1.7));
    colors.push(color.r, color.g, color.b);
    if (ix < nx && iz < nz) {
      const a = iz * (nx + 1) + ix, b = a + 1, c = a + nx + 1, d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  place(root, new THREE.Mesh(geometry, material(0xffffff, {
    vertexColors: true, roughness: 0.32, metalness: 0.2, side: THREE.DoubleSide,
  })), 0, 0, 0);
  const boundary = [];
  for (let i = 0; i <= nx; i++) boundary.push([i / nx * width - width / 2, -depth / 2]);
  for (let i = 1; i <= nz; i++) boundary.push([width / 2, i / nz * depth - depth / 2]);
  for (let i = nx - 1; i >= 0; i--) boundary.push([i / nx * width - width / 2, depth / 2]);
  for (let i = nz - 1; i >= 0; i--) boundary.push([-width / 2, i / nz * depth - depth / 2]);
  const skirtVertices = [], skirtIndices = [];
  boundary.forEach(([x, z], i) => {
    skirtVertices.push(x, 0.34, z, x, height(x, z), z);
    if (i + 1 < boundary.length) {
      const n = i * 2;
      skirtIndices.push(n, n + 1, n + 2, n + 1, n + 3, n + 2);
    }
  });
  const skirt = new THREE.BufferGeometry();
  skirt.setAttribute("position", new THREE.Float32BufferAttribute(skirtVertices, 3));
  skirt.setIndex(skirtIndices);
  skirt.computeVertexNormals();
  place(root, new THREE.Mesh(skirt, material(0x8eb5b3, { side: THREE.DoubleSide })), 0, 0, 0);

  // True iso-height contours from a marching-cell cross-section of the surface.
  const contourPoints = [];
  for (let level = 0.74; level < 2.45; level += 0.19) {
    for (let iz = 0; iz < nz; iz++) for (let ix = 0; ix < nx; ix++) {
      const x = ix / nx * width - width / 2, z = iz / nz * depth - depth / 2;
      const corners = [[x, z], [x + width / nx, z],
        [x + width / nx, z + depth / nz], [x, z + depth / nz]];
      const crossings = [];
      for (let edge = 0; edge < 4; edge++) {
        const a = corners[edge], b = corners[(edge + 1) % 4];
        const ha = height(...a), hb = height(...b);
        if ((ha < level) !== (hb < level)) {
          const u = (level - ha) / (hb - ha);
          crossings.push([mix(a[0], b[0], u), level + 0.012, mix(a[1], b[1], u)]);
        }
      }
      for (let i = 0; i + 1 < crossings.length; i += 2) contourPoints.push(...crossings[i], ...crossings[i + 1]);
    }
  }
  const contourGeometry = new THREE.BufferGeometry();
  contourGeometry.setAttribute("position", new THREE.Float32BufferAttribute(contourPoints, 3));
  root.add(new THREE.LineSegments(contourGeometry,
    new THREE.LineBasicMaterial({ color: palette.paper, transparent: true, opacity: 0.8 })));
  for (let i = 0; i < 5; i++) label(root,
    ["MON", "TUE", "WED", "THU", "FRI"][i], -2.6 + i * 1.3, 0.39, 2.68, 0.14);
  label(root, "ILLUSTRATIVE DEMAND / NOT A FORECAST", 0, 0.42, -2.74, 0.15);

  const slicePositions = new Float32Array(65 * 3);
  const sliceGeometry = new THREE.BufferGeometry();
  sliceGeometry.setAttribute("position", new THREE.BufferAttribute(slicePositions, 3));
  const slice = new THREE.Line(sliceGeometry, new THREE.LineBasicMaterial({ color: palette.ink }));
  slice.frustumCulled = false;
  root.add(slice);
  const beacon = place(root, new THREE.Mesh(new THREE.SphereGeometry(0.13, 24, 16), brass), 0, 0, 0);
  const marker = box(root, 0.045, 0.055, 4.56, brass, 0, 0.41, 0, 0.01);
  const update = seconds => {
    const t = cycle(seconds);
    const u = phase(t, 0.6, 5.9) * (1 - phase(t, 6.35, 7));
    const x = mix(-2.85, 2.85, u);
    for (let i = 0; i < 65; i++) {
      const z = i / 64 * depth - depth / 2;
      slicePositions[i * 3] = x;
      slicePositions[i * 3 + 1] = height(x, z) + 0.043;
      slicePositions[i * 3 + 2] = z;
    }
    sliceGeometry.attributes.position.needsUpdate = true;
    beacon.position.set(x, height(x, -0.3) + 0.14, -0.3);
    marker.position.x = x;
  };
  update(0);
  return { root, update, camera: seconds => ({
    position: [8.4 * Math.cos(0.1 * Math.sin(cycle(seconds) / 7 * Math.PI * 2)), 7.5,
      9.7 + 0.5 * Math.sin(cycle(seconds) / 7 * Math.PI * 2)],
    target: [0, 0.95, 0], fov: 35,
  }) };
}

function ceramicJourney(THREE, kit) {
  const root = new THREE.Group();
  const { material, place, box, label } = helpers(THREE, kit);
  const brass = material(palette.brass, { metalness: 0.8, roughness: 0.24 });
  const glaze = material(palette.paper, { roughness: 0.2, clearcoat: 0.95, metalness: 0.02 });
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-3.2, 0.67, 0.95), new THREE.Vector3(-2.1, 1.12, 0.13),
    new THREE.Vector3(-0.95, 0.73, -0.82), new THREE.Vector3(0.36, 1.17, -0.41),
    new THREE.Vector3(1.7, 0.95, 0.89), new THREE.Vector3(3.05, 1.98, 0.28),
  ]);
  box(root, 7.72, 0.2, 4.08, palette.ceramic, 0, 0.05, 0, 0.24);
  const up = new THREE.Vector3(0, 1, 0), side = new THREE.Vector3(), normal = new THREE.Vector3();
  const positions = [], indices = [], leftEdge = [], rightEdge = [];
  const count = 160;
  for (let i = 0; i <= count; i++) {
    const t = i / count, p = curve.getPoint(t), tangent = curve.getTangent(t);
    side.crossVectors(tangent, up).normalize();
    normal.crossVectors(side, tangent).normalize();
    const half = 0.48 + 0.055 * Math.sin(t * Math.PI);
    for (const [s, h] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
      const v = p.clone().addScaledVector(side, s * half).addScaledVector(normal, h * 0.075);
      positions.push(v.x, v.y, v.z);
    }
    leftEdge.push(p.clone().addScaledVector(side, -half));
    rightEdge.push(p.clone().addScaledVector(side, half));
    if (i < count) {
      const a = i * 4, b = a + 4;
      indices.push(a, b, a + 1, a + 1, b, b + 1,
        a + 2, a + 3, b + 2, a + 3, b + 3, b + 2,
        a, a + 2, b, a + 2, b + 2, b,
        a + 1, b + 1, a + 3, a + 3, b + 1, b + 3);
    }
  }
  indices.push(0, 1, 2, 1, 3, 2, count * 4, count * 4 + 2, count * 4 + 1,
    count * 4 + 1, count * 4 + 2, count * 4 + 3);
  // The side-frame construction winds inward; invert once for outward ceramic normals.
  for (let i = 0; i < indices.length; i += 3) {
    [indices[i + 1], indices[i + 2]] = [indices[i + 2], indices[i + 1]];
  }
  const ribbonGeometry = new THREE.BufferGeometry();
  ribbonGeometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  ribbonGeometry.setIndex(indices);
  ribbonGeometry.computeVertexNormals();
  place(root, new THREE.Mesh(ribbonGeometry, glaze), 0, 0, 0);
  for (const points of [leftEdge, rightEdge]) {
    const edge = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 180, 0.023, 6, false), brass);
    root.add(edge);
  }
  const milestones = [0.08, 0.47, 0.89];
  const stations = [];
  milestones.forEach((u, i) => {
    const point = curve.getPoint(u), tangent = curve.getTangent(u);
    const portal = new THREE.Group();
    root.add(portal);
    portal.position.copy(point);
    portal.rotation.y = Math.atan2(tangent.x, tangent.z);
    const shape = new THREE.Shape();
    shape.moveTo(-0.73, 0);
    shape.lineTo(-0.73, 0.97);
    shape.absarc(0, 0.97, 0.73, Math.PI, 0, true);
    shape.lineTo(0.73, 0);
    shape.lineTo(0.56, 0);
    shape.lineTo(0.56, 0.97);
    shape.absarc(0, 0.97, 0.56, 0, Math.PI, false);
    shape.lineTo(-0.56, 0);
    shape.closePath();
    const portalGeometry = new THREE.ExtrudeGeometry(shape, {
      depth: 0.17, bevelEnabled: true, bevelThickness: 0.025,
      bevelSize: 0.03, bevelSegments: 3, curveSegments: 36,
    });
    place(portal, new THREE.Mesh(portalGeometry,
      material([palette.ceramic, palette.mist, palette.ceramic][i], { roughness: 0.24, clearcoat: 0.85 })), 0, 0.015, -0.085);
    label(root, ["ARRIVAL", "REVIEW", "HANDOFF"][i], point.x, point.y + 2.09, point.z, 0.16);
    const disc = place(root, new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.022, 32), brass),
      point.x, point.y + 0.095, point.z);
    stations.push(disc);
  });
  const token = new THREE.Group();
  root.add(token);
  box(token, 0.44, 0.19, 0.36, palette.jade, 0, 0, 0, 0.085);
  box(token, 0.24, 0.02, 0.19, brass, 0, 0.105, 0, 0.035);
  label(root, "ONE GUEST · ONE CONTINUOUS JOURNEY", 0, 0.33, 2.31, 0.15);
  const update = seconds => {
    const t = cycle(seconds);
    const progress = phase(t, 0.45, 5.95) * (1 - phase(t, 6.4, 7));
    const u = mix(0.015, 0.97, progress), point = curve.getPoint(u), tangent = curve.getTangent(u);
    token.position.copy(point);
    token.position.y += 0.22;
    token.rotation.set(0, Math.atan2(tangent.x, tangent.z), 0);
    stations.forEach((disc, i) => {
      const emphasis = Math.exp(-((u - milestones[i]) ** 2) / 0.0035);
      disc.scale.set(1 + emphasis * 0.4, 1, 1 + emphasis * 0.4);
    });
  };
  update(0);
  return { root, update, camera: seconds => ({
    position: [8.3 - 0.5 * Math.sin(cycle(seconds) / 7 * Math.PI * 2), 6.4, 11.5],
    target: [0, 1.6, 0], fov: 38,
  }) };
}

export const intelligenceConcepts = [
  {
    id: "05", title: "The identity lens", subtitle: "Clarity before confirmation",
    category: "Optical intelligence", layout: "lens",
    summary: "A machined glass lens traverses an illustrative document. Review fields separate into a deliberate staff-confirmation sequence.",
    checks: ["Illustrative document", "Optical focus", "Review before confirmation", "No identity verification"],
    create: opticalLens,
  },
  {
    id: "06", title: "Decision orbits", subtitle: "Possibilities become a considered choice",
    category: "Spatial decision support", layout: "decision",
    summary: "Three physical room candidates follow individual curved rails. One settles onto the selection plinth while alternatives remain visible.",
    checks: ["Sample room candidates", "Visible alternatives", "Ordered convergence", "Staff retains the choice"],
    create: candidateOrbits,
  },
  {
    id: "07", title: "The revenue terrain", subtitle: "Read the shape of a possible week",
    category: "Sculptural analytics", layout: "terrain",
    summary: "A glazed demand landscape turns peaks into real geometry. An optical section moves across its contours without concealing the whole.",
    checks: ["Illustrative demand", "True contour geometry", "A moving cross-section", "Not a revenue forecast"],
    create: revenueTerrain,
  },
  {
    id: "08", title: "A continuous journey", subtitle: "Arrival, review and handoff in one ribbon",
    category: "Ceramic choreography", layout: "journey",
    summary: "A solid ceramic ribbon rises through architectural portals. One guest token carries continuity from arrival to a considered handoff.",
    checks: ["Synthetic guest token", "Three physical stations", "Continuous spatial path", "Illustrative handoff only"],
    create: ceramicJourney,
  },
];
