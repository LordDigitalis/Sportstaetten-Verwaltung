import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Login from './components/Login';
import Register from './components/Register';
import Calendar from './components/Calendar';
import Rooms from './components/Rooms';
import PublicCalendar from './components/PublicCalendar';
import ContactForm from './components/ContactForm';
import AdminDashboard from './components/AdminDashboard';
import BookingRequest from './components/BookingRequest';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/calendar" element={<Calendar />} />
        <Route path="/rooms" element={<Rooms />} />
        <Route path="/public" element={<PublicCalendar />} />
        <Route path="/contact" element={<ContactForm />} />
        <Route path="/dashboard" element={<AdminDashboard />} />
        <Route path="/request" element={<BookingRequest />} />
        <Route path="/" element={<Login />} />
      </Routes>
    </Router>
  );
}

export default App;