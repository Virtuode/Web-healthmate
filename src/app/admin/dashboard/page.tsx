"use client";

import { useEffect, useState } from "react";
import { getDatabase, ref, get, set, remove } from "firebase/database";
import { auth } from "@/firebase";
import { deleteUser } from "firebase/auth";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

interface Doctor {
  id: string;
  name: string;
  email: string;
  phone: string;
  specialization: string;
  experience: number;
  education: string;
  biography: string;
  documentUrl: string;
  licenseNumber: string;
  availableDays: string[];
  selectedTimeSlots: { id: string; day: string; startTime: string; endTime: string; isAvailable: boolean }[];
  isVerified: boolean;
  verificationStatus: string;
  languages: string[];
  profilePicture: string;
  createdAt: string;
  updatedAt: string;
}

export default function AdminDashboard() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const router = useRouter();

  useEffect(() => {
    const fetchDoctors = async () => {
      try {
        const db = getDatabase();
        const doctorsRef = ref(db, "doctors");
        const snapshot = await get(doctorsRef);

        if (snapshot.exists()) {
          const doctorsData = snapshot.val();
          const pendingDoctors = Object.keys(doctorsData)
            .filter((key) => doctorsData[key].verificationStatus === "pending")
            .map((key) => ({
              id: key,
              ...doctorsData[key],
            }));
          setDoctors(pendingDoctors);
        } else {
          setDoctors([]);
        }
      } catch (err) {
        setError("Failed to fetch doctors. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchDoctors();
  }, []);

  const handleApprove = async (doctorId: string) => {
    try {
      const db = getDatabase();
      const doctorRef = ref(db, `doctors/${doctorId}`);
      await set(doctorRef, {
        ...doctors.find((doc) => doc.id === doctorId),
        verificationStatus: "approved",
        isVerified: true,
        updatedAt: new Date().toISOString(),
      });
      setDoctors((prev) => prev.filter((doc) => doc.id !== doctorId));
      alert("Doctor approved successfully!");
    } catch (err) {
      setError("Failed to approve doctor. Please try again.");
    }
  };

  const handleReject = async (doctorId: string) => {
    try {
      const db = getDatabase();
      const doctorRef = ref(db, `doctors/${doctorId}`);
      await remove(doctorRef);
      const user = auth.currentUser;
      if (user && user.uid === doctorId) {
        await deleteUser(user);
      } else {
        console.warn("Cannot delete user from auth without re-authentication.");
      }
      setDoctors((prev) => prev.filter((doc) => doc.id !== doctorId));
      alert("Doctor rejected and removed successfully!");
    } catch (err) {
      setError("Failed to reject doctor. Please try again.");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen animated-radial-gradient flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="h-12 w-12 border-4 border-t-transparent border-white rounded-full"
        />
      </div>
    );
  }

  return (
    <>
      <style jsx global>{`
        .animated-radial-gradient {
          background: radial-gradient(circle at 50% 50%, #3b82f6, #8b5cf6, #ec4899);
          animation: rotateGradient 15s infinite ease-in-out;
        }

        @keyframes rotateGradient {
          0% {
            background: radial-gradient(circle at 30% 30%, #3b82f6, #8b5cf6, #ec4899);
          }
          10% {
            background: radial-gradient(circle at 40% 20%, #3b82f6, #8b5cf6, #ec4899);
          }
          20% {
            background: radial-gradient(circle at 60% 15%, #3b82f6, #8b5cf6, #ec4899);
          }
          30% {
            background: radial-gradient(circle at 80% 30%, #3b82f6, #8b5cf6, #ec4899);
          }
          40% {
            background: radial-gradient(circle at 70% 50%, #3b82f6, #8b5cf6, #ec4899);
          }
          50% {
            background: radial-gradient(circle at 60% 70%, #3b82f6, #8b5cf6, #ec4899);
          }
          60% {
            background: radial-gradient(circle at 40% 80%, #3b82f6, #8b5cf6, #ec4899);
          }
          70% {
            background: radial-gradient(circle at 20% 70%, #3b82f6, #8b5cf6, #ec4899);
          }
          80% {
            background: radial-gradient(circle at 15% 50%, #3b82f6, #8b5cf6, #ec4899);
          }
          90% {
            background: radial-gradient(circle at 20% 30%, #3b82f6, #8b5cf6, #ec4899);
          }
          100% {
            background: radial-gradient(circle at 30% 30%, #3b82f6, #8b5cf6, #ec4899);
          }
        }
      `}</style>

      <div className="min-h-screen animated-radial-gradient p-6">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="flex justify-between items-center mb-8"
          >
            <h1 className="text-4xl font-bold text-white drop-shadow-lg">
              Admin Dashboard
            </h1>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => auth.signOut().then(() => router.push("/AdminPage/admin-signup-login"))}
              className="px-6 py-2 bg-red-500 text-white rounded-full shadow-lg hover:bg-red-600 transition-all duration-300"
            >
              Sign Out
            </motion.button>
          </motion.div>

          {error && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mb-6 p-4 bg-red-500/20 backdrop-blur-md text-white border border-red-500/50 rounded-xl shadow-lg"
            >
              {error}
            </motion.div>
          )}

          <h2 className="text-3xl font-semibold text-white mb-6 drop-shadow-md">
            Pending Doctor Proposals
          </h2>

          <AnimatePresence>
            {doctors.length === 0 ? (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-white/80 text-lg"
              >
                No pending doctor proposals found.
              </motion.p>
            ) : (
              <div className="grid gap-6">
                {doctors.map((doctor) => (
                  <motion.div
                    key={doctor.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.5 }}
                    className="bg-white/10 backdrop-blur-lg rounded-xl shadow-xl p-6 flex flex-col md:flex-row items-start md:items-center gap-6 border border-white/20 hover:shadow-2xl transition-all duration-300"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-4 mb-4">
                        {doctor.profilePicture ? (
                          <motion.img
                            whileHover={{ scale: 1.1 }}
                            src={doctor.profilePicture}
                            alt={doctor.name}
                            className="w-16 h-16 rounded-full object-cover shadow-md"
                          />
                        ) : (
                          <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center text-white/80 shadow-md">
                            No Image
                          </div>
                        )}
                        <div>
                          <h3 className="text-xl font-semibold text-white">
                            {doctor.name}
                          </h3>
                          <p className="text-white/80">{doctor.specialization}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-white/90">
                        <div>
                          <p><strong>Email:</strong> {doctor.email}</p>
                          <p><strong>Phone:</strong> {doctor.phone}</p>
                          <p><strong>License:</strong> {doctor.licenseNumber}</p>
                          <p><strong>Experience:</strong> {doctor.experience} years</p>
                          <p><strong>Education:</strong> {doctor.education}</p>
                        </div>
                        <div>
                          <p><strong>Bio:</strong> {doctor.biography}</p>
                          <p><strong>Languages:</strong> {doctor.languages?.join(", ")}</p>
                          <p><strong>Days:</strong> {doctor.availableDays.join(", ")}</p>
                          <p><strong>Created:</strong> {new Date(doctor.createdAt).toLocaleDateString()}</p>
                        </div>
                      </div>

                      <div className="mt-4">
                        <h4 className="text-lg font-semibold text-white mb-2">
                          Time Slots
                        </h4>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                          {doctor.selectedTimeSlots.map((slot) => (
                            <motion.div
                              key={slot.id}
                              whileHover={{ scale: 1.05 }}
                              className="bg-white/20 backdrop-blur-sm p-2 rounded-lg text-sm text-center text-white/90 shadow-sm"
                            >
                              {slot.day}: {slot.startTime} - {slot.endTime}
                            </motion.div>
                          ))}
                        </div>
                      </div>

                      <motion.a
                        whileHover={{ scale: 1.05 }}
                        href={doctor.documentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-4 inline-block px-6 py-2 bg-blue-500 text-white rounded-full shadow-lg hover:bg-blue-600 transition-all duration-300"
                      >
                        View Document
                      </motion.a>
                    </div>

                    <div className="flex gap-4">
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleApprove(doctor.id)}
                        className="px-6 py-2 bg-green-500 text-white rounded-full shadow-lg hover:bg-green-600 transition-all duration-300"
                      >
                        Approve
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleReject(doctor.id)}
                        className="px-6 py-2 bg-red-500 text-white rounded-full shadow-lg hover:bg-red-600 transition-all duration-300"
                      >
                        Reject
                      </motion.button>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </>
  );
}