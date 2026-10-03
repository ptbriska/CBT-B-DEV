/**
 * ROOT MODULE HEALTH CHECK
 * Memastikan script root tidak corrupt & canvas siap digunakan
 */
(function initRootModule() {
  const statusEl = document.getElementById('health-status');
  
  try {
    // Registrasi variabel modul lokal root
    window.ROOT_MODULE = {
      loaded: true,
      institution: "Briska Education Corporation",
      timestamp: new Date().toISOString()
    };

    if (statusEl) {
      statusEl.style.color = '#34d399';
      statusEl.textContent = '● SYSTEM STATUS: ONLINE [ROOT OK]';
    }
    console.log('[ROOT-MOD] index.js loaded successfully.');
  } catch (err) {
    if (statusEl) {
      statusEl.style.color = '#f87171';
      statusEl.textContent = '🚨 SYSTEM STATUS: ROOT CORRUPT!';
    }
    console.error('[ROOT-MOD ERROR] Module initialization failed:', err);
  }
})();

/**
 * BACKGROUND CANVAS: Dynamic Particle Network Effect
 */
const canvas = document.getElementById('bg-canvas');
const ctx = canvas.getContext('2d');

let width, height;
let particles = [];
const mouse = { x: null, y: null, radius: 120 };

function resizeCanvas() {
  width = canvas.width = window.innerWidth;
  height = canvas.height = window.innerHeight;
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();

window.addEventListener('mousemove', (e) => {
  mouse.x = e.clientX;
  mouse.y = e.clientY;
});

window.addEventListener('mouseleave', () => {
  mouse.x = null;
  mouse.y = null;
});

class Particle {
  constructor() {
    this.x = Math.random() * width;
    this.y = Math.random() * height;
    this.vx = (Math.random() - 0.5) * 1.2;
    this.vy = (Math.random() - 0.5) * 1.2;
    this.radius = Math.random() * 2 + 1;
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;

    // Bounce off walls
    if (this.x < 0 || this.x > width) this.vx *= -1;
    if (this.y < 0 || this.y > height) this.vy *= -1;

    // Interaction with mouse
    if (mouse.x !== null && mouse.y !== null) {
      const dx = mouse.x - this.x;
      const dy = mouse.y - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < mouse.radius) {
        const force = (mouse.radius - dist) / mouse.radius;
        const angle = Math.atan2(dy, dx);
        this.x -= Math.cos(angle) * force * 2;
        this.y -= Math.sin(angle) * force * 2;
      }
    }
  }

  draw() {
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(56, 189, 248, 0.7)';
    ctx.fill();
  }
}

// Particle density based on screen size
const particleCount = Math.floor((window.innerWidth * window.innerHeight) / 12000);
for (let i = 0; i < particleCount; i++) {
  particles.push(new Particle());
}

function animate() {
  ctx.clearRect(0, 0, width, height);

  // Connect particles with line if close enough
  for (let i = 0; i < particles.length; i++) {
    particles[i].update();
    particles[i].draw();

    for (let j = i + 1; j < particles.length; j++) {
      const dx = particles[i].x - particles[j].x;
      const dy = particles[i].y - particles[j].y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 100) {
        ctx.beginPath();
        ctx.moveTo(particles[i].x, particles[i].y);
        ctx.lineTo(particles[j].x, particles[j].y);
        ctx.strokeStyle = `rgba(56, 189, 248, ${1 - dist / 100})`;
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }
    }
  }

  requestAnimationFrame(animate);
}

animate();
