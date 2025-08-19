import React, { useState, useEffect } from 'react';
import { TextField, Button, Typography, Box, List, ListItem, ListItemText, FormControl, InputLabel, Select, MenuItem } from '@mui/material';
import axios from 'axios';
import { useTranslation } from 'react-i18next';

const Rooms = () => {
  const { t } = useTranslation();
  const [rooms, setRooms] = useState([]);
  const [name, setName] = useState('');
  const [capacity, setCapacity] = useState('');
  const [pricePerHour, setPricePerHour] = useState('');
  const [featureName, setFeatureName] = useState('');
  const [featurePrice, setFeaturePrice] = useState('');
  const [selectedRoom, setSelectedRoom] = useState('');

  useEffect(() => {
    axios.get('http://localhost:5000/rooms').then(res => setRooms(res.data)).catch(() => alert('Fehler beim Laden der Räume'));
  }, []);

  const addRoom = async () => {
    const token = localStorage.getItem('token');
    try {
      await axios.post('http://localhost:5000/rooms', { name, capacity, price_per_hour: parseFloat(pricePerHour) }, { headers: { Authorization: `Bearer ${token}` } });
      setRooms([...rooms, { name, capacity, price_per_hour: parseFloat(pricePerHour) }]);
      setName('');
      setCapacity('');
      setPricePerHour('');
    } catch (err) {
      alert(err.response?.data?.message || 'Fehler beim Hinzufügen');
    }
  };

  const addFeature = async () => {
    const token = localStorage.getItem('token');
    try {
      await axios.post('http://localhost:5000/features', { room_id: selectedRoom, name: featureName, price: parseFloat(featurePrice) }, { headers: { Authorization: `Bearer ${token}` } });
      alert(t('featureAdded'));
      setFeatureName('');
      setFeaturePrice('');
    } catch (err) {
      alert(err.response?.data?.message || 'Fehler beim Hinzufügen');
    }
  };

  return (
    <Box sx={{ m: 4 }}>
      <Typography variant="h4" gutterBottom>{t('rooms')}</Typography>
      <List>
        {rooms.map(room => (
          <ListItem key={room.id}>
            <ListItemText primary={`${room.name} (Kapazität: ${room.capacity}, Preis: ${room.price_per_hour}€/h)`} />
          </ListItem>
        ))}
      </List>
      <TextField label={t('roomName')} value={name} onChange={e => setName(e.target.value)} margin="normal" />
      <TextField label={t('capacity')} type="number" value={capacity} onChange={e => setCapacity(e.target.value)} margin="normal" />
      <TextField label={t('pricePerHour')} type="number" value={pricePerHour} onChange={e => setPricePerHour(e.target.value)} margin="normal" />
      <Button variant="contained" onClick={addRoom} sx={{ mt: 2 }}>{t('addRoom')}</Button>
      <Typography variant="h5" gutterBottom sx={{ mt: 4 }}>{t('features')}</Typography>
      <FormControl fullWidth margin="normal">
        <InputLabel>{t('room')}</InputLabel>
        <Select value={selectedRoom} onChange={e => setSelectedRoom(e.target.value)}>
          {rooms.map(room => (
            <MenuItem key={room.id} value={room.id}>{room.name}</MenuItem>
          ))}
        </Select>
      </FormControl>
      <TextField label={t('featureName')} value={featureName} onChange={e => setFeatureName(e.target.value)} margin="normal" />
      <TextField label={t('featurePrice')} type="number" value={featurePrice} onChange={e => setFeaturePrice(e.target.value)} margin="normal" />
      <Button variant="contained" onClick={addFeature} sx={{ mt: 2 }}>{t('addFeature')}</Button>
    </Box>
  );
};

export default Rooms;