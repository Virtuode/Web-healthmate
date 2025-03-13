"use client";

import { useEffect, useState } from "react";
import { auth, db } from "@/firebase";
import { ref, onValue, update } from "firebase/database";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

export default function ProfilePage() {
  const [doctorData, setDoctorData] = useState<DoctorData | null>(null);
  const [editableData, setEditableData] = useState<DoctorData | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const router = useRouter();

  interface DoctorData {
    email: string;
    phone: string;
    languages: string;
    specialization: string;
    experience: number;
    biography: string;
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
        await update(doctorRef, editableData);
        setDoctorData(editableData);
        alert("Profile updated successfully!");
      } catch (error) {
        console.error("Error updating profile:", error);
        alert("Failed to update profile. Please try again.");
      }
    }
  };

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
        {/* Header */}
        <motion.h1
          className="text-3xl font-semibold text-center mb-6 bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.6 }}
        >
          Profile Overview
        </motion.h1>

        {/* Form */}
        <div className="space-y-6">
          {/* Email */}
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

          {/* Phone */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Phone</label>
            <input
              name="phone"
              value={editableData.phone}
              onChange={handleChange}
              className="w-full px-4 py-3 rounded-lg bg-gray-900/50 text-white border border-gray-700/50 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all placeholder-gray-500 hover:bg-gray-900/70"
            />
          </div>

          {/* Languages */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Languages (comma separated)</label>
            <input
              name="languages"
              value={editableData.languages}
              onChange={handleChange}
              className="w-full px-4 py-3 rounded-lg bg-gray-900/50 text-white border border-gray-700/50 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all placeholder-gray-500 hover:bg-gray-900/70"
            />
          </div>

          {/* Specialization */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Specialization</label>
            <input
              name="specialization"
              value={editableData.specialization}
              onChange={handleChange}
              className="w-full px-4 py-3 rounded-lg bg-gray-900/50 text-white border border-gray-700/50 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all placeholder-gray-500 hover:bg-gray-900/70"
            />
          </div>

          {/* Experience */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Experience (years)</label>
            <input
              type="number"
              name="experience"
              value={editableData.experience}
              onChange={handleChange}
              className="w-full px-4 py-3 rounded-lg bg-gray-900/50 text-white border border-gray-700/50 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all placeholder-gray-500 hover:bg-gray-900/70"
            />
          </div>

          {/* Biography */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Biography</label>
            <textarea
              name="biography"
              value={editableData.biography}
              onChange={handleChange}
              rows={4}
              className="w-full px-4 py-3 rounded-lg bg-gray-900/50 text-white border border-gray-700/50 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all placeholder-gray-500 hover:bg-gray-900/70"
            />
          </div>

          {/* Save Button */}
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