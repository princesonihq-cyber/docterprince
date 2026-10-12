/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  app.use(express.json());

  // In-memory appointments database with strict constraints
  interface Appointment {
    id: string;
    date: string;
    timeSlot: string;
    fullName: string;
    phoneNumber: string;
    email?: string;
    reason?: string;
    status: 'pending-approval' | 'confirmed';
    createdAt: string;
  }

  const appointments: Appointment[] = [];

  const ALL_SLOTS = [
    '09:00 AM',
    '10:00 AM',
    '11:15 AM',
    '01:30 PM',
    '02:45 PM',
    '04:00 PM',
    '05:00 PM',
  ];

  // API endpoint: Get available slots for a date
  app.get('/api/appointments/slots', (req, res) => {
    const date = req.query.date as string;
    if (!date) {
      return res.status(400).json({ error: 'Date parameter is required (YYYY-MM-DD)' });
    }

    const [year, month, day] = date.split('-').map(Number);
    const targetDate = new Date(year, month - 1, day);
    targetDate.setHours(0, 0, 0, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (targetDate.getTime() < today.getTime()) {
      return res.status(400).json({ error: 'Past dates cannot be scheduled' });
    }

    if (targetDate.getDay() === 0) {
      return res.status(400).json({ error: 'Clinic is closed on Sundays' });
    }

    // Booked slots in memory
    const bookedInDb = appointments
      .filter((a) => a.date === date)
      .map((a) => a.timeSlot);

    // Realistic seeded bookings
    const simulatedBooked = day % 2 === 0 ? ['10:00 AM', '02:45 PM'] : ['11:15 AM'];
    const bookedSet = new Set([...bookedInDb, ...simulatedBooked]);

    const slots = ALL_SLOTS.map((slot) => ({
      time: slot,
      available: !bookedSet.has(slot),
    }));

    return res.json({ date, slots });
  });

  // API endpoint: Request appointment with double-booking prevention
  app.post('/api/appointments', (req, res) => {
    const { date, timeSlot, fullName, phoneNumber, email, reason } = req.body;
    if (!date || !timeSlot || !fullName || !phoneNumber) {
      return res.status(400).json({
        error: 'Missing required booking fields (date, timeSlot, fullName, phoneNumber)',
      });
    }

    const [year, month, day] = date.split('-').map(Number);
    const targetDate = new Date(year, month - 1, day);
    targetDate.setHours(0, 0, 0, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (targetDate.getTime() < today.getTime()) {
      return res.status(400).json({ error: 'Cannot book appointments for past dates' });
    }

    if (targetDate.getDay() === 0) {
      return res.status(400).json({ error: 'Clinic is closed on Sundays' });
    }

    const phoneDigits = String(phoneNumber).replace(/\D/g, '');
    if (phoneDigits.length < 7) {
      return res.status(400).json({ error: 'Please provide a valid phone number' });
    }

    // Check double-booking constraint
    const simulatedBooked = day % 2 === 0 ? ['10:00 AM', '02:45 PM'] : ['11:15 AM'];
    const isSimulatedBooked = simulatedBooked.includes(timeSlot);
    const isDbBooked = appointments.some((a) => a.date === date && a.timeSlot === timeSlot);

    if (isSimulatedBooked || isDbBooked) {
      return res.status(409).json({
        error: `The slot ${timeSlot} on ${date} was just reserved by another patient. Please select an alternate time.`,
      });
    }

    const newBooking: Appointment = {
      id: `APT-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 1000)}`,
      date,
      timeSlot,
      fullName: String(fullName).trim(),
      phoneNumber: String(phoneNumber).trim(),
      email: email ? String(email).trim() : undefined,
      reason: reason ? String(reason).trim() : undefined,
      status: 'pending-approval',
      createdAt: new Date().toISOString(),
    };

    appointments.push(newBooking);

    return res.status(201).json({
      success: true,
      status: 'pending-approval',
      message: "Your appointment request has been submitted to Dr. Prince Soni's practice for approval.",
      booking: newBooking,
    });
  });

  // In development, hook Vite dev server middleware
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Application server running on port ${PORT}`);
  });
}

startServer();
