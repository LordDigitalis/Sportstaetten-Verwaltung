import React, { useState } from 'react';
import { Typography, Box, FormControlLabel, Checkbox, Button, CircularProgress } from '@mui/material';
import axios from 'axios';
import { useTranslation } from 'react-i18next';

const Settings = () => {
  const { t } = useTranslation();
  const [pushEnabled, setPushEnabled] = useState(false);
  const [loading, setLoading] = useState(false);

  const handlePushToggle = async () => {
    setLoading(true);
    const token = localStorage.getItem('token');
    try {
      await axios.post('http://localhost:5000/settings/push', { enabled: !pushEnabled }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setPushEnabled(!pushEnabled);
      alert(t('pushSettingsUpdated'));
    } catch (err) {
      alert(err.response?.data?.message || t('error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 600, mx: 'auto', mt: 4 }}>
      <Typography variant="h4" gutterBottom>{t('settings')}</Typography>
      <FormControlLabel
        control={<Checkbox checked={pushEnabled} onChange={handlePushToggle} disabled={loading} />}
        label={t('enablePushNotifications')}
      />
      {loading && <CircularProgress size={24} />}
    </Box>
  );
};

export default Settings;