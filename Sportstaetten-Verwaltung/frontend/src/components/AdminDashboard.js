import React, { useState, useEffect } from 'react';
import { Typography, Box, List, ListItem, ListItemText, Button } from '@mui/material';
import axios from 'axios';
import { useTranslation } from 'react-i18next';

const AdminDashboard = () => {
  const { t } = useTranslation();
  const [bookings, setBookings] = useState([]);
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    axios.get('http://localhost:5000/admin/dashboard', { headers: { Authorization: `Bearer ${token}` } })
      .then(res => setBookings(res.data.bookings))
      .catch(() => alert(t('errorLoading')));
    axios.get('http://localhost:5000/logs', { headers: { Authorization: `Bearer ${token}` } })
      .then(res => setLogs(res.data))
      .catch(() => alert(t('errorLoading')));
  }, []);

  const approve = async (id) => {
    const token = localStorage.getItem('token');
    try {
      const res = await axios.put(`http://localhost:5000/bookings/${id}/approve`, {}, { headers: { Authorization: `Bearer ${token}` } });
      alert(t('approved'));
      window.location.reload();
    } catch (err) {
      alert(err.response?.data?.message || t('error'));
    }
  };

  const reject = async (id) => {
    const token = localStorage.getItem('token');
    try {
      await axios.put(`http://localhost:5000/bookings/${id}/reject`, {}, { headers: { Authorization: `Bearer ${token}` } });
      alert(t('rejected'));
      window.location.reload();
    } catch (err) {
      alert(err.response?.data?.message || t('error'));
    }
  };

  return (
    <Box sx={{ m: 4 }}>
      <Typography variant="h4" gutterBottom>{t('dashboard')}</Typography>
      <Typography variant="h5" gutterBottom>{t('bookings')}</Typography>
      <List>
        {bookings.map(booking => (
          <ListItem key={booking.id}>
            <ListItemText 
              primary={`Raum ${booking.name}, ${booking.start_time} - ${booking.end_time}, Status: ${booking.status}, ${t('paymentStatus')}: ${booking.payment_status}`} 
            />
            {booking.status === 'pending' && (
              <>
                <Button onClick={() => approve(booking.id)} sx={{ mr: 1 }}>{t('approve')}</Button>
                <Button onClick={() => reject(booking.id)} color="error">{t('reject')}</Button>
              </>
            )}
            {booking.status === 'approved' && booking.payment_status === 'unpaid' && (
              <Button href={`/payment/${booking.sessionId}`} sx={{ mr: 1 }}>{t('payNow')}</Button>
            )}
            {booking.status === 'approved' && (
              <Button href={`http://localhost:5000/invoices/${booking.id}`}>{t('invoice')}</Button>
            )}
          </ListItem>
        ))}
      </List>
      <Typography variant="h5" gutterBottom sx={{ mt: 4 }}>{t('logs')}</Typography>
      <List>
        {logs.map(log => (
          <ListItem key={log.id}>
            <ListItemText primary={`${log.created_at}: ${log.type} - ${log.message}`} />
          </ListItem>
        ))}
      </List>
    </Box>
  );
};

export default AdminDashboard;