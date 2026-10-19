import confetti from 'canvas-confetti';

export function fireSuccessConfetti() {
  const count = 200;
  const defaults = {
    origin: { y: 0.65 },
    zIndex: 99999
  };

  function fire(particleRatio, opts) {
    confetti({
      ...defaults,
      ...opts,
      particleCount: Math.floor(count * particleRatio)
    });
  }

  // Left & right burst
  fire(0.25, {
    spread: 30,
    startVelocity: 55,
    colors: ['#06b6d4', '#3b82f6', '#10b981']
  });
  fire(0.2, {
    spread: 60,
    colors: ['#a855f7', '#6366f1', '#f59e0b']
  });
  fire(0.35, {
    spread: 100,
    decay: 0.91,
    scalar: 0.8,
    colors: ['#38bdf8', '#ec4899', '#ffffff']
  });
  fire(0.1, {
    spread: 120,
    startVelocity: 25,
    decay: 0.92,
    colors: ['#10b981', '#3b82f6', '#8b5cf6']
  });
  fire(0.1, {
    spread: 120,
    startVelocity: 45
  });
}
