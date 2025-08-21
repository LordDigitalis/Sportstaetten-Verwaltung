import React, { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import { PayPalButtons, PayPalScriptProvider } from '@paypal/react-paypal-js';
import { Box, Typography, FormControl, InputLabel, Select, MenuItem, Button, CircularProgress } from '@mui/material';
import axios from 'axios';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const stripePromise = loadStripe(process.env.REACT_APP_STRIPE_PUBLIC_KEY);

const Payment = () => {
  const { t } = useTranslation();
  const { bookingId } = useParams();
  const [paymentMethod, setPaymentMethod] = useState('');
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [qrCode, setQrCode] = useState('');

  useEffect(() => {
    const fetchBooking = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get(`http://localhost:5000/bookings`, { headers: { Authorization: `Bearer ${token}` } });
        const bookingData = res.data.find(b => b.id === parseInt(bookingId));
        setBooking(bookingData);
        if (bookingData.payment_status === 'unpaid') {
          const qrRes = await axios.get(`http://localhost:5000/invoices/${bookingId}`, { headers: { Authorization: `Bearer ${token}` } });
          setQrCode(qrRes.data.qrCodeUrl);
        }
      } catch (err) {
        alert(err.response?.data?.message || t('error'));
      } finally {
        setLoading(false);
      }
    };
    fetchBooking();
  }, [bookingId]);

  const handleStripePayment = async () => {
    setLoading(true);
    try {
      const stripe = await stripePromise;
      await stripe.redirectToCheckout({ sessionId: booking.stripeSessionId });
    } catch (err) {
      alert(t('error'));
    } finally {
      setLoading(false);
    }
  };

  const handlePaypalPayment = () => {
    // PayPalButtons handles the flow
  };

  return (
    <Box sx={{ maxWidth: 400, mx: 'auto', mt: 4 }}>
      <Typography variant="h4" gutterBottom>{t('payNow')}</Typography>
      {loading || !booking ? (
        <CircularProgress />
      ) : (
        <>
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>{t('selectPaymentMethod')}</InputLabel>
            <Select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
              <MenuItem value="stripe">{t('stripe')}</MenuItem>
              <MenuItem value="paypal">{t('paypal')}</MenuItem>
              <MenuItem value="sofort">{t('sofort')}</MenuItem>
            </Select>
          </FormControl>
          {paymentMethod === 'stripe' && (
            <Button variant="contained" onClick={handleStripePayment} disabled={loading}>
              {loading ? <CircularProgress size={24} /> : t('payNow')}
            </Button>
          )}
          {paymentMethod === 'paypal' && (
            <PayPalScriptProvider options={{ "client-id": process.env.REACT_APP_PAYPAL_CLIENT_ID }}>
              <PayPalButtons
                createOrder={(data, actions) => actions.order.create({
                  purchase_units: [{ amount: { value: booking.total.toFixed(2), currency_code: 'EUR' }, custom_id: booking.id.toString() }]
                })}
                onApprove={(data, actions) => actions.order.capture().then(() => {
                  axios.put(`http://localhost:5000/bookings/${bookingId}/update-payment`, { payment_status: 'paid', payment_method: 'paypal' }, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
                    .then(() => window.location.href = '/success')
                    .catch(err => alert(err.response?.data?.message || t('error')));
                })}
              />
            </PayPalScriptProvider>
          )}
          {paymentMethod === 'sofort' && (
            <Box>
              <Typography>{t('sofort')}</Typography>
              <img src={qrCode} alt="QR Code" style={{ width: '100px' }} />
              <Typography>Scannen Sie den QR-Code mit Ihrer Bank-App.</Typography>
            </Box>
          )}
        </>
      )}
    </Box>
  );
};

export default Payment;