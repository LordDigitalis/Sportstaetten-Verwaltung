import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { Typography, Box, CircularProgress } from '@mui/material';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import 'leaflet/dist/leaflet.css';

const Map = () => {
  const { t } = useTranslation();
  const [rooms, setRooms] = useState([]);
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

  return (
    <Box sx={{ m: 4 }}>
      <Typography variant="h4" gutterBottom>{t('map')}</Typography>
      {loading ? (
        <CircularProgress />
      ) : (
        <MapContainer center={[48.137154, 11.576124]} zoom={13} style={{ height: '500px', width: '100%' }}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {rooms.map(room => (
            room.lat && room.lng && (
              <Marker key={room.id} position={[room.lat, room.lng]}>
                <Popup>
                  {`${room.name} (Bewertung: ${room.avg_rating.toFixed(1)}/5)`}
                  <br />
                  {`Kapazität: ${room.capacity}, Preis: ${room.price_per_hour}€/h`}
                </Popup>
              </Marker>
            )
          ))}
        </MapContainer>
      )}
    </Box>
  );
};

export default Map;