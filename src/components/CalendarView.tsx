// src/components/CalendarView.tsx
"use client";

import { useState, useMemo } from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths, isSameDay } from "date-fns";
import { motion } from "framer-motion";
import Image from "next/image";

interface Appointment {
  id: string;
  patientId: string;
  date: string; // May be invalid like "15-10-0008"
  timeSlot: string;
  status: string;
  doctorId: string;
  endTime: string;
  startTime: string;
  timestamp?: number; // Added for fallback
}

interface Patient {
  id: string;
  name: string;
  contactNumber?: string;
  email?: string;
}

interface CalendarViewProps {
  appointments: Appointment[];
  patients: { [key: string]: Patient };
  doctorName: string;
}

const CalendarView: React.FC<CalendarViewProps> = ({ appointments, patients, doctorName }) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  // Generate days for the current month
  const daysInMonth = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  // Map appointments to dates using normalized date from timestamp if date is invalid
  const appointmentsByDate = useMemo(() => {
    const map: { [key: string]: Appointment[] } = {};
    appointments.forEach((appt) => {
      let dateStr: string;
      try {
        // Try parsing the date field
        const parsedDate = new Date(`${appt.date}T${appt.startTime}:00`);
        if (isNaN(parsedDate.getTime())) {
          // If invalid, use timestamp
          dateStr = format(new Date(appt.timestamp || Date.now()), "yyyy-MM-dd");
        } else {
          dateStr = format(parsedDate, "yyyy-MM-dd");
        }
      } catch (e) {
        console.warn(`Invalid date for appointment ${appt.id}: ${appt.date}`, e);
        // Fallback to timestamp
        dateStr = format(new Date(appt.timestamp || Date.now()), "yyyy-MM-dd");
      }
      if (!map[dateStr]) map[dateStr] = [];
      map[dateStr].push(appt);
    });
    return map;
  }, [appointments]);

  // Handlers for month navigation
  const handlePrevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const handleNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const handleDayClick = (day: Date) => setSelectedDate(day);

  // Get appointments for the selected date
  const selectedAppointments = selectedDate
    ? appointmentsByDate[format(selectedDate, "yyyy-MM-dd")] || []
    : [];

  return (
    <div className="bg-gray-800/50 backdrop-blur-md rounded-xl shadow-lg p-6 border border-gray-700/50">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold text-indigo-200">
          Calendar View - {format(currentMonth, "MMMM yyyy")}
        </h2>
        <div className="space-x-2">
          <button
            onClick={handlePrevMonth}
            className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-white transition"
          >
            Prev
          </button>
          <button
            onClick={handleNextMonth}
            className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-white transition"
          >
            Next
          </button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-2 text-center">
        {/* Weekday Headers */}
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
          <div key={day} className="text-gray-400 font-semibold">
            {day}
          </div>
        ))}

        {/* Days */}
        {daysInMonth.map((day) => {
          const dateStr = format(day, "yyyy-MM-dd");
          const hasAppointments = appointmentsByDate[dateStr]?.length > 0;
          const isSelected = selectedDate && isSameDay(day, selectedDate);

          return (
            <motion.div
              key={dateStr}
              className={`p-2 rounded-lg cursor-pointer transition-colors ${
                hasAppointments ? "bg-indigo-900/50" : "bg-gray-900/50"
              } ${isSelected ? "ring-2 ring-indigo-500" : ""} hover:bg-indigo-700/50`}
              onClick={() => handleDayClick(day)}
              whileHover={{ scale: 1.05 }}
            >
              <span className="text-gray-200">{format(day, "d")}</span>
              {hasAppointments && (
                <div className="flex justify-center mt-1">
                  <span className="w-2 h-2 bg-indigo-400 rounded-full" />
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Appointment Details Modal */}
      {selectedDate && (
        <motion.div
          className="mt-4 bg-gray-900/80 p-4 rounded-lg border border-gray-700/50"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
        >
          <h3 className="text-lg font-semibold text-indigo-200 mb-2">
            Appointments on {format(selectedDate, "MMMM d, yyyy")}
          </h3>
          {selectedAppointments.length === 0 ? (
            <p className="text-gray-400">No appointments scheduled.</p>
          ) : (
            selectedAppointments.map((appt) => (
              <div key={appt.id} className="mb-4 p-3 bg-gray-800/50 rounded-lg">
                <p className="text-gray-200">
                  <strong>Time:</strong> {appt.startTime} - {appt.endTime}
                </p>
                <p className="text-gray-200">
                  <strong>Patient:</strong> {patients[appt.patientId]?.name || "Unknown"}
                </p>
                <p className="text-gray-200">
                  <strong>Doctor:</strong> {doctorName}
                </p>
                <p className="text-gray-200">
                  <strong>Status:</strong>{" "}
                  <span
                    className={`${
                      appt.status === "confirmed" ? "text-green-300" : "text-yellow-300"
                    }`}
                  >
                    {appt.status}
                  </span>
                </p>
              </div>
            ))
          )}
          <button
            onClick={() => setSelectedDate(null)}
            className="mt-2 px-3 py-1 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-white transition"
          >
            Close
          </button>
        </motion.div>
      )}
    </div>
  );
};

export default CalendarView;