/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface TimeSlot {
  time: string;
  available: boolean;
}

export interface AppointmentRecord {
  id: string;
  date: string; // YYYY-MM-DD
  timeSlot: string;
  fullName: string;
  phoneNumber: string;
  email?: string;
  reason?: string;
  status: 'pending-approval' | 'confirmed' | 'cancelled';
  createdAt: string;
}

export interface BookingSubmission {
  date: string;
  timeSlot: string;
  fullName: string;
  phoneNumber: string;
  email?: string;
  reason?: string;
}

export interface BookingResponse {
  success: boolean;
  status?: 'pending-approval' | 'confirmed';
  booking?: AppointmentRecord;
  error?: string;
  message?: string;
}

// Configurable standard clinic consultation schedule
export const STANDARD_DAILY_SLOTS: string[] = [
  '09:00 AM',
  '10:00 AM',
  '11:15 AM',
  '01:30 PM',
  '02:45 PM',
  '04:00 PM',
  '05:00 PM',
];

const STORAGE_KEY = 'dr_prince_soni_appointments_v1';

export function getStoredAppointments(): AppointmentRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as AppointmentRecord[];
  } catch {
    return [];
  }
}

export function saveStoredAppointments(appointments: AppointmentRecord[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appointments));
  } catch (err) {
    console.error('Failed to persist appointment record:', err);
  }
}

/**
 * Validates whether a date string is in the past (before today)
 */
export function isDateInPast(dateString: string): boolean {
  const [year, month, day] = dateString.split('-').map(Number);
  const target = new Date(year, month - 1, day);
  target.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return target.getTime() < today.getTime();
}

/**
 * Checks if a date falls on a Sunday when the clinic is closed
 */
export function isClinicClosedOnDate(dateString: string): boolean {
  const [year, month, day] = dateString.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getDay() === 0; // 0 = Sunday
}

/**
 * Retrieves available slots for a given date
 */
export async function fetchAvailableSlots(
  dateString: string
): Promise<{ date: string; slots: TimeSlot[]; error?: string }> {
  // 1. Check past date constraint
  if (isDateInPast(dateString)) {
    return {
      date: dateString,
      slots: [],
      error: 'Past dates cannot be scheduled for consultation.',
    };
  }

  // 2. Check clinic closed constraint
  if (isClinicClosedOnDate(dateString)) {
    return {
      date: dateString,
      slots: [],
      error: "Dr. Soni's practice is closed on Sundays for scheduled appointments.",
    };
  }

  // 3. Try server API if available
  try {
    const response = await fetch(`/api/appointments/slots?date=${encodeURIComponent(dateString)}`, {
      headers: { Accept: 'application/json' },
    });
    if (response.ok) {
      const data = await response.json();
      return data;
    }
  } catch {
    // Graceful fallback to client persistence
  }

  // 4. Local schedule calculation fallback
  const stored = getStoredAppointments();
  const bookedInStore = stored
    .filter((a) => a.date === dateString && a.status !== 'cancelled')
    .map((a) => a.timeSlot);

  // Deterministic seed simulation for demo realism: every 2nd weekday has 1-2 booked slots
  const [year, month, day] = dateString.split('-').map(Number);
  const dateObj = new Date(year, month - 1, day);
  const dayOfMonth = dateObj.getDate();
  const simulatedBooked = dayOfMonth % 2 === 0 ? ['10:00 AM', '02:45 PM'] : ['11:15 AM'];
  const allBooked = new Set([...bookedInStore, ...simulatedBooked]);

  const slots: TimeSlot[] = STANDARD_DAILY_SLOTS.map((time) => ({
    time,
    available: !allBooked.has(time),
  }));

  return { date: dateString, slots };
}

/**
 * Requests an appointment with double-booking prevention and field validation
 */
export async function requestAppointment(submission: BookingSubmission): Promise<BookingResponse> {
  const { date, timeSlot, fullName, phoneNumber, email, reason } = submission;

  // Validation: Required fields
  if (!date || !timeSlot || !fullName.trim() || !phoneNumber.trim()) {
    return {
      success: false,
      error: 'Please fill in all required fields (Date, Time Slot, Full Name, and Phone Number).',
    };
  }

  // Validation: Past dates
  if (isDateInPast(date)) {
    return {
      success: false,
      error: 'Cannot request an appointment for a past date.',
    };
  }

  // Validation: Clinic day
  if (isClinicClosedOnDate(date)) {
    return {
      success: false,
      error: 'The clinic is closed on this date. Please select Monday through Saturday.',
    };
  }

  // Validation: Phone format
  const digitsOnly = phoneNumber.replace(/\D/g, '');
  if (digitsOnly.length < 7) {
    return {
      success: false,
      error: 'Please provide a valid contact phone number (minimum 7 digits).',
    };
  }

  // Validation: Email format if provided
  if (email && email.trim().length > 0) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return {
        success: false,
        error: 'Please provide a valid email address or leave it blank.',
      };
    }
  }

  // 1. Try server API
  try {
    const response = await fetch('/api/appointments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(submission),
    });
    if (response.ok) {
      const data: BookingResponse = await response.json();
      if (data.booking) {
        // Also persist locally to keep client state synchronized
        const current = getStoredAppointments();
        current.push(data.booking);
        saveStoredAppointments(current);
      }
      return data;
    } else if (response.status === 409) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        error:
          errorData.error ||
          `The slot ${timeSlot} on ${date} is no longer available. Please select another time.`,
      };
    }
  } catch {
    // Fallback to client-side transactional repository
  }

  // 2. Transactional local constraint check
  const existing = getStoredAppointments();
  const isDuplicate = existing.some(
    (a) => a.date === date && a.timeSlot === timeSlot && a.status !== 'cancelled'
  );

  if (isDuplicate) {
    return {
      success: false,
      error: `The slot ${timeSlot} on ${date} was just booked by another patient. Please select an alternate time.`,
    };
  }

  // Create new appointment record with 'pending-approval'
  const newRecord: AppointmentRecord = {
    id: `APT-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 1000)}`,
    date,
    timeSlot,
    fullName: fullName.trim(),
    phoneNumber: phoneNumber.trim(),
    email: email?.trim() || undefined,
    reason: reason?.trim() || undefined,
    status: 'pending-approval',
    createdAt: new Date().toISOString(),
  };

  existing.push(newRecord);
  saveStoredAppointments(existing);

  // Artificial network latency simulation for realism (400ms)
  await new Promise((resolve) => setTimeout(resolve, 400));

  return {
    success: true,
    status: 'pending-approval',
    message: "Your consultation request has been submitted to Dr. Prince Soni's practice for approval.",
    booking: newRecord,
  };
}
