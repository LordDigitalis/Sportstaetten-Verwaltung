import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Typography, Box, Button, CircularProgress } from '@mui/material';
import axios from 'axios';
import { useTranslation } from 'react-i18next';

const Payment = () => {
  const { t } = useTranslation();
  const { bookingId } = useParams();
  const navigate = useNavigate();
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    const token = localStorage.getItem('token');
    axios.get(`http://localhost:5000/bookings/${bookingId}`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then(res => {
      setBooking(res.data);
      setLoading(false);
    }).catch(() => {
      alert(t('error'));
      setLoading(false);
    });
  }, [bookingId]);

  const requestRefund = async () => {
    setLoading(true);
    const token = localStorage.getItem('token');
    try {
      await axios.post(`http://localhost:5000/bookings/${bookingId}/refund`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      alert(t('refundSuccessful'));
      navigate('/calendar');
    } catch (err) {
      alert(err.response?.data?.message || t('error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 600, mx: 'auto', mt: 4 }}>
      <Typography variant="h4" gutterBottom>{t('payment')}</Typography>
      {loading || !booking ? (
        <CircularProgress />
      ) : (
        <>
          <Typography variant="h6">Buchung ID: {booking.id}</Typography>
          <Typography>Raum: {booking.room.name}</Typography>
          <Typography>Zeit: {booking.startTime} - {booking.endTime}</Typography>
          <Typography>Zahlungsstatus: {booking.paymentStatus}</Typography>
          {booking.paymentStatus === 'paid' && (
            <Button variant="contained" color="warning" onClick={requestRefund} sx={{ mt: 2 }} disabled={loading}>
              {loading ? <CircularProgress size={24} /> : t('refund')}
            </Button>
          )}
        </>
      )}
    </Box>
  );
};

export default Payment;