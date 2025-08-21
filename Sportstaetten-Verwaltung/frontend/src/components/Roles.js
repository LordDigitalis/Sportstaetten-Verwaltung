import React, { useState, useEffect } from 'react';
import { Typography, Box, List, ListItem, ListItemText, FormControl, InputLabel, Select, MenuItem, Button, CircularProgress } from '@mui/material';
import axios from 'axios';
import { useTranslation } from 'react-i18next';

const Roles = () => {
  const { t } = useTranslation();
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState('');
  const [role, setRole] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    const token = localStorage.getItem('token');
    axios.get('http://localhost:5000/users', { headers: { Authorization: `Bearer ${token}` } })
      .then(res => {
        setUsers(res.data);
        setLoading(false);
      })
      .catch(() => {
        alert(t('error'));
        setLoading(false);
      });
  }, []);

  const updateRole = async () => {
    setLoading(true);
    const token = localStorage.getItem('token');
    try {
      await axios.put(`http://localhost:5000/users/${selectedUser}/role`, { role }, { headers: { Authorization: `Bearer ${token}` } });
      alert(t('roleUpdated'));
      setUsers(users.map(user => user.id === parseInt(selectedUser) ? { ...user, role } : user));
      setSelectedUser('');
      setRole('');
    } catch (err) {
      alert(err.response?.data?.message || t('error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 600, mx: 'auto', mt: 4 }}>
      <Typography variant="h4" gutterBottom>{t('roles')}</Typography>
      {loading ? (
        <CircularProgress />
      ) : (
        <>
          <List>
            {users.map(user => (
              <ListItem key={user.id}>
                <ListItemText primary={`${user.username} (${user.email})`} secondary={`Rolle: ${user.role}`} />
              </ListItem>
            ))}
          </List>
          <FormControl fullWidth margin="normal">
            <InputLabel>{t('user')}</InputLabel>
            <Select value={selectedUser} onChange={e => setSelectedUser(e.target.value)}>
              {users.map(user => (
                <MenuItem key={user.id} value={user.id}>{user.username}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl fullWidth margin="normal">
            <InputLabel>{t('role')}</InputLabel>
            <Select value={role} onChange={e => setRole(e.target.value)}>
              <MenuItem value="admin">{t('admin')}</MenuItem>
              <MenuItem value="manager">{t('manager')}</MenuItem>
              <MenuItem value="citizen">{t('citizen')}</MenuItem>
            </Select>
          </FormControl>
          <Button variant="contained" onClick={updateRole} disabled={loading || !selectedUser || !role}>
            {loading ? <CircularProgress size={24} /> : t('updateRole')}
          </Button>
        </>
      )}
    </Box>
  );
};

export default Roles;