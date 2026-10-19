import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { BookOpen, RotateCcw } from 'lucide-react';
import OtpVerification from './components/OtpVerification';
import BackgroundOrbs from './components/BackgroundOrbs';

export default function App() {
  const [demoKey, setDemoKey] = useState(0);

  return (
    <div
      style={{
        minHeight: '100vh',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
        position: 'relative',
        background: '#f8fafc'
      }}
    >
      {/* Light Theme Background Meshes & Dots */}
      <BackgroundOrbs />

      {/* Header Branding */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        style={{
          position: 'fixed',
          top: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '8px 18px',
          borderRadius: '9999px',
          background: 'rgba(255, 255, 255, 0.9)',
          backdropFilter: 'blur(16px)',
          border: '1.5px solid #e2e8f0',
          zIndex: 50,
          boxShadow: '0 8px 24px rgba(61, 90, 241, 0.08)'
        }}
      >
        <div
          style={{
            width: '28px',
            height: '28px',
            borderRadius: '8px',
            background: 'linear-gradient(135deg, #3d5af1, #6366f1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <BookOpen size={16} color="#ffffff" />
        </div>
        <span
          style={{
            fontFamily: "'Outfit', sans-serif",
            fontSize: '15px',
            fontWeight: 800,
            letterSpacing: '-0.02em',
            color: '#0f172a'
          }}
        >
          TechBook
        </span>
        <span
          style={{
            fontSize: '11px',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            padding: '2px 8px',
            borderRadius: '9999px',
            background: '#eff2fe',
            border: '1px solid #c7d2fe',
            color: '#3d5af1'
          }}
        >
          Auth V2
        </span>
      </motion.header>

      {/* Main Interactive OTP Card */}
      <main style={{ width: '100%', display: 'flex', justifyContent: 'center', zIndex: 10 }}>
        <OtpVerification
          key={demoKey}
          initialEmail="b.parvathi@techbook.ac.in"
          usn="U26E01CS176"
          apiBaseUrl="https://tech-book-two.vercel.app"
          onSuccess={(details) => {
            console.log('Verification Success:', details);
          }}
        />
      </main>

      {/* Footer Info / Controls */}
      <motion.footer
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5, duration: 0.8 }}
        style={{
          marginTop: '28px',
          zIndex: 10,
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          fontSize: '12px',
          color: '#64748b'
        }}
      >
        <button
          onClick={() => setDemoKey((k) => k + 1)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 14px',
            borderRadius: '9999px',
            background: '#ffffff',
            border: '1.5px solid #e2e8f0',
            color: '#475569',
            cursor: 'pointer',
            boxShadow: '0 2px 6px rgba(0, 0, 0, 0.04)',
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = '#0f172a';
            e.currentTarget.style.borderColor = '#cbd5e1';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = '#475569';
            e.currentTarget.style.borderColor = '#e2e8f0';
          }}
        >
          <RotateCcw size={12} />
          <span>Reset Demo</span>
        </button>
        <span>•</span>
        <span>Secure 256-Bit SHA Encryption</span>
      </motion.footer>
    </div>
  );
}
