import React, { useState } from 'react';
import { TextField, Button, Typography, Box } from '@mui/material';
import axios from 'axios';
import { useTranslation } from 'react-i18next';

const Login = () => {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async () => {
    try {
      const res = await axios.post('http://localhost:5000/login', { email, password });
      localStorage.setItem('token', res.data.token);
      window.location.href = '/calendar';
    } catch (err) {
      alert(err.response?.data?.message || 'Login fehlgeschlagen');
    }
  };

  return (
    <Box sx={{ maxWidth: 400, mx: 'auto', mt: 4 }}>
      <Typography variant="h4" gutterBottom>{t('login')}</Typography>
      <TextField fullWidth label={t('email')} value={email} onChange={e => setEmail(e.target.value)} margin="normal" />
      <TextField fullWidth label={t('password')} type="password" value={password} onChange={e => setPassword(e.target.value)} margin="normal" />
      <Button variant="contained" onClick={handleLogin} fullWidth sx={{ mt: 2 }}>{t('login')}</Button>
      <Typography sx={{ mt: 2 }}>{t('noAccount')} <a href="/register">{t('register')}</a></Typography>
    </Box>
  );
};

export default Login;