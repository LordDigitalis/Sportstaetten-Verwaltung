import React, { useState, useEffect } from 'react';
import { Typography, Box, Button } from '@mui/material';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import axios from 'axios';
import { useTranslation } from 'react-i18next';

const Calendar = () => {
  const { t } = useTranslation();
  const [events, setEvents] = useState([]);

  useEffect(() => {
    const fetchBookings = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get('http://localhost:5000/bookings', { headers: { Authorization: `Bearer ${token}` } });
        setEvents(res.data.map(booking => ({
          title: `Raum ${booking.name} (${booking.status}, ${booking.payment_status})`,
          start: booking.start_time,
          end: booking.end_time,
        })));
      } catch (err) {
        alert(err.response?.data?.message || 'Fehler beim Laden');
      }
    };
    fetchBookings();
  }, []);

  return (
    <Box sx={{ m: 4 }}>
      <Typography variant="h4" gutterBottom>{t('calendar')}</Typography>
      <FullCalendar
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView="timeGridWeek"
        events={events}
        editable={true}
        locale="de"
      />
    </Box>
  );
};

export default Calendar;