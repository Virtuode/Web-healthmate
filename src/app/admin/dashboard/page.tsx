"use client";

import { useEffect, useState } from "react";
import { getDatabase, ref, get, set, remove, push } from "firebase/database";
import { auth, deleteUser } from "@/firebase";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { MdCheck, MdClose, MdAssignment } from "react-icons/md";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Line } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

interface TimeSlot {
  id: string;
  day: string;
  startTime: string;
  endTime: string;
  isAvailable: boolean;
}

interface Appointment {
  consultationType: string;
  createdAt: string;
  date: string;
  doctorId: string;
  endTime: string;
  id: string;
  patientId: string;
  startTime: string;
  status: string;
  timeSlot: string;
}

interface Doctor {
  id: string;
  name: string;
  email: string;
  phone: string;
  specialization: string;
  experience: number | string;
  education: string;
  biography: string;
  documentUrl: string;
  licenseNumber: string;
  availableDays: string[];
  selectedTimeSlots: TimeSlot[];
  isVerified: boolean;
  verificationStatus: string;
  languages: string[];
  profilePicture?: string;
  createdAt: string;
  updatedAt: string;
  appointments?: { [key: string]: Appointment };
}

export default function AdminDashboard() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [activeSection, setActiveSection] = useState("dashboard");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
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
            selectedTimeSlots: Array.isArray(doctorsData[key].selectedTimeSlots)
              ? doctorsData[key].selectedTimeSlots
              : [],
          }));
          setDoctors(allDoctors);
        } else {
          setDoctors([]);
        }
      } catch (err) {
        setError("Failed to fetch doctors data");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchDoctors();
  }, []);

  const pendingDoctors = doctors.filter((doc) => doc.verificationStatus === "pending");
  const approvedDoctors = doctors.filter((doc) => doc.verificationStatus === "approved");
  const totalAppointments = doctors.reduce(
    (acc, doc) => acc + (doc.appointments ? Object.keys(doc.appointments).length : 0),
    0
  );
  const recentAppointments = doctors
    .flatMap((doc) => (doc.appointments ? Object.values(doc.appointments) : []))
    .filter((appt) => new Date(appt.createdAt) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));

  const filteredDoctors = doctors.filter((doc) => {
    const matchesSearch = 
      doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || doc.verificationStatus === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleApprove = async (doctorId: string) => {
    try {
      const db = getDatabase();
      const doctorRef = ref(db, `doctors/${doctorId}`);
      const doctor = doctors.find((doc) => doc.id === doctorId);
      if (!doctor) throw new Error("Doctor not found");

      const updatedDoctor = {
        ...doctor,
        verificationStatus: "approved",
        isVerified: true,
        updatedAt: new Date().toISOString(),
      };
      await set(doctorRef, updatedDoctor);
      setDoctors((prev) => prev.map((doc) => (doc.id === doctorId ? updatedDoctor : doc)));
    } catch (err) {
      setError("Failed to approve doctor");
      console.error(err);
    }
  };

  const handleReject = async (doctorId: string) => {
    try {
      const db = getDatabase();
      const doctorRef = ref(db, `doctors/${doctorId}`);
      await remove(doctorRef);
      setDoctors((prev) => prev.filter((doc) => doc.id !== doctorId));
    } catch (err) {
      setError("Failed to reject doctor");
      console.error(err);
    }
  };

  const assignTaskToDoctor = (doctorId: string) => {
    const taskDescription = prompt("Enter task description:");
    if (!taskDescription) return;

    const dueDateInput = prompt("Enter due date (YYYY-MM-DD, optional):");
    const dueDate = dueDateInput || null;

    const db = getDatabase();
    const tasksRef = ref(db, `doctors/${doctorId}/tasks`);
    const newTaskRef = push(tasksRef);
    set(newTaskRef, {
      description: taskDescription,
      timestamp: Date.now(),
      completed: false,
      dueDate,
    })
      .then(() => {
        const notifRef = ref(db, `notifications/doctors/${doctorId}`);
        const newNotifRef = push(notifRef);
        set(newNotifRef, {
          message: `New task: ${taskDescription}`,
          timestamp: Date.now(),
          read: false,
          type: "task",
          relatedId: newTaskRef.key,
        });
      })
      .catch((err) => setError("Failed to assign task"));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-tr from-gray-900 via-indigo-900 to-purple-900 flex items-center justify-center">
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
      className="min-h-screen bg-gradient-to-tr from-gray-900 via-indigo-900 to-purple-900 p-4 md:p-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.8 }}
    >
      <div className="flex flex-col md:flex-row gap-6">
        {/* Sidebar */}
        <motion.div
          initial={{ x: -100 }}
          animate={{ x: 0 }}
          className="w-full md:w-64 bg-gray-800/40 backdrop-blur-xl p-6 rounded-3xl border border-gray-700/50"
        >
          <h2 className="text-2xl font-extrabold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent mb-6">
            Admin Panel
          </h2>
          {["dashboard", "allDoctors", "pending"].map((section) => (
            <motion.button
              key={section}
              onClick={() => setActiveSection(section)}
              className={`w-full py-2 px-4 text-left rounded-lg mb-2 ${
                activeSection === section
                  ? "bg-gradient-to-r from-indigo-600 to-purple-600"
                  : "text-gray-400 hover:bg-gray-700/50"
              }`}
              whileHover={{ scale: 1.05 }}
            >
              {section.charAt(0).toUpperCase() + section.slice(1).replace("allDoctors", "All Doctors")}
            </motion.button>
          ))}
          <motion.button
            onClick={() => auth.signOut().then(() => router.push("/AdminPage/admin-signup-login"))}
            className="w-full py-2 px-4 bg-gradient-to-r from-red-600 to-red-700 rounded-lg mt-auto text-white"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            Sign Out
          </motion.button>
        </motion.div>

        {/* Main Content */}
        <div className="flex-1 bg-gray-900/60 backdrop-blur-md rounded-3xl p-6 border border-gray-700/50">
          {error && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mb-6 p-4 text-red-400 bg-red-900/20 rounded-lg border border-red-700/50"
            >
              {error}
            </motion.div>
          )}

          <AnimatePresence mode="wait">
            {activeSection === "dashboard" && (
              <DashboardOverview
                key="dashboard"
                totalDoctors={doctors.length}
                totalAppointments={totalAppointments}
                recentAppointments={recentAppointments}
                pendingCount={pendingDoctors.length}
                approvedCount={approvedDoctors.length}
              />
            )}
            {activeSection === "allDoctors" && (
              <DoctorsList
                key="allDoctors"
                doctors={filteredDoctors}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                statusFilter={statusFilter}
                setStatusFilter={setStatusFilter}
                onAssignTask={assignTaskToDoctor}
              />
            )}
            {activeSection === "pending" && (
              <PendingProposals
                key="pending"
                doctors={pendingDoctors}
                onApprove={handleApprove}
                onReject={handleReject}
              />
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}

const DashboardOverview = ({
  totalDoctors,
  totalAppointments,
  recentAppointments,
  pendingCount,
  approvedCount,
}: {
  totalDoctors: number;
  totalAppointments: number;
  recentAppointments: Appointment[];
  pendingCount: number;
  approvedCount: number;
}) => {
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - i);
    return date.toISOString().split("T")[0];
  }).reverse();

  const appointmentCounts = last7Days.map((date) =>
    recentAppointments.filter((appt) => appt.createdAt.split(" ")[0] === date).length
  );

  const chartData = {
    labels: last7Days,
    datasets: [
      {
        label: "Appointments",
        data: appointmentCounts,
        borderColor: "rgba(99, 102, 241, 1)",
        backgroundColor: "rgba(99, 102, 241, 0.2)",
        fill: true,
      },
    ],
  };

  const options = {
    responsive: true,
    plugins: {
      legend: { position: "top" as const, labels: { color: "white" } },
      title: { display: true, text: "Appointments Last 7 Days", color: "white" },
    },
    scales: {
      x: { ticks: { color: "white" } },
      y: { ticks: { color: "white" }, beginAtZero: true },
    },
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.5 }}
    >
      <h2 className="text-3xl font-extrabold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent mb-6">
        Dashboard Overview
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <StatCard title="Total Doctors" value={totalDoctors} />
        <StatCard title="Approved Doctors" value={approvedCount} />
        <StatCard title="Pending Approvals" value={pendingCount} />
        <StatCard title="Total Appointments" value={totalAppointments} />
        <StatCard title="Recent Appointments" value={recentAppointments.length} />
      </div>
      <div className="bg-gray-800/40 p-4 rounded-lg border border-gray-700/50">
        <Line data={chartData} options={options} />
      </div>
    </motion.div>
  );
};

const StatCard = ({ title, value }: { title: string; value: number }) => (
  <motion.div
    className="bg-gray-800/40 p-4 rounded-lg border border-gray-700/50 text-white"
    whileHover={{ scale: 1.05 }}
  >
    <h3 className="text-gray-300">{title}</h3>
    <p className="text-2xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
      {value}
    </p>
  </motion.div>
);

const DoctorsList = ({
  doctors,
  searchQuery,
  setSearchQuery,
  statusFilter,
  setStatusFilter,
  onAssignTask,
}: {
  doctors: Doctor[];
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  statusFilter: string;
  setStatusFilter: (status: string) => void;
  onAssignTask: (id: string) => void;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -20 }}
    transition={{ duration: 0.5 }}
  >
    <h2 className="text-3xl font-extrabold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent mb-6">
      All Doctors
    </h2>
    <div className="flex flex-col sm:flex-row gap-4 mb-6">
      <input
        type="text"
        placeholder="Search by name or email..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="w-full sm:w-1/2 px-4 py-2 rounded-lg bg-gray-800/50 text-white border border-gray-700/50 focus:ring-2 focus:ring-indigo-500"
      />
      <select
        value={statusFilter}
        onChange={(e) => setStatusFilter(e.target.value)}
        className="w-full sm:w-1/4 px-4 py-2 rounded-lg bg-gray-800/50 text-white border border-gray-700/50 focus:ring-2 focus:ring-indigo-500"
      >
        <option value="all">All Status</option>
        <option value="approved">Approved</option>
        <option value="pending">Pending</option>
        <option value="rejected">Rejected</option>
      </select>
    </div>
    <div className="grid gap-6">
      {doctors.map((doctor) => (
        <DoctorCard
          key={doctor.id}
          doctor={doctor}
          onAssignTask={doctor.verificationStatus === "approved" ? onAssignTask : undefined}
          isApproved={doctor.verificationStatus === "approved"}
        />
      ))}
    </div>
  </motion.div>
);

const PendingProposals = ({
  doctors,
  onApprove,
  onReject,
}: {
  doctors: Doctor[];
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -20 }}
    transition={{ duration: 0.5 }}
  >
    <h2 className="text-3xl font-extrabold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent mb-6">
      Pending Proposals
    </h2>
    {doctors.length === 0 ? (
      <p className="text-gray-300">No pending proposals found</p>
    ) : (
      <div className="grid gap-6">
        {doctors.map((doctor) => (
          <DoctorCard
            key={doctor.id}
            doctor={doctor}
            onApprove={onApprove}
            onReject={onReject}
          />
        ))}
      </div>
    )}
  </motion.div>
);

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
    <motion.div
      className="bg-gray-800/40 p-6 rounded-lg border border-gray-700/50"
      whileHover={{ scale: 1.02 }}
    >
      <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
        <div className="flex-1 text-white">
          <div className="flex items-center gap-4 mb-4">
            {doctor.profilePicture ? (
              <motion.img
                whileHover={{ scale: 1.1 }}
                src={doctor.profilePicture}
                alt={doctor.name}
                className="w-16 h-16 rounded-full object-cover"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-gray-700 flex items-center justify-center text-gray-400">
                No Image
              </div>
            )}
            <div>
              <h3 className="text-xl font-semibold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                {doctor.name}
              </h3>
              <p className="text-gray-300">{doctor.specialization}</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-gray-400">
            <div>
              <p><strong>Email:</strong> {doctor.email}</p>
              <p><strong>Phone:</strong> {doctor.phone}</p>
              <p><strong>License:</strong> {doctor.licenseNumber}</p>
              <p><strong>Experience:</strong> {doctor.experience} years</p>
            </div>
            <div>
              <p><strong>Education:</strong> {doctor.education}</p>
              <p><strong>Languages:</strong> {doctor.languages?.join(", ") || "N/A"}</p>
              <p><strong>Days:</strong> {doctor.availableDays.join(", ") || "N/A"}</p>
              <p><strong>Status:</strong> {doctor.verificationStatus}</p>
            </div>
          </div>
          <p className="mt-2 text-gray-400"><strong>Bio:</strong> {doctor.biography}</p>
          <motion.a
            whileHover={{ scale: 1.05 }}
            href={doctor.documentUrl}
            target="_blank"
            className="mt-4 inline-block px-4 py-2 bg-indigo-500 text-white rounded-lg"
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
              className="px-4 py-2 bg-green-500 text-white rounded-lg flex items-center"
            >
              <MdCheck className="mr-2" /> Approve
            </motion.button>
          )}
          {!isApproved && onReject && (
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => onReject(doctor.id)}
              className="px-4 py-2 bg-red-500 text-white rounded-lg flex items-center"
            >
              <MdClose className="mr-2" /> Reject
            </motion.button>
          )}
          {isApproved && onAssignTask && (
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => onAssignTask(doctor.id)}
              className="px-4 py-2 bg-indigo-500 text-white rounded-lg flex items-center"
            >
              <MdAssignment className="mr-2" /> Assign Task
            </motion.button>
          )}
        </div>
      </div>
    </motion.div>
  );
}