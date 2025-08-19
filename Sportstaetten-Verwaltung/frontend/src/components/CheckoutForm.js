import React from 'react';
import { useStripe } from '@stripe/react-stripe-js';
import { Button, Box, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';

const CheckoutForm = ({ sessionId }) => {
  const { t } = useTranslation();
  const stripe = useStripe();

  const handleSubmit = async () => {
    if (!stripe) return;
    const { error } = await stripe.redirectToCheckout({ sessionId });
    if (error) {
      alert(error.message);
    }
  };

  return (
    <Box sx={{ maxWidth: 400, mx: 'auto', mt: 4 }}>
      <Typography variant="h4" gutterBottom>{t('payNow')}</Typography>
      <Button variant="contained" onClick={handleSubmit} fullWidth>{t('payNow')}</Button>
    </Box>
  );
};

export default CheckoutForm;