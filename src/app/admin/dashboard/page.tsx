"use client";

import { useEffect, useState } from "react";
import { getDatabase, ref, get, set, remove, push } from "firebase/database";
import { auth } from "@/firebase";
import { deleteUser } from "firebase/auth";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { MdCheck, MdClose, MdAssignment } from "react-icons/md";

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
  languages?: string[];
  profilePicture?: string;
  createdAt: string;
  updatedAt: string;
}

export default function AdminDashboard() {
  const [pendingDoctors, setPendingDoctors] = useState<Doctor[]>([]);
  const [approvedDoctors, setApprovedDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [analytics, setAnalytics] = useState({ total: 0, pending: 0, approved: 0 });
  const router = useRouter();

  useEffect(() => {
    const fetchDoctors = async () => {
      try {
        const db = getDatabase();
        const doctorsRef = ref(db, "doctors");
        const snapshot = await get(doctorsRef);

        if (snapshot.exists()) {
          const doctorsData = snapshot.val();
          const allDoctors = Object.keys(doctorsData).map((key) => ({
            id: key,
            ...doctorsData[key],
            languages: Array.isArray(doctorsData[key].languages)
              ? doctorsData[key].languages
              : doctorsData[key].languages
              ? [doctorsData[key].languages]
              : [],
            availableDays: Array.isArray(doctorsData[key].availableDays)
              ? doctorsData[key].availableDays
              : doctorsData[key].availableDays
              ? [doctorsData[key].availableDays]
              : [],
          }));
          const pending = allDoctors.filter((doc) => doc.verificationStatus === "pending");
          const approved = allDoctors.filter((doc) => doc.verificationStatus === "approved");
          setPendingDoctors(pending);
          setApprovedDoctors(approved);
          setAnalytics({
            total: allDoctors.length,
            pending: pending.length,
            approved: approved.length,
          });
        } else {
          setPendingDoctors([]);
          setApprovedDoctors([]);
          setAnalytics({ total: 0, pending: 0, approved: 0 });
        }
      } catch (err) {
        setError("Failed to fetch doctors. Please try again.");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchDoctors();
  }, []);

  const assignTaskToDoctor = (doctorId: string) => {
    const taskDescription = prompt("Enter task description for this doctor:");
    if (!taskDescription) return;

    const dueDateInput = prompt("Enter due date (YYYY-MM-DD, optional):");
    const dueDate = dueDateInput || undefined;

    const db = getDatabase();
    const tasksRef = ref(db, `doctors/${doctorId}/tasks`);
    const newTaskRef = push(tasksRef);
    set(newTaskRef, {
      description: taskDescription,
      patientId: null,
      timestamp: Date.now(),
      completed: false,
      dueDate: dueDate || null,
    })
      .then(() => {
        const notifRef = ref(db, `notifications/doctors/${doctorId}`);
        const newNotifRef = push(notifRef);
        set(newNotifRef, {
          message: `New task assigned: ${taskDescription}`,
          timestamp: Date.now(),
          read: false,
          type: "task",
          relatedId: newTaskRef.key,
        });
        alert("Task assigned successfully!");
      })
      .catch(() => {
        setError("Failed to assign task. Please try again.");
      });
  };

  const handleApprove = async (doctorId: string) => {
    try {
      const db = getDatabase();
      const doctorRef = ref(db, `doctors/${doctorId}`);
      const doctor = pendingDoctors.find((doc) => doc.id === doctorId);
      if (!doctor) {
        setError("Doctor not found. Please refresh and try again.");
        return;
      }

      const updatedDoctor = {
        ...doctor,
        verificationStatus: "approved",
        isVerified: true,
        updatedAt: new Date().toISOString(),
      };
      await set(doctorRef, updatedDoctor);
      setPendingDoctors((prev) => prev.filter((doc) => doc.id !== doctorId));
      setApprovedDoctors((prev) => [...prev, updatedDoctor]);
      setAnalytics((prev) => ({ ...prev, pending: prev.pending - 1, approved: prev.approved + 1 }));
      alert("Doctor approved successfully!");
    } catch (err) {
      setError("Failed to approve doctor. Please try again.");
      console.error(err);
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
      setPendingDoctors((prev) => prev.filter((doc) => doc.id !== doctorId));
      setAnalytics((prev) => ({ ...prev, pending: prev.pending - 1, total: prev.total - 1 }));
      alert("Doctor rejected and removed successfully!");
    } catch (err) {
      setError("Failed to reject doctor. Please try again.");
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="h-12 w-12 border-4 border-t-indigo-500 border-gray-700 rounded-full"
        />
      </div>
    );
  }

  return (
    <motion.div
      className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-white"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.8 }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex justify-between items-center mb-8"
        >
          <h1 className="text-4xl font-bold text-indigo-200">Admin Dashboard</h1>
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
            className="mb-6 p-4 bg-red-900/50 text-red-200 rounded-lg shadow-lg border border-red-700/50"
          >
            {error}
          </motion.div>
        )}

        {/* Analytics Section */}
        <div className="bg-gray-800/50 rounded-xl shadow-lg p-6 mb-6 border border-gray-700/50">
          <h2 className="text-xl font-semibold text-indigo-200 mb-4">Analytics</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-gray-900/50 rounded-lg shadow border border-gray-700/50">
              <p className="text-lg font-semibold text-gray-200">Total Doctors</p>
              <p className="text-2xl text-indigo-200">{analytics.total}</p>
            </div>
            <div className="text-center p-4 bg-gray-900/50 rounded-lg shadow border border-gray-700/50">
              <p className="text-lg font-semibold text-gray-200">Pending Approvals</p>
              <p className="text-2xl text-yellow-200">{analytics.pending}</p>
            </div>
            <div className="text-center p-4 bg-gray-900/50 rounded-lg shadow border border-gray-700/50">
              <p className="text-lg font-semibold text-gray-200">Approved Doctors</p>
              <p className="text-2xl text-green-200">{analytics.approved}</p>
            </div>
          </div>
        </div>

        {/* Pending Doctors Section */}
        <h2 className="text-3xl font-semibold text-indigo-200 mb-6">Pending Doctor Proposals</h2>
        <AnimatePresence>
          {pendingDoctors.length === 0 ? (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-gray-400 text-lg mb-6"
            >
              No pending doctor proposals found.
            </motion.p>
          ) : (
            <div className="grid gap-6 mb-12">
              {pendingDoctors.map((doctor) => (
                <motion.div
                  key={doctor.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.5 }}
                  className="bg-gray-800/50 rounded-xl shadow-lg p-6 border border-gray-700/50 hover:shadow-xl transition-all duration-300"
                >
                  <DoctorCard doctor={doctor} onApprove={handleApprove} onReject={handleReject} />
                </motion.div>
              ))}
            </div>
          )}
        </AnimatePresence>

        {/* Approved Doctors Section */}
        <h2 className="text-3xl font-semibold text-indigo-200 mb-6">Approved Doctors</h2>
        <AnimatePresence>
          {approvedDoctors.length === 0 ? (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-gray-400 text-lg"
            >
              No approved doctors found.
            </motion.p>
          ) : (
            <div className="grid gap-6">
              {approvedDoctors.map((doctor) => (
                <motion.div
                  key={doctor.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.5 }}
                  className="bg-gray-800/50 rounded-xl shadow-lg p-6 border border-gray-700/50 hover:shadow-xl transition-all duration-300"
                >
                  <DoctorCard doctor={doctor} onAssignTask={assignTaskToDoctor} isApproved />
                </motion.div>
              ))}
            </div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

function DoctorCard({
  doctor,
  onApprove,
  onReject,
  onAssignTask,
  isApproved = false,
}: {
  doctor: Doctor;
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
  onAssignTask?: (id: string) => void;
  isApproved?: boolean;
}) {
  return (
    <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
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
            <div className="w-16 h-16 rounded-full bg-gray-700/50 flex items-center justify-center text-gray-400 shadow-md">
              No Image
            </div>
          )}
          <div>
            <h3 className="text-xl font-semibold text-gray-200">{doctor.name}</h3>
            <p className="text-gray-400">{doctor.specialization}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-gray-400">
          <div>
            <p><strong>Email:</strong> {doctor.email}</p>
            <p><strong>Phone:</strong> {doctor.phone}</p>
            <p><strong>License:</strong> {doctor.licenseNumber}</p>
            <p><strong>Experience:</strong> {doctor.experience} years</p>
            <p><strong>Education:</strong> {doctor.education}</p>
          </div>
          <div>
            <p><strong>Bio:</strong> {doctor.biography}</p>
            <p><strong>Languages:</strong> {doctor.languages?.join(", ") || "Not specified"}</p>
            <p><strong>Days:</strong> {doctor.availableDays.join(", ") || "Not specified"}</p>
            <p><strong>Created:</strong> {new Date(doctor.createdAt).toLocaleDateString()}</p>
          </div>
        </div>

        <div className="mt-4">
          <h4 className="text-lg font-semibold text-gray-200 mb-2">Time Slots</h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {doctor.selectedTimeSlots.map((slot) => (
              <motion.div
                key={slot.id}
                whileHover={{ scale: 1.05 }}
                className="bg-gray-900/50 p-2 rounded-lg text-sm text-center text-gray-400 shadow-sm"
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
          className="mt-4 inline-block px-6 py-2 bg-indigo-500 text-white rounded-full shadow-lg hover:bg-indigo-600 transition-all duration-300"
        >
          View Document
        </motion.a>
      </div>

      <div className="flex gap-4">
        {!isApproved && onApprove && (
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onApprove(doctor.id)}
            className="px-6 py-2 bg-green-500 text-white rounded-full shadow-lg hover:bg-green-600 transition-all duration-300 flex items-center"
          >
            <MdCheck className="mr-2" /> Approve
          </motion.button>
        )}
        {!isApproved && onReject && (
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onReject(doctor.id)}
            className="px-6 py-2 bg-red-500 text-white rounded-full shadow-lg hover:bg-red-600 transition-all duration-300 flex items-center"
          >
            <MdClose className="mr-2" /> Reject
          </motion.button>
        )}
        {isApproved && onAssignTask && (
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onAssignTask(doctor.id)}
            className="px-6 py-2 bg-indigo-500 text-white rounded-full shadow-lg hover:bg-indigo-600 transition-all duration-300 flex items-center"
          >
            <MdAssignment className="mr-2" /> Assign Task
          </motion.button>
        )}
      </div>
    </div>
  );
}