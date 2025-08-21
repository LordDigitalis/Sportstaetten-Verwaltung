import React, { useState, useEffect } from 'react';
import { Typography, Box, TextField, Button, CircularProgress } from '@mui/material';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, BarElement, CategoryScale, LinearScale } from 'chart.js';
import { Pie, Bar } from 'react-chartjs-2';

ChartJS.register(ArcElement, Tooltip, Legend, BarElement, CategoryScale, LinearScale);

const Analytics = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [analytics, setAnalytics] = useState({ totalRevenue: 0, bookingCount: 0, bookingsByRoom: {} });
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    setLoading(true);
    const token = localStorage.getItem('token');
    try {
      const res = await axios.get(`http://localhost:5000/analytics?startDate=${startDate}&endDate=${endDate}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setAnalytics(res.data);
    } catch (err) {
      alert(err.response?.data?.message || t('error'));
    } finally {
      setLoading(false);
    }
  };

  const pieData = {
    labels: Object.keys(analytics.bookingsByRoom),
    datasets: [{
      data: Object.values(analytics.bookingsByRoom),
      backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF'],
    }],
  };

  const barData = {
    labels: Object.keys(analytics.bookingsByRoom),
    datasets: [{
      label: t('bookings'),
      data: Object.values(analytics.bookingsByRoom),
      backgroundColor: '#36A2EB',
    }],
  };

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', mt: 4 }}>
      <Typography variant="h4" gutterBottom>{t('analytics')}</Typography>
      {loading ? (
        <CircularProgress />
      ) : (
        <>
          <TextField
            label={t('startDate')}
            type="date"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
            margin="normal"
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            label={t('endDate')}
            type="date"
            value={endDate}
            onChange={e => setEndDate(e.target.value)}
            margin="normal"
            InputLabelProps={{ shrink: true }}
          />
          <Button variant="contained" onClick={fetchAnalytics} sx={{ mt: 2 }} disabled={loading}>
            {loading ? <CircularProgress size={24} /> : t('fetchAnalytics')}
          </Button>
          <Typography variant="h6" gutterBottom sx={{ mt: 4 }}>
            {t('totalRevenue')}: {analytics.totalRevenue.toFixed(2)}€
          </Typography>
          <Typography variant="h6" gutterBottom>
            {t('bookingCount')}: {analytics.bookingCount}
          </Typography>
          <Box sx={{ mt: 4 }}>
            <Typography variant="h6">{t('bookingsByRoom')}</Typography>
            <Pie data={pieData} />
            <Bar data={barData} options={{ scales: { y: { beginAtZero: true } } }} />
          </Box>
        </>
      )}
    </Box>
  );
};

export default Analytics;