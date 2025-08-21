import React, { useState, useEffect } from 'react';
import { TextField, Button, Typography, Box, FormControl, InputLabel, Select, MenuItem, FormGroup, FormControlLabel, Checkbox, CircularProgress } from '@mui/material';
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
  const [capacityFilter, setCapacityFilter] = useState('');
  const [priceFilter, setPriceFilter] = useState('');
  const [recommendations, setRecommendations] = useState([]);
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
    const token = localStorage.getItem('token');
    axios.get('http://localhost:5000/recommendations', { headers: { Authorization: `Bearer ${token}` } })
      .then(res => setRecommendations(res.data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (roomId) {
      setLoading(true);
      axios.get(`http://localhost:5000/features/${roomId}`)
        .then(res => {
          setFeatures(res.data);
          setLoading(false);
        })
        .catch(() => {
          alert(t('error'));
          setLoading(false);
        });
    }
  }, [roomId]);

  const handleFeatureChange = (id) => {
    setSelectedFeatures(prev => prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]);
  };

  const handleRequest = async () => {
    setLoading(true);
    const token = localStorage.getItem('token');
    try {
      await axios.post('http://localhost:5000/bookings/request', { room_id: roomId, start_time: startTime, end_time: endTime, features: selectedFeatures }, { headers: { Authorization: `Bearer ${token}` } });
      alert(t('requestSent'));
      setRoomId('');
      setSelectedFeatures([]);
      setStartTime('');
      setEndTime('');
    } catch (err) {
      alert(err.response?.data?.message || t('error'));
    } finally {
      setLoading(false);
    }
  };

  const filteredRooms = rooms.filter(room => (
    (!capacityFilter || room.capacity >= parseInt(capacityFilter)) &&
    (!priceFilter || room.price_per_hour <= parseFloat(priceFilter))
  ));

  return (
    <Box sx={{ maxWidth: 600, mx: 'auto', mt: 4 }}>
      <Typography variant="h4" gutterBottom>{t('bookingRequest')}</Typography>
      {loading ? (
        <CircularProgress />
      ) : (
        <>
          <Typography variant="h6" gutterBottom>{t('recommendations')}</Typography>
          <List>
            {recommendations.map(room => (
              <ListItem key={room.id}>
                <ListItemText primary={`Raum ${room.name} (Empfohlen)`} />
              </ListItem>
            ))}
          </List>
          <TextField fullWidth label={t('capacityFilter')} type="number" value={capacityFilter} onChange={e => setCapacityFilter(e.target.value)} margin="normal" />
          <TextField fullWidth label={t('priceFilter')} type="number" value={priceFilter} onChange={e => setPriceFilter(e.target.value)} margin="normal" />
          <FormControl fullWidth margin="normal">
            <InputLabel>{t('room')}</InputLabel>
            <Select value={roomId} onChange={e => setRoomId(e.target.value)}>
              {filteredRooms.map(room => (
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
          <Button variant="contained" onClick={handleRequest} fullWidth sx={{ mt: 2 }} disabled={loading}>
            {loading ? <CircularProgress size={24} /> : t('submitRequest')}
          </Button>
        </>
      )}
    </Box>
  );
};

export default BookingRequest;