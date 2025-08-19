import React, { useState } from 'react';
import axios from 'axios';

const BookingRequest = () => {
  const [roomId, setRoomId] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');

  const handleRequest = async () => {
    const token = localStorage.getItem('token');
    try {
      await axios.post('http://localhost:5000/bookings/request', { room_id: roomId, start_time: startTime, end_time: endTime }, { headers: { Authorization: `Bearer ${token}` } });
      alert('Anfrage gesendet');
    } catch (err) {
      alert('Anfrage fehlgeschlagen');
    }
  };

  return (
    <div>
      <h2>Buchungsanfrage stellen</h2>
      <input value={roomId} onChange={e => setRoomId(e.target.value)} placeholder="Raum ID" />
      <input type="datetime-local" value={startTime} onChange={e => setStartTime(e.target.value)} />
      <input type="datetime-local" value={endTime} onChange={e => setEndTime(e.target.value)} />
      <button onClick={handleRequest}>Anfragen</button>
    </div>
  );
};

export default BookingRequest;