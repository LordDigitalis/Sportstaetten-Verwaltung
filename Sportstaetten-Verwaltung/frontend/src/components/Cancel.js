import React from 'react';
import { Typography, Box } from '@mui/material';
import { useTranslation } from 'react-i18next';

const Cancel = () => {
  const { t } = useTranslation();
  return (
    <Box sx={{ m: 4 }}>
      <Typography variant="h4" gutterBottom>{t('cancel')}</Typography>
      <Typography>{t('paymentCancelled')}</Typography>
    </Box>
  );
};

export default Cancel;