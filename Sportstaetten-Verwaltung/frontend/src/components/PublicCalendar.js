import React, { useState, useEffect } from 'react';
import { Typography, Box } from '@mui/material';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import axios from 'axios';
import { useTranslation } from 'react-i18next';

const PublicCalendar = () => {
  const { t } = useTranslation();
  const [events, setEvents] = useState([]);

  useEffect(() => {
    axios.get('http://localhost:5000/public/bookings').then(res => {
      setEvents(res.data.map(booking => ({
        title: `Raum ${booking.name}`,
        start: booking.start_time,
        end: booking.end_time,
      })));
    }).catch(() => alert(t('errorLoading')));
  }, []);

  return (
    <Box sx={{ m: 4 }}>
      <Typography variant="h4" gutterBottom>{t('publicCalendar')}</Typography>
      <FullCalendar plugins={[dayGridPlugin, timeGridPlugin]} initialView="timeGridWeek" events={events} locale="de" />
    </Box>
  );
};

export default PublicCalendar;