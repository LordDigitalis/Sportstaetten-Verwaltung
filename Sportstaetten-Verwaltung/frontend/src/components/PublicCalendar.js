import React, { useState, useEffect } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import axios from 'axios';

const PublicCalendar = () => {
  const [events, setEvents] = useState([]);

  useEffect(() => {
    axios.get('http://localhost:5000/public/bookings').then(res => {
      setEvents(res.data.map(booking => ({
        title: `Room ${booking.room_id} booked`,
        start: booking.start_time,
        end: booking.end_time,
      })));
    });
  }, []);

  return (
    <div>
      <h2>Öffentlicher Belegungsplan</h2>
      <FullCalendar plugins={[dayGridPlugin, timeGridPlugin]} initialView="timeGridWeek" events={events} />
    </div>
  );
};

export default PublicCalendar;