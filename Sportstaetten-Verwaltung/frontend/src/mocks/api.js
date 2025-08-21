export const mockApi = {
  getRooms: async () => [
    { id: 1, name: 'Sporthalle A', capacity: 50, pricePerHour: 20, lat: 48.137154, lng: 11.576124 },
    { id: 2, name: 'Sporthalle B', capacity: 30, pricePerHour: 15, lat: 48.137154, lng: 11.576124 },
  ],
  getFeatures: async (roomId) => [
    { id: 1, roomId: 1, name: 'Beamer', price: 10 },
    { id: 2, roomId: 1, name: 'Whiteboard', price: 5 },
  ],
  getBookings: async () => [
    { id: 1, roomId: 1, userId: 1, startTime: '2025-08-22T10:00:00Z', endTime: '2025-08-22T12:00:00Z', status: 'pending', paymentStatus: 'unpaid' },
  ],
  getReviews: async () => [
    { id: 1, roomId: 1, userId: 1, rating: 4, comment: 'Guter Raum!', createdAt: '2025-08-20T12:00:00Z' },
  ],
  getAnalytics: async () => ({
    totalRevenue: 1000,
    bookingCount: 10,
    bookingsByRoom: { 'Sporthalle A': 7, 'Sporthalle B': 3 },
  }),
  postBooking: async (data) => ({ message: 'Buchung erfolgreich', id: 2 }),
  postReview: async (data) => ({ message: 'Bewertung gespeichert' }),
};