import confetti from 'canvas-confetti';

export function triggerSmallBurst(originX = 0.5, originY = 0.6) {
  confetti({
    particleCount: 28,
    spread: 55,
    startVelocity: 26,
    origin: { x: originX, y: originY },
    colors: ['#10B981', '#8B5CF6', '#F59E0B', '#38BDF8'],
    disableForReducedMotion: true,
  });
}

export function triggerBossDefeatConfetti() {
  const duration = 1800;
  const end = Date.now() + duration;

  const frame = () => {
    confetti({
      particleCount: 6,
      angle: 60,
      spread: 60,
      origin: { x: 0, y: 0.65 },
      colors: ['#EF4444', '#F97316', '#F59E0B', '#10B981', '#8B5CF6'],
    });
    confetti({
      particleCount: 6,
      angle: 120,
      spread: 60,
      origin: { x: 1, y: 0.65 },
      colors: ['#EF4444', '#F97316', '#F59E0B', '#10B981', '#8B5CF6'],
    });

    if (Date.now() < end) {
      requestAnimationFrame(frame);
    }
  };

  // Initial central burst
  confetti({
    particleCount: 85,
    spread: 100,
    startVelocity: 42,
    origin: { x: 0.5, y: 0.5 },
    colors: ['#F59E0B', '#10B981', '#8B5CF6', '#EC4899'],
  });

  frame();
}

export function triggerLevelUpConfetti() {
  confetti({
    particleCount: 110,
    spread: 120,
    startVelocity: 45,
    origin: { x: 0.5, y: 0.45 },
    colors: ['#8B5CF6', '#6366F1', '#F59E0B', '#10B981', '#F43F5E'],
  });
}
