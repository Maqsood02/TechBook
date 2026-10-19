import React from 'react';
import { motion } from 'framer-motion';

export default function BackgroundOrbs() {
  return (
    <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
      {/* Light Radial Base Gradient */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse at 50% 15%, #eff6ff 0%, #f8fafc 65%, #f1f5f9 100%)'
        }}
      />

      {/* Subtle Technical Dot Matrix */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          opacity: 0.45,
          backgroundImage: 'radial-gradient(rgba(99, 102, 241, 0.15) 1px, transparent 1px)',
          backgroundSize: '24px 24px'
        }}
      />

      {/* Floating Soft Indigo/Blue Glow */}
      <motion.div
        animate={{
          x: [0, 40, -30, 0],
          y: [0, -40, 20, 0],
          scale: [1, 1.12, 0.95, 1],
          opacity: [0.35, 0.5, 0.38, 0.35]
        }}
        transition={{
          duration: 12,
          repeat: Infinity,
          ease: 'easeInOut'
        }}
        style={{
          position: 'absolute',
          top: '12%',
          left: '18%',
          width: '450px',
          height: '450px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(99, 102, 241, 0.22) 0%, rgba(59, 130, 246, 0.1) 50%, transparent 70%)',
          filter: 'blur(75px)'
        }}
      />

      {/* Floating Soft Cyan/Sky Glow */}
      <motion.div
        animate={{
          x: [0, -35, 30, 0],
          y: [0, 35, -25, 0],
          scale: [1, 1.15, 0.92, 1],
          opacity: [0.3, 0.45, 0.35, 0.3]
        }}
        transition={{
          duration: 14,
          repeat: Infinity,
          ease: 'easeInOut',
          delay: 1.5
        }}
        style={{
          position: 'absolute',
          bottom: '15%',
          right: '18%',
          width: '480px',
          height: '480px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(56, 189, 248, 0.25) 0%, rgba(147, 197, 253, 0.12) 50%, transparent 70%)',
          filter: 'blur(80px)'
        }}
      />
    </div>
  );
}
