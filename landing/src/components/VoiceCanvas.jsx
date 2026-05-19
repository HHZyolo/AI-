import { useEffect, useRef } from 'react';

/**
 * Hero WebGL 声纹光晕 —— DESIGN.md §7 爆点 1。
 * 单页唯一 WebGL;IntersectionObserver 不可见时暂停渲染;
 * 移动端 / reduced-motion / WebGL 不可用时由父组件回退为 CSS 渐变。
 *
 * 渲染:全屏 fragment shader 画一条品红/紫的声波曲线 + 柔光,
 * 鼠标移动时声波轻微跟随(pointermove 已在着色器侧平滑)。
 */
export default function VoiceCanvas() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext('webgl', { antialias: true, alpha: true });
    if (!gl) return; // 父组件已渲染 fallback

    const vert = `
      attribute vec2 p;
      void main() { gl_Position = vec4(p, 0.0, 1.0); }
    `;
    const frag = `
      precision mediump float;
      uniform vec2 u_res;
      uniform float u_time;
      uniform vec2 u_mouse;

      // 一条起伏的声波
      float wave(vec2 uv, float t, float freq, float amp, float phase) {
        float y = sin(uv.x * freq + t + phase) * amp;
        y += sin(uv.x * freq * 1.9 + t * 1.3 + phase) * amp * 0.4;
        float d = abs(uv.y - y);
        return d;
      }

      void main() {
        vec2 uv = (gl_FragCoord.xy / u_res.xy - 0.5);
        uv.x *= u_res.x / u_res.y;

        float t = u_time * 0.55;
        // 鼠标轻微影响波幅
        float mAmp = 0.06 + (u_mouse.y - 0.5) * 0.05;
        float mPhase = (u_mouse.x - 0.5) * 1.2;

        vec3 col = vec3(0.0);

        // 三条声波,品红 -> 紫渐变
        for (int i = 0; i < 3; i++) {
          float fi = float(i);
          float d = wave(uv, t + fi * 0.9, 3.0 + fi * 1.4, mAmp + fi * 0.018, mPhase + fi);
          float line = 0.012 / (d + 0.012);
          vec3 c = mix(vec3(1.0, 0.36, 0.62), vec3(0.61, 0.42, 1.0), fi / 2.0);
          col += c * line * 0.5;
        }

        // 中心柔光晕
        float glow = 0.10 / (length(uv * vec2(0.7, 1.3)) + 0.18);
        col += mix(vec3(1.0,0.36,0.62), vec3(0.61,0.42,1.0), 0.5) * glow * 0.30;

        float alpha = clamp(length(col), 0.0, 1.0);
        gl_FragColor = vec4(col, alpha * 0.9);
      }
    `;

    const compile = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return s;
    };
    const prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, vert));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, frag));
    gl.linkProgram(prog);
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      gl.STATIC_DRAW
    );
    const loc = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);

    const uRes = gl.getUniformLocation(prog, 'u_res');
    const uTime = gl.getUniformLocation(prog, 'u_time');
    const uMouse = gl.getUniformLocation(prog, 'u_mouse');

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      const w = canvas.clientWidth * dpr;
      const h = canvas.clientHeight * dpr;
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
    };
    resize();
    window.addEventListener('resize', resize);

    // 鼠标 —— rAF 节流(性能红线)
    const mouse = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5 };
    const onMove = (e) => {
      mouse.tx = e.clientX / window.innerWidth;
      mouse.ty = 1 - e.clientY / window.innerHeight;
    };
    window.addEventListener('pointermove', onMove, { passive: true });

    // 可见性控制 —— 离开视口暂停
    let visible = true;
    const io = new IntersectionObserver(
      ([e]) => {
        visible = e.isIntersecting;
        if (visible && !raf) loop(performance.now());
      },
      { threshold: 0 }
    );
    io.observe(canvas);

    let raf = 0;
    const start = performance.now();
    const loop = (now) => {
      if (!visible) {
        raf = 0;
        return;
      }
      mouse.x += (mouse.tx - mouse.x) * 0.06;
      mouse.y += (mouse.ty - mouse.y) * 0.06;
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform1f(uTime, (now - start) / 1000);
      gl.uniform2f(uMouse, mouse.x, mouse.y);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', onMove);
    };
  }, []);

  return <canvas ref={canvasRef} className="voice-canvas" aria-hidden="true" />;
}
