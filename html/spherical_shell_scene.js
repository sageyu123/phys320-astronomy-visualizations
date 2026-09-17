import * as THREE from '../vendor/three.module.js';
import { pointAccumulatedForce } from './spherical_shell_model.js';

// Three-dimensional view for the spherical-shell theorem. Coordinates use R = 1,
// with the test mass on +x and inward force positive toward -x.
export function createShellScene(canvas) {
  const scene = new THREE.Scene();
  scene.background = null;
  const camera = new THREE.PerspectiveCamera(34, 1, 0.01, 100);
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const referenceScene = new THREE.Scene();

  scene.add(new THREE.HemisphereLight(0xd7fbff, 0x0b1018, 1.35));
  const key = new THREE.DirectionalLight(0xffffff, 1.8);
  key.position.set(3, 4, 5);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0x5799b0, 0.65);
  fill.position.set(-4, -1, -3);
  scene.add(fill);
  referenceScene.add(new THREE.HemisphereLight(0xd7fbff, 0x0b1018, 1.35));
  const referenceKey = new THREE.DirectionalLight(0xffffff, 1.8);
  referenceKey.position.set(3, 4, 5);
  referenceScene.add(referenceKey);

  const shell = new THREE.Group();
  const shellMesh = new THREE.Mesh(
    new THREE.SphereGeometry(1, 40, 24),
    new THREE.MeshPhongMaterial({ color: 0x56c7d9, transparent: true, opacity: 0.10, side: THREE.DoubleSide, shininess: 85, depthWrite: false })
  );
  shell.add(shellMesh);
  const wireMaterial = new THREE.LineBasicMaterial({ color: 0x56c7d9, transparent: true, opacity: 0.3 });
  for (let i = 0; i < 8; i += 1) {
    const lon = (i * Math.PI) / 8;
    const points = [];
    for (let j = 0; j <= 64; j += 1) {
      const a = (j * Math.PI * 2) / 64;
      points.push(new THREE.Vector3(Math.cos(a) * Math.cos(lon), Math.sin(a), Math.cos(a) * Math.sin(lon)));
    }
    shell.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), wireMaterial));
  }
  for (let i = 1; i < 6; i += 1) {
    const lat = (i * Math.PI) / 6;
    const points = [];
    for (let j = 0; j <= 64; j += 1) {
      const a = (j * Math.PI * 2) / 64;
      const rr = Math.sin(lat);
      points.push(new THREE.Vector3(Math.cos(a) * rr, Math.cos(lat), Math.sin(a) * rr));
    }
    shell.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), wireMaterial));
  }
  scene.add(shell);
  const referenceShell = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.SphereGeometry(1, 24, 14)), new THREE.LineBasicMaterial({ color: 0x56c7d9, transparent: true, opacity: 0.18 }));
  referenceScene.add(referenceShell);
  const centralMass = new THREE.Mesh(new THREE.SphereGeometry(0.13, 20, 14), new THREE.MeshPhongMaterial({ color: 0xffcc66, emissive: 0x4b3510, emissiveIntensity: 0.35 }));
  referenceScene.add(centralMass);
  const referenceTest = new THREE.Mesh(new THREE.SphereGeometry(0.085, 16, 12), new THREE.MeshBasicMaterial({ color: 0xee65be, depthTest: false }));
  referenceTest.renderOrder = 5;
  referenceScene.add(referenceTest);
  const referenceAxis = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineDashedMaterial({ color: 0x69717a, dashSize: 0.08, gapSize: 0.06 }));
  referenceScene.add(referenceAxis);
  const referenceRLine = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineDashedMaterial({ color: 0xee65be, dashSize: 0.06, gapSize: 0.05 }));
  referenceScene.add(referenceRLine);
  const referenceArrow = new THREE.ArrowHelper(new THREE.Vector3(-1, 0, 0), new THREE.Vector3(), 0.8, 0x56dc72, 0.11, 0.06);
  referenceArrow.visible = false;
  referenceScene.add(referenceArrow);
  const capMaterial = new THREE.MeshPhongMaterial({ color: 0x56dc72, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false, shininess: 70 });
  let sweptCap = null;
  function replaceSweptCap(angle) {
    if (sweptCap) { sweptCap.geometry.dispose(); scene.remove(sweptCap); sweptCap = null; }
    if (angle <= 0.001) return;
    sweptCap = new THREE.Mesh(new THREE.SphereGeometry(1.005, 48, 32, 0, Math.PI * 2, 0, angle), capMaterial);
    sweptCap.rotation.z = -Math.PI / 2;
    sweptCap.renderOrder = 1;
    scene.add(sweptCap);
  }

  const axisMaterial = new THREE.LineDashedMaterial({ color: 0x69717a, dashSize: 0.08, gapSize: 0.06 });
  const axis = new THREE.Line(new THREE.BufferGeometry(), axisMaterial);
  scene.add(axis);
  const center = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 8), new THREE.MeshBasicMaterial({ color: 0x56c7d9 }));
  scene.add(center);

  const test = new THREE.Mesh(new THREE.SphereGeometry(0.085, 16, 12), new THREE.MeshBasicMaterial({ color: 0xee65be, depthTest: false }));
  test.renderOrder = 5;
  scene.add(test);
  const ring = new THREE.LineLoop(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xffcc66, linewidth: 2 }));
  scene.add(ring);
  const radiusLine = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineDashedMaterial({ color: 0xee65be, dashSize: 0.06, gapSize: 0.05 }));
  const distanceLine = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xe7e9eb, transparent: true, opacity: 0.7 }));
  scene.add(radiusLine, distanceLine);
  const polarArc = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xffcc66 }));
  scene.add(polarArc);

  const arrows = [
    new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(), 0.8, 0xffcc66, 0.09, 0.05),
    new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(), 0.8, 0xffcc66, 0.09, 0.05),
    new THREE.ArrowHelper(new THREE.Vector3(-1, 0, 0), new THREE.Vector3(), 0.9, 0x56dc72, 0.11, 0.06),
  ];
  arrows.forEach((a) => { a.visible = false; scene.add(a); });

  function addForceShaft(arrow) {
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 10), new THREE.MeshBasicMaterial({ color: 0x56dc72 }));
    arrow.line.visible = false;
    arrow.add(shaft);
    return shaft;
  }
  const shellShaft = addForceShaft(arrows[2]), pointShaft = addForceShaft(referenceArrow);

  const shellRadius = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0x56c7d9 }));
  scene.add(shellRadius);
  function makeLabel(text, color, parent = scene) {
    const image = document.createElement('canvas'); image.width = 128; image.height = 64;
    const context = image.getContext('2d');
    context.font = 'italic 38px Georgia'; context.textAlign = 'center'; context.textBaseline = 'middle';
    context.strokeStyle = '#0d1015'; context.lineWidth = 6; context.strokeText(text, 64, 32);
    context.fillStyle = color; context.fillText(text, 64, 32);
    const texture = new THREE.CanvasTexture(image); texture.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false }));
    sprite.scale.set(.42, .21, 1); sprite.renderOrder = 6; parent.add(sprite); return sprite;
  }
  const massLabel = makeLabel('m', '#ee65be'), radiusLabel = makeLabel('R', '#56c7d9');
  const distanceLabel = makeLabel('s', '#e7e9eb'), rLabel = makeLabel('r', '#ee65be');
  const thetaLabel = makeLabel('θ', '#ffcc66');
  const centralLabel = makeLabel('Σdm', '#ffcc66', referenceScene);
  const referenceMassLabel = makeLabel('m', '#ee65be', referenceScene);
  const referenceRadiusLabel = makeLabel('r', '#ee65be', referenceScene);

  let r = 1.6;
  let theta = 1.1;
  let accumulatedForce = 0;
  let yaw = Math.atan2(6, 4);
  let pitch = 1.237;
  let zoom = 1;
  let dragging = null;

  function pointOnRing(angle) {
    const x = Math.cos(theta);
    const rr = Math.sin(theta);
    return new THREE.Vector3(x, rr * Math.cos(angle), rr * Math.sin(angle));
  }

  function setArrow(arrow, from, to, visible) {
    const delta = to.clone().sub(from);
    const length = Math.min(0.75, delta.length() * 0.5);
    arrow.position.copy(from);
    arrow.setDirection(delta.lengthSq() ? delta.normalize() : new THREE.Vector3(-1, 0, 0));
    arrow.setLength(length, Math.min(0.1, length * 0.35), Math.min(0.06, length * 0.2));
    arrow.visible = visible;
  }

  function update(nextR = r, nextTheta = theta, nextAccumulatedForce = accumulatedForce) {
    r = Math.max(0, Math.min(3, Number(nextR) || 0));
    theta = Math.max(0, Math.min(Math.PI, Number(nextTheta) || 0));
    accumulatedForce = Number(nextAccumulatedForce);
    if (!Number.isFinite(accumulatedForce)) accumulatedForce = 0;
    replaceSweptCap(theta);
    const mass = new THREE.Vector3(r, 0, 0);
    test.position.copy(mass);
    referenceTest.position.copy(mass);
    axis.geometry.dispose();
    axis.geometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-1.25, 0, 0), new THREE.Vector3(3.15, 0, 0)]);
    axis.computeLineDistances();
    radiusLine.geometry.dispose();
    radiusLine.geometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), mass]);
    radiusLine.computeLineDistances();
    distanceLine.geometry.dispose();
    distanceLine.geometry = new THREE.BufferGeometry().setFromPoints([mass, pointOnRing(0)]);

    const ringPoints = [];
    for (let i = 0; i < 96; i += 1) ringPoints.push(pointOnRing((i * Math.PI * 2) / 96));
    ring.geometry.dispose();
    ring.geometry = new THREE.BufferGeometry().setFromPoints(ringPoints);

    const arcPoints = [];
    for (let i = 0; i <= 24; i += 1) {
      const a = (theta * i) / 24;
      arcPoints.push(new THREE.Vector3(Math.cos(a) * 0.25, Math.sin(a) * 0.25, 0));
    }
    polarArc.geometry.dispose();
    polarArc.geometry = new THREE.BufferGeometry().setFromPoints(arcPoints);

    const top = pointOnRing(0);
    const bottom = pointOnRing(Math.PI);
    setArrow(arrows[0], mass, top, Math.abs(Math.sin(theta)) > 0.015);
    setArrow(arrows[1], mass, bottom, Math.abs(Math.sin(theta)) > 0.015);
    const sumVisible = Math.abs(accumulatedForce) > 1e-8;
    const sumDirection = accumulatedForce >= 0 ? new THREE.Vector3(-1, 0, 0) : new THREE.Vector3(1, 0, 0);
    const sumLength = Math.min(1.1, 0.85 * Math.abs(accumulatedForce));
    arrows[2].position.copy(mass).addScaledVector(sumDirection, .10);
    arrows[2].setDirection(sumDirection);
    arrows[2].setLength(sumLength, Math.min(0.15, sumLength * 0.28), Math.min(0.12, sumLength * 0.3));
    arrows[2].setColor(accumulatedForce >= 0 ? 0x56dc72 : 0xff7f66);
    arrows[2].visible = sumVisible;
    shellShaft.scale.set(.012, sumLength * .8, .012); shellShaft.position.y = sumLength * .4;
    shellShaft.material.color.setHex(accumulatedForce >= 0 ? 0x56dc72 : 0xff7f66);
    referenceAxis.geometry.dispose();
    referenceAxis.geometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-1.25, 0, 0), new THREE.Vector3(3.15, 0, 0)]);
    referenceAxis.computeLineDistances();
    referenceRLine.geometry.dispose();
    referenceRLine.geometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), mass]);
    referenceRLine.computeLineDistances();
    const referenceForce = pointAccumulatedForce(r, theta);
    const referenceVisible = Number.isFinite(referenceForce) && referenceForce > 1e-8;
    const referenceLength = referenceVisible ? Math.min(1.1, 0.85 * referenceForce) : 0;
    referenceArrow.position.copy(mass).add(new THREE.Vector3(-.10, 0, 0));
    referenceArrow.setDirection(new THREE.Vector3(-1, 0, 0));
    referenceArrow.setLength(referenceLength, Math.min(0.15, referenceLength * 0.28), Math.min(0.12, referenceLength * 0.3));
    referenceArrow.visible = referenceVisible;
    pointShaft.scale.set(.012, referenceLength * .8, .012); pointShaft.position.y = referenceLength * .4;
    centralLabel.position.set(-.16, .18, 0);
    referenceMassLabel.position.copy(mass.clone().add(new THREE.Vector3(0,.19,0)));
    referenceRadiusLabel.position.copy(mass.clone().multiplyScalar(.5).add(new THREE.Vector3(0,-.16,0)));
    referenceRadiusLabel.visible = r > .2;
    shellRadius.geometry.dispose();
    shellRadius.geometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), top]);
    for (const [label, position] of [[massLabel, mass.clone().add(new THREE.Vector3(0, .19, 0))], [radiusLabel, top.clone().multiplyScalar(.57).add(new THREE.Vector3(-.12, 0, 0))], [distanceLabel, mass.clone().add(top).multiplyScalar(.5).add(new THREE.Vector3(0, .16, 0))], [rLabel, mass.clone().multiplyScalar(.5).add(new THREE.Vector3(0, -.16, 0))]]) label.position.copy(position);
    thetaLabel.position.set(.34 * Math.cos(theta / 2), .34 * Math.sin(theta / 2), .08);
    rLabel.visible = r > .2;
    const showGeometry = theta > 0 && theta < Math.PI;
    for (const object of [shellRadius, distanceLine, polarArc, radiusLabel, distanceLabel, thetaLabel]) object.visible = showGeometry;
    render();
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(1, rect.width);
    const height = Math.max(1, rect.height);
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.setSize(width, height, false);
    render();
  }

  function resetView() {
    yaw = Math.atan2(6, 4);
    pitch = 1.237;
    zoom = 1;
    render();
  }

  function render() {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const vertical = rect.width < 600;
    const width = vertical ? rect.width : rect.width / 2;
    const height = vertical ? rect.height / 2 : rect.height;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    const target = new THREE.Vector3(0.65, 0, 0);
    const distance = Math.max(6.4, 2.25 / (Math.tan(17 * Math.PI / 180) * camera.aspect)) / zoom;
    const cp = Math.max(0.22, Math.min(Math.PI - 0.22, pitch));
    camera.position.set(target.x + distance * Math.sin(cp) * Math.cos(yaw), target.y + distance * Math.cos(cp), target.z + distance * Math.sin(cp) * Math.sin(yaw));
    camera.lookAt(target);
    const views = vertical
      ? [{ x: 0, y: height, scene }, { x: 0, y: 0, scene: referenceScene }]
      : [{ x: 0, y: 0, scene }, { x: width, y: 0, scene: referenceScene }];
    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, rect.width, rect.height);
    renderer.clear();
    renderer.setScissorTest(true);
    for (const view of views) {
      // Three.js applies DPR internally: viewport and scissor use CSS pixels.
      renderer.setViewport(view.x, view.y, width, height);
      renderer.setScissor(view.x, view.y, width, height);
      renderer.render(view.scene, camera);
    }
    renderer.setScissorTest(false);
  }

  canvas.addEventListener('pointerdown', (event) => { dragging = { id: event.pointerId, x: event.clientX, y: event.clientY }; canvas.setPointerCapture(event.pointerId); });
  canvas.addEventListener('pointermove', (event) => {
    if (!dragging || dragging.id !== event.pointerId) return;
    yaw -= (event.clientX - dragging.x) * 0.009;
    pitch = Math.max(.22, Math.min(Math.PI - .22, pitch - (event.clientY - dragging.y) * .009));
    dragging.x = event.clientX;
    dragging.y = event.clientY;
    render();
  });
  const endDrag = () => { dragging = null; };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('wheel', (event) => {
    event.preventDefault();
    zoom = Math.max(.65, Math.min(2.8, zoom * Math.exp(-event.deltaY * .0015)));
    render();
  }, { passive: false });
  canvas.addEventListener('dblclick', resetView);
  canvas.addEventListener('keydown', (event) => {
    const step = 0.12;
    if (event.key === 'ArrowLeft') yaw -= step;
    else if (event.key === 'ArrowRight') yaw += step;
    else if (event.key === 'ArrowUp') pitch -= step;
    else if (event.key === 'ArrowDown') pitch += step;
    else return;
    pitch = Math.max(.22, Math.min(Math.PI - .22, pitch));
    event.preventDefault();
    render();
  });

  resize();
  update(r, theta);
  return { update, resize, resetView };
}
