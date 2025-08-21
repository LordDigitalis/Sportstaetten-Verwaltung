import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Container, FormControl, InputLabel, Select, MenuItem } from '@mui/material';
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
import Success from './components/Success';
import Cancel from './components/Cancel';
import Roles from './components/Roles';

function App() {
  const { t } = useTranslation();

  const changeLanguage = (lng) => {
    i18n.changeLanguage(lng);
  };

  return (
    <Router>
      <Container>
        <FormControl sx={{ m: 1, minWidth: 120 }}>
          <InputLabel>{t('language')}</InputLabel>
          <Select value={i18n.language} onChange={(e) => changeLanguage(e.target.value)}>
            <MenuItem value="de">Deutsch</MenuItem>
            <MenuItem value="en">English</MenuItem>
          </Select>
        </FormControl>
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
          <Route path="/success" element={<Success />} />
          <Route path="/cancel" element={<Cancel />} />
          <Route path="/roles" element={<Roles />} />
          <Route path="/" element={<Login />} />
        </Routes>
      </Container>
    </Router>
  );
}

export default App;