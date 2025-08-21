import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { CssBaseline, Switch, Box, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import Login from './components/Login';
import Register from './components/Register';
import Calendar from './components/Calendar';
import Rooms from './components/Rooms';
import PublicCalendar from './components/PublicCalendar';
import ContactForm from './components/ContactForm';
import AdminDashboard from './components/AdminDashboard';
import BookingRequest from './components/BookingRequest';
import Payment from './components/Payment';
import CheckoutForm from './components/CheckoutForm';
import Success from './components/Success';
import Cancel from './components/Cancel';
import Reviews from './components/Reviews';
import Roles from './components/Roles';
import Map from './components/Map';
import Analytics from './components/Analytics';
import Settings from './components/Settings';

const App = () => {
  const { t } = useTranslation();
  const [darkMode, setDarkMode] = useState(false);

  const theme = createTheme({
    palette: {
      mode: darkMode ? 'dark' : 'light',
    },
  });

  const handleThemeToggle = () => {
    setDarkMode(!darkMode);
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', p: 2 }}>
          <Typography variant="body1" sx={{ mr: 1 }}>{t('darkMode')}</Typography>
          <Switch checked={darkMode} onChange={handleThemeToggle} />
        </Box>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/calendar" element={<Calendar />} />
          <Route path="/rooms" element={<Rooms />} />
          <Route path="/public" element={<PublicCalendar />} />
          <Route path="/contact" element={<ContactForm />} />
          <Route path="/dashboard" element={<AdminDashboard />} />
          <Route path="/request" element={<BookingRequest />} />
          <Route path="/payment/:bookingId" element={<Payment />} />
          <Route path="/checkout/:bookingId" element={<CheckoutForm />} />
          <Route path="/success" element={<Success />} />
          <Route path="/cancel" element={<Cancel />} />
          <Route path="/reviews" element={<Reviews />} />
          <Route path="/roles" element={<Roles />} />
          <Route path="/map" element={<Map />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/" element={<Login />} />
        </Routes>
      </Router>
    </ThemeProvider>
  );
};

export default App;