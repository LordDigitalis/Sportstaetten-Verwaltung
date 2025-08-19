import React, { useState } from 'react';
import { TextField, Button, Typography, Box, FormControlLabel, Checkbox } from '@mui/material';
import axios from 'axios';
import { useTranslation } from 'react-i18next';

const Register = () => {
  const { t } = useTranslation();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [consent, setConsent] = useState(false);

  const handleRegister = async () => {
    if (!consent) return alert(t('consent'));
    try {
      await axios.post('http://localhost:5000/register', { username, email, password, consent });
      window.location.href = '/login';
    } catch (err) {
      alert(err.response?.data?.message || 'Registrierung fehlgeschlagen');
    }
  };

  return (
    <Box sx={{ maxWidth: 400, mx: 'auto', mt: 4 }}>
      <Typography variant="h4" gutterBottom>{t('register')}</Typography>
      <TextField fullWidth label={t('username')} value={username} onChange={e => setUsername(e.target.value)} margin="normal" />
      <TextField fullWidth label={t('email')} type="email" value={email} onChange={e => setEmail(e.target.value)} margin="normal" />
      <TextField fullWidth label={t('password')} type="password" value={password} onChange={e => setPassword(e.target.value)} margin="normal" />
      <FormControlLabel
        control={<Checkbox checked={consent} onChange={e => setConsent(e.target.checked)} />}
        label={t('consent')}
      />
      <Button variant="contained" onClick={handleRegister} fullWidth sx={{ mt: 2 }}>{t('register')}</Button>
    </Box>
  );
};

export default Register;