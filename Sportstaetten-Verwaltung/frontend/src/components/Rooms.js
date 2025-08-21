import React, { useState, useEffect } from 'react';
import { TextField, Button, Typography, Box, List, ListItem, ListItemText, FormControl, InputLabel, Select, MenuItem, CircularProgress } from '@mui/material';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import 'leaflet/dist/leaflet.css';

const Rooms = () => {
  const { t } = useTranslation();
  const [rooms, setRooms] = useState([]);
  const [name, setName] = useState('');
  const [capacity, setCapacity] = useState('');
  const [pricePerHour, setPricePerHour] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [featureName, setFeatureName] = useState('');
  const [featurePrice, setFeaturePrice] = useState('');
  const [selectedRoom, setSelectedRoom] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    axios.get('http://localhost:5000/rooms').then(res => {
      Promise.all(res.data.map(async room => {
        const reviewRes = await axios.get(`http://localhost:5000/reviews/${room.id}`);
        return { ...room, avg_rating: reviewRes.data.avg_rating };
      })).then(updatedRooms => {
        setRooms(updatedRooms);
        setLoading(false);
      });
    }).catch(() => {
      alert(t('error'));
      setLoading(false);
    });
  }, []);

  const addRoom = async () => {
    setLoading(true);
    const token = localStorage.getItem('token');
    try {
      await axios.post('http://localhost:5000/rooms', { name, capacity, price_per_hour: parseFloat(pricePerHour), lat: parseFloat(lat), lng: parseFloat(lng) }, { headers: { Authorization: `Bearer ${token}` } });
      setRooms([...rooms, { name, capacity, price_per_hour: parseFloat(pricePerHour), lat: parseFloat(lat), lng: parseFloat(lng), avg_rating: 0 }]);
      setName('');
      setCapacity('');
      setPricePerHour('');
      setLat('');
      setLng('');
    } catch (err) {
      alert(err.response?.data?.message || t('error'));
    } finally {
      setLoading(false);
    }
  };

  const addFeature = async () => {
    setLoading(true);
    const token = localStorage.getItem('token');
    try {
      await axios.post('http://localhost:5000/features', { room_id: selectedRoom, name: featureName, price: parseFloat(featurePrice) }, { headers: { Authorization: `Bearer ${token}` } });
      alert(t('featureAdded'));
      setFeatureName('');
      setFeaturePrice('');
    } catch (err) {
      alert(err.response?.data?.message || t('error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ m: 4 }}>
      <Typography variant="h4" gutterBottom>{t('rooms')}</Typography>
      {loading ? (
        <CircularProgress />
      ) : (
        <>
          <List>
            {rooms.map(room => (
              <ListItem key={room.id}>
                <ListItemText primary={`${room.name} (Kapazität: ${room.capacity}, Preis: ${room.price_per_hour}€/h, Bewertung: ${room.avg_rating.toFixed(1)}/5)`} secondary={`Standort: ${room.lat}, ${room.lng}`} />
              </ListItem>
            ))}
          </List>
          <MapContainer center={[48.137154, 11.576124]} zoom={13} style={{ height: '400px', marginTop: '20px' }}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            {rooms.map(room => (
              room.lat && room.lng && (
                <Marker key={room.id} position={[room.lat, room.lng]}>
                  <Popup>{`${room.name} (Bewertung: ${room.avg_rating.toFixed(1)}/5)`}</Popup>
                </Marker>
              )
            ))}
          </MapContainer>
          <TextField label={t('roomName')} value={name} onChange={e => setName(e.target.value)} margin="normal" />
          <TextField label={t('capacity')} type="number" value={capacity} onChange={e => setCapacity(e.target.value)} margin="normal" />
          <TextField label={t('pricePerHour')} type="number" value={pricePerHour} onChange={e => setPricePerHour(e.target.value)} margin="normal" />
          <TextField label="Latitude" type="number" value={lat} onChange={e => setLat(e.target.value)} margin="normal" />
          <TextField label="Longitude" type="number" value={lng} onChange={e => setLng(e.target.value)} margin="normal" />
          <Button variant="contained" onClick={addRoom} sx={{ mt: 2 }} disabled={loading}>
            {loading ? <CircularProgress size={24} /> : t('addRoom')}
          </Button>
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
          <Button variant="contained" onClick={addFeature} sx={{ mt: 2 }} disabled={loading}>
            {loading ? <CircularProgress size={24} /> : t('addFeature')}
          </Button>
        </>
      )}
    </Box>
  );
};

export default Rooms;