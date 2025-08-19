import React, { useState, useEffect } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import axios from 'axios';

const Calendar = () => {
  const [events, setEvents] = useState([]);

  useEffect(() => {
    const fetchBookings = async () => {
      const token = localStorage.getItem('token');
      const res = await axios.get('http://localhost:5000/bookings', { headers: { Authorization: `Bearer ${token}` } });
      setEvents(res.data.map(booking => ({
        title: `Room ${booking.room_id} booked`,
        start: booking.start_time,
        end: booking.end_time,
      })));
    };
    fetchBookings();
  }, []);

  return (
    <div>
      <h2>Belegungsplan</h2>
      <FullCalendar
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView="timeGridWeek"
        events={events}
        editable={true}
      />
    </div>
  );
};

export default Calendar;