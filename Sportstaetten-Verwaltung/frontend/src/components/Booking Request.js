import React, { useState, useEffect } from 'react';
import { TextField, Button, Typography, Box, FormControl, InputLabel, Select, MenuItem, FormGroup, FormControlLabel, Checkbox } from '@mui/material';
import axios from 'axios';
import { useTranslation } from 'react-i18next';

const BookingRequest = () => {
  const { t } = useTranslation();
  const [rooms, setRooms] = useState([]);
  const [features, setFeatures] = useState([]);
  const [roomId, setRoomId] = useState('');
  const [selectedFeatures, setSelectedFeatures] = useState([]);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');

  useEffect(() => {
    axios.get('http://localhost:5000/rooms')
      .then(res => setRooms(res.data))
      .catch(() => alert(t('errorLoading')));
  }, []);

  useEffect(() => {
    if (roomId) {
      axios.get(`http://localhost:5000/features/${roomId}`)
        .then(res => setFeatures(res.data))
        .catch(() => alert(t('errorLoading')));
    }
  }, [roomId]);

  const handleFeatureChange = (id) => {
    setSelectedFeatures(prev => prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]);
  };

  const handleRequest = async () => {
    const token = localStorage.getItem('token');
    try {
      await axios.post('http://localhost:5000/bookings/request', { room_id: roomId, start_time: startTime, end_time: endTime, features: selectedFeatures }, { headers: { Authorization: `Bearer ${token}` } });
      alert(t('requestSent'));
      setRoomId('');
      setSelectedFeatures([]);
      setStartTime('');
      setEndTime('');
    } catch (err) {
      alert(err.response?.data?.message || t('errorSending'));
    }
  };

  return (
    <Box sx={{ maxWidth: 400, mx: 'auto', mt: 4 }}>
      <Typography variant="h4" gutterBottom>{t('bookingRequest')}</Typography>
      <FormControl fullWidth margin="normal">
        <InputLabel>{t('room')}</InputLabel>
        <Select value={roomId} onChange={e => setRoomId(e.target.value)}>
          {rooms.map(room => (
            <MenuItem key={room.id} value={room.id}>{room.name}</MenuItem>
          ))}
        </Select>
      </FormControl>
      <Typography variant="h6" gutterBottom>{t('features')}</Typography>
      <FormGroup>
        {features.map(feature => (
          <FormControlLabel
            key={feature.id}
            control={<Checkbox checked={selectedFeatures.includes(feature.id)} onChange={() => handleFeatureChange(feature.id)} />}
            label={`${feature.name} (${feature.price}€)`}
          />
        ))}
      </FormGroup>
      <TextField fullWidth label={t('startTime')} type="datetime-local" value={startTime} onChange={e => setStartTime(e.target.value)} margin="normal" />
      <TextField fullWidth label={t('endTime')} type="datetime-local" value={endTime} onChange={e => setEndTime(e.target.value)} margin="normal" />
      <Button variant="contained" onClick={handleRequest} fullWidth sx={{ mt: 2 }}>{t('submitRequest')}</Button>
    </Box>
  );
};

export default BookingRequest;