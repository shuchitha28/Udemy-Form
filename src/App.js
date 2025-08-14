import React, { useEffect, useMemo, useRef, useState } from 'react';
import './App.css';

const schema = {
  meta: {
    title: 'Udyam Registration — Prototype',
    steps: ['Aadhaar & OTP', 'PAN Validation'],
  },
  steps: [
    {
      key: 'aadhaar',
      title: 'Step 1 — Aadhaar & OTP Verification',
      description: 'Enter Aadhaar details to receive and verify OTP (simulated).',
      fields: [
        { name: 'aadhaarName', label: 'Name (as per Aadhaar)', type: 'text', placeholder: 'Full name', required: true, maxLength: 60 },
        { name: 'aadhaarNumber', label: 'Aadhaar Number', type: 'text', inputMode: 'numeric', placeholder: '12-digit Aadhaar', required: true, pattern: /^\d{12}$/ },
        { name: 'mobile', label: 'Mobile (linked to Aadhaar)', type: 'tel', placeholder: '10-digit mobile', required: true, pattern: /^[6-9]\d{9}$/ },
        { name: 'pincode', label: 'PIN Code', type: 'text', inputMode: 'numeric', placeholder: 'e.g., 560001', required: true, pattern: /^\d{6}$/ },
        { name: 'state', label: 'State', type: 'text', placeholder: 'Auto-filled from PIN', required: true, readOnly: true },
        { name: 'city', label: 'City/District', type: 'text', placeholder: 'Auto-filled from PIN', required: true, readOnly: true },
      ],
    },
    {
      key: 'pan',
      title: 'Step 2 — PAN Validation',
      description: 'Provide PAN to proceed. Client-side format check applies.',
      fields: [
        { name: 'panHolder', label: 'Name (as per PAN)', type: 'text', placeholder: 'Full name', required: true, maxLength: 60 },
        { name: 'panNumber', label: 'PAN Number', type: 'text', placeholder: 'ABCDE1234F', required: true, pattern: /^[A-Z]{5}[0-9]{4}[A-Z]$/ },
      ],
    },
  ],
};

const validators = {
  aadhaarNumber: (v) => (/^\d{12}$/.test(v) ? '' : 'Aadhaar must be exactly 12 digits.'),
  mobile: (v) => (/^[6-9]\d{9}$/.test(v) ? '' : 'Enter a valid 10-digit Indian mobile.'),
  pincode: (v) => (/^\d{6}$/.test(v) ? '' : 'PIN must be 6 digits.'),
  panNumber: (v) => (/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(v) ? '' : 'PAN format should be AAAAA9999A.'),
  aadhaarName: (v) => (v?.trim().length ? '' : 'Name is required.'),
  panHolder: (v) => (v?.trim().length ? '' : 'Name is required.'),
};

const PIN_LOCAL = {
  '560001': { state: 'Karnataka', city: 'Bengaluru' },
  '110001': { state: 'Delhi', city: 'New Delhi' },
  '400001': { state: 'Maharashtra', city: 'Mumbai' },
  '700001': { state: 'West Bengal', city: 'Kolkata' },
  '600001': { state: 'Tamil Nadu', city: 'Chennai' },
};

async function lookupPin(pin) {
  if (!/^\d{6}$/.test(pin)) return null;
  try {
    const res = await fetch(`https://api.postalpincode.in/pincode/${pin}`);
    const data = await res.json();
    const first = data?.[0];
    if (first?.Status === 'Success') {
      const po = first?.PostOffice?.[0];
      return { state: po?.State, city: po?.District };
    }
  } catch {}
  return PIN_LOCAL[pin] ?? null;
}

const Stepper = ({ steps, active }) => (
  <div className="stepper">
    {steps.map((s, i) => (
      <div key={s} className={`step${i === active ? ' active' : ''}`}>
        <span className="dot" />
        <span>{i + 1}. {s}</span>
      </div>
    ))}
  </div>
);

const Field = ({ f, value, error, onChange, onBlur }) => {
  const common = {
    name: f.name,
    id: f.name,
    placeholder: f.placeholder || '',
    required: !!f.required,
    readOnly: !!f.readOnly,
    maxLength: f.maxLength || undefined,
    inputMode: f.inputMode || undefined,
    value: value ?? '',
    onChange: (e) => onChange(f.name, e.target.value),
    onBlur: () => onBlur?.(f.name),
  };
  return (
    <div className="field">
      <label htmlFor={f.name}>{f.label} {f.required && <span className="pill">Required</span>}</label>
      {f.type === 'select' ? (
        <select {...common}>
          {(f.options || []).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ) : (
        <input type={f.type || 'text'} {...common} />
      )}
      <div className="err">{error || ''}</div>
    </div>
  );
};

const OTPBox = ({ value, setValue, disabled, length = 6 }) => {
  const refs = useRef([]);
  useEffect(() => { refs.current = refs.current.slice(0, length); }, [length]);
  const digits = value.padEnd(length, ' ').slice(0, length).split('');
  const onKey = (i, e) => {
    const k = e.key;
    if (k === 'Backspace') {
      e.preventDefault();
      const v = value.slice(0, Math.max(0, i - 1)) + value.slice(i);
      setValue(v);
      if (i > 0) refs.current[i - 1].focus();
    } else if (/^[0-9]$/.test(k)) {
      e.preventDefault();
      const v = (value.slice(0, i) + k + value.slice(i + 1)).slice(0, length);
      setValue(v);
      if (i < length - 1) refs.current[i + 1].focus();
    }
  };
  return (
    <div className="otpbox">
      {digits.map((d, i) => (
        <input key={i} ref={el => refs.current[i] = el} inputMode="numeric" maxLength={1}
          value={d.trim()} disabled={disabled}
          onKeyDown={(e) => onKey(i, e)} />
      ))}
    </div>
  );
};

function App() {
  const [active, setActive] = useState(0);
  const [form, setForm] = useState({ aadhaarName:'', aadhaarNumber:'', mobile:'', pincode:'', state:'', city:'', panHolder:'', panNumber:'' });
  const [errors, setErrors] = useState({});
  const [otpSent, setOtpSent] = useState(false);
  const [otpServer, setOtpServer] = useState('');
  const [otpInput, setOtpInput] = useState('');
  const [otpVerified, setOtpVerified] = useState(false);
  const [showJSON, setShowJSON] = useState(null);
  const [otpMessage, setOtpMessage] = useState(null);

  const step = schema.steps[active];

  useEffect(() => {
    const pin = form.pincode || '';
    if (/^\d{6}$/.test(pin)) {
      lookupPin(pin).then(loc => {
        if (loc) setForm(f => ({ ...f, state: loc.state || '', city: loc.city || '' }));
      });
    } else {
      setForm(f => ({ ...f, state: '', city: '' }));
    }
  }, [form.pincode]);

  const setField = (name, value) => {
    setForm(prev => ({ ...prev, [name]: name === 'panNumber' ? value.toUpperCase() : value }));
  };

  const validateField = (name, v = form[name]) => {
    const fn = validators[name];
    const msg = fn ? fn(v || '') : '';
    setErrors(prev => ({ ...prev, [name]: msg }));
    return msg;
  };

  const validateStep = () => {
    const msgs = step.fields.map(f => validateField(f.name));
    return msgs.every(m => !m);
  };

  const sendOtp = () => {
    if (!validateField('aadhaarNumber') && !validateField('mobile')) {
      const code = String(Math.floor(100000 + Math.random()*900000));
      setOtpServer(code);
      setOtpSent(true);
      setOtpVerified(false);
      setOtpInput('');
      setOtpMessage(`Simulated OTP sent to your mobile. (Code: ${code})`);
    }
  };

  const verifyOtp = () => {
    if (otpInput === otpServer && otpInput.length === 6) {
      setOtpVerified(true);
      setOtpMessage("✅ OTP verified successfully.");
    } else {
      setOtpMessage("❌ Invalid OTP. Please try again.");
    }
  };

  const onNext = () => {
    if (!validateStep()) return;
    if (active === 0 && !otpVerified) {
      setOtpMessage("⚠️ Please verify OTP first.");
      return;
    }
    setActive(a => Math.min(a + 1, schema.steps.length - 1));
  };

  const onBack = () => setActive(a => Math.max(a - 1, 0));

  const allValid = useMemo(() =>
    Object.keys(validators).every(k => !validators[k](form[k] || '')) && otpVerified
  , [form, otpVerified]);

  const onSubmit = (e) => {
    e.preventDefault();
    if (!allValid) {
      setOtpMessage("⚠️ Please fix errors before submitting.");
      return;
    }
    const payload = {
      step1: {
        aadhaarName: form.aadhaarName,
        aadhaarNumber: form.aadhaarNumber,
        mobile: form.mobile,
        pincode: form.pincode,
        state: form.state,
        city: form.city,
      },
      step2: {
        panHolder: form.panHolder,
        panNumber: form.panNumber,
      },
      consent: true,
      submittedAt: new Date().toISOString(),
    };
    console.log(payload);
    setShowJSON(payload);
  };

  return (
    <div className="container">
      <div className="card">
        <div className="header">
          <div style={{display:'flex', alignItems:'center', gap:'10px'}}>
            <div>
              <div style={{fontSize:'18px', fontWeight:800}}>Udyam Registration</div>
              <div className="faint" style={{fontSize:'12px'}}>Client-side validations.</div>
            </div>
          </div>
          <span className="badge">Demo / Assignment</span>
        </div>
        <div className="content">
          <div style={{display:'flex', justifyContent:'space-between', marginBottom:16}}>
            <Stepper steps={schema.meta.steps} active={active} />
            <span className="pill">Client-side demo</span>
          </div>
          <div className="divider" />
          <form onSubmit={onSubmit} noValidate>
            <h2>{step.title}</h2>
            <div className="faint" style={{marginBottom:16}}>{step.description}</div>
            <div className="row">
              {step.fields.map(f => (
                <div key={f.name} className="col-6">
                  <Field f={f} value={form[f.name]} error={errors[f.name]}
                    onChange={setField} onBlur={validateField} />
                </div>
              ))}
              {active === 0 && (
                <div className="col-12" style={{display:'grid', gap:12}}>
                  <div className="actions">
                    <button type="button" className="btn" onClick={sendOtp} disabled={otpSent && !otpVerified}>Send OTP</button>
                  </div>
                  {otpMessage && (
                    <div className="otp-card">
                      {otpMessage}
                    </div>
                  )}
                  <div className="field">
                    <label>Enter OTP</label>
                    <OTPBox value={otpInput} setValue={setOtpInput} disabled={!otpSent || otpVerified} />
                    <div className="actions">
                      <button type="button" className="btn primary" onClick={verifyOtp} disabled={!otpSent || otpVerified}>Verify OTP</button>
                      {otpVerified && <span className="pill" style={{background:'#10301f'}}>Verified</span>}
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="divider" />
            <div className="actions" style={{justifyContent:'space-between'}}>
              {active > 0 && <button type="button" className="btn ghost" onClick={onBack}>Back</button>}
              {active < schema.steps.length - 1 ? (
                <button type="button" className="btn primary" onClick={onNext}>Next</button>
              ) : (
                <button type="submit" className="btn success" disabled={!allValid}>Submit</button>
              )}
            </div>
          </form>
          {showJSON && (
            <pre className="json">{JSON.stringify(showJSON, null, 2)}</pre>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
