"use client";

import { useEffect, useState } from "react";
import { auth, db } from "@/firebase";
import { ref, onValue, update } from "firebase/database";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import TimeSlotCard from "@/components/TimeSlotCard"; // Assuming this component exists
import { TimeSlot } from "@/models/TimeSlot"; // Assuming this type exists

export default function ProfilePage() {
  const [doctorData, setDoctorData] = useState<DoctorData | null>(null);
  const [editableData, setEditableData] = useState<DoctorData | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [selectedTimeSlots, setSelectedTimeSlots] = useState<TimeSlot[]>([]);
  const [newTimeSlot, setNewTimeSlot] = useState({ day: "", startTime: "", endTime: "" });
  const router = useRouter();

  interface DoctorData {
    email: string;
    phone: string;
    languages: string;
    specialization: string;
    experience: number;
    biography: string;
    selectedTimeSlots?: TimeSlot[];
    availableDays?: string[]; // Add availableDays to the interface
  }

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (!user) {
        router.push("/");
        return;
      }
      setUserId(user.uid);
      const doctorRef = ref(db, "doctors/" + user.uid);
      onValue(doctorRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
          setDoctorData(data);
          setEditableData(data);
          setSelectedTimeSlots(data.selectedTimeSlots || []);
        }
      });
    });
    return () => unsubscribe();
  }, [router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (editableData) {
      setEditableData({ ...editableData, [e.target.name]: e.target.value });
    }
  };

  const handleSave = async () => {
    if (userId && editableData) {
      try {
        const doctorRef = ref(db, "doctors/" + userId);
        // Extract unique days from selectedTimeSlots
        const uniqueDays = [...new Set(selectedTimeSlots.map((slot) => slot.day))];
        const updatedData = {
          ...editableData,
          selectedTimeSlots: selectedTimeSlots,
          availableDays: uniqueDays, // Sync availableDays with selectedTimeSlots
        };
        await update(doctorRef, updatedData);
        setDoctorData(updatedData);
        alert("Profile updated successfully!");
      } catch (error) {
        console.error("Error updating profile:", error);
        alert("Failed to update profile. Please try again.");
      }
    }
  };

  // Time Slot Management Functions
  const generateTimeSlots = (day: string): TimeSlot[] => {
    const slots: TimeSlot[] = [];
    const startHour = 8;
    const endHour = 20;
    const interval = 30;

    for (let hour = startHour; hour < endHour; hour++) {
      for (let minute = 0; minute < 60; minute += interval) {
        const startTime = `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
        const endTimeDate = new Date(`1970-01-01T${startTime}`);
        endTimeDate.setMinutes(endTimeDate.getMinutes() + interval);
        const endTime = endTimeDate.toTimeString().slice(0, 5);

        slots.push({
          id: `${day}-${startTime}`,
          day,
          startTime,
          endTime,
          isAvailable: true,
        });
      }
    }
    return slots;
  };

  const handleTimeSlotSelect = (timeSlot: TimeSlot) => {
    setSelectedTimeSlots((prev) => {
      const isSelected = prev.some(
        (slot) => slot.day === timeSlot.day && slot.startTime === timeSlot.startTime
      );
      if (isSelected) {
        return prev.filter(
          (slot) => !(slot.day === timeSlot.day && slot.startTime === timeSlot.startTime)
        );
      }
      const conflicts = prev.some(
        (slot) =>
          slot.day === timeSlot.day &&
          ((slot.startTime <= timeSlot.startTime && slot.endTime > timeSlot.startTime) ||
           (slot.startTime < timeSlot.endTime && slot.endTime >= timeSlot.endTime))
      );
      if (conflicts) {
        alert(`Time slot ${timeSlot.startTime}-${timeSlot.endTime} conflicts with existing selection`);
        return prev;
      }
      return [...prev, timeSlot];
    });
  };

  const handleDeleteTimeSlot = (timeSlotId: string) => {
    setSelectedTimeSlots((prev) => prev.filter((slot) => slot.id !== timeSlotId));
  };

  const handleAddTimeSlot = () => {
    if (!newTimeSlot.day || !newTimeSlot.startTime || !newTimeSlot.endTime) {
      alert("Please fill in all time slot fields");
      return;
    }

    const timeSlot: TimeSlot = {
      id: `${newTimeSlot.day}-${newTimeSlot.startTime}`,
      day: newTimeSlot.day,
      startTime: newTimeSlot.startTime,
      endTime: newTimeSlot.endTime,
      isAvailable: true,
    };

    handleTimeSlotSelect(timeSlot);
    setNewTimeSlot({ day: "", startTime: "", endTime: "" });
  };

  const daysOfWeek = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

  if (!editableData) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } },
  };

  const buttonVariants = {
    hover: { scale: 1.05, boxShadow: "0 0 15px rgba(99, 102, 241, 0.5)" },
    tap: { scale: 0.95 },
  };

  return (
    <motion.div
      className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 flex items-center justify-center p-6"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <div className="w-full max-w-2xl bg-gray-800/50 backdrop-blur-md rounded-xl shadow-2xl border border-gray-700/50 p-6">
        <motion.h1
          className="text-3xl font-semibold text-center mb-6 bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.6 }}
        >
          Profile Overview
        </motion.h1>

        <div className="space-y-6">
          {/* Existing Profile Fields */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Email</label>
            <input
              name="email"
              value={editableData.email}
              onChange={handleChange}
              disabled
              className="w-full px-4 py-3 rounded-lg bg-gray-900/50 text-gray-400 border border-gray-700/50 outline-none transition-all placeholder-gray-500 cursor-not-allowed"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Phone</label>
            <input
              name="phone"
              value={editableData.phone}
              onChange={handleChange}
              className="w-full px-4 py-3 rounded-lg bg-gray-900/50 text-white border border-gray-700/50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Languages</label>
            <input
              name="languages"
              value={editableData.languages}
              onChange={handleChange}
              className="w-full px-4 py-3 rounded-lg bg-gray-900/50 text-white border border-gray-700/50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Specialization</label>
            <input
              name="specialization"
              value={editableData.specialization}
              onChange={handleChange}
              className="w-full px-4 py-3 rounded-lg bg-gray-900/50 text-white border border-gray-700/50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Experience (Years)</label>
            <input
              name="experience"
              type="number"
              value={editableData.experience}
              onChange={handleChange}
              className="w-full px-4 py-3 rounded-lg bg-gray-900/50 text-white border border-gray-700/50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Biography</label>
            <textarea
              name="biography"
              value={editableData.biography}
              onChange={handleChange}
              className="w-full px-4 py-3 rounded-lg bg-gray-900/50 text-white border border-gray-700/50"
              rows={4}
            />
          </div>

          {/* Time Slot Management Section */}
          <div className="mt-6">
            <h3 className="text-xl font-semibold text-indigo-200 mb-4">Manage Time Slots</h3>

            {/* Add New Time Slot */}
            <div className="bg-gray-900/50 p-4 rounded-lg mb-4">
              <h4 className="text-lg text-gray-300 mb-2">Add New Time Slot</h4>
              <div className="grid grid-cols-3 gap-4">
                <select
                  value={newTimeSlot.day}
                  onChange={(e) => setNewTimeSlot({ ...newTimeSlot, day: e.target.value })}
                  className="px-4 py-3 rounded-lg bg-gray-900/50 text-white border border-gray-700/50"
                >
                  <option value="">Select Day</option>
                  {daysOfWeek.map((day) => (
                    <option key={day} value={day}>{day}</option>
                  ))}
                </select>
                <input
                  type="time"
                  value={newTimeSlot.startTime}
                  onChange={(e) => setNewTimeSlot({ ...newTimeSlot, startTime: e.target.value })}
                  className="px-4 py-3 rounded-lg bg-gray-900/50 text-white border border-gray-700/50"
                />
                <input
                  type="time"
                  value={newTimeSlot.endTime}
                  onChange={(e) => setNewTimeSlot({ ...newTimeSlot, endTime: e.target.value })}
                  className="px-4 py-3 rounded-lg bg-gray-900/50 text-white border border-gray-700/50"
                />
              </div>
              <motion.button
                onClick={handleAddTimeSlot}
                variants={buttonVariants}
                whileHover="hover"
                whileTap="tap"
                className="mt-4 px-4 py-2 bg-indigo-600 rounded-lg text-white"
              >
                Add Time Slot
              </motion.button>
            </div>

            {/* Existing Time Slots */}
            {daysOfWeek.map((day) => {
              const daySlots = selectedTimeSlots.filter((slot) => slot.day === day);
              if (daySlots.length === 0) return null;
              return (
                <div key={day} className="mb-4">
                  <h4 className="text-lg text-indigo-200 mb-2">{day}</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {daySlots.map((slot) => (
                      <div key={slot.id} className="flex justify-between items-center bg-gray-900/50 p-2 rounded-lg">
                        <span>{`${slot.startTime} - ${slot.endTime}`}</span>
                        <motion.button
                          onClick={() => handleDeleteTimeSlot(slot.id)}
                          variants={buttonVariants}
                          whileHover="hover"
                          whileTap="tap"
                          className="px-2 py-1 bg-red-600 rounded-lg text-white"
                        >
                          Delete
                        </motion.button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <motion.button
            onClick={handleSave}
            variants={buttonVariants}
            whileHover="hover"
            whileTap="tap"
            className="w-full py-3 px-4 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold shadow-lg hover:from-indigo-700 hover:to-purple-700 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-900 transition-all duration-300"
          >
            Save Changes
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}