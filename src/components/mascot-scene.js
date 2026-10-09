import * as THREE from "three";

/** A jointed chibi speedster in the site’s forest-and-lime palette. Actions update the rig without rebuilding WebGL. */
export function createMascotScene(container, initialAction = "idle") {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(31, 1, 0.1, 40);
  camera.position.set(0, 0.2, 8.4);
  camera.lookAt(0, 0.1, 0);
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  const pixelRatioLimit = window.matchMedia("(pointer: coarse)").matches ? 1.25 : 1.6;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, pixelRatioLimit));
  renderer.setClearColor(0, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x536b43, 2.1));
  const key = new THREE.DirectionalLight(0xfff3db, 3.6);
  key.position.set(-3, 5, 6);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xd9f46b, 2.4);
  rim.position.set(4, 2, -3);
  scene.add(rim);
  const materials = {};
  for (const [name, color] of Object.entries({
    lime: 0xd9f46b,
    green: 0x315a36,
    jersey: 0x315a36,
    white: 0xfffff5,
    ink: 0x202820,
    orange: 0xe68b61,
    sole: 0xd9dccc,
    cream: 0xf6f5df,
  }))
    materials[name] = new THREE.MeshStandardMaterial({
      color,
      roughness: name === "ink" ? 0.19 : name === "green" || name === "jersey" ? 0.38 : 0.46,
    });
  const mesh = (
    parent,
    geometry,
    material,
    position = [0, 0, 0],
    scale = [1, 1, 1],
  ) => {
    const object = new THREE.Mesh(geometry, material);
    object.position.set(...position);
    object.scale.set(...scale);
    parent.add(object);
    return object;
  };
  const orb = (parent, material, position, scale = [1, 1, 1], radius = 1) =>
    mesh(
      parent,
      new THREE.SphereGeometry(radius, 24, 18),
      material,
      position,
      scale,
    );
  const tube = (parent, points, material, radius = 0.035) =>
    mesh(
      parent,
      new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p))),
        24,
        radius,
        8,
        false,
      ),
      material,
    );
  const rounded = (parent, material, position, size, radius = 0.1) =>
    mesh(
      parent,
      new THREE.CapsuleGeometry(
        radius,
        Math.max(0.001, size[1] - radius * 2),
        6,
        14,
      ),
      material,
      position,
      [size[0] / (radius * 2), 1, size[2] / (radius * 2)],
    );
  const bolt = (parent, material, position, scale) => {
    const outline = new THREE.Shape();
    outline.moveTo(0.25, 0.66);
    outline.lineTo(-0.39, -0.05);
    outline.lineTo(-0.06, -0.05);
    outline.lineTo(-0.22, -0.59);
    outline.lineTo(0.43, 0.15);
    outline.lineTo(0.08, 0.15);
    outline.closePath();
    return mesh(
      parent,
      new THREE.ExtrudeGeometry(outline, {
        depth: 0.07,
        bevelEnabled: true,
        bevelSize: 0.035,
        bevelThickness: 0.035,
        bevelSegments: 3,
        steps: 1,
      }),
      material,
      position,
      [scale, scale, scale],
    );
  };
  const character = new THREE.Group();
  scene.add(character);
  orb(character, materials.jersey, [0, -0.25, 0], [0.55, 0.59, 0.42]);
  orb(character, materials.green, [0, -0.73, 0], [0.48, 0.22, 0.36]);
  const emblem = mesh(character, new THREE.CylinderGeometry(0.245, 0.245, 0.035, 48), materials.white, [0, -0.25, 0.415]);
  emblem.rotation.x = Math.PI / 2;
  mesh(character, new THREE.TorusGeometry(0.245, 0.023, 10, 48), materials.lime, [0, -0.25, 0.44]);
  bolt(character, materials.green, [0.015, -0.25, 0.45], 0.33);
  tube(
    character,
    [
      [-0.43, -0.54, 0.16],
      [-0.22, -0.64, 0.26],
      [0.22, -0.64, 0.26],
      [0.43, -0.54, 0.16],
    ],
    materials.lime,
    0.042,
  );
  orb(character, materials.lime, [0, 0.32, 0], [0.25, 0.19, 0.25]);
  const head = new THREE.Group();
  head.position.set(0, 0.87, 0.06);
  head.scale.setScalar(1.2);
  character.add(head);
  orb(head, materials.green, [0, 0, 0], [0.79, 0.73, 0.6]);
  // Lightning ear pieces and an open lower mask keep the silhouette playful.
  for (const side of [-1, 1]) {
    orb(head, materials.lime, [side * 0.77, 0.02, 0], [0.12, 0.19, 0.16]);
    const wing = new THREE.Shape();
    wing.moveTo(0, -0.14);
    wing.lineTo(0.42, 0.25);
    wing.lineTo(0.14, 0.17);
    wing.lineTo(0.31, 0.42);
    wing.lineTo(-0.06, 0.23);
    wing.closePath();
    mesh(head, new THREE.ExtrudeGeometry(wing, {depth: 0.075, bevelEnabled: true, bevelSize: 0.025, bevelThickness: 0.025, bevelSegments: 2, steps: 1}), materials.lime, [side * 0.77, 0.02, -0.02], [side, 1, 1]);
  }
  orb(head, materials.cream, [0, -0.27, 0.405], [0.64, 0.38, 0.23]);
  bolt(head, materials.lime, [0, 0.43, 0.55], 0.28);
  tube(head, [[-0.48, 0.47, 0.33], [-0.36, 0.59, 0.34], [-0.18, 0.65, 0.32]], materials.white, 0.012);
  const face = new THREE.Group();
  face.position.z = 0.56;
  head.add(face);
  const eyes = [];
  for (const x of [-0.255, 0.255]) {
    const eye = new THREE.Group();
    eye.position.set(x, 0.015, 0);
    face.add(eye);
    orb(eye, materials.white, [0, 0, 0.035], [0.205, 0.255, 0.065]);
    const pupil = orb(
      eye,
      materials.ink,
      [0, -0.007, 0.097],
      [0.105, 0.155, 0.045],
    );
    orb(pupil, materials.white, [-0.24, 0.33, 1.03], [0.25, 0.19, 0.2], 0.65);
    eyes.push({ eye, pupil });
    tube(
      face,
      [
        [x - 0.12, 0.28, 0],
        [x, 0.31, 0.023],
        [x + 0.11, 0.27, 0],
      ],
      materials.lime,
      0.032,
    );
  }
  orb(face, materials.cream, [0, -0.16, 0.135], [0.115, 0.078, 0.073]);
  orb(face, materials.orange, [-0.43, -0.19, 0.025], [0.1, 0.042, 0.017]);
  orb(face, materials.orange, [0.43, -0.19, 0.025], [0.1, 0.042, 0.017]);
  const smile = tube(
    face,
    [
      [-0.19, -0.27, 0.093],
      [-0.11, -0.34, 0.125],
      [0, -0.37, 0.137],
      [0.11, -0.34, 0.125],
      [0.19, -0.27, 0.093],
    ],
    materials.ink,
    0.026,
  );
  const surprised = orb(
    face,
    materials.ink,
    [0, -0.32, 0.14],
    [0.08, 0.09, 0.025],
  );
  surprised.visible = false;
  const makeArm = (side) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.49, -0.03, 0);
    shoulder.scale.setScalar(0.72);
    character.add(shoulder);
    orb(shoulder, materials.jersey, [side * 0.03, -0.1, 0], [0.24, 0.27, 0.23]);
    rounded(shoulder, materials.green, [0, -0.37, 0], [0.2, 0.56, 0.2]);
    const elbow = new THREE.Group();
    elbow.position.y = -0.62;
    shoulder.add(elbow);
    rounded(elbow, materials.green, [0, -0.19, 0], [0.18, 0.4, 0.18]);
    const glove = new THREE.Group();
    glove.position.set(0, -0.43, 0.025);
    elbow.add(glove);
    orb(glove, materials.lime, [0, 0, 0], [0.2, 0.23, 0.17]);
    orb(glove, materials.lime, [-side * 0.15, 0.01, 0.03], [0.1, 0.13, 0.1]);
    const cuff = mesh(
      glove,
      new THREE.TorusGeometry(0.135, 0.04, 8, 24),
      materials.lime,
      [0, 0.16, 0],
    );
    cuff.rotation.x = Math.PI / 2;
    return { shoulder, elbow, glove };
  };
  const left = makeArm(-1),
    right = makeArm(1);
  const makeLeg = (side) => {
    const hip = new THREE.Group();
    hip.position.set(side * 0.26, -0.68, 0);
    hip.scale.setScalar(0.78);
    character.add(hip);
    rounded(hip, materials.green, [0, -0.26, 0], [0.2, 0.55, 0.2]);
    const knee = new THREE.Group();
    knee.position.y = -0.49;
    hip.add(knee);
    rounded(knee, materials.lime, [0, -0.16, 0], [0.22, 0.3, 0.22]);
    tube(
      knee,
      [
        [-0.1, -0.04, 0.064],
        [0, -0.03, 0.12],
        [0.1, -0.04, 0.064],
      ],
      materials.green,
      0.022,
    );
    orb(knee, materials.lime, [side * 0.035, -0.42, 0.16], [0.27, 0.16, 0.43]);
    orb(knee, materials.sole, [side * 0.035, -0.51, 0.17], [0.28, 0.045, 0.43]);
    // Swoosh on the visible toe/quarter, with contrasting laces and a thick sole.
    const swoosh = new THREE.Shape();
    swoosh.moveTo(-0.13, 0.04);
    swoosh.bezierCurveTo(-0.2, -0.14, -0.05, -0.1, 0.2, 0.08);
    swoosh.lineTo(-0.04, -0.015);
    swoosh.quadraticCurveTo(-0.15, -0.065, -0.13, 0.04);
    const swooshGeometry = new THREE.ShapeGeometry(swoosh);
    const swooshPoints = swooshGeometry.attributes.position;
    for (let i = 0; i < swooshPoints.count; i++) {
      const x = swooshPoints.getX(i),
        y = swooshPoints.getY(i);
      // Project the badge onto the curved shoe rather than burying it in the toe.
      const z =
        0.16 +
        0.43 *
          Math.sqrt(
            Math.max(0, 1 - (x / 0.27) ** 2 - ((y - 0.01) / 0.16) ** 2),
          ) +
        0.012;
      swooshPoints.setZ(i, z);
    }
    swooshGeometry.computeVertexNormals();
    mesh(knee, swooshGeometry, materials.ink, [side * 0.035, -0.43, 0]);
    for (const y of [-0.34, -0.38])
      tube(
        knee,
        [
          [side * 0.035 - 0.09, y, 0.44],
          [side * 0.035 + 0.09, y, 0.44],
        ],
        materials.orange,
        0.013,
      );
    tube(
      knee,
      [
        [side * 0.035 - 0.1, -0.32, 0.32],
        [side * 0.035 + 0.1, -0.32, 0.32],
      ],
      materials.green,
      0.018,
    );
    return { hip, knee };
  };
  const legs = [makeLeg(-1), makeLeg(1)];
  const ball = new THREE.Group();
  ball.position.set(1.2, -1.2, 0.21);
  scene.add(ball);
  orb(ball, materials.white, [0, 0, 0], [1, 1, 1], 0.33);
  const phi = (1 + Math.sqrt(5)) / 2;
  const panels = [];
  for (const a of [-1, 1])
    for (const b of [-1, 1])
      panels.push([0, a, b * phi], [a, b * phi, 0], [b * phi, 0, a]);
  for (const coords of panels) {
    const normal = new THREE.Vector3(...coords).normalize();
    const u = new THREE.Vector3(0, 1, 0).cross(normal).normalize();
    const v = normal.clone().cross(u);
    const geometry = new THREE.CircleGeometry(0.108, 5);
    const points = geometry.attributes.position;
    for (let i = 0; i < points.count; i++) {
      const position = normal
        .clone()
        .multiplyScalar(0.33)
        .addScaledVector(u, points.getX(i))
        .addScaledVector(v, points.getY(i))
        .normalize()
        .multiplyScalar(0.339);
      points.setXYZ(i, position.x, position.y, position.z);
    }
    geometry.computeVertexNormals();
    mesh(ball, geometry, materials.ink);
  }
  const shadow = mesh(
    scene,
    new THREE.CircleGeometry(1.17, 48),
    new THREE.MeshBasicMaterial({
      color: 0x315a36,
      transparent: true,
      opacity: 0.12,
    }),
    [0, -1.54, 0],
    [1, 0.48, 1],
  );
  shadow.rotation.x = -Math.PI / 2;
  let action = initialAction,
    actionStarted = performance.now(),
    pointerX = 0,
    pointerY = 0,
    frame = 0,
    visible = true,
    disposed = false,
    lastTime = 0,
    actualPointerX = 0,
    actualPointerY = 0;
  const move = (event) => {
    if (event.pointerType !== "mouse") return;
    pointerX = THREE.MathUtils.clamp(
      (event.clientX / window.innerWidth - 0.5) * 2,
      -1,
      1,
    );
    pointerY = THREE.MathUtils.clamp(
      (event.clientY / window.innerHeight - 0.5) * 2,
      -1,
      1,
    );
  };
  const leave = () => {
    pointerX = 0;
    pointerY = 0;
  };
  window.addEventListener("pointermove", move, { passive: true });
  document.addEventListener("pointerleave", leave);
  const resize = () => {
    const { width, height } = container.getBoundingClientRect();
    if (width && height) {
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    }
  };
  const observer = new ResizeObserver(resize);
  observer.observe(container);
  resize();
  const intersection = new IntersectionObserver((entries) => {
    visible = entries[0].isIntersecting;
  });
  intersection.observe(container);
  const mix = (object, key, value, smoothing) => {
    object[key] = THREE.MathUtils.lerp(object[key], value, smoothing);
  };
  const render = (time) => {
    if (disposed) return;
    const dt = Math.min((time - lastTime) / 1000, 0.05);
    lastTime = time;
    if (visible && !document.hidden) {
      const t = time / 1000,
        elapsed = Math.max(0, (time - actionStarted) / 1000),
        rate = 1 - Math.exp(-dt * 11);
      actualPointerX = THREE.MathUtils.lerp(actualPointerX, pointerX, rate);
      actualPointerY = THREE.MathUtils.lerp(actualPointerY, pointerY, rate);
      let leftAngle = -0.12,
        rightAngle = 0.12,
        leftElbow = 0,
        rightElbow = 0,
        bounce = Math.sin(t * 2.3) * 0.027,
        turn = actualPointerX * 0.18,
        lean = 0,
        headTurn = actualPointerX * 0.28,
        headTilt = -actualPointerY * 0.12;
      const run = action === "run" || action === "speed",
        happy = action === "celebrate" || action === "highfive";
      if (action === "wave") {
        rightAngle = 2.45 + Math.sin(elapsed * 8) * 0.16;
        rightElbow = -0.4;
      }
      if (action === "point") {
        rightAngle = 1.3;
        rightElbow = -0.12;
        headTurn = -0.24;
      }
      if (action === "think") {
        rightAngle = -2.35;
        rightElbow = 0.8;
        headTilt = 0.12;
        headTurn = -0.2;
      }
      if (action === "encourage") {
        leftAngle = -0.72;
        rightAngle = 0.72;
        headTilt = -0.12;
        bounce = 0;
      }
      if (action === "peek") {
        leftAngle = -2.65;
        rightAngle = 2.65;
        leftElbow = 0.55;
        rightElbow = -0.55;
        headTurn = -0.75;
        headTilt = 0.14;
      }
      if (happy) {
        rightAngle = 2.8;
        leftAngle = action === "celebrate" ? -2.8 : -0.65;
        rightElbow = -0.16;
        bounce =
          Math.abs(Math.sin(elapsed * 7)) * (action === "highfive" ? 0.2 : 0.3);
        lean = Math.sin(elapsed * 7) * 0.055;
      }
      if (run) {
        leftAngle = -0.2 + Math.sin(t * 11) * 0.65;
        rightAngle = 0.2 - Math.sin(t * 11) * 0.65;
        bounce = Math.abs(Math.sin(t * 11)) * 0.1;
        lean = -0.1;
        turn = 0.2;
      }
      if (action === "dribble") {
        rightAngle = 0.93;
        rightElbow = -0.3;
        headTilt = -0.08;
      }
      let travel = 0, tumble = 0;
      if (action === "speed") {
        travel = Math.sin(elapsed * 5.5) * 0.62;
        turn = Math.cos(elapsed * 5.5) > 0 ? 0.45 : -0.45;
        lean = -Math.cos(elapsed * 5.5) * 0.2;
      }
      if (action === "spin") {
        turn = elapsed * Math.PI * 2;
        leftAngle = -1.4;
        rightAngle = 1.4;
        bounce = Math.abs(Math.sin(elapsed * 5)) * 0.13;
      }
      if (action === "flip") {
        const phase = Math.min(elapsed / 1.35, 1);
        tumble = phase * Math.PI * 2;
        bounce = Math.sin(phase * Math.PI) * 0.48;
        leftAngle = -1.15;
        rightAngle = 1.15;
        lean = phase >= 1 ? -0.08 : 0;
      }
      mix(character.position, "x", travel, rate);
      // Equivalent full turns reset cleanly when returning to rest.
      if (action !== "flip" && character.rotation.x > Math.PI) character.rotation.x -= Math.PI * 2;
      if (action !== "spin" && character.rotation.y > Math.PI) character.rotation.y %= Math.PI * 2;
      mix(character.rotation, "x", tumble, rate);
      mix(character.position, "y", bounce, rate);
      mix(character.rotation, "y", turn, rate);
      mix(character.rotation, "z", lean, rate);
      mix(head.rotation, "y", headTurn, rate);
      mix(head.rotation, "x", headTilt, rate);
      mix(left.shoulder.rotation, "z", leftAngle, rate);
      mix(right.shoulder.rotation, "z", rightAngle, rate);
      mix(left.elbow.rotation, "z", leftElbow, rate);
      mix(right.elbow.rotation, "z", rightElbow, rate);
      mix(right.glove.position, "z", action === "think" ? 0.55 : 0.025, rate);
      legs.forEach((leg, index) => {
        const swing = run
          ? Math.sin(t * 11 + index * Math.PI) * 0.6
          : action === "dribble" && index === 1
            ? -0.35 - Math.max(0, Math.cos(elapsed * 7)) * 0.7
            : 0;
        mix(leg.hip.rotation, "x", swing, rate);
        mix(leg.knee.rotation, "x", Math.max(0, -swing) * 0.75, rate);
      });
      const blink = Math.sin(t * 0.82) > 0.996 ? 0.09 : 1;
      eyes.forEach(({ eye, pupil }) => {
        mix(
          eye.scale,
          "y",
          action === "peek" ? 0.12 : blink,
          Math.min(1, rate * 1.5),
        );
        pupil.position.x = actualPointerX * 0.045;
        pupil.position.y = -0.007 - actualPointerY * 0.035;
      });
      surprised.visible = action === "highfive" || action === "flip";
      smile.visible = !surprised.visible;
      const dribbling = action === "dribble";
      mix(
        ball.position,
        "y",
        dribbling ? -1.2 + Math.abs(Math.sin(elapsed * 7)) * 0.9 : -1.21,
        rate,
      );
      ball.rotation.z += dribbling ? dt * 2 : dt * 0.15;
      mix(
        ball.position,
        "x",
        dribbling ? 0.75 + Math.sin(elapsed * 7) * 0.18 : 1.2,
        rate,
      );
      ball.rotation.x += dribbling ? dt * 4 : 0;
      shadow.scale.set(1 - bounce * 0.18, 0.48 - bounce * 0.06, 1);
      renderer.render(scene, camera);
    }
    frame = requestAnimationFrame(render);
  };
  frame = requestAnimationFrame(render);
  return {
    setAction(next, accent) {
      if (action !== next) {
        action = next;
        actionStarted = performance.now();
      }
      materials.jersey.color.set(accent || 0x315a36);
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      intersection.disconnect();
      window.removeEventListener("pointermove", move);
      document.removeEventListener("pointerleave", leave);
      scene.traverse((object) => {
        if (object.isMesh) object.geometry.dispose();
      });
      Object.values(materials).forEach((material) => material.dispose());
      shadow.material.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
