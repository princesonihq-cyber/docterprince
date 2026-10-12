/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  CircleUserRound,
  Menu,
  X,
  ArrowRight,
  Calendar,
  Clock,
  Sparkles,
  HeartPulse,
  ShieldCheck,
  Activity,
  Stethoscope,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  CheckCircle2,
  AlertCircle,
  FileText,
  User,
  Phone,
  Mail,
  MapPin
} from 'lucide-react';
import {
  fetchAvailableSlots,
  requestAppointment,
  TimeSlot,
  AppointmentRecord,
  isDateInPast,
  isClinicClosedOnDate
} from './services/bookingApi.ts';

// 9-point triangular dot pattern for hero stats
const TRIANGLE_DOTS = [
  { left: 8.75, top: 1.5 },
  { left: 5.75, top: 6.5 },
  { left: 11.75, top: 6.5 },
  { left: 2.75, top: 11.5 },
  { left: 8.75, top: 11.5 },
  { left: 14.75, top: 11.5 },
  { left: 0.0, top: 16.5 },
  { left: 8.75, top: 16.5 },
  { left: 17.5, top: 16.5 },
];

const CHECKERBOARD_GRID = [
  'bg-white/60', 'bg-white/0', 'bg-white/60',
  'bg-white/0', 'bg-white/60', 'bg-white/0',
  'bg-white/60', 'bg-white/0', 'bg-white/60',
];

interface FAQItem {
  question: string;
  answer: string;
}

const FAQS: FAQItem[] = [
  {
    question: 'How do I prepare for my initial consultation with Dr. Soni?',
    answer: 'Please bring any recent diagnostic reports, laboratory results from the past 12 months, a current medication and supplement list, and any specific health questions you wish to address.'
  },
  {
    question: 'How long does an appointment typically take?',
    answer: 'Initial comprehensive consultations are scheduled for 45 to 60 minutes to ensure adequate time for unhurried clinical history review and collaborative discussion. Follow-up visits are typically 30 minutes.'
  },
  {
    question: 'Are follow-up consultations available virtually or by phone?',
    answer: 'Yes. Following an in-person initial intake, eligible follow-up check-ins and test result reviews can be conducted via secure telehealth video or audio consultation.'
  },
  {
    question: "What is the clinic's rescheduling and cancellation policy?",
    answer: 'We kindly request at least 24 hours advance notice if you need to reschedule or cancel your visit. This courtesy allows us to offer the reserved time slot to patients awaiting care.'
  }
];

export default function App() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [knowMoreOpen, setKnowMoreOpen] = useState(false);
  const [activeFaq, setActiveFaq] = useState<number | null>(0);

  // Calendar & Booking State
  const today = new Date();
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth()); // 0-indexed

  // Format initial date as tomorrow YYYY-MM-DD (or Monday if tomorrow is Sunday)
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  if (tomorrow.getDay() === 0) {
    tomorrow.setDate(tomorrow.getDate() + 1); // roll over to Monday if tomorrow is Sunday
  }
  const defaultDateStr = tomorrow.toISOString().split('T')[0];

  const [selectedDate, setSelectedDate] = useState<string>(defaultDateStr);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<string>('');
  const [slotFetchError, setSlotFetchError] = useState<string | null>(null);

  // Patient Details
  const [patientForm, setPatientForm] = useState({
    fullName: '',
    phoneNumber: '',
    email: '',
    reason: ''
  });
  const [bookingSubmitting, setBookingSubmitting] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [confirmedBooking, setConfirmedBooking] = useState<AppointmentRecord | null>(null);

  // Reusable slot loader
  const loadSlots = useCallback(async (dateStr: string) => {
    if (!dateStr) return;
    setSlotsLoading(true);
    setSlotFetchError(null);
    const result = await fetchAvailableSlots(dateStr);
    if (result.error) {
      setSlotFetchError(result.error);
      setAvailableSlots([]);
    } else {
      setAvailableSlots(result.slots);
      setSlotFetchError(null);
      // Pre-select first available slot if any and no slot is chosen yet
      setSelectedSlot((prev) => {
        const stillAvailable = result.slots.some((s) => s.time === prev && s.available);
        if (stillAvailable) return prev;
        const firstAvail = result.slots.find((s) => s.available);
        return firstAvail ? firstAvail.time : '';
      });
    }
    setSlotsLoading(false);
  }, []);

  // Fetch slots whenever selectedDate changes
  useEffect(() => {
    loadSlots(selectedDate);
  }, [selectedDate, loadSlots]);

  // Handle modal escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setKnowMoreOpen(false);
        setMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Calendar Helpers
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(currentYear, currentMonth, 1).getDay(); // 0 is Sunday
  const monthName = new Date(currentYear, currentMonth, 1).toLocaleString('default', { month: 'long' });

  const isCurrentMonthOrBefore =
    currentYear < today.getFullYear() ||
    (currentYear === today.getFullYear() && currentMonth <= today.getMonth());

  const prevMonth = () => {
    if (isCurrentMonthOrBefore) return; // Prevent navigating to past months
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  const handleDateSelect = (dayNum: number) => {
    const formatted = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
    if (isDateInPast(formatted)) return;
    if (isClinicClosedOnDate(formatted)) return;
    setSelectedDate(formatted);
  };

  const handleBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBookingError(null);

    if (!selectedDate) {
      setBookingError('Please select a consultation date on the calendar.');
      return;
    }
    if (!selectedSlot) {
      setBookingError('Please select an available appointment time slot.');
      return;
    }
    if (!patientForm.fullName.trim()) {
      setBookingError('Please enter your full name.');
      return;
    }
    if (!patientForm.phoneNumber.trim()) {
      setBookingError('Please provide a valid contact phone number.');
      return;
    }

    setBookingSubmitting(true);
    const result = await requestAppointment({
      date: selectedDate,
      timeSlot: selectedSlot,
      fullName: patientForm.fullName,
      phoneNumber: patientForm.phoneNumber,
      email: patientForm.email,
      reason: patientForm.reason
    });
    setBookingSubmitting(false);

    if (result.success && result.booking) {
      setConfirmedBooking(result.booking);
      setBookingError(null);
      // Refresh slots in background so this slot is shown as booked
      loadSlots(selectedDate);
    } else {
      setBookingError(result.error || 'Failed to request appointment. Please check availability.');
    }
  };

  const resetBookingForm = () => {
    setConfirmedBooking(null);
    setBookingError(null);
    setPatientForm({ fullName: '', phoneNumber: '', email: '', reason: '' });
    loadSlots(selectedDate);
  };

  const scrollToSection = (id: string) => {
    setMenuOpen(false);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#FAF9F6] text-neutral-900 selection:bg-neutral-900 selection:text-white">
      {/* =========================================================================
          SECTION 1: HERO SECTION
          Full-screen video hero with liquid glass aesthetics, custom logo,
          overlapping avatars, and floating entrance keyframes.
         ========================================================================= */}
      <section
        id="hero"
        className="relative h-screen h-[100dvh] w-full overflow-hidden flex flex-col justify-between select-none bg-black text-white"
      >
        {/* Full-viewport autoplaying looping muted video with poster fallback */}
        <video
          autoPlay
          loop
          muted
          playsInline
          poster="/src/assets/images/modern_medical_sanctuary_1791820211029.jpg"
          className="absolute inset-0 w-full h-full object-cover z-0"
        >
          <source
            src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260715_082433_69699cf8-444b-4484-93cc-053e57896dfd.mp4"
            type="video/mp4"
          />
        </video>

        {/* Ambient contrast scrim */}
        <div className="absolute inset-0 bg-black/35 pointer-events-none z-[1]" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40 pointer-events-none z-[1]" />

        {/* NAVIGATION (z-20, top) */}
        <header className="relative z-20 flex items-center justify-between px-5 pt-6 sm:px-8 sm:pt-8 md:px-16 lg:px-20 shrink-0">
          {/* Left: Custom SVG Logo */}
          <a
            href="#hero"
            onClick={(e) => {
              e.preventDefault();
              scrollToSection('hero');
            }}
            className="flex items-center gap-3 text-white transition-opacity hover:opacity-90 focus:outline-none"
            aria-label="Dr. Prince Soni Practice Home"
          >
            <svg
              className="w-8 h-8 md:w-9 md:h-9 fill-white shrink-0 drop-shadow-sm"
              viewBox="0 0 256 256"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path d="M 128 128 C 198.692 128 256 185.308 256 256 L 151.883 256 C 149.812 220.307 120.213 192 84 192 C 47.787 192 18.188 220.307 16.117 256 L 0 256 C 0 185.308 57.308 128 128 128 Z M 104.117 0 C 106.188 35.694 135.787 64 172 64 C 208.213 64 237.812 35.694 239.883 0 L 256 0 C 256 70.692 198.692 128 128 128 C 57.308 128 0 70.692 0 0 Z" />
            </svg>
            <span className="text-base sm:text-lg font-medium tracking-tight text-white hidden sm:inline">
              Dr. Prince Soni
            </span>
          </a>

          {/* Center (desktop only): liquid-glass pill */}
          <nav
            className="hidden md:flex liquid-glass rounded-full px-8 py-3 items-center gap-8 shadow-lg"
            aria-label="Desktop Navigation"
          >
            <button
              onClick={() => scrollToSection('hero')}
              className="text-sm font-medium text-white transition-opacity hover:opacity-100 cursor-pointer focus:outline-none"
            >
              Home
            </button>
            <button
              onClick={() => scrollToSection('doctor')}
              className="text-sm font-medium text-white/75 transition-all hover:opacity-100 hover:text-white cursor-pointer focus:outline-none"
            >
              Dr. Soni
            </button>
            <button
              onClick={() => scrollToSection('approach')}
              className="text-sm font-medium text-white/75 transition-all hover:opacity-100 hover:text-white cursor-pointer focus:outline-none"
            >
              Our Approach
            </button>
            <button
              onClick={() => scrollToSection('specialities')}
              className="text-sm font-medium text-white/75 transition-all hover:opacity-100 hover:text-white cursor-pointer focus:outline-none"
            >
              Specialities
            </button>
            <button
              onClick={() => scrollToSection('sanctuary')}
              className="text-sm font-medium text-white/75 transition-all hover:opacity-100 hover:text-white cursor-pointer focus:outline-none"
            >
              Sanctuary
            </button>
            <button
              onClick={() => scrollToSection('experience')}
              className="text-sm font-medium text-white/75 transition-all hover:opacity-100 hover:text-white cursor-pointer focus:outline-none"
            >
              Patient Care
            </button>
          </nav>

          {/* Right (desktop only): liquid-glass circle */}
          <button
            onClick={() => scrollToSection('booking')}
            className="hidden md:flex liquid-glass h-10 w-10 rounded-full items-center justify-center cursor-pointer transition-transform hover:scale-105 active:scale-95 focus:outline-none"
            aria-label="Book an appointment"
            title="Book an appointment"
          >
            <CircleUserRound className="h-5 w-5 text-white/90" strokeWidth={1.5} />
          </button>

          {/* Right (mobile only, md:hidden): liquid-glass circle button */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="liquid-glass h-10 w-10 rounded-full md:hidden flex items-center justify-center relative z-50 cursor-pointer focus:outline-none transition-transform active:scale-95"
            aria-label={menuOpen ? 'Close Navigation Menu' : 'Open Navigation Menu'}
          >
            <Menu
              className={`h-5 w-5 text-white absolute transition-all duration-300 ${
                menuOpen ? 'rotate-90 scale-0 opacity-0' : 'rotate-0 scale-100 opacity-100'
              }`}
              strokeWidth={1.5}
            />
            <X
              className={`h-5 w-5 text-white absolute transition-all duration-300 ${
                menuOpen ? 'rotate-0 scale-100 opacity-100' : '-rotate-90 scale-0 opacity-0'
              }`}
              strokeWidth={1.5}
            />
          </button>
        </header>

        {/* MOBILE MENU OVERLAY (z-10, fixed inset-0, md:hidden) */}
        <div
          className={`fixed inset-0 z-10 md:hidden bg-black/85 backdrop-blur-xl flex flex-col items-center justify-center transition-opacity duration-500 ease-out ${
            menuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
          }`}
        >
          <div
            className={`flex flex-col items-center gap-7 transition-transform duration-500 ease-out ${
              menuOpen ? 'translate-y-0' : '-translate-y-8'
            }`}
          >
            <button
              onClick={() => scrollToSection('hero')}
              className="text-2xl font-medium text-white transition-opacity hover:opacity-80 focus:outline-none"
            >
              Home
            </button>
            <button
              onClick={() => scrollToSection('doctor')}
              className="text-2xl font-medium text-white transition-opacity hover:opacity-80 focus:outline-none"
            >
              Dr. Soni
            </button>
            <button
              onClick={() => scrollToSection('approach')}
              className="text-2xl font-medium text-white transition-opacity hover:opacity-80 focus:outline-none"
            >
              Our Approach
            </button>
            <button
              onClick={() => scrollToSection('specialities')}
              className="text-2xl font-medium text-white transition-opacity hover:opacity-80 focus:outline-none"
            >
              Specialities
            </button>
            <button
              onClick={() => scrollToSection('sanctuary')}
              className="text-2xl font-medium text-white transition-opacity hover:opacity-80 focus:outline-none"
            >
              Sanctuary
            </button>
            <button
              onClick={() => scrollToSection('experience')}
              className="text-2xl font-medium text-white transition-opacity hover:opacity-80 focus:outline-none"
            >
              Patient Care
            </button>
            <button
              onClick={() => scrollToSection('booking')}
              className="text-2xl font-medium text-white/90 underline underline-offset-8 transition-opacity hover:opacity-100 focus:outline-none"
            >
              Book Appointment
            </button>
            <div className="pt-3 flex flex-col items-center gap-2">
              <button
                onClick={() => scrollToSection('booking')}
                className="liquid-glass h-12 w-12 rounded-full flex items-center justify-center cursor-pointer transition-transform hover:scale-105 active:scale-95 focus:outline-none"
                aria-label="Request Appointment"
              >
                <CircleUserRound className="h-6 w-6 text-white/90" strokeWidth={1.5} />
              </button>
              <span className="text-sm font-light text-white/70">Schedule Visit</span>
            </div>
          </div>
        </div>

        {/* HERO MAIN CONTENT (z-10) with subtle floating entrance animations */}
        <div
          className={`relative z-10 flex flex-col justify-between flex-1 px-5 pb-7 sm:px-8 sm:pb-9 md:px-16 md:pb-12 lg:px-20 lg:pb-14 transition-opacity duration-300 ${
            menuOpen ? 'opacity-0 pointer-events-none md:opacity-100 md:pointer-events-auto' : 'opacity-100'
          }`}
        >
          {/* Top block */}
          <div className="mt-14 sm:mt-20 md:mt-28 max-w-2xl">
            {/* 1. Badge — liquid-glass pill with floating entrance */}
            <div className="animate-float-in-1 liquid-glass rounded-full inline-flex items-center gap-2.5 sm:gap-3 px-3 py-1.5 sm:px-4 sm:py-2 mb-5 sm:mb-6 cursor-default">
              <div className="flex -space-x-2 shrink-0">
                <span className="h-5 w-5 sm:h-6 sm:w-6 rounded-full bg-emerald-700/80 border-2 border-white/30 flex items-center justify-center text-[10px] font-semibold text-white">
                  PS
                </span>
                <span className="h-5 w-5 sm:h-6 sm:w-6 rounded-full bg-neutral-700 border-2 border-white/30 flex items-center justify-center text-[10px] font-semibold text-white">
                  IM
                </span>
                <span className="h-5 w-5 sm:h-6 sm:w-6 rounded-full bg-amber-700/80 border-2 border-white/30 flex items-center justify-center text-[10px] font-semibold text-white">
                  VW
                </span>
              </div>
              <span className="text-xs sm:text-sm font-light text-white/90 whitespace-nowrap">
                Our Path to Natural Wellness
              </span>
            </div>

            {/* 2. Heading with subtle floating entrance */}
            <h1
              className="animate-float-in-2 text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-normal leading-[1.05] text-white"
              style={{ letterSpacing: '-0.05em' }}
            >
              Heal Your Body
              <br />
              Naturally
            </h1>

            {/* 3. Subtitle with subtle floating entrance */}
            <p className="animate-float-in-3 mt-4 sm:mt-5 text-sm sm:text-base md:text-lg font-light text-white/80">
              Holistic wellness. Transformative results.
            </p>

            {/* 4. CTA button with subtle floating entrance */}
            <div className="animate-float-in-4">
              <button
                onClick={() => scrollToSection('booking')}
                className="liquid-glass rounded-full px-6 py-3 sm:px-7 sm:py-3.5 mt-6 sm:mt-8 text-sm font-medium text-white transition duration-300 hover:bg-white/15 cursor-pointer inline-flex items-center gap-2 group active:scale-[0.98] focus:outline-none shadow-sm"
              >
                <span>Begin Your Journey</span>
                <ArrowRight className="w-4 h-4 text-white/90 transition-transform duration-300 group-hover:translate-x-1" />
              </button>
            </div>
          </div>

          {/* BOTTOM STATS */}
          <div className="flex items-end gap-6 sm:gap-10 md:gap-16 mt-8 sm:mt-12">
            {/* Stat 1: 48 Hours */}
            <button
              onClick={() => scrollToSection('booking')}
              className="group text-left flex flex-col cursor-pointer focus:outline-none transition-transform hover:-translate-y-0.5"
              aria-label="Jump to scheduling"
            >
              <div className="w-5 h-5 relative mb-2 sm:mb-2.5 opacity-80 group-hover:opacity-100 transition-opacity">
                {TRIANGLE_DOTS.map((dot, idx) => (
                  <span
                    key={idx}
                    className="absolute bg-white/70 rounded-[0.5px]"
                    style={{
                      left: `${dot.left}px`,
                      top: `${dot.top}px`,
                      width: '2.5px',
                      height: '2.5px',
                    }}
                  />
                ))}
              </div>
              <span className="text-xl sm:text-2xl md:text-3xl font-normal text-white tabular-nums tracking-tight">
                48 Hours
              </span>
              <span className="text-xs sm:text-sm font-light text-white/70">
                Initial Consultation
              </span>
            </button>

            {/* Stat 2: Initial Consultation */}
            <button
              onClick={() => scrollToSection('experience')}
              className="group text-left flex flex-col cursor-pointer focus:outline-none transition-transform hover:-translate-y-0.5"
              aria-label="View healing session journey"
            >
              <div className="w-5 h-5 flex items-center justify-center mb-2 sm:mb-2.5 opacity-80 group-hover:opacity-100 transition-opacity">
                <div className="grid grid-cols-3 gap-[2px]">
                  {CHECKERBOARD_GRID.map((bgClass, idx) => (
                    <div key={idx} className={`w-[4px] h-[4px] rounded-[1px] ${bgClass}`} />
                  ))}
                </div>
              </div>
              <span className="text-xl sm:text-2xl md:text-3xl font-normal text-white tracking-tight">
                Personalised Care
              </span>
              <span className="text-xs sm:text-sm font-light text-white/70">
                Healing Sessions
              </span>
            </button>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 2: DOCTOR INTRODUCTION
          Spacious section introducing Dr. Prince Soni.
          - Professional doctor portrait
          - Name and medical speciality
          - One short introductory sentence
          - Minimal "Know More" modal link
         ========================================================================= */}
      <section
        id="doctor"
        className="py-24 sm:py-32 px-5 sm:px-8 md:px-16 lg:px-20 max-w-7xl mx-auto border-b border-neutral-200/80"
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          {/* Portrait Column */}
          <div className="lg:col-span-5 flex justify-center">
            <div className="relative w-full max-w-md aspect-[3/4] rounded-2xl overflow-hidden shadow-xl bg-neutral-100 border border-neutral-200">
              <img
                src="/src/assets/images/dr_prince_soni_portrait_1791820191147.jpg"
                alt="Dr. Prince Soni, Internal and Integrative Medicine Physician"
                className="w-full h-full object-cover object-top filter contrast-[1.02]"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none" />
              <div className="absolute bottom-4 left-4 right-4 bg-white/95 backdrop-blur-md px-4 py-2.5 rounded-xl border border-white/50 flex items-center justify-between shadow-sm">
                <span className="text-xs font-medium text-neutral-800">In-Clinic Consultation</span>
                <span className="text-[11px] text-neutral-500 font-light">Direct Physician Access</span>
              </div>
            </div>
          </div>

          {/* Details Column */}
          <div className="lg:col-span-7 flex flex-col justify-center">
            <div className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-neutral-500 mb-3">
              <Stethoscope className="w-3.5 h-3.5 text-neutral-700" />
              <span>Attending Physician</span>
            </div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-normal tracking-tight text-neutral-900 mb-2">
              Dr. Prince Soni
            </h2>
            <p className="text-base sm:text-lg text-neutral-600 font-light mb-6">
              Internal &amp; Integrative Medicine
            </p>
            <div className="w-12 h-[1px] bg-neutral-300 mb-6" />

            {/* Exactly one short introductory sentence */}
            <p className="text-lg sm:text-xl text-neutral-700 font-light leading-relaxed mb-8 max-w-xl">
              Dr. Prince Soni is a dedicated physician specialising in internal and integrative medicine, bringing a compassionate, evidence-based focus to patient longevity and everyday vitality.
            </p>

            {/* Minimal Know More link & Booking Link */}
            <div className="flex items-center gap-6">
              <button
                onClick={() => setKnowMoreOpen(true)}
                className="inline-flex items-center gap-2 text-sm font-medium text-neutral-900 border-b border-neutral-900/40 pb-1 hover:border-neutral-900 hover:gap-3 transition-all cursor-pointer focus:outline-none"
              >
                <span>Know More</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => scrollToSection('booking')}
                className="text-xs font-medium text-neutral-500 hover:text-neutral-900 transition-colors cursor-pointer"
              >
                Request Consultation &rarr;
              </button>
            </div>
          </div>
        </div>

        {/* Minimal Know More Modal */}
        {knowMoreOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-doctor-title"
          >
            <div className="bg-white rounded-2xl w-full max-w-lg p-6 sm:p-8 relative shadow-2xl border border-neutral-200 max-h-[85vh] overflow-y-auto">
              <button
                onClick={() => setKnowMoreOpen(false)}
                className="absolute top-5 right-5 text-neutral-400 hover:text-neutral-900 transition-colors p-1 rounded-full hover:bg-neutral-100 focus:outline-none"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="text-xs font-medium uppercase tracking-wider text-neutral-400 mb-1">
                Clinical Focus &amp; Philosophy
              </div>
              <h3 id="modal-doctor-title" className="text-2xl font-normal text-neutral-900 mb-4">
                Dr. Prince Soni
              </h3>
              <div className="space-y-4 text-sm text-neutral-600 font-light leading-relaxed">
                <p>
                  In modern healthcare, patients frequently navigate fragmented clinical care with limited time for comprehensive doctor-patient dialogue.
                </p>
                <p>
                  Dr. Soni&apos;s clinical philosophy centers on restoring unhurried communication and thorough diagnostic evaluation. By looking closely at the intersection of cardiovascular health, metabolic markers, and daily restorative habits, care plans are systematically tailored to each individual.
                </p>
                <p>
                  Every consultation is structured to listen to the patient&apos;s full history, conduct meticulous evaluations, and recommend clear, verified therapeutic steps.
                </p>
              </div>
              <div className="mt-8 pt-6 border-t border-neutral-100 flex justify-between items-center">
                <button
                  onClick={() => {
                    setKnowMoreOpen(false);
                    scrollToSection('booking');
                  }}
                  className="px-5 py-2.5 rounded-full bg-neutral-900 text-white text-xs font-medium hover:bg-neutral-800 transition-colors cursor-pointer"
                >
                  Schedule Initial Consultation
                </button>
                <button
                  onClick={() => setKnowMoreOpen(false)}
                  className="text-xs text-neutral-500 hover:text-neutral-800"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* =========================================================================
          SECTION 3: OUR APPROACH
          Three concise principles:
          - Personalised Care
          - Evidence-Based Treatment
          - Patient-First Approach
         ========================================================================= */}
      <section
        id="approach"
        className="py-24 sm:py-32 px-5 sm:px-8 md:px-16 lg:px-20 max-w-7xl mx-auto border-b border-neutral-200/80"
      >
        <div className="max-w-2xl mb-16">
          <span className="text-xs font-medium uppercase tracking-wider text-neutral-500 block mb-3">
            Core Philosophy
          </span>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-normal tracking-tight text-neutral-900 mb-4">
            Our Approach
          </h2>
          <p className="text-base sm:text-lg text-neutral-600 font-light">
            Healthcare designed around clinical precision, thoughtful listening, and deliberate partnership.
          </p>
        </div>

        {/* 3 Principles in an elegant architectural layout */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-12">
          {/* Principle 1 */}
          <div className="flex flex-col justify-between p-8 rounded-2xl bg-white border border-neutral-200/90 shadow-sm hover:border-neutral-300 transition-all group">
            <div>
              <div className="w-10 h-10 rounded-xl bg-neutral-100 flex items-center justify-center text-neutral-800 mb-6 group-hover:scale-105 transition-transform">
                <User className="w-5 h-5 stroke-[1.5]" />
              </div>
              <span className="text-xs font-mono text-neutral-400 block mb-2">01</span>
              <h3 className="text-xl font-normal text-neutral-900 mb-3 tracking-tight">
                Personalised Care
              </h3>
              <p className="text-sm text-neutral-600 font-light leading-relaxed">
                Every consultation begins with an in-depth review of your individual health profile, metabolic factors, and lifestyle rhythms to formulate targeted care.
              </p>
            </div>
            <div className="pt-6 mt-6 border-t border-neutral-100 text-xs text-neutral-400 font-light">
              Tailored Clinical Focus
            </div>
          </div>

          {/* Principle 2 */}
          <div className="flex flex-col justify-between p-8 rounded-2xl bg-white border border-neutral-200/90 shadow-sm hover:border-neutral-300 transition-all group">
            <div>
              <div className="w-10 h-10 rounded-xl bg-neutral-100 flex items-center justify-center text-neutral-800 mb-6 group-hover:scale-105 transition-transform">
                <ShieldCheck className="w-5 h-5 stroke-[1.5]" />
              </div>
              <span className="text-xs font-mono text-neutral-400 block mb-2">02</span>
              <h3 className="text-xl font-normal text-neutral-900 mb-3 tracking-tight">
                Evidence-Based Treatment
              </h3>
              <p className="text-sm text-neutral-600 font-light leading-relaxed">
                Treatments and diagnostic recommendations remain grounded strictly in peer-reviewed clinical science, validated data, and medical guidelines.
              </p>
            </div>
            <div className="pt-6 mt-6 border-t border-neutral-100 text-xs text-neutral-400 font-light">
              Scientifically Verified
            </div>
          </div>

          {/* Principle 3 */}
          <div className="flex flex-col justify-between p-8 rounded-2xl bg-white border border-neutral-200/90 shadow-sm hover:border-neutral-300 transition-all group">
            <div>
              <div className="w-10 h-10 rounded-xl bg-neutral-100 flex items-center justify-center text-neutral-800 mb-6 group-hover:scale-105 transition-transform">
                <HeartPulse className="w-5 h-5 stroke-[1.5]" />
              </div>
              <span className="text-xs font-mono text-neutral-400 block mb-2">03</span>
              <h3 className="text-xl font-normal text-neutral-900 mb-3 tracking-tight">
                Patient-First Approach
              </h3>
              <p className="text-sm text-neutral-600 font-light leading-relaxed">
                Uncompromised time to listen, address concerns, and involve you directly in decisions regarding your ongoing health and treatment choices.
              </p>
            </div>
            <div className="pt-6 mt-6 border-t border-neutral-100 text-xs text-neutral-400 font-light">
              Collaborative Decision Making
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 4: SPECIALITIES / SERVICES
          Clean, premium grid with simple visual, short title and description.
         ========================================================================= */}
      <section
        id="specialities"
        className="py-24 sm:py-32 px-5 sm:px-8 md:px-16 lg:px-20 max-w-7xl mx-auto border-b border-neutral-200/80"
      >
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-16 gap-6">
          <div className="max-w-xl">
            <span className="text-xs font-medium uppercase tracking-wider text-neutral-500 block mb-3">
              Clinical Areas
            </span>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-normal tracking-tight text-neutral-900 mb-3">
              Specialities &amp; Services
            </h2>
            <p className="text-base sm:text-lg text-neutral-600 font-light">
              Dedicated clinical care tailored to adult preventative health and internal medicine.
            </p>
          </div>
          <button
            onClick={() => scrollToSection('booking')}
            className="inline-flex items-center gap-2 text-xs font-medium text-neutral-900 hover:text-neutral-600 transition-colors self-start md:self-end cursor-pointer"
          >
            <span>Check slot availability</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Service 1 */}
          <div className="p-7 rounded-2xl bg-white border border-neutral-200/80 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-xl bg-neutral-100 flex items-center justify-center text-neutral-800 mb-5">
                <Activity className="w-5 h-5 stroke-[1.5]" />
              </div>
              <h3 className="text-lg font-medium text-neutral-900 mb-2 tracking-tight">
                Comprehensive Assessments
              </h3>
              <p className="text-xs sm:text-sm text-neutral-600 font-light leading-relaxed">
                Complete health screenings, baseline cardiovascular evaluations, and preventive laboratory examinations.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-neutral-100 text-[11px] text-neutral-400 font-light">
              Preventative Diagnostic Care
            </div>
          </div>

          {/* Service 2 */}
          <div className="p-7 rounded-2xl bg-white border border-neutral-200/80 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-xl bg-neutral-100 flex items-center justify-center text-neutral-800 mb-5">
                <Stethoscope className="w-5 h-5 stroke-[1.5]" />
              </div>
              <h3 className="text-lg font-medium text-neutral-900 mb-2 tracking-tight">
                Chronic Care Management
              </h3>
              <p className="text-xs sm:text-sm text-neutral-600 font-light leading-relaxed">
                Ongoing therapeutic monitoring for blood pressure, blood glucose, cholesterol, and metabolic vitality.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-neutral-100 text-[11px] text-neutral-400 font-light">
              Long-Term Health Support
            </div>
          </div>

          {/* Service 3 */}
          <div className="p-7 rounded-2xl bg-white border border-neutral-200/80 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-xl bg-neutral-100 flex items-center justify-center text-neutral-800 mb-5">
                <Sparkles className="w-5 h-5 stroke-[1.5]" />
              </div>
              <h3 className="text-lg font-medium text-neutral-900 mb-2 tracking-tight">
                Integrative Consultations
              </h3>
              <p className="text-xs sm:text-sm text-neutral-600 font-light leading-relaxed">
                Balancing proven internal medicine with circadian rhythms, sleep restoration, and natural nutritional protocols.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-neutral-100 text-[11px] text-neutral-400 font-light">
              Holistic Equilibrium
            </div>
          </div>

          {/* Service 4 */}
          <div className="p-7 rounded-2xl bg-white border border-neutral-200/80 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-xl bg-neutral-100 flex items-center justify-center text-neutral-800 mb-5">
                <FileText className="w-5 h-5 stroke-[1.5]" />
              </div>
              <h3 className="text-lg font-medium text-neutral-900 mb-2 tracking-tight">
                Treatment Plan Follow-ups
              </h3>
              <p className="text-xs sm:text-sm text-neutral-600 font-light leading-relaxed">
                Scheduled milestone reviews to examine treatment responses, adjust protocols, and support patient progress.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-neutral-100 text-[11px] text-neutral-400 font-light">
              Milestone Continuity
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 5: SANCTUARY & PRACTICE STANDARDS
          Features real clinic photography & verified practice standards.
         ========================================================================= */}
      <section
        id="sanctuary"
        className="py-24 sm:py-32 px-5 sm:px-8 md:px-16 lg:px-20 max-w-7xl mx-auto border-b border-neutral-200/80"
      >
        <div className="mb-14">
          <span className="text-xs font-medium uppercase tracking-wider text-neutral-500 block mb-3">
            The Healing Environment
          </span>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-normal tracking-tight text-neutral-900 mb-4">
            A Calming Clinical Sanctuary
          </h2>
          <p className="text-base sm:text-lg text-neutral-600 font-light max-w-2xl">
            Designed to reduce clinical anxiety and foster open, relaxed dialogues between physician and patient.
          </p>
        </div>

        {/* Sanctuary Visual Banner */}
        <div className="relative rounded-3xl overflow-hidden shadow-xl border border-neutral-200 mb-16 aspect-[16/9] sm:aspect-[21/9]">
          <img
            src="/src/assets/images/modern_medical_sanctuary_1791820211029.jpg"
            alt="Dr. Prince Soni Modern Medical Sanctuary Consultation Room"
            className="w-full h-full object-cover"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent pointer-events-none" />
          <div className="absolute bottom-6 left-6 right-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4 text-white">
            <div>
              <span className="text-xs font-mono tracking-wider uppercase text-white/80 block mb-1">
                Medical Suites 402 &middot; West Wing Health Center
              </span>
              <h3 className="text-xl sm:text-2xl font-light">
                Quiet, Natural Light &amp; Deliberate Serenity
              </h3>
            </div>
            <button
              onClick={() => scrollToSection('booking')}
              className="px-5 py-2.5 rounded-full bg-white text-neutral-900 text-xs font-medium hover:bg-neutral-100 transition-colors shadow-sm self-start sm:self-auto cursor-pointer"
            >
              Reserve a Visit &rarr;
            </button>
          </div>
        </div>

        {/* 4 Practice Standards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="p-6 rounded-2xl bg-white border border-neutral-200/90 shadow-sm">
            <span className="text-xs font-mono text-neutral-400 block mb-2">01</span>
            <h3 className="text-base font-medium text-neutral-900 mb-2">
              Unhurried Appointments
            </h3>
            <p className="text-xs sm:text-sm text-neutral-600 font-light leading-relaxed">
              Generous consultation blocks allow ample time to discuss root causes without clinical rush.
            </p>
          </div>
          <div className="p-6 rounded-2xl bg-white border border-neutral-200/90 shadow-sm">
            <span className="text-xs font-mono text-neutral-400 block mb-2">02</span>
            <h3 className="text-base font-medium text-neutral-900 mb-2">
              Transparent Care Pathways
            </h3>
            <p className="text-xs sm:text-sm text-neutral-600 font-light leading-relaxed">
              Clear explanations of tests, diagnoses, and proposed therapeutic options at every juncture.
            </p>
          </div>
          <div className="p-6 rounded-2xl bg-white border border-neutral-200/90 shadow-sm">
            <span className="text-xs font-mono text-neutral-400 block mb-2">03</span>
            <h3 className="text-base font-medium text-neutral-900 mb-2">
              Serene Sanctuary
            </h3>
            <p className="text-xs sm:text-sm text-neutral-600 font-light leading-relaxed">
              A minimal, calm consultation setting designed intentionally to ease healthcare anxiety.
            </p>
          </div>
          <div className="p-6 rounded-2xl bg-white border border-neutral-200/90 shadow-sm">
            <span className="text-xs font-mono text-neutral-400 block mb-2">04</span>
            <h3 className="text-base font-medium text-neutral-900 mb-2">
              Structured Follow-Up
            </h3>
            <p className="text-xs sm:text-sm text-neutral-600 font-light leading-relaxed">
              Continuous guidance and scheduled check-ins to monitor health improvements over time.
            </p>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 6: PATIENT CARE EXPERIENCE
          Timeline: 01 Book -> 02 Consultation -> 03 Personalised Care Plan
         ========================================================================= */}
      <section
        id="experience"
        className="py-24 sm:py-32 px-5 sm:px-8 md:px-16 lg:px-20 max-w-7xl mx-auto border-b border-neutral-200/80"
      >
        <div className="max-w-2xl mb-16">
          <span className="text-xs font-medium uppercase tracking-wider text-neutral-500 block mb-3">
            Your Journey
          </span>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-normal tracking-tight text-neutral-900 mb-3">
            Patient Care Experience
          </h2>
          <p className="text-base sm:text-lg text-neutral-600 font-light">
            A simple, predictable, and supportive path from initial booking to ongoing wellness.
          </p>
        </div>

        {/* Minimal Timeline */}
        <div className="relative">
          {/* Horizontal connecting line on desktop */}
          <div className="hidden md:block absolute top-7 left-12 right-12 h-[1px] bg-neutral-200 -z-0" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-8 relative z-10">
            {/* Step 1 */}
            <div className="flex flex-col">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-14 h-14 rounded-2xl bg-white border border-neutral-300 shadow-sm flex items-center justify-center font-mono text-sm font-semibold text-neutral-900 shrink-0">
                  01
                </div>
                <div className="md:hidden h-[1px] flex-1 bg-neutral-200" />
              </div>
              <h3 className="text-xl font-normal text-neutral-900 mb-2 tracking-tight">
                Book Your Appointment
              </h3>
              <p className="text-sm text-neutral-600 font-light leading-relaxed">
                Select your preferred consultation date and available time slot through our secure online scheduling system.
              </p>
            </div>

            {/* Step 2 */}
            <div className="flex flex-col">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-14 h-14 rounded-2xl bg-white border border-neutral-300 shadow-sm flex items-center justify-center font-mono text-sm font-semibold text-neutral-900 shrink-0">
                  02
                </div>
                <div className="md:hidden h-[1px] flex-1 bg-neutral-200" />
              </div>
              <h3 className="text-xl font-normal text-neutral-900 mb-2 tracking-tight">
                Consultation
              </h3>
              <p className="text-sm text-neutral-600 font-light leading-relaxed">
                Meet one-on-one with Dr. Prince Soni for an unhurried, comprehensive discussion regarding your symptoms, questions, and goals.
              </p>
            </div>

            {/* Step 3 */}
            <div className="flex flex-col">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-14 h-14 rounded-2xl bg-white border border-neutral-300 shadow-sm flex items-center justify-center font-mono text-sm font-semibold text-neutral-900 shrink-0">
                  03
                </div>
                <div className="md:hidden h-[1px] flex-1 bg-neutral-200" />
              </div>
              <h3 className="text-xl font-normal text-neutral-900 mb-2 tracking-tight">
                Personalised Care Plan
              </h3>
              <p className="text-sm text-neutral-600 font-light leading-relaxed">
                Receive a clear, tailored clinical treatment protocol complete with lifestyle advice, diagnostics, and scheduled milestones.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-14 p-6 sm:p-8 rounded-2xl bg-white border border-neutral-200/80 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-800 shrink-0">
              <Calendar className="w-5 h-5 stroke-[1.5]" />
            </div>
            <div>
              <span className="text-sm font-medium text-neutral-900 block">
                Next Available Openings
              </span>
              <span className="text-xs text-neutral-500 font-light">
                Consultations typically confirmed within 48 business hours
              </span>
            </div>
          </div>
          <button
            onClick={() => scrollToSection('booking')}
            className="w-full sm:w-auto px-6 py-2.5 rounded-full bg-neutral-900 text-white text-xs font-medium hover:bg-neutral-800 transition-colors cursor-pointer shrink-0"
          >
            Go to Appointment Calendar &darr;
          </button>
        </div>
      </section>

      {/* =========================================================================
          SECTION 7: FREQUENTLY ASKED QUESTIONS
          Maximum 4 short, relevant FAQs using an elegant accordion.
         ========================================================================= */}
      <section
        id="faq"
        className="py-24 sm:py-32 px-5 sm:px-8 md:px-16 lg:px-20 max-w-4xl mx-auto border-b border-neutral-200/80"
      >
        <div className="text-center max-w-xl mx-auto mb-16">
          <span className="text-xs font-medium uppercase tracking-wider text-neutral-500 block mb-3">
            Common Inquiries
          </span>
          <h2 className="text-3xl sm:text-4xl font-normal tracking-tight text-neutral-900 mb-3">
            Frequently Asked Questions
          </h2>
          <p className="text-sm sm:text-base text-neutral-600 font-light">
            Concise answers regarding consultation protocols, appointments, and care.
          </p>
        </div>

        <div className="space-y-4">
          {FAQS.map((faq, index) => {
            const isOpen = activeFaq === index;
            return (
              <div
                key={index}
                className="rounded-2xl bg-white border border-neutral-200/90 overflow-hidden transition-all shadow-sm"
              >
                <button
                  onClick={() => setActiveFaq(isOpen ? null : index)}
                  className="w-full px-6 py-5 flex items-center justify-between text-left cursor-pointer focus:outline-none"
                  aria-expanded={isOpen}
                >
                  <span className="text-base font-normal text-neutral-900 pr-4">
                    {faq.question}
                  </span>
                  <ChevronDown
                    className={`w-5 h-5 text-neutral-500 shrink-0 transition-transform duration-300 ${
                      isOpen ? 'rotate-180 text-neutral-900' : ''
                    }`}
                  />
                </button>
                {isOpen && (
                  <div className="px-6 pb-6 pt-1 text-sm text-neutral-600 font-light leading-relaxed border-t border-neutral-100">
                    {faq.answer}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* =========================================================================
          SECTION 8: FINAL APPOINTMENT BOOKING SECTION
          Step 1: Select consultation date using calendar
          Step 2: Display available appointment time slots for that date
          Step 3: Allow patient to select one time slot
          Step 4: Collect patient details (Name, Phone, Email, Reason)
          Step 5: Show clean booking summary
          Step 6: Provide clear "Request Appointment" button
         ========================================================================= */}
      <section
        id="booking"
        className="py-24 sm:py-32 px-5 sm:px-8 md:px-16 lg:px-20 max-w-7xl mx-auto"
      >
        <div className="max-w-2xl mx-auto text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-neutral-200/70 text-neutral-800 text-xs font-medium mb-3">
            <Calendar className="w-3.5 h-3.5 text-neutral-700" />
            <span>Interactive Scheduling System</span>
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-normal tracking-tight text-neutral-900 mb-3">
            Request an Appointment
          </h2>
          <p className="text-base text-neutral-600 font-light">
            Select an available time slot and submit your consultation inquiry directly to Dr. Prince Soni&apos;s clinical schedule.
          </p>
        </div>

        {confirmedBooking ? (
          /* Confirmation / Pending Approval Screen */
          <div className="max-w-2xl mx-auto bg-white rounded-3xl p-8 sm:p-12 border border-neutral-200 shadow-xl text-center animate-in fade-in duration-300">
            <div className="w-16 h-16 rounded-full bg-neutral-900 text-white flex items-center justify-center mx-auto mb-6 shadow-md">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-xs font-medium mb-4">
              <Clock className="w-3.5 h-3.5" />
              <span>Status: Request Submitted (Pending Approval)</span>
            </div>

            <h3 className="text-2xl sm:text-3xl font-normal text-neutral-900 mb-3">
              Consultation Inquiry Received
            </h3>

            <p className="text-sm text-neutral-600 font-light leading-relaxed max-w-lg mx-auto mb-8">
              Thank you, <span className="font-medium text-neutral-900">{confirmedBooking.fullName}</span>. Your appointment request has been logged in Dr. Soni&apos;s scheduling queue. Our office will verify availability and reach out via phone within 48 hours to confirm intake details.
            </p>

            {/* Booking Details Card */}
            <div className="bg-neutral-50 rounded-2xl p-6 text-left border border-neutral-200/80 mb-8 space-y-3">
              <div className="flex justify-between items-center text-xs pb-3 border-b border-neutral-200">
                <span className="text-neutral-500 font-light">Reference ID</span>
                <span className="font-mono font-medium text-neutral-900">{confirmedBooking.id}</span>
              </div>
              <div className="flex justify-between items-center text-xs pb-3 border-b border-neutral-200">
                <span className="text-neutral-500 font-light">Requested Date</span>
                <span className="font-medium text-neutral-900">{confirmedBooking.date}</span>
              </div>
              <div className="flex justify-between items-center text-xs pb-3 border-b border-neutral-200">
                <span className="text-neutral-500 font-light">Requested Time</span>
                <span className="font-medium text-neutral-900">{confirmedBooking.timeSlot}</span>
              </div>
              <div className="flex justify-between items-center text-xs pb-3 border-b border-neutral-200">
                <span className="text-neutral-500 font-light">Contact Phone</span>
                <span className="font-medium text-neutral-900">{confirmedBooking.phoneNumber}</span>
              </div>
              {confirmedBooking.email && (
                <div className="flex justify-between items-center text-xs pb-3 border-b border-neutral-200">
                  <span className="text-neutral-500 font-light">Email</span>
                  <span className="font-medium text-neutral-900">{confirmedBooking.email}</span>
                </div>
              )}
              {confirmedBooking.reason && (
                <div className="text-xs pt-1">
                  <span className="text-neutral-500 font-light block mb-1">Reason for Visit</span>
                  <span className="text-neutral-800 italic">{confirmedBooking.reason}</span>
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={resetBookingForm}
                className="px-6 py-3 rounded-full bg-neutral-900 text-white text-xs font-medium hover:bg-neutral-800 transition-colors cursor-pointer"
              >
                Schedule Another Consultation
              </button>
              <button
                onClick={() => scrollToSection('hero')}
                className="px-6 py-3 rounded-full bg-neutral-100 text-neutral-700 text-xs font-medium hover:bg-neutral-200 transition-colors cursor-pointer"
              >
                Return to Top
              </button>
            </div>
          </div>
        ) : (
          /* Multi-Step Booking Interface */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left Column: Calendar & Time Slots */}
            <div className="lg:col-span-7 bg-white rounded-3xl p-6 sm:p-8 border border-neutral-200 shadow-sm space-y-8">
              {/* Step 1: Calendar */}
              <div>
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <span className="text-[11px] font-mono uppercase tracking-wider text-neutral-400 block">
                      Step 1 of 4
                    </span>
                    <h3 className="text-lg font-medium text-neutral-900">
                      Select Consultation Date
                    </h3>
                  </div>

                  {/* Month Navigation */}
                  <div className="flex items-center gap-1.5 bg-neutral-100 p-1 rounded-xl">
                    <button
                      type="button"
                      disabled={isCurrentMonthOrBefore}
                      onClick={prevMonth}
                      className="p-1.5 rounded-lg hover:bg-white text-neutral-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                      aria-label="Previous month"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-xs font-medium text-neutral-800 px-2 min-w-[100px] text-center">
                      {monthName} {currentYear}
                    </span>
                    <button
                      type="button"
                      onClick={nextMonth}
                      className="p-1.5 rounded-lg hover:bg-white text-neutral-600 transition-colors cursor-pointer"
                      aria-label="Next month"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Calendar Grid */}
                <div className="border border-neutral-100 rounded-2xl p-3 bg-neutral-50/50">
                  <div className="grid grid-cols-7 text-center mb-2">
                    {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day) => (
                      <span key={day} className="text-[11px] font-medium text-neutral-400 py-1">
                        {day}
                      </span>
                    ))}
                  </div>

                  <div className="grid grid-cols-7 gap-1">
                    {/* Empty placeholder cells for month offset */}
                    {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                      <div key={`empty-${i}`} className="aspect-square" />
                    ))}

                    {/* Day buttons */}
                    {Array.from({ length: daysInMonth }).map((_, i) => {
                      const dayNum = i + 1;
                      const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                      const isPast = isDateInPast(dateStr);
                      const isSunday = isClinicClosedOnDate(dateStr);
                      const isSelected = selectedDate === dateStr;
                      const isDisabled = isPast || isSunday;

                      return (
                        <button
                          key={dayNum}
                          type="button"
                          disabled={isDisabled}
                          aria-label={`Select ${monthName} ${dayNum}, ${currentYear}${isDisabled ? ' (Unavailable)' : ''}`}
                          onClick={() => handleDateSelect(dayNum)}
                          className={`aspect-square rounded-xl text-xs flex flex-col items-center justify-center transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-neutral-900 text-white font-semibold shadow-sm'
                              : isDisabled
                              ? 'text-neutral-300 bg-transparent cursor-not-allowed'
                              : 'text-neutral-800 bg-white hover:bg-neutral-200/70 border border-neutral-200/50'
                          }`}
                        >
                          <span>{dayNum}</span>
                          {isSunday && (
                            <span className="text-[8px] text-neutral-400 leading-none">Off</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-center gap-4 text-[11px] text-neutral-400 font-light mt-3 px-1">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-neutral-900 inline-block" />
                    <span>Selected Date</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-neutral-200 inline-block" />
                    <span>Closed (Sundays) / Past</span>
                  </div>
                </div>
              </div>

              {/* Step 2 & 3: Display Available Time Slots & Allow Patient to Select One */}
              <div className="pt-6 border-t border-neutral-100">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <span className="text-[11px] font-mono uppercase tracking-wider text-neutral-400 block">
                      Steps 2 &amp; 3 of 4
                    </span>
                    <h3 className="text-lg font-medium text-neutral-900">
                      Available Consultation Times
                    </h3>
                  </div>
                  <span className="text-xs font-mono text-neutral-500 bg-neutral-100 px-2.5 py-1 rounded-lg">
                    {selectedDate || 'Select a date'}
                  </span>
                </div>

                {slotFetchError ? (
                  <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{slotFetchError}</span>
                  </div>
                ) : slotsLoading ? (
                  <div className="py-8 flex items-center justify-center gap-2 text-xs text-neutral-500">
                    <div className="w-4 h-4 rounded-full border-2 border-neutral-400 border-t-transparent animate-spin" />
                    <span>Checking Dr. Soni&apos;s real-time schedule...</span>
                  </div>
                ) : availableSlots.length === 0 ? (
                  <div className="p-6 text-center text-xs text-neutral-500 bg-neutral-50 rounded-xl border border-neutral-100">
                    No consultation openings available for this date. Please select another date.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {availableSlots.map((slot) => {
                      const isChosen = selectedSlot === slot.time;
                      return (
                        <button
                          key={slot.time}
                          type="button"
                          disabled={!slot.available}
                          aria-pressed={isChosen}
                          onClick={() => setSelectedSlot(slot.time)}
                          className={`p-3 rounded-xl text-xs font-medium transition-all flex items-center justify-between border cursor-pointer ${
                            isChosen
                              ? 'bg-neutral-900 text-white border-neutral-900 shadow-sm'
                              : slot.available
                              ? 'bg-white text-neutral-800 border-neutral-200 hover:border-neutral-400'
                              : 'bg-neutral-100/60 text-neutral-400 border-neutral-100 cursor-not-allowed line-through'
                          }`}
                        >
                          <span>{slot.time}</span>
                          <span
                            className={`text-[10px] font-light ${
                              isChosen
                                ? 'text-white/80'
                                : slot.available
                                ? 'text-emerald-600'
                                : 'text-neutral-400'
                            }`}
                          >
                            {slot.available ? 'Available' : 'Booked'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Step 4 (Patient Details) + Step 5 (Summary) + Step 6 (Request CTA) */}
            <div className="lg:col-span-5 bg-white rounded-3xl p-6 sm:p-8 border border-neutral-200 shadow-sm">
              <form onSubmit={handleBookingSubmit} className="space-y-6">
                <div>
                  <span className="text-[11px] font-mono uppercase tracking-wider text-neutral-400 block mb-1">
                    Step 4 of 4
                  </span>
                  <h3 className="text-lg font-medium text-neutral-900 mb-1">
                    Patient Details
                  </h3>
                  <p className="text-xs text-neutral-500 font-light">
                    Direct contact information for appointment confirmation.
                  </p>
                </div>

                {/* Error Banner */}
                {bookingError && (
                  <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{bookingError}</span>
                  </div>
                )}

                {/* Form Inputs */}
                <div className="space-y-4">
                  {/* Full Name */}
                  <div>
                    <label className="block text-xs font-medium text-neutral-700 mb-1">
                      Full Name <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        required
                        value={patientForm.fullName}
                        onChange={(e) => setPatientForm({ ...patientForm, fullName: e.target.value })}
                        placeholder="e.g. Eleanor Vance"
                        className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-neutral-900 placeholder-neutral-400 text-xs focus:outline-none focus:border-neutral-900 bg-neutral-50/50"
                      />
                      <User className="w-4 h-4 text-neutral-400 absolute right-3.5 top-2.5 pointer-events-none" />
                    </div>
                  </div>

                  {/* Phone Number */}
                  <div>
                    <label className="block text-xs font-medium text-neutral-700 mb-1">
                      Phone Number <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="tel"
                        required
                        value={patientForm.phoneNumber}
                        onChange={(e) => setPatientForm({ ...patientForm, phoneNumber: e.target.value })}
                        placeholder="e.g. (555) 019-2834"
                        className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-neutral-900 placeholder-neutral-400 text-xs focus:outline-none focus:border-neutral-900 bg-neutral-50/50"
                      />
                      <Phone className="w-4 h-4 text-neutral-400 absolute right-3.5 top-2.5 pointer-events-none" />
                    </div>
                  </div>

                  {/* Email (Optional) */}
                  <div>
                    <label className="block text-xs font-medium text-neutral-700 mb-1">
                      Email Address <span className="text-neutral-400 font-light">(Optional)</span>
                    </label>
                    <div className="relative">
                      <input
                        type="email"
                        value={patientForm.email}
                        onChange={(e) => setPatientForm({ ...patientForm, email: e.target.value })}
                        placeholder="e.g. eleanor@example.com"
                        className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-neutral-900 placeholder-neutral-400 text-xs focus:outline-none focus:border-neutral-900 bg-neutral-50/50"
                      />
                      <Mail className="w-4 h-4 text-neutral-400 absolute right-3.5 top-2.5 pointer-events-none" />
                    </div>
                  </div>

                  {/* Reason for Visit (Optional) */}
                  <div>
                    <label className="block text-xs font-medium text-neutral-700 mb-1">
                      Reason for Visit <span className="text-neutral-400 font-light">(Optional)</span>
                    </label>
                    <textarea
                      rows={2}
                      value={patientForm.reason}
                      onChange={(e) => setPatientForm({ ...patientForm, reason: e.target.value })}
                      placeholder="e.g. Annual physical, fatigue evaluation, medication review..."
                      className="w-full px-4 py-2 rounded-xl border border-neutral-200 text-neutral-900 placeholder-neutral-400 text-xs focus:outline-none focus:border-neutral-900 bg-neutral-50/50 resize-none"
                    />
                  </div>
                </div>

                {/* Step 5: Clean Booking Summary */}
                <div className="pt-4 border-t border-neutral-100">
                  <span className="text-[11px] font-mono uppercase tracking-wider text-neutral-400 block mb-2">
                    Step 5: Booking Summary
                  </span>
                  <div className="bg-neutral-50 rounded-2xl p-4 border border-neutral-200/80 space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-neutral-500 font-light">Physician:</span>
                      <span className="font-medium text-neutral-900">Dr. Prince Soni</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-500 font-light">Selected Date:</span>
                      <span className="font-medium text-neutral-900">{selectedDate || 'Not selected'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-500 font-light">Selected Slot:</span>
                      <span className="font-medium text-neutral-900">
                        {selectedSlot ? selectedSlot : <span className="text-neutral-400 italic">None selected</span>}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-500 font-light">Patient:</span>
                      <span className="font-medium text-neutral-900">
                        {patientForm.fullName.trim() || <span className="text-neutral-400 italic">Pending name</span>}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Step 6: Clear "Request Appointment" button */}
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={bookingSubmitting}
                    className="w-full py-3.5 px-6 rounded-full bg-neutral-900 hover:bg-neutral-800 text-white text-xs sm:text-sm font-medium transition-all shadow-md hover:shadow-lg active:scale-[0.99] cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {bookingSubmitting ? (
                      <>
                        <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                        <span>Verifying &amp; Submitting Request...</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-4 h-4 text-white/90" />
                        <span>Request Appointment</span>
                      </>
                    )}
                  </button>
                  <p className="text-[11px] text-neutral-400 text-center font-light mt-2.5">
                    No charge at booking. Verified with practice schedule to prevent double-booking.
                  </p>
                </div>
              </form>
            </div>
          </div>
        )}
      </section>

      {/* =========================================================================
          SECTION 9: FOOTER
          Doctor's name, contact information, location, privacy policy, and copyright.
         ========================================================================= */}
      <footer className="mt-20 border-t border-neutral-200/90 bg-white py-14 px-5 sm:px-8 md:px-16 lg:px-20">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <svg
                className="w-6 h-6 fill-neutral-900"
                viewBox="0 0 256 256"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M 128 128 C 198.692 128 256 185.308 256 256 L 151.883 256 C 149.812 220.307 120.213 192 84 192 C 47.787 192 18.188 220.307 16.117 256 L 0 256 C 0 185.308 57.308 128 128 128 Z M 104.117 0 C 106.188 35.694 135.787 64 172 64 C 208.213 64 237.812 35.694 239.883 0 L 256 0 C 256 70.692 198.692 128 128 128 C 57.308 128 0 70.692 0 0 Z" />
              </svg>
              <span className="text-base font-semibold text-neutral-900 tracking-tight">
                Dr. Prince Soni
              </span>
            </div>
            <p className="text-xs text-neutral-500 font-light">
              Internal &amp; Integrative Medicine Practice
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-6 sm:gap-10 text-xs text-neutral-600 font-light">
            <div>
              <span className="block font-medium text-neutral-800 mb-1">Practice Location</span>
              <span>Medical Suites, Suite 402</span>
              <span className="block text-neutral-400">West Wing Health Center</span>
            </div>
            <div>
              <span className="block font-medium text-neutral-800 mb-1">Contact Office</span>
              <a href="mailto:contact@drprincesoni.com" className="hover:text-neutral-900 block">
                contact@drprincesoni.com
              </a>
              <span className="block text-neutral-400">+1 (555) 019-2834</span>
            </div>
            <div>
              <span className="block font-medium text-neutral-800 mb-1">Office Hours</span>
              <span>Monday &ndash; Saturday</span>
              <span className="block text-neutral-400">09:00 AM &ndash; 05:30 PM</span>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto mt-12 pt-6 border-t border-neutral-100 flex flex-col sm:flex-row items-center justify-between text-[11px] text-neutral-400 font-light gap-4">
          <p>&copy; {new Date().getFullYear()} Dr. Prince Soni. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <a href="#booking" onClick={(e) => { e.preventDefault(); scrollToSection('booking'); }} className="hover:text-neutral-700">
              Patient Scheduling
            </a>
            <span aria-hidden="true">&middot;</span>
            <a href="#hero" onClick={(e) => { e.preventDefault(); scrollToSection('hero'); }} className="hover:text-neutral-700">
              Privacy Policy
            </a>
            <span aria-hidden="true">&middot;</span>
            <a href="#hero" onClick={(e) => { e.preventDefault(); scrollToSection('hero'); }} className="hover:text-neutral-700">
              Terms of Care
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
