import React, { useState } from 'react';
import { TextField, Button, Typography, Box } from '@mui/material';
import axios from 'axios';
import { useTranslation } from 'react-i18next';

const ContactForm = () => {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');

  const handleSubmit = async () => {
    try {
      await axios.post('http://localhost:5000/contact', { name, email, message });
      alert(t('requestSent'));
      setName('');
      setEmail('');
      setMessage('');
    } catch (err) {
      alert(err.response?.data?.message || t('errorSending'));
    }
  };

  return (
    <Box sx={{ maxWidth: 400, mx: 'auto', mt: 4 }}>
      <Typography variant="h4" gutterBottom>{t('contact')}</Typography>
      <TextField fullWidth label={t('name')} value={name} onChange={e => setName(e.target.value)} margin="normal" />
      <TextField fullWidth label={t('email')} type="email" value={email} onChange={e => setEmail(e.target.value)} margin="normal" />
      <TextField fullWidth label={t('message')} multiline rows={4} value={message} onChange={e => setMessage(e.target.value)} margin="normal" />
      <Button variant="contained" onClick={handleSubmit} fullWidth sx={{ mt: 2 }}>{t('submit')}</Button>
    </Box>
  );
};

export default ContactForm;