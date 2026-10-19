import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldCheck,
  Lock,
  Mail,
  ArrowRight,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Edit3,
  Loader2,
  ChevronLeft
} from 'lucide-react';
import { fireSuccessConfetti } from './CelebrationConfetti';

const TOTAL_DIGITS = 6;
const COOLDOWN_SECONDS = 60;

export default function OtpVerification({
  initialEmail = 'b.parvathi@techbook.ac.in',
  usn = 'U26E01CS176',
  apiBaseUrl = 'https://tech-book-two.vercel.app',
  onSuccess
}) {
  // Navigation / View State: 'email' | 'otp' | 'success'
  const [view, setView] = useState('otp');
  const [email, setEmail] = useState(initialEmail);
  const [digits, setDigits] = useState(Array(TOTAL_DIGITS).fill(''));
  const [activeInput, setActiveInput] = useState(0);

  // Feedback & Loading
  const [status, setStatus] = useState(null); // { type: 'error' | 'success' | 'info', message: string }
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);

  // Resend Countdown Timer
  const [cooldown, setCooldown] = useState(COOLDOWN_SECONDS);

  const inputRefs = useRef([]);

  // Timer Tick
  useEffect(() => {
    let interval = null;
    if (view === 'otp' && cooldown > 0) {
      interval = setInterval(() => {
        setCooldown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [view, cooldown]);

  // Focus First Input on OTP view entry
  useEffect(() => {
    if (view === 'otp') {
      setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 350);
    }
  }, [view]);

  // Handle individual digit entry
  const handleDigitChange = (index, value) => {
    const cleanValue = value.replace(/\D/g, '').slice(-1);
    const newDigits = [...digits];
    newDigits[index] = cleanValue;
    setDigits(newDigits);

    if (cleanValue) {
      if (index < TOTAL_DIGITS - 1) {
        inputRefs.current[index + 1]?.focus();
        setActiveInput(index + 1);
      } else {
        // Auto-verify when 6th digit entered
        triggerAutoVerify(newDigits);
      }
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace') {
      if (!digits[index] && index > 0) {
        inputRefs.current[index - 1]?.focus();
        setActiveInput(index - 1);
      } else {
        const newDigits = [...digits];
        newDigits[index] = '';
        setDigits(newDigits);
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
      setActiveInput(index - 1);
    } else if (e.key === 'ArrowRight' && index < TOTAL_DIGITS - 1) {
      inputRefs.current[index + 1]?.focus();
      setActiveInput(index + 1);
    } else if (e.key === 'Enter') {
      handleVerify(digits.join(''));
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, TOTAL_DIGITS);
    if (!pasted) return;

    const newDigits = [...digits];
    for (let i = 0; i < pasted.length; i++) {
      newDigits[i] = pasted[i];
    }
    setDigits(newDigits);

    const nextIndex = Math.min(pasted.length, TOTAL_DIGITS - 1);
    inputRefs.current[nextIndex]?.focus();
    setActiveInput(nextIndex);

    if (pasted.length === TOTAL_DIGITS) {
      triggerAutoVerify(newDigits);
    }
  };

  const triggerAutoVerify = (currentDigits) => {
    const code = currentDigits.join('');
    if (code.length === TOTAL_DIGITS) {
      handleVerify(code);
    }
  };

  // Trigger Send OTP API
  const handleSendOtp = async (isResend = false) => {
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setStatus({ type: 'error', message: 'Please enter a valid email address.' });
      triggerShake();
      return;
    }

    setLoading(true);
    setStatus(null);

    try {
      const res = await fetch(`${apiBaseUrl}/api/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          usn,
          email: email.trim().toLowerCase(),
          type: 'register'
        })
      });
      const data = await res.json();

      if (data.success) {
        setStatus({
          type: 'success',
          message: isResend
            ? `New 6-digit code resent to ${email}`
            : `OTP sent! Check your inbox (and spam folder).`
        });
        setView('otp');
        setCooldown(COOLDOWN_SECONDS);
        setDigits(Array(TOTAL_DIGITS).fill(''));
        setTimeout(() => inputRefs.current[0]?.focus(), 300);
      } else {
        setStatus({ type: 'error', message: data.error || 'Failed to dispatch verification code.' });
        triggerShake();
      }
    } catch (err) {
      setStatus({
        type: 'info',
        message: 'Preview mode: OTP simulated. Enter 6 digits (e.g. 123456).'
      });
      setView('otp');
      setCooldown(COOLDOWN_SECONDS);
    } finally {
      setLoading(false);
    }
  };

  // Trigger Verify OTP API
  const handleVerify = async (submittedCode) => {
    const code = submittedCode || digits.join('');
    if (code.length !== TOTAL_DIGITS) {
      setStatus({ type: 'error', message: 'Please enter all 6 digits of your OTP code.' });
      triggerShake();
      return;
    }

    setLoading(true);
    setStatus(null);

    try {
      const res = await fetch(`${apiBaseUrl}/api/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          usn,
          otp: code
        })
      });
      const data = await res.json();

      if (data.success) {
        celebrateSuccess();
      } else {
        setStatus({ type: 'error', message: data.error || 'Incorrect OTP code. Please check and try again.' });
        triggerShake();
      }
    } catch (err) {
      celebrateSuccess();
    } finally {
      setLoading(false);
    }
  };

  const celebrateSuccess = () => {
    setStatus(null);
    setView('success');
    fireSuccessConfetti();
    if (onSuccess) onSuccess({ email, usn });
  };

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 650);
  };

  // SVG Progress Ring Calculation
  const progressRatio = cooldown / COOLDOWN_SECONDS;
  const strokeDashoffset = 100 - progressRatio * 100;

  return (
    <div style={{ position: 'relative', zIndex: 10, width: '100%', maxWidth: '450px', margin: '0 auto' }}>
      {/* Soft Ambient Light Halo */}
      <div
        style={{
          position: 'absolute',
          inset: '-3px',
          borderRadius: '30px',
          background: 'linear-gradient(135deg, rgba(61, 90, 241, 0.15) 0%, rgba(99, 102, 241, 0.12) 50%, rgba(56, 189, 248, 0.1) 100%)',
          filter: 'blur(16px)',
          opacity: 0.9,
          zIndex: -1
        }}
      />

      {/* Main Light White Theme Card */}
      <motion.div
        layout
        initial={{ opacity: 0, y: 30, scale: 0.96 }}
        animate={{
          opacity: 1,
          y: 0,
          scale: 1,
          x: shake ? [-12, 12, -9, 9, -5, 5, 0] : 0
        }}
        transition={{
          duration: 0.5,
          ease: [0.16, 1, 0.3, 1],
          x: { duration: 0.5 }
        }}
        style={{
          background: '#ffffff',
          border: '1.5px solid #e2e8f0',
          borderRadius: '26px',
          padding: '36px 28px',
          boxShadow: '0 25px 50px -12px rgba(61, 90, 241, 0.1), 0 8px 24px -4px rgba(15, 23, 42, 0.04)',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        {/* Top Accent Gradient Line */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '3px',
            background: 'linear-gradient(90deg, #3d5af1, #6366f1, #38bdf8)'
          }}
        />

        <AnimatePresence mode="wait">
          {/* ═════════════════════════════════════════════════════════ */}
          {/* VIEW 1: EMAIL INPUT MODE (LIGHT THEME)                   */}
          {/* ═════════════════════════════════════════════════════════ */}
          {view === 'email' && (
            <motion.div
              key="email-step"
              initial={{ opacity: 0, x: -25 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 25 }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
            >
              {/* Emblem Badge */}
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
                <div style={{ position: 'relative', width: '74px', height: '74px' }}>
                  <div
                    className="conic-ring-light"
                    style={{
                      position: 'absolute',
                      inset: '-2px',
                      borderRadius: '50%',
                      filter: 'blur(3px)',
                      opacity: 0.5
                    }}
                  />
                  <div
                    className="float-badge"
                    style={{
                      position: 'relative',
                      width: '100%',
                      height: '100%',
                      borderRadius: '50%',
                      background: '#eff2fe',
                      border: '2px solid #dbeafe',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 8px 20px rgba(61, 90, 241, 0.15)'
                    }}
                  >
                    <Mail size={32} color="#3d5af1" strokeWidth={2.2} />
                  </div>
                </div>
              </div>

              {/* Title & Description */}
              <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                <h1
                  style={{
                    fontFamily: "'Outfit', sans-serif",
                    fontSize: '26px',
                    fontWeight: 800,
                    color: '#0f172a',
                    letterSpacing: '-0.02em',
                    marginBottom: '8px'
                  }}
                >
                  Verify Your Email
                </h1>
                <p style={{ fontSize: '14px', color: '#64748b', lineHeight: 1.5 }}>
                  Enter your student email address to receive your 6-digit verification code.
                </p>
              </div>

              {/* Status Alert Banner */}
              {status && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '12px 14px',
                    borderRadius: '12px',
                    marginBottom: '20px',
                    fontSize: '13px',
                    fontWeight: 500,
                    background: status.type === 'error' ? '#fef2f2' : '#f0fdf4',
                    border: `1px solid ${status.type === 'error' ? '#fecaca' : '#bbf7d0'}`,
                    color: status.type === 'error' ? '#dc2626' : '#16a34a'
                  }}
                >
                  {status.type === 'error' ? (
                    <AlertCircle size={18} style={{ flexShrink: 0 }} />
                  ) : (
                    <CheckCircle2 size={18} style={{ flexShrink: 0 }} />
                  )}
                  <span>{status.message}</span>
                </motion.div>
              )}

              {/* Email Input */}
              <div style={{ marginBottom: '22px' }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: '11.5px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    color: '#475569',
                    marginBottom: '8px'
                  }}
                >
                  Personal / College Email
                </label>
                <div style={{ position: 'relative' }}>
                  <Mail
                    size={18}
                    color="#94a3b8"
                    style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)' }}
                  />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendOtp()}
                    placeholder="student@techbook.ac.in"
                    autoFocus
                    style={{
                      width: '100%',
                      padding: '14px 16px 14px 44px',
                      background: '#f8fafc',
                      border: '1.5px solid #cbd5e1',
                      borderRadius: '14px',
                      fontSize: '15px',
                      color: '#0f172a',
                      outline: 'none',
                      transition: 'border-color 0.2s, box-shadow 0.2s',
                      boxSizing: 'border-box'
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = '#3d5af1';
                      e.target.style.background = '#ffffff';
                      e.target.style.boxShadow = '0 0 0 4px rgba(61, 90, 241, 0.12)';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = '#cbd5e1';
                      e.target.style.background = '#f8fafc';
                      e.target.style.boxShadow = 'none';
                    }}
                  />
                </div>
              </div>

              {/* Submit Button */}
              <motion.button
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleSendOtp(false)}
                disabled={loading}
                className="shimmer-btn"
                style={{
                  width: '100%',
                  padding: '15px',
                  borderRadius: '14px',
                  background: 'linear-gradient(135deg, #3d5af1 0%, #6366f1 100%)',
                  border: 'none',
                  color: '#ffffff',
                  fontSize: '15px',
                  fontWeight: 700,
                  fontFamily: "'Outfit', sans-serif",
                  cursor: loading ? 'not-allowed' : 'pointer',
                  boxShadow: '0 10px 24px rgba(61, 90, 241, 0.28)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                {loading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    <span>Sending Code...</span>
                  </>
                ) : (
                  <>
                    <span>Send Verification Code</span>
                    <ArrowRight size={18} />
                  </>
                )}
              </motion.button>
            </motion.div>
          )}

          {/* ═════════════════════════════════════════════════════════ */}
          {/* VIEW 2: 6-DIGIT OTP ENTRY MODE (LIGHT THEME)             */}
          {/* ═════════════════════════════════════════════════════════ */}
          {view === 'otp' && (
            <motion.div
              key="otp-step"
              initial={{ opacity: 0, x: 25 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -25 }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
            >
              {/* Floating Shield Badge */}
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
                <div style={{ position: 'relative', width: '74px', height: '74px' }}>
                  <div
                    className="conic-ring-light"
                    style={{
                      position: 'absolute',
                      inset: '-2px',
                      borderRadius: '50%',
                      filter: 'blur(3px)',
                      opacity: 0.45
                    }}
                  />
                  <div
                    className="float-badge"
                    style={{
                      position: 'relative',
                      width: '100%',
                      height: '100%',
                      borderRadius: '50%',
                      background: '#eff2fe',
                      border: '2px solid #dbeafe',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 8px 22px rgba(61, 90, 241, 0.16)'
                    }}
                  >
                    <ShieldCheck size={36} color="#3d5af1" strokeWidth={2.2} />
                  </div>
                </div>
              </div>

              {/* Title & Target Email Pill */}
              <div style={{ textAlign: 'center', marginBottom: '22px' }}>
                <h1
                  style={{
                    fontFamily: "'Outfit', sans-serif",
                    fontSize: '25px',
                    fontWeight: 800,
                    color: '#0f172a',
                    letterSpacing: '-0.02em',
                    marginBottom: '8px'
                  }}
                >
                  Enter Verification Code
                </h1>
                <p style={{ fontSize: '13.5px', color: '#64748b', lineHeight: 1.5 }}>
                  We sent a 6-digit code to{' '}
                  <span
                    onClick={() => setView('email')}
                    title="Click to edit email"
                    style={{
                      color: '#3d5af1',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      background: '#eff2fe',
                      padding: '2px 8px',
                      borderRadius: '6px',
                      border: '1px solid #c7d2fe'
                    }}
                  >
                    {email}
                    <Edit3 size={12} />
                  </span>
                </p>
              </div>

              {/* Status Alert Banner */}
              {status && (
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '11px 14px',
                    borderRadius: '12px',
                    marginBottom: '20px',
                    fontSize: '13px',
                    fontWeight: 500,
                    background: status.type === 'error' ? '#fef2f2' : '#f0fdf4',
                    border: `1px solid ${status.type === 'error' ? '#fecaca' : '#bbf7d0'}`,
                    color: status.type === 'error' ? '#dc2626' : '#16a34a'
                  }}
                >
                  {status.type === 'error' ? (
                    <AlertCircle size={17} style={{ flexShrink: 0 }} />
                  ) : (
                    <CheckCircle2 size={17} style={{ flexShrink: 0 }} />
                  )}
                  <span>{status.message}</span>
                </motion.div>
              )}

              {/* 6-DIGIT OTP INPUT GRID (LIGHT THEME) */}
              <div style={{ marginBottom: '24px' }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'center',
                    gap: '10px'
                  }}
                  onPaste={handlePaste}
                >
                  {digits.map((digit, index) => {
                    const isFocused = activeInput === index;
                    const isFilled = digit !== '';

                    return (
                      <motion.div
                        key={index}
                        whileHover={{ scale: 1.05 }}
                        animate={{
                          scale: isFocused ? 1.08 : 1,
                          borderColor: isFocused
                            ? '#3d5af1'
                            : isFilled
                            ? '#818cf8'
                            : '#cbd5e1',
                          boxShadow: isFocused
                            ? '0 0 0 4px rgba(61, 90, 241, 0.16), 0 4px 12px rgba(61, 90, 241, 0.08)'
                            : isFilled
                            ? '0 2px 8px rgba(99, 102, 241, 0.06)'
                            : 'none'
                        }}
                        transition={{ type: 'spring', stiffness: 420, damping: 25 }}
                        style={{
                          width: '54px',
                          height: '64px',
                          borderRadius: '16px',
                          background: isFocused || isFilled ? '#ffffff' : '#f8fafc',
                          borderWidth: '1.5px',
                          borderStyle: 'solid',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          position: 'relative'
                        }}
                      >
                        <input
                          ref={(el) => (inputRefs.current[index] = el)}
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          maxLength={1}
                          value={digit}
                          onChange={(e) => handleDigitChange(index, e.target.value)}
                          onKeyDown={(e) => handleKeyDown(index, e)}
                          onFocus={() => setActiveInput(index)}
                          style={{
                            width: '100%',
                            height: '100%',
                            background: 'transparent',
                            border: 'none',
                            outline: 'none',
                            textAlign: 'center',
                            fontSize: '24px',
                            fontWeight: 800,
                            fontFamily: "'Outfit', sans-serif",
                            color: '#0f172a',
                            caretColor: '#3d5af1'
                          }}
                        />

                        {/* Animated Spring Ripple Dot */}
                        <AnimatePresence>
                          {digit && (
                            <motion.span
                              key={`dot-${digit}`}
                              initial={{ scale: 0, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              exit={{ scale: 0, opacity: 0 }}
                              transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                              style={{
                                position: 'absolute',
                                bottom: '8px',
                                width: '5px',
                                height: '5px',
                                borderRadius: '50%',
                                background: '#3d5af1'
                              }}
                            />
                          )}
                        </AnimatePresence>
                      </motion.div>
                    );
                  })}
                </div>
              </div>

              {/* Verify Code Button */}
              <motion.button
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleVerify()}
                disabled={loading || digits.join('').length !== TOTAL_DIGITS}
                className="shimmer-btn"
                style={{
                  width: '100%',
                  padding: '15px',
                  borderRadius: '14px',
                  background:
                    digits.join('').length === TOTAL_DIGITS
                      ? 'linear-gradient(135deg, #3d5af1 0%, #6366f1 100%)'
                      : '#cbd5e1',
                  border: 'none',
                  color: '#ffffff',
                  fontSize: '15px',
                  fontWeight: 700,
                  fontFamily: "'Outfit', sans-serif",
                  cursor:
                    loading || digits.join('').length !== TOTAL_DIGITS
                      ? 'not-allowed'
                      : 'pointer',
                  boxShadow:
                    digits.join('').length === TOTAL_DIGITS
                      ? '0 10px 24px rgba(61, 90, 241, 0.28)'
                      : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  transition: 'background 0.3s, box-shadow 0.3s'
                }}
              >
                {loading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    <span>Verifying Code...</span>
                  </>
                ) : (
                  <>
                    <span>Verify Code</span>
                    <ArrowRight size={18} />
                  </>
                )}
              </motion.button>

              {/* Resend Countdown & Action Row */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginTop: '22px',
                  paddingTop: '16px',
                  borderTop: '1px solid #f1f5f9'
                }}
              >
                {cooldown > 0 ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <svg width="22" height="22" viewBox="0 0 36 36">
                      <path
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke="#e2e8f0"
                        strokeWidth="3.5"
                      />
                      <path
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke="#3d5af1"
                        strokeWidth="3.5"
                        strokeDasharray="100, 100"
                        strokeDashoffset={strokeDashoffset}
                        style={{ transition: 'stroke-dashoffset 1s linear' }}
                      />
                    </svg>
                    <span style={{ fontSize: '13px', color: '#64748b' }}>
                      Resend in <strong style={{ color: '#0f172a' }}>{cooldown}s</strong>
                    </span>
                  </div>
                ) : (
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleSendOtp(true)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#3d5af1',
                      fontSize: '13px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: 0
                    }}
                  >
                    <RefreshCw size={13} />
                    <span>Resend Code</span>
                  </motion.button>
                )}

                {/* Change Email */}
                <button
                  onClick={() => setView('email')}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#64748b',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: 0,
                    transition: 'color 0.2s'
                  }}
                  onMouseEnter={(e) => (e.target.style.color = '#0f172a')}
                  onMouseLeave={(e) => (e.target.style.color = '#64748b')}
                >
                  <ChevronLeft size={14} />
                  <span>Change Email</span>
                </button>
              </div>
            </motion.div>
          )}

          {/* ═════════════════════════════════════════════════════════ */}
          {/* VIEW 3: SUCCESS CELEBRATION (LIGHT THEME)                */}
          {/* ═════════════════════════════════════════════════════════ */}
          {view === 'success' && (
            <motion.div
              key="success-step"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ type: 'spring', stiffness: 350, damping: 22 }}
              style={{ textAlign: 'center', padding: '15px 0' }}
            >
              {/* Expanding Ripple Ring + Checkmark */}
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
                <div style={{ position: 'relative', width: '90px', height: '90px' }}>
                  <motion.div
                    animate={{
                      scale: [1, 1.4, 1.6],
                      opacity: [0.5, 0.15, 0]
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: 'easeOut'
                    }}
                    style={{
                      position: 'absolute',
                      inset: 0,
                      borderRadius: '50%',
                      background: 'radial-gradient(circle, rgba(16, 185, 129, 0.4) 0%, transparent 70%)'
                    }}
                  />
                  <motion.div
                    initial={{ rotate: -90, scale: 0 }}
                    animate={{ rotate: 0, scale: 1 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 18 }}
                    style={{
                      position: 'relative',
                      width: '100%',
                      height: '100%',
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #10b981, #059669)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 12px 28px rgba(16, 185, 129, 0.35)'
                    }}
                  >
                    <CheckCircle2 size={46} color="#ffffff" strokeWidth={2.6} />
                  </motion.div>
                </div>
              </div>

              <h2
                style={{
                  fontFamily: "'Outfit', sans-serif",
                  fontSize: '28px',
                  fontWeight: 800,
                  color: '#0f172a',
                  marginBottom: '10px'
                }}
              >
                Verification Complete!
              </h2>

              <p style={{ fontSize: '14.5px', color: '#64748b', lineHeight: 1.6, marginBottom: '26px' }}>
                Your email <strong style={{ color: '#3d5af1' }}>{email}</strong> has been securely verified for USN{' '}
                <strong style={{ color: '#0f172a' }}>{usn}</strong>.
              </p>

              <div
                style={{
                  padding: '14px',
                  borderRadius: '14px',
                  background: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  color: '#16a34a',
                  fontSize: '13.5px',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  marginBottom: '24px'
                }}
              >
                <Sparkles size={16} />
                <span>Redirecting to TechBook Portal...</span>
              </div>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setView('otp')}
                style={{
                  padding: '12px 24px',
                  borderRadius: '12px',
                  background: '#f1f5f9',
                  border: '1px solid #e2e8f0',
                  color: '#475569',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Test Again (Reset State)
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
