import React, { useState, useEffect } from 'react';
import axios from 'axios';

const Rooms = () => {
  const [rooms, setRooms] = useState([]);
  const [name, setName] = useState('');
  const [capacity, setCapacity] = useState('');

  useEffect(() => {
    axios.get('http://localhost:5000/rooms').then(res => setRooms(res.data));
  }, []);

  const addRoom = async () => {
    const token = localStorage.getItem('token');
    await axios.post('http://localhost:5000/rooms', { name, capacity }, { headers: { Authorization: `Bearer ${token}` } });
    setRooms([...rooms, { name, capacity }]);
  };

  return (
    <div>
      <h2>Räume</h2>
      <ul>{rooms.map(room => <li key={room.id}>{room.name} (Kapazität: {room.capacity})</li>)}</ul>
      <input value={name} onChange={e => setName(e.target.value)} placeholder="Raumname" />
      <input value={capacity} onChange={e => setCapacity(e.target.value)} placeholder="Kapazität" />
      <button onClick={addRoom}>Hinzufügen (Admin)</button>
    </div>
  );
};

export default Rooms;