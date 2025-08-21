import React, { useState, useEffect } from 'react';
import { TextField, Button, Typography, Box, FormControl, InputLabel, Select, MenuItem, Checkbox, ListItemText, CircularProgress } from '@mui/material';
import axios from 'axios';
import { useTranslation } from 'react-i18next';

const BookingRequest = () => {
  const { t } = useTranslation();
  const [rooms, setRooms] = useState([]);
  const [selectedRoom, setSelectedRoom] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [features, setFeatures] = useState([]);
  const [selectedFeatures, setSelectedFeatures] = useState([]);
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    axios.get('http://localhost:5000/rooms').then(res => {
      setRooms(res.data);
      setLoading(false);
    }).catch(() => {
      alert(t('error'));
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (selectedRoom && startTime) {
      const room = rooms.find(r => r.id === parseInt(selectedRoom));
      if (room) {
        axios.get(`http://localhost:5000/weather?lat=${room.lat}&lng=${room.lng}&date=${startTime.split('T')[0]}`).then(res => {
          setWeather(res.data);
        }).catch(() => setWeather(null));
      }
      axios.get(`http://localhost:5000/features?room_id=${selectedRoom}`).then(res => {
        setFeatures(res.data);
      }).catch(() => setFeatures([]));
    }
  }, [selectedRoom, startTime]);

  const submitRequest = async () => {
    setLoading(true);
    const token = localStorage.getItem('token');
    try {
      await axios.post('http://localhost:5000/bookings', {
        room_id: selectedRoom,
        start_time: startTime,
        end_time: endTime,
        features: selectedFeatures,
      }, { headers: { Authorization: `Bearer ${token}` } });
      alert(t('requestSubmitted'));
      setSelectedRoom('');
      setStartTime('');
      setEndTime('');
      setSelectedFeatures([]);
    } catch (err) {
      alert(err.response?.data?.message || t('error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 600, mx: 'auto', mt: 4 }}>
      <Typography variant="h4" gutterBottom>{t('bookingRequest')}</Typography>
      {loading ? (
        <CircularProgress />
      ) : (
        <>
          <FormControl fullWidth margin="normal">
            <InputLabel>{t('room')}</InputLabel>
            <Select value={selectedRoom} onChange={e => setSelectedRoom(e.target.value)}>
              {rooms.map(room => (
                <MenuItem key={room.id} value={room.id}>{room.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            fullWidth
            label={t('startTime')}
            type="datetime-local"
            value={startTime}
            onChange={e => setStartTime(e.target.value)}
            margin="normal"
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            fullWidth
            label={t('endTime')}
            type="datetime-local"
            value={endTime}
            onChange={e => setEndTime(e.target.value)}
            margin="normal"
            InputLabelProps={{ shrink: true }}
          />
          <FormControl fullWidth margin="normal">
            <InputLabel>{t('features')}</InputLabel>
            <Select
              multiple
              value={selectedFeatures}
              onChange={e => setSelectedFeatures(e.target.value)}
              renderValue={selected => selected.map(id => features.find(f => f.id === id)?.name).join(', ')}
            >
              {features.map(feature => (
                <MenuItem key={feature.id} value={feature.id}>
                  <Checkbox checked={selectedFeatures.includes(feature.id)} />
                  <ListItemText primary={`${feature.name} (${feature.price}€)`} />
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          {weather && weather.probability > 50 && (
            <Typography color="warning.main" sx={{ mt: 2 }}>
              {t('weatherWarning')}: {weather.condition} ({weather.probability}% {t('probability')})
            </Typography>
          )}
          <Button variant="contained" onClick={submitRequest} disabled={loading || !selectedRoom || !startTime || !endTime}>
            {loading ? <CircularProgress size={24} /> : t('submitRequest')}
          </Button>
        </>
      )}
    </Box>
  );
};

export default BookingRequest;