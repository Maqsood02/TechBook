import React, { useState, useEffect, useRef } from 'react';
import { Lock, ArrowRight, CheckCircle2, XCircle, Loader2, RefreshCw } from 'lucide-react';

/**
 * Modern, mobile-first OTP Email Verification Modal
 * Supports both new registration and existing student email verification.
 */
export default function OtpVerificationModal({
  isOpen = true,
  onClose,
  initialEmail = '',
  usn = '',
  verificationType = 'verify', // 'verify' for existing student, 'register' for new registration
  onVerificationSuccess,
  apiBaseUrl = 'https://tech-book-two.vercel.app'
}) {
  const [step, setStep] = useState(1); // 1: Email, 2: OTP
  const [email, setEmail] = useState(initialEmail);
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null); // { type: 'error'|'success', message: '' }
  const [cooldown, setCooldown] = useState(0);

  const inputRefs = useRef([]);

  useEffect(() => {
    if (initialEmail) setEmail(initialEmail);
  }, [initialEmail]);

  // Handle Resend Cooldown Countdown
  useEffect(() => {
    let timer;
    if (cooldown > 0) {
      timer = setInterval(() => setCooldown(prev => prev - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [cooldown]);

  // Handle digit box changes
  const handleDigitChange = (index, value) => {
    const digit = value.replace(/\D/g, '').slice(-1);
    const newDigits = [...otpDigits];
    newDigits[index] = digit;
    setOtpDigits(newDigits);

    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    const newDigits = [...otpDigits];
    for (let i = 0; i < pasted.length; i++) {
      newDigits[i] = pasted[i];
    }
    setOtpDigits(newDigits);
    inputRefs.current[Math.min(pasted.length, 5)]?.focus();
  };

  // Step 1: Send OTP
  const handleSendOtp = async (isResend = false) => {
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setStatus({ type: 'error', message: 'Please enter a valid email address.' });
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
          type: verificationType
        })
      });

      const data = await res.json();

      if (data.success) {
        setStatus({ type: 'success', message: 'OTP sent! Please check your inbox and spam folder.' });
        setStep(2);
        setCooldown(60);
        setTimeout(() => inputRefs.current[0]?.focus(), 150);
      } else {
        setStatus({ type: 'error', message: data.error || 'Failed to send OTP.' });
      }
    } catch (err) {
      setStatus({ type: 'error', message: 'Network error. Make sure the server is accessible.' });
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify OTP
  const handleVerifyOtp = async () => {
    const fullOtp = otpDigits.join('');
    if (fullOtp.length !== 6) {
      setStatus({ type: 'error', message: 'Please enter the complete 6-digit OTP code.' });
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
          otp: fullOtp
        })
      });

      const data = await res.json();

      if (data.success) {
        setStatus({ type: 'success', message: 'Email verified successfully! Updating records...' });
        setTimeout(() => {
          if (onVerificationSuccess) onVerificationSuccess(data);
          if (onClose) onClose();
        }, 1200);
      } else {
        setStatus({ type: 'error', message: data.error || 'Incorrect or expired OTP. Please try again.' });
      }
    } catch (err) {
      setStatus({ type: 'error', message: 'Verification failed. Please check your network connection.' });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(15, 23, 42, 0.75)',
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000,
      padding: '16px'
    }}>
      <div style={{
        background: '#ffffff',
        width: '100%',
        maxWidth: '440px',
        borderRadius: '24px',
        padding: '32px 24px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        textAlign: 'center',
        position: 'relative',
        fontFamily: "'Plus Jakarta Sans', 'Poppins', sans-serif"
      }}>
        {/* Security Lock Badge */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '18px' }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: '#eff2fe',
            border: '2px solid #dbeafe',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 8px 16px rgba(61, 90, 241, 0.12)'
          }}>
            <Lock size={30} color="#3d5af1" strokeWidth={2.2} />
          </div>
        </div>

        {/* Title & Subtitle */}
        <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#0f172a', marginBottom: '8px' }}>
          Verify Your Email
        </h2>
        <p style={{ fontSize: '13.5px', color: '#64748b', lineHeight: 1.5, marginBottom: '20px' }}>
          One-time setup required for notifications and security.
        </p>

        {/* Feedback Alert */}
        {status && (
          <div style={{
            padding: '10px 14px',
            borderRadius: '12px',
            fontSize: '13px',
            fontWeight: 500,
            marginBottom: '18px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            textAlign: 'left',
            background: status.type === 'error' ? '#fef2f2' : '#f0fdf4',
            border: `1px solid ${status.type === 'error' ? '#fecaca' : '#bbf7d0'}`,
            color: status.type === 'error' ? '#dc2626' : '#16a34a'
          }}>
            {status.type === 'error' ? <XCircle size={18} /> : <CheckCircle2 size={18} />}
            <span>{status.message}</span>
          </div>
        )}

        {/* Step 1: Input Email */}
        {step === 1 && (
          <div>
            <div style={{ textAlign: 'left', marginBottom: '18px' }}>
              <label style={{
                display: 'block',
                fontSize: '11px',
                fontWeight: 700,
                color: '#0f172a',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                marginBottom: '8px'
              }}>
                Personal Email Address
              </label>
              <input
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendOtp()}
                autoFocus
                style={{
                  width: '100%',
                  padding: '13px 16px',
                  background: '#f8fafc',
                  border: '1.5px solid #e2e8f0',
                  borderRadius: '12px',
                  fontSize: '14.5px',
                  color: '#0f172a',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <button
              onClick={() => handleSendOtp(false)}
              disabled={loading}
              style={{
                width: '100%',
                padding: '14px',
                background: 'linear-gradient(135deg, #3d5af1 0%, #6366f1 100%)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '12px',
                fontSize: '14px',
                fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1,
                boxShadow: '0 8px 18px rgba(61, 90, 241, 0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                touchAction: 'manipulation'
              }}
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin" size={18} />
                  Sending OTP...
                </>
              ) : (
                <>
                  Send OTP
                  <ArrowRight size={18} />
                </>
              )}
            </button>
            <p style={{ fontSize: '11.5px', color: '#94a3b8', marginTop: '12px' }}>
              An OTP will be sent to your email. Valid for 5 minutes.
            </p>
          </div>
        )}

        {/* Step 2: 6-Digit OTP Entry */}
        {step === 2 && (
          <div>
            <div style={{
              background: '#eff2fe',
              border: '1px solid #c7d2fe',
              borderRadius: '12px',
              padding: '10px 14px',
              marginBottom: '18px',
              fontSize: '13px'
            }}>
              <span style={{ color: '#64748b' }}>OTP sent to </span>
              <strong style={{ color: '#3d5af1' }}>{email}</strong>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block',
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '0.08em',
                marginBottom: '8px',
                textTransform: 'uppercase',
                color: '#0f172a'
              }}>
                Enter 6-Digit OTP
              </label>

              <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }} onPaste={handlePaste}>
                {otpDigits.map((digit, index) => (
                  <input
                    key={index}
                    ref={(el) => (inputRefs.current[index] = el)}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleDigitChange(index, e.target.value)}
                    onKeyDown={(e) => {
                      handleKeyDown(index, e);
                      if (e.key === 'Enter' && index === 5) handleVerifyOtp();
                    }}
                    style={{
                      width: '44px',
                      height: '52px',
                      borderRadius: '12px',
                      border: '1.5px solid #c7d2fe',
                      background: '#f8fafc',
                      fontSize: '22px',
                      fontWeight: 700,
                      textAlign: 'center',
                      color: '#0f172a',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                ))}
              </div>
            </div>

            <button
              onClick={handleVerifyOtp}
              disabled={loading || otpDigits.join('').length !== 6}
              style={{
                width: '100%',
                padding: '14px',
                background: 'linear-gradient(135deg, #3d5af1 0%, #6366f1 100%)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '12px',
                fontSize: '14px',
                fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: (loading || otpDigits.join('').length !== 6) ? 0.7 : 1,
                boxShadow: '0 8px 18px rgba(61, 90, 241, 0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                touchAction: 'manipulation'
              }}
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin" size={18} />
                  Verifying...
                </>
              ) : (
                <>
                  Verify OTP
                  <CheckCircle2 size={18} />
                </>
              )}
            </button>

            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: '16px',
              fontSize: '12.5px'
            }}>
              {cooldown > 0 ? (
                <span style={{ color: '#94a3b8' }}>Resend in {cooldown}s</span>
              ) : (
                <button
                  type="button"
                  onClick={() => handleSendOtp(true)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#3d5af1',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: 0
                  }}
                >
                  <RefreshCw size={13} /> Resend OTP
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setStep(1);
                  setOtpDigits(['', '', '', '', '', '']);
                  setStatus(null);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#64748b',
                  cursor: 'pointer',
                  padding: 0
                }}
              >
                Change Email
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
