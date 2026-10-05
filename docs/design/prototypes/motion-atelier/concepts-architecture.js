const LOOP_SECONDS = 7;

const clamp01 = (value) => Math.max(0, Math.min(1, value));

function ease(kit, value) {
  return kit.smooth(0, 1, clamp01(value));
}

function enter(kit, seconds, start, duration) {
  return ease(kit, (seconds - start) / duration);
}

function leave(kit, seconds, start, duration) {
  return 1 - enter(kit, seconds, start, duration);
}

function staged(kit, seconds, inStart, inDuration, outStart = 6, outDuration = 0.8) {
  return Math.min(
    enter(kit, seconds, inStart, inDuration),
    leave(kit, seconds, outStart, outDuration),
  );
}

function objectFromRoundedBox(THREE, kit, width, height, depth, radius, material) {
  const candidate = kit.roundedBox(width, height, depth, radius, material);
  return candidate?.isObject3D ? candidate : new THREE.Mesh(candidate, material);
}

function rounded(
  THREE,
  kit,
  parent,
  dimensions,
  position,
  material,
  options = {},
) {
  const [width, height, depth, radius = 0.06] = dimensions;
  const item = objectFromRoundedBox(THREE, kit, width, height, depth, radius, material);
  item.position.set(...position);
  item.castShadow = options.castShadow ?? true;
  item.receiveShadow = options.receiveShadow ?? true;
  if (options.rotation) item.rotation.set(...options.rotation);
  if (options.name) item.name = options.name;
  parent.add(item);
  return item;
}

function mesh(
  THREE,
  parent,
  geometry,
  material,
  position,
  options = {},
) {
  const item = new THREE.Mesh(geometry, material);
  item.position.set(...position);
  item.castShadow = options.castShadow ?? true;
  item.receiveShadow = options.receiveShadow ?? true;
  if (options.rotation) item.rotation.set(...options.rotation);
  if (options.scale) item.scale.set(...options.scale);
  if (options.name) item.name = options.name;
  parent.add(item);
  return item;
}

function addLabel(kit, parent, text, position, options = {}) {
  const item = kit.label(text, {
    size: options.size ?? 0.22,
    color: options.color ?? "#28342f",
  });
  if (!item?.isObject3D) return null;
  item.position.set(...position);
  if (options.scale) item.scale.multiplyScalar(options.scale);
  parent.add(item);
  return item;
}

function addTube(THREE, kit, parent, points, radius, color) {
  const vectors = points.map((point) => new THREE.Vector3(...point));
  const candidate = kit.tube(vectors, radius, color);
  const item = candidate?.isObject3D
    ? candidate
    : new THREE.Mesh(
        candidate,
        new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.05 }),
      );
  item.castShadow = true;
  parent.add(item);
  return item;
}

function addTree(THREE, kit, parent, x, z, scale, materials) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  parent.add(group);

  mesh(
    THREE,
    group,
    new THREE.CylinderGeometry(0.06 * scale, 0.09 * scale, 0.7 * scale, 10),
    materials.trunk,
    [0, 0.42 * scale, 0],
    { castShadow: true },
  );
  const crown = mesh(
    THREE,
    group,
    new THREE.IcosahedronGeometry(0.28 * scale, 2),
    materials.leaf,
    [0, 0.88 * scale, 0],
    { castShadow: true },
  );
  crown.scale.set(1, 1.18, 0.92);
  return group;
}

function addBench(THREE, kit, parent, x, y, z, width, materials, rotationY = 0) {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  group.rotation.y = rotationY;
  parent.add(group);
  rounded(THREE, kit, group, [width, 0.1, 0.34, 0.05], [0, 0.38, 0], materials.seat);
  rounded(THREE, kit, group, [width, 0.44, 0.08, 0.04], [0, 0.62, -0.15], materials.seat);
  for (const legX of [-width * 0.36, width * 0.36]) {
    rounded(THREE, kit, group, [0.06, 0.38, 0.06, 0.02], [legX, 0.18, 0], materials.metal);
  }
  return group;
}

function addBed(THREE, kit, parent, x, y, z, width, depth, materials, rotationY = 0) {
  const bed = new THREE.Group();
  bed.position.set(x, y, z);
  bed.rotation.y = rotationY;
  parent.add(bed);
  rounded(THREE, kit, bed, [width, 0.18, depth, 0.08], [0, 0.2, 0], materials.base);
  rounded(THREE, kit, bed, [width - 0.08, 0.18, depth - 0.12, 0.09], [0, 0.38, 0], materials.linen);
  rounded(THREE, kit, bed, [width, 0.7, 0.12, 0.06], [0, 0.58, -depth * 0.48], materials.headboard);
  for (const pillowX of [-width * 0.23, width * 0.23]) {
    const pillow = rounded(
      THREE,
      kit,
      bed,
      [width * 0.38, 0.11, depth * 0.24, 0.07],
      [pillowX, 0.53, -depth * 0.29],
      materials.pillow,
    );
    pillow.rotation.x = -0.08;
  }
  const runner = rounded(
    THREE,
    kit,
    bed,
    [width - 0.1, 0.035, depth * 0.28, 0.018],
    [0, 0.5, depth * 0.25],
    materials.runner,
    { castShadow: false },
  );
  runner.receiveShadow = true;
  return bed;
}

function addChair(THREE, kit, parent, x, y, z, materials, rotationY = 0, scale = 1) {
  const chair = new THREE.Group();
  chair.position.set(x, y, z);
  chair.rotation.y = rotationY;
  chair.scale.setScalar(scale);
  parent.add(chair);
  rounded(THREE, kit, chair, [0.5, 0.12, 0.52, 0.06], [0, 0.42, 0], materials.seat);
  rounded(THREE, kit, chair, [0.5, 0.58, 0.1, 0.05], [0, 0.7, -0.22], materials.seat);
  for (const xOffset of [-0.18, 0.18]) {
    for (const zOffset of [-0.17, 0.17]) {
      rounded(
        THREE,
        kit,
        chair,
        [0.045, 0.4, 0.045, 0.018],
        [xOffset, 0.2, zOffset],
        materials.metal,
      );
    }
  }
  return chair;
}

function cameraOrbit(seconds, radiusX, radiusZ, height, target, phase = 0) {
  const travel = Math.sin((Math.PI * seconds) / LOOP_SECONDS);
  const angle = phase + travel * 0.34;
  return {
    position: [Math.cos(angle) * radiusX, height + travel * 0.45, Math.sin(angle) * radiusZ],
    target,
    fov: 38,
  };
}

function createAtlasTwin(THREE, kit) {
  const root = new THREE.Group();
  root.name = "atlas-hotel-twin";

  const material = {
    stone: kit.mat("#ddd3c2", { roughness: 0.82, metalness: 0 }),
    stoneLight: kit.mat("#f2ede4", { roughness: 0.78, metalness: 0 }),
    reveal: kit.mat("#f7f4ed", { roughness: 0.66, metalness: 0 }),
    ink: kit.mat("#26342f", { roughness: 0.63, metalness: 0.06 }),
    bronze: kit.mat("#ad8858", { roughness: 0.42, metalness: 0.42 }),
    glass: kit.mat("#a9c5c2", {
      roughness: 0.18,
      metalness: 0.04,
      transparent: true,
      opacity: 0.58,
      transmission: 0.16,
    }),
    window: kit.mat("#617675", { roughness: 0.24, metalness: 0.18 }),
    windowLit: kit.mat("#e2c999", { roughness: 0.38, metalness: 0, emissive: "#6f552e", emissiveIntensity: 0.12 }),
    water: kit.mat("#90b8b4", { roughness: 0.16, metalness: 0.08, transparent: true, opacity: 0.76 }),
    soil: kit.mat("#6a6150", { roughness: 0.92 }),
    leaf: kit.mat("#627a62", { roughness: 0.88 }),
    trunk: kit.mat("#7b644d", { roughness: 0.95 }),
    route: kit.mat("#c7a660", { roughness: 0.4, metalness: 0.12 }),
  };

  const plinth = rounded(THREE, kit, root, [7.6, 0.24, 5.5, 0.12], [0, 0.02, 0], material.stoneLight);
  plinth.receiveShadow = true;
  rounded(THREE, kit, root, [6.95, 0.035, 4.9, 0.08], [0, 0.16, 0], material.reveal, { castShadow: false });

  const water = rounded(THREE, kit, root, [2.55, 0.055, 0.72, 0.16], [0, 0.2, 2.05], material.water, { castShadow: false });
  const waterInset = rounded(THREE, kit, root, [2.82, 0.08, 0.96, 0.18], [0, 0.175, 2.05], material.ink, { castShadow: false });
  root.remove(waterInset);
  root.add(waterInset);
  root.remove(water);
  root.add(water);

  const building = new THREE.Group();
  building.position.y = 0.18;
  root.add(building);

  const wings = [];
  const facadePanels = [];
  const roomReveals = [];

  for (const side of [-1, 1]) {
    const wing = new THREE.Group();
    wing.position.x = side * 2.08;
    building.add(wing);
    wings.push(wing);

    rounded(THREE, kit, wing, [3.0, 0.16, 2.0, 0.05], [0, 0.18, 0], material.ink);
    for (let floor = 0; floor < 4; floor += 1) {
      const y = 0.48 + floor * 0.66;
      rounded(THREE, kit, wing, [2.9, 0.12, 1.92, 0.035], [0, y, 0], material.stoneLight);
      rounded(THREE, kit, wing, [2.84, 0.5, 0.12, 0.035], [0, y + 0.3, -0.93], material.stone);

      for (let column = 0; column < 4; column += 1) {
        const x = -1.02 + column * 0.68;
        const lit = (floor + column + (side > 0 ? 1 : 0)) % 3 === 0;
        rounded(
          THREE,
          kit,
          wing,
          [0.46, 0.31, 0.035, 0.025],
          [x, y + 0.29, 0.982],
          lit ? material.windowLit : material.window,
          { castShadow: false },
        );
        rounded(
          THREE,
          kit,
          wing,
          [0.035, 0.32, 0.82, 0.012],
          [x + 0.29, y + 0.28, 0.22],
          material.reveal,
        );
        rounded(
          THREE,
          kit,
          wing,
          [0.34, 0.1, 0.58, 0.025],
          [x, y + 0.17, 0.14],
          material.reveal,
        );
      }

      const roomBand = new THREE.Group();
      roomBand.position.set(0, y + 0.3, 0.38);
      wing.add(roomBand);
      for (let room = 0; room < 4; room += 1) {
        const roomX = -1.02 + room * 0.68;
        rounded(THREE, kit, roomBand, [0.37, 0.08, 0.38, 0.025], [roomX, -0.13, 0], material.route);
        rounded(THREE, kit, roomBand, [0.28, 0.1, 0.16, 0.025], [roomX, 0.02, -0.08], material.stoneLight);
      }
      roomReveals.push({ group: roomBand, side, floor });
    }

    const facade = new THREE.Group();
    facade.position.z = 1.015;
    wing.add(facade);
    facadePanels.push({ group: facade, side });
    for (let column = 0; column < 5; column += 1) {
      const x = -1.38 + column * 0.69;
      rounded(THREE, kit, facade, [0.08, 2.78, 0.1, 0.025], [x, 1.5, 0], material.bronze);
    }
    rounded(THREE, kit, facade, [2.86, 0.1, 0.1, 0.025], [0, 2.88, 0], material.bronze);

    const roof = rounded(THREE, kit, wing, [3.1, 0.18, 2.08, 0.07], [0, 3.16, 0], material.stoneLight);
    roof.castShadow = true;
    rounded(THREE, kit, wing, [1.45, 0.2, 0.7, 0.08], [side * 0.45, 3.32, 0], material.soil);
    for (let planter = 0; planter < 3; planter += 1) {
      const roofTree = addTree(
        THREE,
        kit,
        wing,
        side * 0.45 - 0.45 + planter * 0.42,
        -0.02,
        0.34,
        material,
      );
      roofTree.position.y = 3.34;
    }
  }

  const atrium = new THREE.Group();
  atrium.position.z = -0.03;
  building.add(atrium);
  rounded(THREE, kit, atrium, [1.08, 3.18, 1.62, 0.07], [0, 1.63, 0], material.glass, { castShadow: false });
  for (const x of [-0.49, 0, 0.49]) {
    rounded(THREE, kit, atrium, [0.055, 3.05, 1.68, 0.018], [x, 1.64, 0], material.ink);
  }
  for (let floor = 0; floor < 5; floor += 1) {
    rounded(THREE, kit, atrium, [1.12, 0.055, 1.68, 0.018], [0, 0.3 + floor * 0.65, 0], material.bronze);
  }

  const bridge = new THREE.Group();
  bridge.position.set(0, 2.48, 0.15);
  building.add(bridge);
  rounded(THREE, kit, bridge, [1.65, 0.17, 0.78, 0.05], [0, 0, 0], material.ink);
  rounded(THREE, kit, bridge, [1.58, 0.38, 0.035, 0.018], [0, 0.24, 0.37], material.glass, { castShadow: false });
  for (const x of [-0.72, -0.36, 0, 0.36, 0.72]) {
    rounded(THREE, kit, bridge, [0.025, 0.4, 0.04, 0.01], [x, 0.25, 0.38], material.bronze);
  }

  const porteCochere = new THREE.Group();
  porteCochere.position.set(0, 0.35, 1.34);
  building.add(porteCochere);
  rounded(THREE, kit, porteCochere, [2.25, 0.13, 1.15, 0.07], [0, 0.95, 0.3], material.stoneLight);
  for (const x of [-0.88, 0.88]) {
    rounded(THREE, kit, porteCochere, [0.1, 0.96, 0.1, 0.03], [x, 0.47, 0.3], material.bronze);
  }
  for (let slat = 0; slat < 9; slat += 1) {
    rounded(
      THREE,
      kit,
      porteCochere,
      [0.045, 0.07, 1.02, 0.012],
      [-0.84 + slat * 0.21, 1.03, 0.3],
      material.bronze,
    );
  }

  const serviceRoute = addTube(
    THREE,
    kit,
    building,
    [[-3.05, 0.32, -0.74], [-2.08, 0.32, -0.74], [0, 0.32, -0.74], [2.08, 0.32, -0.74], [3.05, 0.32, -0.74]],
    0.035,
    "#c7a660",
  );
  serviceRoute.visible = false;

  for (const [x, z, scale] of [[-3.25, 1.55, 0.6], [3.25, 1.55, 0.6], [-3.35, -1.95, 0.7], [3.35, -1.95, 0.7]]) {
    addTree(THREE, kit, root, x, z, scale, material);
  }

  rounded(THREE, kit, root, [1.62, 0.16, 0.46, 0.08], [0, 0.26, 2.66], material.ink);
  addLabel(kit, root, "ATLAS / LIVE SECTION", [0, 0.39, 2.92], { size: 0.18, color: "#26342f" });

  return {
    root,
    update(seconds) {
      const t = Math.max(0, Math.min(LOOP_SECONDS, seconds));
      const arrive = staged(kit, t, 0, 0.95, 6.25, 0.65);
      const section = staged(kit, t, 1.25, 1.05, 5.35, 0.8);
      const trace = staged(kit, t, 2.45, 0.55, 5.15, 0.5);

      building.position.y = 0.18 - (1 - arrive) * 0.34;
      building.scale.setScalar(0.94 + arrive * 0.06);
      wings.forEach((wing, index) => {
        const side = index === 0 ? -1 : 1;
        wing.position.x = side * (2.08 + section * 0.18);
      });
      facadePanels.forEach(({ group, side }) => {
        group.position.x = side * section * 0.5;
        group.position.z = 1.015 + section * 0.32;
        group.rotation.y = side * section * 0.08;
      });
      roomReveals.forEach(({ group, side, floor }) => {
        const cadence = clamp01(section * 1.35 - floor * 0.08);
        group.position.x = side * cadence * 0.08;
        group.position.z = 0.38 + cadence * 0.05;
      });
      bridge.position.y = 2.48 + section * 0.16;
      serviceRoute.visible = trace > 0.03;
      serviceRoute.scale.set(0.25 + trace * 0.75, 1, 1);
      water.material.opacity = 0.68 + Math.sin(t * 2.2) * 0.05;
    },
    camera(seconds) {
      const travel = Math.sin((Math.PI * Math.max(0, Math.min(LOOP_SECONDS, seconds))) / LOOP_SECONDS);
      return {
        position: [8.4 - travel * 1.2, 5.8 + travel * 0.55, 10.1 - travel * 1.7],
        target: [0, 1.45 + travel * 0.18, 0.1],
        fov: 37,
      };
    },
  };
}

function createSuiteConfigurator(THREE, kit) {
  const root = new THREE.Group();
  root.name = "suite-configurator";

  const material = {
    floor: kit.mat("#d8c7ad", { roughness: 0.82 }),
    rug: kit.mat("#7f8a7c", { roughness: 0.97 }),
    wall: kit.mat("#f3ede2", { roughness: 0.88 }),
    plaster: kit.mat("#e7dfd2", { roughness: 0.92 }),
    walnut: kit.mat("#76563f", { roughness: 0.62 }),
    linen: kit.mat("#ece7dc", { roughness: 0.93 }),
    white: kit.mat("#faf8f2", { roughness: 0.72 }),
    sage: kit.mat("#788776", { roughness: 0.78 }),
    clay: kit.mat("#b3765c", { roughness: 0.8 }),
    bronze: kit.mat("#aa8656", { roughness: 0.35, metalness: 0.46 }),
    ink: kit.mat("#25312d", { roughness: 0.6, metalness: 0.06 }),
    glass: kit.mat("#b5d0cd", { roughness: 0.12, transparent: true, opacity: 0.46, transmission: 0.28 }),
    water: kit.mat("#96bdb9", { roughness: 0.18, transparent: true, opacity: 0.72 }),
    leaf: kit.mat("#61745e", { roughness: 0.88 }),
    trunk: kit.mat("#786149", { roughness: 0.94 }),
  };

  rounded(THREE, kit, root, [7.7, 0.2, 5.65, 0.14], [0, 0, 0], material.plaster);
  rounded(THREE, kit, root, [6.95, 0.08, 4.95, 0.08], [-0.15, 0.15, -0.05], material.floor);

  const shell = new THREE.Group();
  root.add(shell);
  rounded(THREE, kit, shell, [6.9, 2.75, 0.15, 0.045], [-0.15, 1.53, -2.45], material.wall);
  rounded(THREE, kit, shell, [0.15, 2.75, 4.9, 0.045], [-3.6, 1.53, -0.05], material.wall);
  rounded(THREE, kit, shell, [0.15, 1.0, 4.9, 0.045], [3.3, 0.65, -0.05], material.wall);

  const windowWall = new THREE.Group();
  windowWall.position.set(3.28, 1.85, -0.05);
  root.add(windowWall);
  rounded(THREE, kit, windowWall, [0.055, 1.6, 4.75, 0.02], [0, 0, 0], material.glass, { castShadow: false });
  for (const z of [-2.26, -1.14, 0, 1.14, 2.26]) {
    rounded(THREE, kit, windowWall, [0.08, 1.72, 0.08, 0.018], [0, 0, z], material.bronze);
  }
  rounded(THREE, kit, windowWall, [0.08, 0.08, 4.76, 0.018], [0, -0.79, 0], material.bronze);
  rounded(THREE, kit, windowWall, [0.08, 0.08, 4.76, 0.018], [0, 0.79, 0], material.bronze);

  const sleepZone = new THREE.Group();
  sleepZone.position.set(-1.85, 0.15, -0.72);
  root.add(sleepZone);
  addBed(THREE, kit, sleepZone, 0, 0, 0, 2.25, 2.3, {
    base: material.walnut,
    linen: material.linen,
    headboard: material.sage,
    pillow: material.white,
    runner: material.clay,
  });
  rounded(THREE, kit, sleepZone, [3.1, 0.035, 3.15, 0.06], [0, 0.05, 0.1], material.rug, { castShadow: false });
  for (const x of [-1.42, 1.42]) {
    rounded(THREE, kit, sleepZone, [0.52, 0.42, 0.48, 0.06], [x, 0.25, -0.82], material.walnut);
    mesh(THREE, sleepZone, new THREE.CylinderGeometry(0.04, 0.04, 0.52, 12), material.bronze, [x, 0.78, -0.82]);
    mesh(THREE, sleepZone, new THREE.ConeGeometry(0.22, 0.28, 20, 1, true), material.linen, [x, 1.04, -0.82]);
  }
  addLabel(kit, sleepZone, "SLEEP / KING", [0, 1.55, -1.05], { size: 0.17 });

  const loungeZone = new THREE.Group();
  loungeZone.position.set(1.25, 0.15, 0.82);
  root.add(loungeZone);
  const sofa = new THREE.Group();
  loungeZone.add(sofa);
  rounded(THREE, kit, sofa, [2.25, 0.2, 0.78, 0.08], [0, 0.28, 0], material.sage);
  rounded(THREE, kit, sofa, [2.25, 0.72, 0.16, 0.06], [0, 0.62, -0.32], material.sage);
  rounded(THREE, kit, sofa, [0.17, 0.58, 0.78, 0.06], [-1.04, 0.52, 0], material.sage);
  rounded(THREE, kit, sofa, [0.17, 0.58, 0.78, 0.06], [1.04, 0.52, 0], material.sage);
  for (const x of [-0.7, 0, 0.7]) {
    rounded(THREE, kit, sofa, [0.62, 0.16, 0.58, 0.07], [x, 0.48, 0.06], material.linen);
  }
  const coffeeTable = new THREE.Group();
  coffeeTable.position.set(0, 0, 1.0);
  loungeZone.add(coffeeTable);
  mesh(THREE, coffeeTable, new THREE.CylinderGeometry(0.58, 0.58, 0.09, 32), material.walnut, [0, 0.42, 0]);
  mesh(THREE, coffeeTable, new THREE.CylinderGeometry(0.06, 0.09, 0.39, 16), material.bronze, [0, 0.2, 0]);
  rounded(THREE, kit, loungeZone, [3.1, 0.035, 2.2, 0.08], [0, 0.05, 0.42], material.rug, { castShadow: false });

  const workZone = new THREE.Group();
  workZone.position.set(1.52, 0.15, -1.35);
  root.add(workZone);
  rounded(THREE, kit, workZone, [1.65, 0.12, 0.62, 0.05], [0, 0.72, 0], material.walnut);
  for (const x of [-0.66, 0.66]) {
    rounded(THREE, kit, workZone, [0.065, 0.7, 0.065, 0.02], [x, 0.35, 0], material.bronze);
  }
  addChair(THREE, kit, workZone, 0, 0, 0.78, { seat: material.clay, metal: material.bronze }, Math.PI, 0.85);
  rounded(THREE, kit, workZone, [0.6, 0.4, 0.035, 0.02], [0, 1.05, -0.28], material.ink);

  const bathZone = new THREE.Group();
  bathZone.position.set(-2.25, 0.15, 1.55);
  root.add(bathZone);
  const tubOuter = rounded(THREE, kit, bathZone, [2.05, 0.72, 0.95, 0.22], [0, 0.38, 0], material.white);
  rounded(THREE, kit, bathZone, [1.72, 0.15, 0.63, 0.18], [0, 0.7, 0], material.water, { castShadow: false });
  rounded(THREE, kit, bathZone, [1.45, 0.78, 0.48, 0.05], [0.1, 0.5, -0.76], material.walnut);
  rounded(THREE, kit, bathZone, [1.2, 0.68, 0.035, 0.025], [0.1, 1.05, -0.5], material.glass, { castShadow: false });
  for (const x of [-0.46, 0.46]) {
    mesh(THREE, bathZone, new THREE.CylinderGeometry(0.16, 0.13, 0.18, 20), material.white, [x, 0.98, -0.69]);
  }
  addLabel(kit, bathZone, "BATH / OPEN", [0, 1.45, 0.12], { size: 0.16 });

  const screen = new THREE.Group();
  screen.position.set(-0.82, 0.15, 1.18);
  root.add(screen);
  for (let slat = 0; slat < 12; slat += 1) {
    rounded(THREE, kit, screen, [0.055, 2.05, 0.16, 0.022], [-0.72 + slat * 0.13, 1.08, 0], material.walnut);
  }
  rounded(THREE, kit, screen, [1.58, 0.09, 0.18, 0.025], [0, 2.12, 0], material.walnut);

  const balcony = new THREE.Group();
  balcony.position.set(3.55, 0.16, 0.15);
  root.add(balcony);
  rounded(THREE, kit, balcony, [0.62, 0.08, 4.25, 0.05], [0, 0.02, 0], material.floor);
  rounded(THREE, kit, balcony, [0.06, 0.72, 4.25, 0.025], [0.27, 0.4, 0], material.glass, { castShadow: false });
  for (const z of [-1.9, -0.95, 0, 0.95, 1.9]) {
    rounded(THREE, kit, balcony, [0.08, 0.78, 0.08, 0.018], [0.27, 0.4, z], material.bronze);
  }
  addTree(THREE, kit, balcony, 0, 1.55, 0.48, material);
  addTree(THREE, kit, balcony, 0, -1.55, 0.48, material);

  const route = addTube(
    THREE,
    kit,
    root,
    [[-2.0, 0.24, -0.7], [-0.45, 0.24, -0.2], [1.15, 0.24, 0.7], [2.4, 0.24, 0.25]],
    0.025,
    "#aa8656",
  );

  return {
    root,
    update(seconds) {
      const t = Math.max(0, Math.min(LOOP_SECONDS, seconds));
      const reveal = staged(kit, t, 0, 0.8, 6.25, 0.65);
      const privacy = staged(kit, t, 1.2, 0.95, 5.55, 0.75);
      const reconfigure = staged(kit, t, 2.3, 1.0, 5.05, 0.65);
      const terrace = staged(kit, t, 3.15, 0.8, 4.85, 0.55);

      shell.position.y = -(1 - reveal) * 0.18;
      windowWall.position.x = 3.28 + terrace * 0.15;
      windowWall.rotation.z = -terrace * 0.025;
      screen.position.x = -0.82 + privacy * 1.22;
      screen.position.z = 1.18 + privacy * 0.16;
      loungeZone.position.x = 1.25 + reconfigure * 0.36;
      loungeZone.position.z = 0.82 - reconfigure * 0.22;
      workZone.position.x = 1.52 - reconfigure * 0.38;
      workZone.position.z = -1.35 + reconfigure * 0.16;
      sleepZone.position.z = -0.72 - reconfigure * 0.1;
      tubOuter.position.y = 0.38 + privacy * 0.08;
      route.scale.set(0.15 + reconfigure * 0.85, 1, 1);
      material.water.opacity = 0.67 + Math.sin(t * 2.4) * 0.045;
    },
    camera(seconds) {
      const t = Math.max(0, Math.min(LOOP_SECONDS, seconds));
      const travel = Math.sin((Math.PI * t) / LOOP_SECONDS);
      return {
        position: [8.9 - travel * 1.35, 6.7 + travel * 0.65, 9.2 - travel * 1.0],
        target: [-0.05 + travel * 0.25, 0.72, -0.05],
        fov: 37,
      };
    },
  };
}

function createExplodedFloors(THREE, kit) {
  const root = new THREE.Group();
  root.name = "exploded-floor-selection";

  const material = {
    slab: kit.mat("#d8d0c4", { roughness: 0.86 }),
    slabSelected: kit.mat("#c4aa72", { roughness: 0.62, metalness: 0.08 }),
    wall: kit.mat("#f1ece3", { roughness: 0.88 }),
    wallSelected: kit.mat("#f7f1e5", { roughness: 0.78 }),
    corridor: kit.mat("#718079", { roughness: 0.8 }),
    corridorSelected: kit.mat("#9d875b", { roughness: 0.65 }),
    glass: kit.mat("#799493", { roughness: 0.24, metalness: 0.08 }),
    linen: kit.mat("#eee8dc", { roughness: 0.92 }),
    clay: kit.mat("#a26f58", { roughness: 0.8 }),
    core: kit.mat("#2b3733", { roughness: 0.62 }),
    bronze: kit.mat("#b18c57", { roughness: 0.38, metalness: 0.36 }),
    route: kit.mat("#c3a15f", { roughness: 0.34, metalness: 0.2 }),
  };

  rounded(THREE, kit, root, [7.35, 0.2, 5.3, 0.14], [0, 0, 0], material.wall);
  rounded(THREE, kit, root, [6.9, 0.04, 4.85, 0.1], [0, 0.13, 0], material.slab, { castShadow: false });

  const floors = [];
  const selectedIndex = 2;
  for (let index = 0; index < 5; index += 1) {
    const selected = index === selectedIndex;
    const floor = new THREE.Group();
    floor.name = `floor-${index + 4}`;
    root.add(floor);

    rounded(
      THREE,
      kit,
      floor,
      [6.45, 0.15, 3.92, 0.08],
      [0, 0, 0],
      selected ? material.slabSelected : material.slab,
    );
    rounded(
      THREE,
      kit,
      floor,
      [5.72, 0.045, 0.58, 0.025],
      [-0.05, 0.11, 0],
      selected ? material.corridorSelected : material.corridor,
      { castShadow: false },
    );

    for (const side of [-1, 1]) {
      for (let roomIndex = 0; roomIndex < 5; roomIndex += 1) {
        const x = -2.36 + roomIndex * 1.18;
        const z = side * 1.16;
        rounded(
          THREE,
          kit,
          floor,
          [1.08, 0.1, 1.5, 0.035],
          [x, 0.11, z],
          selected ? material.wallSelected : material.wall,
        );
        rounded(
          THREE,
          kit,
          floor,
          [1.08, 0.34, 0.045, 0.018],
          [x, 0.26, side * 1.9],
          material.glass,
          { castShadow: false },
        );
        rounded(
          THREE,
          kit,
          floor,
          [0.05, 0.38, 1.58, 0.018],
          [x - 0.55, 0.28, z],
          selected ? material.wallSelected : material.wall,
        );
        rounded(
          THREE,
          kit,
          floor,
          [0.52, 0.07, 0.46, 0.025],
          [x, 0.19, z + side * 0.18],
          material.linen,
        );
        rounded(
          THREE,
          kit,
          floor,
          [0.48, 0.16, 0.06, 0.018],
          [x, 0.3, z - side * 0.07],
          material.clay,
        );
      }
    }

    const core = new THREE.Group();
    core.position.set(2.78, 0.12, 0);
    floor.add(core);
    rounded(THREE, kit, core, [0.62, 0.5, 1.05, 0.045], [0, 0.2, 0], material.core);
    for (const z of [-0.26, 0.26]) {
      rounded(THREE, kit, core, [0.34, 0.3, 0.035, 0.012], [-0.31, 0.2, z], material.bronze);
    }
    rounded(THREE, kit, floor, [0.08, 0.38, 3.78, 0.018], [-3.08, 0.27, 0], material.bronze);

    const label = addLabel(kit, floor, `0${index + 4}`, [-3.55, 0.2, 0], {
      size: selected ? 0.24 : 0.19,
      color: selected ? "#7e6236" : "#53605b",
    });
    if (label) label.visible = false;
    floors.push({ group: floor, label, selected, baseIndex: index });
  }

  const coreGuide = new THREE.Group();
  root.add(coreGuide);
  for (let index = 0; index < 4; index += 1) {
    mesh(
      THREE,
      coreGuide,
      new THREE.CylinderGeometry(0.035, 0.035, 0.72, 10),
      material.route,
      [2.78, 0.62 + index * 0.78, 0],
      { castShadow: false },
    );
  }
  const selectedBeacon = mesh(
    THREE,
    root,
    new THREE.TorusGeometry(0.42, 0.035, 12, 48),
    material.route,
    [2.78, 2.25, 0],
    { rotation: [Math.PI / 2, 0, 0] },
  );
  selectedBeacon.visible = false;

  addLabel(kit, root, "FLOOR STACK / SELECT 06", [0, 0.35, 2.85], { size: 0.18 });

  return {
    root,
    update(seconds) {
      const t = Math.max(0, Math.min(LOOP_SECONDS, seconds));
      const assemble = staged(kit, t, 0, 0.8, 6.3, 0.6);
      const explode = staged(kit, t, 1.05, 1.25, 5.65, 0.7);
      const select = staged(kit, t, 2.45, 0.8, 5.1, 0.55);

      floors.forEach(({ group, label, selected, baseIndex }) => {
        const collapsedY = 0.2 + baseIndex * 0.22;
        const explodedY = 0.25 + baseIndex * 0.82;
        const cadence = clamp01(explode * 1.25 - baseIndex * 0.05);
        group.position.y = collapsedY + (explodedY - collapsedY) * cadence - (1 - assemble) * 0.3;
        group.position.x = selected ? select * 0.52 : 0;
        group.position.z = selected ? select * 0.16 : 0;
        group.rotation.y = selected ? -select * 0.035 : 0;
        if (label) label.visible = explode > 0.14;
      });
      coreGuide.visible = explode > 0.08;
      coreGuide.scale.y = 0.2 + explode * 0.8;
      selectedBeacon.visible = select > 0.05;
      selectedBeacon.position.set(3.3, 2.25, 0.16);
      selectedBeacon.scale.setScalar(0.72 + select * 0.28 + Math.sin(t * 3) * 0.025);
    },
    camera(seconds) {
      const t = Math.max(0, Math.min(LOOP_SECONDS, seconds));
      const travel = Math.sin((Math.PI * t) / LOOP_SECONDS);
      return {
        position: [9.2 - travel * 1.6, 6.1 + travel * 1.35, 10.3 - travel * 1.35],
        target: [travel * 0.12, 1.55 + travel * 0.5, 0],
        fov: 38,
      };
    },
  };
}

function createResortIsland(THREE, kit) {
  const root = new THREE.Group();
  root.name = "courtyard-resort-island";

  const material = {
    sand: kit.mat("#d9c8a9", { roughness: 0.96 }),
    earth: kit.mat("#8a765c", { roughness: 0.94 }),
    path: kit.mat("#e9dfcf", { roughness: 0.9 }),
    plaster: kit.mat("#f1eadf", { roughness: 0.9 }),
    roof: kit.mat("#9c684d", { roughness: 0.76 }),
    timber: kit.mat("#765941", { roughness: 0.7 }),
    bronze: kit.mat("#ae8954", { roughness: 0.4, metalness: 0.3 }),
    glass: kit.mat("#739492", { roughness: 0.18, transparent: true, opacity: 0.58 }),
    water: kit.mat("#80b8b4", { roughness: 0.12, metalness: 0.08, transparent: true, opacity: 0.78 }),
    waterDark: kit.mat("#547f7d", { roughness: 0.24 }),
    leaf: kit.mat("#58705a", { roughness: 0.9 }),
    leafLight: kit.mat("#7c8d68", { roughness: 0.9 }),
    trunk: kit.mat("#735b43", { roughness: 0.96 }),
    linen: kit.mat("#ede7da", { roughness: 0.93 }),
    route: kit.mat("#c49b55", { roughness: 0.4, metalness: 0.12 }),
  };

  const island = mesh(
    THREE,
    root,
    new THREE.CylinderGeometry(3.85, 4.05, 0.34, 48),
    material.earth,
    [0, -0.02, 0],
    { scale: [1, 1, 0.72] },
  );
  island.receiveShadow = true;
  const sand = mesh(
    THREE,
    root,
    new THREE.CylinderGeometry(3.72, 3.78, 0.16, 48),
    material.sand,
    [0, 0.16, 0],
    { scale: [1, 1, 0.7] },
  );
  sand.receiveShadow = true;

  const poolInset = rounded(THREE, kit, root, [3.0, 0.16, 1.42, 0.32], [0, 0.26, 0], material.waterDark);
  const pool = rounded(THREE, kit, root, [2.72, 0.065, 1.16, 0.28], [0, 0.36, 0], material.water, { castShadow: false });
  rounded(THREE, kit, root, [3.44, 0.055, 1.78, 0.3], [0, 0.34, 0], material.path, { castShadow: false });
  root.remove(poolInset);
  root.add(poolInset);
  root.remove(pool);
  root.add(pool);

  const courtyard = new THREE.Group();
  courtyard.position.y = 0.25;
  root.add(courtyard);
  const cottages = [];
  const cottagePlacements = [
    [-2.18, -1.42, 0.03],
    [0, -1.72, 0],
    [2.18, -1.42, -0.03],
    [-2.5, 1.3, Math.PI],
    [2.5, 1.3, Math.PI],
  ];

  cottagePlacements.forEach(([x, z, rotationY], index) => {
    const cottage = new THREE.Group();
    cottage.position.set(x, 0, z);
    cottage.rotation.y = rotationY;
    courtyard.add(cottage);

    rounded(THREE, kit, cottage, [1.55, 0.13, 1.35, 0.06], [0, 0.08, 0], material.path);
    rounded(THREE, kit, cottage, [1.45, 0.88, 1.22, 0.08], [0, 0.56, 0], material.plaster);
    rounded(THREE, kit, cottage, [0.72, 0.56, 0.055, 0.025], [0, 0.58, 0.625], material.glass, { castShadow: false });
    for (const side of [-1, 1]) {
      rounded(THREE, kit, cottage, [0.08, 0.65, 0.08, 0.02], [side * 0.42, 0.6, 0.65], material.timber);
    }
    const roof = mesh(
      THREE,
      cottage,
      new THREE.ConeGeometry(1.2, 0.58, 4),
      material.roof,
      [0, 1.28, 0],
      { rotation: [0, Math.PI / 4, 0], scale: [1, 1, 0.92] },
    );
    rounded(THREE, kit, cottage, [1.3, 0.08, 0.52, 0.04], [0, 0.15, 0.92], material.timber);
    addChair(THREE, kit, cottage, -0.34, 0.12, 0.9, { seat: material.linen, metal: material.timber }, Math.PI, 0.45);
    addChair(THREE, kit, cottage, 0.34, 0.12, 0.9, { seat: material.linen, metal: material.timber }, Math.PI, 0.45);
    cottages.push({ group: cottage, roof, x, z, index });
  });

  const pergola = new THREE.Group();
  pergola.position.set(-2.55, 0.25, 0);
  root.add(pergola);
  for (const x of [-0.65, 0.65]) {
    for (const z of [-0.48, 0.48]) {
      rounded(THREE, kit, pergola, [0.08, 1.45, 0.08, 0.025], [x, 0.72, z], material.timber);
    }
  }
  for (let slat = 0; slat < 10; slat += 1) {
    rounded(
      THREE,
      kit,
      pergola,
      [0.08, 0.07, 1.18, 0.018],
      [-0.66 + slat * 0.146, 1.45, 0],
      material.timber,
    );
  }
  addBench(THREE, kit, pergola, 0, 0.02, 0, 1.05, { seat: material.linen, metal: material.bronze });

  const bridge = new THREE.Group();
  bridge.position.set(0, 0.23, 2.05);
  root.add(bridge);
  rounded(THREE, kit, bridge, [1.02, 0.11, 1.55, 0.055], [0, 0.05, 0], material.timber);
  for (let board = 0; board < 8; board += 1) {
    rounded(THREE, kit, bridge, [0.92, 0.025, 0.055, 0.012], [0, 0.12, -0.6 + board * 0.17], material.path);
  }
  for (const x of [-0.46, 0.46]) {
    for (const z of [-0.65, -0.22, 0.22, 0.65]) {
      rounded(THREE, kit, bridge, [0.035, 0.48, 0.035, 0.012], [x, 0.3, z], material.bronze);
    }
    rounded(THREE, kit, bridge, [0.035, 0.035, 1.45, 0.012], [x, 0.53, 0], material.bronze);
  }

  const pathSegments = [];
  const pathDefinitions = [
    [[0, 0.35, 0.72], [0, 0.35, 1.25], [0, 0.35, 1.65]],
    [[-0.9, 0.35, 0], [-1.55, 0.35, 0], [-2.05, 0.35, -0.6]],
    [[0.9, 0.35, 0], [1.55, 0.35, 0], [2.05, 0.35, -0.6]],
  ];
  pathDefinitions.forEach((points) => {
    const path = addTube(THREE, kit, root, points, 0.035, "#c49b55");
    path.visible = false;
    pathSegments.push(path);
  });

  const trees = [
    [-3.15, -0.35, 0.72], [-3.0, 1.72, 0.58], [-1.3, 1.92, 0.65],
    [1.3, 1.92, 0.65], [3.0, 1.72, 0.58], [3.15, -0.35, 0.72],
  ];
  trees.forEach(([x, z, scale], index) => {
    addTree(THREE, kit, root, x, z, scale, {
      ...material,
      leaf: index % 2 ? material.leafLight : material.leaf,
    });
  });

  const poolLoungers = new THREE.Group();
  poolLoungers.position.y = 0.32;
  root.add(poolLoungers);
  for (const x of [-1.15, -0.4, 0.4, 1.15]) {
    const lounger = new THREE.Group();
    lounger.position.set(x, 0, 1.05);
    poolLoungers.add(lounger);
    rounded(THREE, kit, lounger, [0.48, 0.08, 0.86, 0.04], [0, 0.15, 0], material.linen, { rotation: [-0.08, 0, 0] });
    rounded(THREE, kit, lounger, [0.48, 0.08, 0.34, 0.04], [0, 0.32, -0.36], material.linen, { rotation: [-0.62, 0, 0] });
  }

  addLabel(kit, root, "COURTYARD / STAY NETWORK", [0, 0.42, 2.92], { size: 0.18 });

  return {
    root,
    update(seconds) {
      const t = Math.max(0, Math.min(LOOP_SECONDS, seconds));
      const surface = staged(kit, t, 0, 0.85, 6.3, 0.6);
      const open = staged(kit, t, 1.0, 1.15, 5.7, 0.72);
      const connect = staged(kit, t, 2.35, 1.0, 5.15, 0.55);
      const gather = staged(kit, t, 3.2, 0.7, 4.85, 0.5);

      island.scale.y = 0.74 + surface * 0.26;
      sand.scale.y = 0.78 + surface * 0.22;
      cottages.forEach(({ group, roof, x, z, index }) => {
        const cadence = clamp01(open * 1.28 - index * 0.055);
        const outward = 1 + cadence * 0.045;
        group.position.x = x * outward;
        group.position.z = z * outward;
        group.position.y = -(1 - surface) * 0.2 + cadence * 0.03;
        roof.position.y = 1.28 + cadence * 0.16;
      });
      pathSegments.forEach((path, index) => {
        const cadence = clamp01(connect * 1.35 - index * 0.13);
        path.visible = cadence > 0.03;
        path.scale.set(0.18 + cadence * 0.82, 1, 1);
      });
      pergola.position.y = 0.25 + gather * 0.08;
      bridge.position.z = 2.05 - gather * 0.08;
      poolLoungers.position.z = gather * 0.12;
      pool.material.opacity = 0.72 + Math.sin(t * 2.15) * 0.045;
      pool.scale.set(1 + Math.sin(t * 1.8) * 0.006, 1, 1 + Math.sin(t * 1.8) * 0.006);
    },
    camera(seconds) {
      const t = Math.max(0, Math.min(LOOP_SECONDS, seconds));
      const travel = Math.sin((Math.PI * t) / LOOP_SECONDS);
      return {
        position: [8.6 - travel * 1.55, 7.9 + travel * 0.9, 10.8 - travel * 1.45],
        target: [0, 0.55 + travel * 0.12, 0.12],
        fov: 39,
      };
    },
  };
}

export const architectureConcepts = [
  {
    id: "01",
    title: "Atlas Hotel Twin",
    subtitle: "Open the building, not another dashboard.",
    category: "Architectural twin",
    layout: "Sectioned hotel model with operational route",
    summary: "A calm live-section study: stone wings part to expose room bands, bridge and service spine while the camera closes in on the useful detail.",
    checks: [
      "Façade and room bands separate as one reversible section",
      "Atrium, skybridge and service route remain spatially legible",
      "Repeated windows carry restrained occupancy variation",
      "Illustrative model only — no live hotel state",
    ],
    create: createAtlasTwin,
  },
  {
    id: "02",
    title: "Suite Composer",
    subtitle: "Configure the stay at room scale.",
    category: "Luxury suite configurator",
    layout: "Detailed cutaway suite with movable zones",
    summary: "An editorial room cutaway where privacy screen, work setting and lounge shift in sequence, preserving the guest’s spatial context throughout.",
    checks: [
      "Bed, bath, work, lounge and terrace are real geometry",
      "Privacy and furniture changes happen in staged continuity",
      "Guest circulation remains visible during reconfiguration",
      "Illustrative configuration — no inventory mutation",
    ],
    create: createSuiteConfigurator,
  },
  {
    id: "03",
    title: "Floorstack",
    subtitle: "Separate the building. Keep the decision connected.",
    category: "Exploded floor selection",
    layout: "Five detailed floor plates with isolated selection",
    summary: "The hotel rises from a compact stack into navigable floors; one level then moves forward without losing its relationship to the service core.",
    checks: [
      "Five floor plans separate with deterministic cadence",
      "Rooms, corridor, beds, windows and lift core remain readable",
      "Selected floor stays connected to the vertical route",
      "Illustrative availability — no operational room claim",
    ],
    create: createExplodedFloors,
  },
  {
    id: "04",
    title: "Courtyard Constellation",
    subtitle: "See the whole stay network as a place.",
    category: "STR resort landscape",
    layout: "Resort island with cottages, pool and shared paths",
    summary: "A tactile resort plan opens cottage by cottage, then traces the calm shared routes linking private stays to pool, pergola and arrival bridge.",
    checks: [
      "Cottages include roofs, glazing, terraces and furniture",
      "Pool, planting, pergola and arrival bridge establish place",
      "Path reveal explains shared circulation without a radar effect",
      "Illustrative landscape only — no guest tracking",
    ],
    create: createResortIsland,
  },
];
