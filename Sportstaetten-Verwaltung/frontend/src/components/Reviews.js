import React, { useState, useEffect } from 'react';
import { TextField, Button, Typography, Box, List, ListItem, ListItemText, Rating, CircularProgress } from '@mui/material';
import axios from 'axios';
import { useTranslation } from 'react-i18next';

const Reviews = () => {
  const { t } = useTranslation();
  const [rooms, setRooms] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [selectedRoom, setSelectedRoom] = useState('');
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
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
    if (selectedRoom) {
      setLoading(true);
      axios.get(`http://localhost:5000/reviews/${selectedRoom}`).then(res => {
        setReviews(res.data);
        setLoading(false);
      }).catch(() => {
        alert(t('error'));
        setLoading(false);
      });
    }
  }, [selectedRoom]);

  const submitReview = async () => {
    setLoading(true);
    const token = localStorage.getItem('token');
    try {
      await axios.post('http://localhost:5000/reviews', { room_id: selectedRoom, rating, comment }, { headers: { Authorization: `Bearer ${token}` } });
      alert(t('reviewSubmitted'));
      setRating(0);
      setComment('');
      axios.get(`http://localhost:5000/reviews/${selectedRoom}`).then(res => setReviews(res.data));
    } catch (err) {
      alert(err.response?.data?.message || t('error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 600, mx: 'auto', mt: 4 }}>
      <Typography variant="h4" gutterBottom>{t('reviews')}</Typography>
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
          <Typography variant="h6" gutterBottom>{t('submitReview')}</Typography>
          <Rating value={rating} onChange={(e, newValue) => setRating(newValue)} />
          <TextField fullWidth label={t('comment')} multiline rows={4} value={comment} onChange={e => setComment(e.target.value)} margin="normal" />
          <Button variant="contained" onClick={submitReview} disabled={loading || !selectedRoom || !rating}>
            {loading ? <CircularProgress size={24} /> : t('submit')}
          </Button>
          <Typography variant="h6" gutterBottom sx={{ mt: 4 }}>{t('existingReviews')}</Typography>
          <List>
            {reviews.map(review => (
              <ListItem key={review.id}>
                <ListItemText primary={`${review.username}: ${review.rating} Sterne`} secondary={review.comment} />
              </ListItem>
            ))}
          </List>
        </>
      )}
    </Box>
  );
};

export default Reviews;