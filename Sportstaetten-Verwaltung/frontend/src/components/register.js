import React, { useState } from 'react';
import axios from 'axios';

const Register = () => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [consent, setConsent] = useState(false);

  const handleRegister = async () => {
    if (!consent) return alert('Bitte Datenschutz einwilligen (DSGVO)');
    try {
      await axios.post('http://localhost:5000/register', { username, email, password, consent });
      window.location.href = '/login';
    } catch (err) {
      alert('Registration failed');
    }
  };

  return (
    <div>
      <h2>Register</h2>
      <input value={username} onChange={e => setUsername(e.target.value)} placeholder="Username" />
      <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" />
      <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" />
      <label>
        <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} />
        Ich stimme der Datenschutzerklärung zu (DSGVO-konform).
      </label>
      <button onClick={handleRegister}>Register</button>
    </div>
  );
};

export default Register;