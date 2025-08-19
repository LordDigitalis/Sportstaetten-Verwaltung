import React, { useState, useEffect } from 'react';
import axios from 'axios';

const AdminDashboard = () => {
  const [bookings, setBookings] = useState([]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    axios.get('http://localhost:5000/admin/dashboard', { headers: { Authorization: `Bearer ${token}` } }).then(res => setBookings(res.data.bookings));
  }, []);

  const approve = async (id) => {
    const token = localStorage.getItem('token');
    await axios.put(`http://localhost:5000/bookings/${id}/approve`, {}, { headers: { Authorization: `Bearer ${token}` } });
    alert('Genehmigt');
    window.location.reload();
  };

  const reject = async (id) => {
    const token = localStorage.getItem('token');
    await axios.put(`http://localhost:5000/bookings/${id}/reject`, {}, { headers: { Authorization: `Bearer ${token}` } });
    alert('Abgelehnt');
    window.location.reload();
  };

  return (
    <div>
      <h2>Admin Dashboard</h2>
      <ul>
        {bookings.map(booking => (
          <li key={booking.id}>
            Raum {booking.room_id}, {booking.start_time} - {booking.end_time}, Status: {booking.status}
            {booking.status === 'pending' && (
              <>
                <button onClick={() => approve(booking.id)}>Genehmigen</button>
                <button onClick={() => reject(booking.id)}>Ablehnen</button>
              </>
            )}
            {booking.status === 'approved' && <a href={`http://localhost:5000/invoices/${booking.id}`}>Rechnung herunterladen</a>}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default AdminDashboard;