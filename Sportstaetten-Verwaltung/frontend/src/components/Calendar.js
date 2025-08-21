import React, { useState, useEffect } from 'react';
import { Typography, Box, Button, CircularProgress } from '@mui/material';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFacebook, faTwitter, faWhatsapp } from '@fortawesome/free-brands-svg-icons';

const Calendar = () => {
  const { t } = useTranslation();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchBookings = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get('http://localhost:5000/bookings', { headers: { Authorization: `Bearer ${token}` } });
        setEvents(res.data.map(booking => ({
          id: booking.id,
          title: `Raum ${booking.name} (${booking.status}, ${booking.payment_status})`,
          start: booking.start_time,
          end: booking.end_time,
        })));
      } catch (err) {
        alert(err.response?.data?.message || t('error'));
      } finally {
        setLoading(false);
      }
    };
    fetchBookings();
  }, []);

  const handleEventClick = (info) => {
    const bookingId = info.event.id;
    window.location.href = `/payment/${bookingId}`;
  };

  const handleExport = async (bookingId) => {
    try {
      window.location.href = `http://localhost:5000/bookings/${bookingId}/ics`;
    } catch (err) {
      alert(t('error'));
    }
  };

  const shareBooking = (bookingId, platform) => {
    const url = `http://localhost:3000/public?booking=${bookingId}`;
    let shareUrl;
    if (platform === 'facebook') shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
    if (platform === 'twitter') shareUrl = `https://x.com/intent/tweet?url=${encodeURIComponent(url)}&text=Meine Buchung!`;
    if (platform === 'whatsapp') shareUrl = `https://wa.me/?text=${encodeURIComponent(url)}`;
    window.open(shareUrl, '_blank');
  };

  return (
    <Box sx={{ m: 4 }}>
      <Typography variant="h4" gutterBottom>{t('calendar')}</Typography>
      {loading ? (
        <CircularProgress />
      ) : (
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="timeGridWeek"
          events={events}
          eventClick={handleEventClick}
          editable={true}
          locale="de"
          eventContent={(arg) => (
            <div>
              {arg.event.title}
              <Button size="small" onClick={() => handleExport(arg.event.id)}>{t('exportCalendar')}</Button>
              <Button size="small" onClick={() => shareBooking(arg.event.id, 'facebook')}>
                <FontAwesomeIcon icon={faFacebook} />
              </Button>
              <Button size="small" onClick={() => shareBooking(arg.event.id, 'twitter')}>
                <FontAwesomeIcon icon={faTwitter} />
              </Button>
              <Button size="small" onClick={() => shareBooking(arg.event.id, 'whatsapp')}>
                <FontAwesomeIcon icon={faWhatsapp} />
              </Button>
            </div>
          )}
        />
      )}
    </Box>
  );
};

export default Calendar;