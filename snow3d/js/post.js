// ============================================================ EFFETTI DI CAMERA (post-processing)
// La scena si disegna in un'immagine ad alta gamma; poi: bagliore delle luci forti (sole, neve al sole),
// sfocatura radiale in velocita', vignetta e un filo di contrasto. Se il telefono non regge o non
// supporta le immagini intermedie, si spegne da solo e il gioco si disegna come prima.
var POST = { ok: false, on: false, rt: null, bA: null, bB: null, hdr: false, speed: 0 };
var postScene = new THREE.Scene(), postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
var postQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2)); postQuad.frustumCulled = false; postScene.add(postQuad);
var QUAD_VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
var brightMat = new THREE.ShaderMaterial({
  toneMapped: false, depthTest: false, depthWrite: false,
  uniforms: { tDiffuse: { value: null }, uThr: { value: 1.0 } },
  vertexShader: QUAD_VS,
  fragmentShader: 'uniform sampler2D tDiffuse; uniform float uThr; varying vec2 vUv; void main(){ vec3 c = texture2D(tDiffuse, vUv).rgb; float l = max(c.r, max(c.g, c.b)); float k = smoothstep(uThr, uThr * 1.8, l); gl_FragColor = vec4(c * k, 1.0); }'
});
function blurMat(dir) {
  return new THREE.ShaderMaterial({
    toneMapped: false, depthTest: false, depthWrite: false,
    uniforms: { tDiffuse: { value: null }, uDir: { value: new THREE.Vector2() } },
    vertexShader: QUAD_VS,
    fragmentShader: 'uniform sampler2D tDiffuse; uniform vec2 uDir; varying vec2 vUv; void main(){ vec3 c = texture2D(tDiffuse, vUv).rgb * 0.227;' +
      ' c += (texture2D(tDiffuse, vUv + uDir * 1.385).rgb + texture2D(tDiffuse, vUv - uDir * 1.385).rgb) * 0.316;' +
      ' c += (texture2D(tDiffuse, vUv + uDir * 3.231).rgb + texture2D(tDiffuse, vUv - uDir * 3.231).rgb) * 0.070; gl_FragColor = vec4(c, 1.0); }'
  });
}
var blurH = blurMat(), blurV = blurMat();
var compMat = new THREE.ShaderMaterial({
  depthTest: false, depthWrite: false,
  uniforms: { tDiffuse: { value: null }, tBloom: { value: null }, uBloom: { value: 0.55 }, uSpeed: { value: 0 }, uVig: { value: 0.32 }, uFlash: { value: 0 }, uPx: { value: new THREE.Vector2(1 / 1000, 1 / 500) } },
  vertexShader: QUAD_VS,
  fragmentShader: [
    'uniform sampler2D tDiffuse, tBloom; uniform float uBloom, uSpeed, uVig, uFlash; uniform vec2 uPx; varying vec2 vUv;',
    'float lu(vec3 c){ float l = dot(c, vec3(0.299, 0.587, 0.114)); return l / (1.0 + l); }',
    'vec3 fxaa(vec2 uv){',
    '  vec3 nw = texture2D(tDiffuse, uv + vec2(-1.0, -1.0) * uPx).rgb, ne = texture2D(tDiffuse, uv + vec2(1.0, -1.0) * uPx).rgb;',
    '  vec3 sw = texture2D(tDiffuse, uv + vec2(-1.0, 1.0) * uPx).rgb, se = texture2D(tDiffuse, uv + vec2(1.0, 1.0) * uPx).rgb, m = texture2D(tDiffuse, uv).rgb;',
    '  float a = lu(nw), b = lu(ne), c = lu(sw), d = lu(se), e = lu(m);',
    '  float mn = min(e, min(min(a, b), min(c, d))), mx = max(e, max(max(a, b), max(c, d)));',
    '  if (mx - mn < 0.04) return m;',
    '  vec2 dir = vec2(-((a + b) - (c + d)), (a + c) - (b + d));',
    '  float red = max((a + b + c + d) * 0.03125, 1.0 / 128.0), rcp = 1.0 / (min(abs(dir.x), abs(dir.y)) + red);',
    '  dir = clamp(dir * rcp, -8.0, 8.0) * uPx;',
    '  vec3 A = 0.5 * (texture2D(tDiffuse, uv + dir * (1.0 / 3.0 - 0.5)).rgb + texture2D(tDiffuse, uv + dir * (2.0 / 3.0 - 0.5)).rgb);',
    '  vec3 B = A * 0.5 + 0.25 * (texture2D(tDiffuse, uv - dir * 0.5).rgb + texture2D(tDiffuse, uv + dir * 0.5).rgb);',
    '  float lb = lu(B); return (lb < mn || lb > mx) ? A : B;',
    '}',
    'void main(){',
    '  vec2 d = vUv - vec2(0.5, 0.46);',
    '  vec3 c = fxaa(vUv);',
    '  if (uSpeed > 0.01) {',   // sfocatura radiale: solo ai bordi, al centro il rider resta nitido
    '    float m = smoothstep(0.12, 0.55, length(d)) * uSpeed;',
    '    vec3 acc = c; for (int i = 1; i < 6; i++) acc += texture2D(tDiffuse, vUv - d * float(i) * 0.012 * m).rgb;',
    '    c = acc / 6.0;',
    '  }',
    '  c += texture2D(tBloom, vUv).rgb * uBloom;',
    '  float v = smoothstep(0.95, 0.25, length(d * vec2(1.25, 1.0)));',
    '  c *= mix(1.0 - uVig, 1.0, v);',
    '  c = mix(c, vec3(1.0), uFlash);',
    '  gl_FragColor = vec4(c, 1.0);',
    '  #include <tonemapping_fragment>',
    '  #include <colorspace_fragment>',
    '  gl_FragColor.rgb = clamp((gl_FragColor.rgb - 0.5) * 1.05 + 0.5, 0.0, 1.0);',
    '}'].join('\n')
});
function makeRT(w, h, samples, depth) {
  return new THREE.WebGLRenderTarget(w, h, { type: POST.hdr ? THREE.HalfFloatType : THREE.UnsignedByteType, samples: samples || 0, depthBuffer: !!depth, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
}
var _dbs = new THREE.Vector2();
function initPost() {
  try {
    var ext = renderer.extensions, gl2 = renderer.capabilities.isWebGL2;
    if (!gl2) { DIAG.post = 'non supportato (WebGL1)'; return; }
    POST.hdr = ext.has('EXT_color_buffer_float') || ext.has('EXT_color_buffer_half_float');
    // senza immagini ad alta gamma il bagliore schiarirebbe tutta la neve: meglio niente effetti
    if (!POST.hdr) { DIAG.post = 'non supportato su questo telefono'; return; }
    renderer.getDrawingBufferSize(_dbs);
    // niente MSAA: questa versione di Three.js scarta l'immagine multicampionata dopo ogni passaggio
    // (si perderebbe lo sfondo). L'antialiasing lo fa il passaggio finale (FXAA).
    POST.rt = makeRT(_dbs.x, _dbs.y, 0, true);
    POST.bA = makeRT(Math.max(1, _dbs.x >> 2), Math.max(1, _dbs.y >> 2), 0, false);
    POST.bB = makeRT(Math.max(1, _dbs.x >> 2), Math.max(1, _dbs.y >> 2), 0, false);
    // prova: l'immagine intermedia deve essere utilizzabile
    renderer.setRenderTarget(POST.rt); renderer.clear();
    var gl = renderer.getContext(), st = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    renderer.setRenderTarget(null);
    if (st !== gl.FRAMEBUFFER_COMPLETE) { disposePost(); DIAG.post = 'non supportato'; return; }
    brightMat.uniforms.uThr.value = POST.hdr ? 1.05 : 0.86;
    POST.ok = true; DIAG.post = POST.hdr ? 'attivo (HDR)' : 'attivo';
  } catch (e) { disposePost(); DIAG.post = 'errore: ' + e.message; }
}
function disposePost() { ['rt', 'bA', 'bB'].forEach(function (k) { if (POST[k]) { POST[k].dispose(); POST[k] = null; } }); POST.ok = false; POST.on = false; }
function resizePost() {
  if (!POST.ok) return;
  renderer.getDrawingBufferSize(_dbs);
  POST.rt.setSize(_dbs.x, _dbs.y);
  POST.bA.setSize(Math.max(1, _dbs.x >> 2), Math.max(1, _dbs.y >> 2)); POST.bB.setSize(Math.max(1, _dbs.x >> 2), Math.max(1, _dbs.y >> 2));
}
function postPass(mat, target) { postQuad.material = mat; renderer.setRenderTarget(target); renderer.render(postScene, postCam); }
function postRender(dt) {
  if (!POST.ok || !POST.on) return false;
  renderer.autoClear = false;
  renderer.setRenderTarget(POST.rt); renderer.clear();
  renderer.render(bgScene, bgCam); renderer.clearDepth(); renderer.render(scene, camera);
  brightMat.uniforms.tDiffuse.value = POST.rt.texture; postPass(brightMat, POST.bA);
  var w = POST.bA.width, h = POST.bA.height;
  blurH.uniforms.tDiffuse.value = POST.bA.texture; blurH.uniforms.uDir.value.set(1 / w, 0); postPass(blurH, POST.bB);
  blurV.uniforms.tDiffuse.value = POST.bB.texture; blurV.uniforms.uDir.value.set(0, 1 / h); postPass(blurV, POST.bA);
  blurH.uniforms.tDiffuse.value = POST.bA.texture; blurH.uniforms.uDir.value.set(2 / w, 0); postPass(blurH, POST.bB);
  blurV.uniforms.tDiffuse.value = POST.bB.texture; blurV.uniforms.uDir.value.set(0, 2 / h); postPass(blurV, POST.bA);
  compMat.uniforms.tDiffuse.value = POST.rt.texture; compMat.uniforms.tBloom.value = POST.bA.texture;
  compMat.uniforms.uSpeed.value = POST.speed; compMat.uniforms.uPx.value.set(1 / POST.rt.width, 1 / POST.rt.height);
  postPass(compMat, null);
  return true;
}
