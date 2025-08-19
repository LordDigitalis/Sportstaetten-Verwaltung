import React, { useState } from 'react';
import axios from 'axios';

const ContactForm = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');

  const handleSubmit = async () => {
    await axios.post('http://localhost:5000/contact', { name, email, message });
    alert('Anfrage gesendet');
  };

  return (
    <div>
      <h2>Kontaktanfrage</h2>
      <input value={name} onChange={e => setName(e.target.value)} placeholder="Name" />
      <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="E-Mail" />
      <textarea value={message} onChange={e => setMessage(e.target.value)} placeholder="Nachricht" />
      <button onClick={handleSubmit}>Senden</button>
    </div>
  );
};

export default ContactForm;