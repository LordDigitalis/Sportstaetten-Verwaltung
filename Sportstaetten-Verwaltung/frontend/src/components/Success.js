import React from 'react';
import { Typography, Box } from '@mui/material';
import { useTranslation } from 'react-i18next';

const Success = () => {
  const { t } = useTranslation();
  return (
    <Box sx={{ m: 4 }}>
      <Typography variant="h4" gutterBottom>{t('success')}</Typography>
      <Typography>{t('paymentSuccess')}</Typography>
    </Box>
  );
};

export default Success;