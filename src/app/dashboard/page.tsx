"use client";

import { useEffect, useState, useRef } from "react";
import { auth } from "../../firebase";
import { signOut } from "firebase/auth";
import { getDatabase, ref, onValue, off, push, set } from "firebase/database";
import { useRouter } from "next/navigation";
import Image from "next/image";
import ChatComponent from "@/components/ChatComponent";
import HamburgerMenu from "@/components/HamburgerMenu";
import CalendarView from "@/components/CalendarView";
import dynamic from "next/dynamic";
import { MdEvent, MdAccessTime, MdPhone, MdEmail, MdSearch, MdNotifications, MdEdit, MdCalendarToday, MdAnalytics, MdTask, MdVideoCall, MdClose } from "react-icons/md";
import { motion } from "framer-motion";

const VideoCallComponent = dynamic(() => import("@/components/UI/VideoCallComponent"), {
  ssr: false,
});

interface Chat {
  id: string;
  isActive: boolean;
  appointmentId: string;
  appointmentTime: string;
  endTime?: string;
  doctorId: string;
  doctorImageUrl: string;
  doctorName: string;
  lastMessage: string;
  lastMessageTime: number;
  patientId: string;
  remainingDays?: number;
  status?: string;
  unreadCount: number;
  videoCallInitiated?: boolean;
}

interface Appointment {
  id: string;
  patientId: string;
  date: string;
  timeSlot: string;
  status: string;
  doctorId: string;
  startTime: string;
  endTime: string;
  createdAt?: number;
  consultationType?: string;
  timestamp?: number;
}

interface Patient {
  id: string;
  name: string;
  contactNumber?: string;
  email?: string;
}

interface Notification {
  id: string;
  message: string;
  timestamp: number;
  read: boolean;
  type: "appointment" | "message" | "system" | "task";
  relatedId?: string;
}

interface Task {
  id: string;
  description: string;
  patientId: string | null; // Explicitly string | null, no undefined
  timestamp: number;
  completed: boolean;
  dueDate: string | null;
}

export default function DoctorDashboard() {
  const [doctorData, setDoctorData] = useState<any>(null);
  const [chats, setChats] = useState<Chat[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [patients, setPatients] = useState<{ [key: string]: Patient }>({});
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isVideoCallOpen, setIsVideoCallOpen] = useState(false);
  const [selectedVideoChat, setSelectedVideoChat] = useState<Chat | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isNotificationInboxOpen, setIsNotificationInboxOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  const [newAppointmentAlert, setNewAppointmentAlert] = useState<string | null>(null);
  const [lastSeenTimestamp, setLastSeenTimestamp] = useState<number>(Date.now());
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [greetingState, setGreetingState] = useState<"hidden" | "slide-down" | "slide-up">("hidden");
  const router = useRouter();
  const menuRef = useRef<HTMLDivElement>(null);

  // Task enhancement states
  const [newTaskDescription, setNewTaskDescription] = useState("");
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "today" | "completed" | "pending">("all");
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (!user) {
        router.push("/login");
        return;
      }
      const db = getDatabase();
      const doctorRef = ref(db, "doctors/" + user.uid);
      const chatsRef = ref(db, "chats");
      const patientsRef = ref(db, "patients");
      const notificationsRef = ref(db, `notifications/doctors/${user.uid}`);
      const appointmentsRef = ref(db, `doctors/${user.uid}/appointments`);
      const tasksRef = ref(db, `doctors/${user.uid}/tasks`);

      onValue(doctorRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
          setDoctorData({
            ...data,
            availableDays: Array.isArray(data.availableDays) ? data.availableDays : data.availableDays ? [data.availableDays] : [],
            selectedTimeSlots: Array.isArray(data.selectedTimeSlots) ? data.selectedTimeSlots : [],
          });
          setGreetingState("slide-down");
          setTimeout(() => setGreetingState("slide-up"), 3000);
          setTimeout(() => setGreetingState("hidden"), 3500);
        }
        setLoading(false);
      });

      onValue(appointmentsRef, (snapshot) => {
        const apptData = snapshot.val();
        if (apptData) {
          const rawAppts = Object.entries(apptData).map(([id, appt]: [string, any]) => ({
            id,
            patientId: appt.patientId,
            date: appt.date,
            timeSlot: appt.timeSlot,
            status: appt.status,
            doctorId: appt.doctorId,
            startTime: appt.startTime,
            endTime: appt.endTime,
            createdAt: appt.createdAt || Date.now(),
            consultationType: appt.consultationType,
            timestamp: appt.timestamp,
          }));

          const filteredAppts = rawAppts.filter((appt) => {
            let apptDate: Date;
            try {
              apptDate = new Date(`${appt.date}T${appt.startTime}:00`);
              if (isNaN(apptDate.getTime())) {
                apptDate = new Date(appt.timestamp || Date.now());
              }
            } catch (e) {
              console.warn(`Invalid date for appointment ${appt.id}: ${appt.date}`, e);
              apptDate = new Date(appt.timestamp || Date.now());
            }
            const currentTime = Date.now();
            return apptDate.getTime() > currentTime - 24 * 60 * 60 * 1000;
          });

          const newAppt = rawAppts.find(
            (appt) =>
              appt.createdAt > lastSeenTimestamp && !appointments.some((a) => a.id === appt.id)
          );
          if (newAppt && patients[newAppt.patientId]) { // Removed !document.hasFocus()
            const patientName = patients[newAppt.patientId]?.name || "Unknown Patient";
            const notifMessage = `New appointment with ${patientName} on ${newAppt.date} at ${newAppt.startTime} for ${newAppt.consultationType || "consultation"}`;
            addNotification(user.uid, notifMessage, "appointment", newAppt.id);
            setNewAppointmentAlert(notifMessage);
            setTimeout(() => setNewAppointmentAlert(null), 5000);
            setLastSeenTimestamp(Date.now());
          }
          setAppointments(filteredAppts);
        } else {
          setAppointments([]);
        }
      });

      onValue(chatsRef, (snapshot) => {
        const chatsData = snapshot.val();
        if (chatsData) {
          const doctorChats = Object.values(chatsData)
            .filter((chat: any) => chat.doctorId === user.uid)
            .map((chat: any) => ({
              id: chat.id,
              isActive: chat.isActive ?? false,
              appointmentId: chat.appointmentId,
              appointmentTime: chat.appointmentTime,
              endTime: chat.endTime || appointments.find(a => a.id === chat.appointmentId)?.endTime,
              doctorId: chat.doctorId,
              doctorImageUrl: chat.doctorImageUrl,
              doctorName: chat.doctorName,
              lastMessage: chat.lastMessage,
              lastMessageTime: chat.lastMessageTime,
              patientId: chat.patientId,
              remainingDays: chat.remainingDays ?? 0,
              status: chat.status ?? "pending",
              unreadCount: chat.unreadCount ?? 0,
              videoCallInitiated: chat.videoCallInitiated ?? false,
            }));
          setChats(doctorChats);
        }
      });

      onValue(patientsRef, (snapshot) => {
        const patientsData = snapshot.val();
        if (patientsData) {
          const formattedPatients = Object.entries(patientsData).reduce(
            (acc, [id, patient]: [string, any]) => {
              acc[id] = {
                id,
                name: `${patient.survey?.basicInfo?.firstName || ""} ${
                  patient.survey?.basicInfo?.middleName || ""
                } ${patient.survey?.basicInfo?.lastName || ""}`.trim(),
                contactNumber: patient.survey?.basicInfo?.contactNumber,
                email: patient.survey?.emergencyContact?.email || "N/A",
              };
              return acc;
            },
            {} as { [key: string]: Patient }
          );
          setPatients(formattedPatients);
        }
      });

      onValue(notificationsRef, (snapshot) => {
        const notifData = snapshot.val();
        if (notifData) {
          const notifList = Object.entries(notifData).map(([id, notif]: [string, any]) => ({
            id,
            message: notif.message,
            timestamp: notif.timestamp,
            read: notif.read,
            type: notif.type,
            relatedId: notif.relatedId,
          }));
          setNotifications(notifList);
        } else {
          setNotifications([]);
        }
      });

      onValue(tasksRef, (snapshot) => {
        const tasksData = snapshot.val();
        if (tasksData) {
          const taskList = Object.entries(tasksData).map(([id, task]: [string, any]) => ({
            id,
            description: task.description,
            patientId: task.patientId !== undefined ? task.patientId : null, // Normalize to null if undefined
            timestamp: task.timestamp,
            completed: task.completed || false,
            dueDate: task.dueDate || null,
          }));
          setTasks(taskList);
        } else {
          setTasks([]);
        }
      });

      return () => {
        unsubscribe();
        off(doctorRef);
        off(chatsRef);
        off(patientsRef);
        off(notificationsRef);
        off(appointmentsRef);
        off(tasksRef);
        if (mediaStream) {
          mediaStream.getTracks().forEach(track => {
            track.stop();
            track.enabled = false;
          });
          setMediaStream(null);
        }
      };
    });
  }, [router]);

  const addNotification = (
    doctorId: string,
    message: string,
    type: Notification["type"],
    relatedId?: string
  ) => {
    const db = getDatabase();
    const notifRef = ref(db, `notifications/doctors/${doctorId}`);
    const newNotifRef = push(notifRef);
    set(newNotifRef, {
      message,
      timestamp: Date.now(),
      read: false,
      type,
      relatedId,
    });
  };

  const markNotificationAsRead = (notifId: string) => {
    const db = getDatabase();
    const notifRef = ref(db, `notifications/doctors/${auth.currentUser?.uid}/${notifId}`);
    const notif = notifications.find((n) => n.id === notifId);
    if (notif) {
      set(notifRef, { ...notif, read: true });
    }
  };

  const handleLogout = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      setLoading(true);
      await signOut(auth);
      setDoctorData(null);
      setChats([]);
      setAppointments([]);
      setPatients({});
      setNotifications([]);
      setTasks([]);
      setSelectedChatId(null);
      setIsChatOpen(false);
      setIsMenuOpen(false);
      await router.push("/login");
    } catch (error) {
      console.error("Logout failed:", error);
      setLoading(false);
      alert("Failed to log out. Please try again.");
    }
  };

  const isChatTimeValid = (chat: Chat): boolean => {
    try {
      const appointmentTime = new Date(chat.appointmentTime).getTime();
      const endTimeStr = chat.endTime
        ? `${chat.appointmentTime.split(" ")[0]}T${chat.endTime}:00`
        : new Date(appointmentTime + 30 * 60 * 1000).toISOString();
      const endTime = new Date(endTimeStr).getTime();
      const currentTime = Date.now();
      return currentTime >= appointmentTime && currentTime <= endTime && chat.status === "confirmed";
    } catch (e) {
      return false;
    }
  };

  const handleProfileClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsMenuOpen(false);
    router.push("/dashboard/ProfilePage");
  };

  const toggleMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsMenuOpen((prev) => !prev);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!scrollRef.current) return;
    setIsDragging(true);
    setStartX(e.pageX - scrollRef.current.offsetLeft);
    setScrollLeft(scrollRef.current.scrollLeft);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !scrollRef.current) return;
    e.preventDefault();
    e.stopPropagation();
    const x = e.pageX - scrollRef.current.offsetLeft;
    const walk = (x - startX) * 2;
    scrollRef.current.scrollLeft = scrollLeft - walk;
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleChatClick = (chatId: string, isValid: boolean) => (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isValid) {
      setSelectedChatId(chatId);
      setIsChatOpen(true);
    }
  };

  const requestMediaPermissions = async (): Promise<MediaStream | null> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setMediaStream(stream);
      return stream;
    } catch (error) {
      console.error("Failed to get media permissions:", error);
      if (error instanceof DOMException && error.name === "NotAllowedError") {
        setErrorMessage("Camera and microphone permissions are required to start a video call.");
      } else {
        setErrorMessage("An error occurred while accessing media devices.");
      }
      return null;
    }
  };

  const resetVideoCallState = (chatId: string) => {
    const db = getDatabase();
    const chatRef = ref(db, `chats/${chatId}/videoCallInitiated`);
    set(chatRef, false).catch((error) => {
      console.error(`Failed to reset videoCallInitiated for chat ID: ${chatId}`, error);
    });
  };

  const handleVideoCallClick = (chat: Chat) => async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isChatTimeValid(chat)) {
      const stream = await requestMediaPermissions();
      if (stream) {
        setSelectedVideoChat(chat);
        setIsVideoCallOpen(true);

        const db = getDatabase();
        const chatRef = ref(db, `chats/${chat.id}/videoCallInitiated`);
        set(chatRef, true).catch((error) => {
          console.error(`Failed to initiate video call for chat ID: ${chat.id}`, error);
          setErrorMessage("Failed to start the video call. Please try again.");
          setIsVideoCallOpen(false);
          resetVideoCallState(chat.id);
          if (mediaStream) {
            mediaStream.getTracks().forEach(track => track.stop());
            setMediaStream(null);
          }
        });
      } else {
        setTimeout(() => setErrorMessage(null), 5000);
      }
    } else {
      setErrorMessage("Video call is only available during the appointment time.");
      setTimeout(() => setErrorMessage(null), 5000);
    }
  };

  const handleVideoCallClose = () => {
    if (selectedVideoChat) resetVideoCallState(selectedVideoChat.id);
    setIsVideoCallOpen(false);
    if (mediaStream) {
      mediaStream.getTracks().forEach(track => {
        track.stop();
        track.enabled = false;
      });
      setMediaStream(null);
    }
  };

  const toggleTaskCompletion = (taskId: string) => {
    const db = getDatabase();
    const taskRef = ref(db, `doctors/${auth.currentUser?.uid}/tasks/${taskId}`);
    const task = tasks.find(t => t.id === taskId);
    if (task) {
      const updatedTask = {
        description: task.description,
        patientId: task.patientId !== undefined ? task.patientId : null, // Ensure no undefined
        timestamp: task.timestamp,
        completed: !task.completed,
        dueDate: task.dueDate || null,
      };
      set(taskRef, updatedTask).catch((error) => {
        console.error("Failed to update task:", error);
      });
    }
  };

  const addTask = () => {
    if (!newTaskDescription.trim()) return;
    const db = getDatabase();
    const tasksRef = ref(db, `doctors/${auth.currentUser?.uid}/tasks`);
    const newTaskRef = push(tasksRef);
    set(newTaskRef, {
      description: newTaskDescription,
      patientId: selectedPatientId || null,
      timestamp: Date.now(),
      completed: false,
      dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split("T")[0], // Default to tomorrow
    });
    setNewTaskDescription("");
    setSelectedPatientId(null);
  };

  const filteredTasks = tasks.filter((task) => {
    if (filter === "today") {
      const today = new Date().toISOString().split("T")[0];
      return task.dueDate === today;
    }
    if (filter === "completed") return task.completed;
    if (filter === "pending") return !task.completed;
    return true;
  });

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isMenuOpen && menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isMenuOpen]);

  const filteredChats = chats.filter((chat) => {
    const patient = patients[chat.patientId];
    const patientName = patient?.name || "Unknown Patient";
    return patientName.toLowerCase().includes(searchQuery.toLowerCase());
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  if (!doctorData) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <div className="text-red-400">No doctor data found.</div>
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative">
        {greetingState !== "hidden" && (
          <motion.div
            className="fixed top-0 left-0 right-0 flex justify-center z-[1000]"
            initial={{ y: -100 }}
            animate={{ y: greetingState === "slide-down" ? 0 : -100 }}
            transition={{ duration: 0.5 }}
          >
            <div className="text-2xl font-semibold bg-gray-800/80 backdrop-blur-md px-6 py-3 rounded-b-lg shadow-lg text-indigo-200">
              Welcome, Dr. {doctorData.name}
            </div>
          </motion.div>
        )}

        {newAppointmentAlert && (
          <motion.div
            className="fixed top-16 left-0 right-0 flex justify-center z-[1000]"
            initial={{ y: -100 }}
            animate={{ y: 0 }}
            exit={{ y: -100 }}
            transition={{ duration: 0.5 }}
          >
            <div className="bg-indigo-900/80 backdrop-blur-md px-6 py-3 rounded-lg shadow-lg text-indigo-200 flex items-center">
              <MdNotifications className="mr-2" />
              {newAppointmentAlert}
            </div>
          </motion.div>
        )}

        {errorMessage && (
          <motion.div
            className="fixed top-32 left-0 right-0 flex justify-center z-[1000]"
            initial={{ y: -100 }}
            animate={{ y: 0 }}
            exit={{ y: -100 }}
            transition={{ duration: 0.5 }}
          >
            <div className="bg-red-900/80 backdrop-blur-md px-6 py-3 rounded-lg shadow-lg text-red-200 flex items-center">
              <MdNotifications className="mr-2" />
              {errorMessage}
              <button
                onClick={() => setErrorMessage(null)}
                className="ml-4 text-red-200 hover:text-red-100"
              >
                <MdClose />
              </button>
            </div>
          </motion.div>
        )}

        <div className="bg-gray-800/50 backdrop-blur-md rounded-xl shadow-lg p-6 mb-6 border border-gray-700/50 relative z-[999]">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="relative w-16 h-16 rounded-full overflow-hidden ring-2 ring-indigo-500">
                <Image
                  src={doctorData.profilePicture || "/placeholder.png"}
                  alt="Profile Picture"
                  fill
                  sizes="100px"
                  style={{ objectFit: "cover" }}
                />
              </div>
              <div className="ml-4">
                <h1 className="text-3xl font-bold text-indigo-200">Dr. {doctorData.name}</h1>
                <p className="text-sm text-gray-400">Specialization: {doctorData.specialization}</p>
                <p className="text-sm text-gray-400">Experience: {doctorData.experience} years</p>
                <button
                  className="mt-2 text-indigo-400 hover:text-indigo-300 transition-colors bg-transparent"
                  onClick={handleProfileClick}
                >
                  <MdEdit className="inline mr-1" /> Edit Profile
                </button>
              </div>
            </div>
            <div className="flex z-[1000] relative">
              <HamburgerMenu onToggle={toggleMenu} isOpen={isMenuOpen} />
              {isMenuOpen && (
                <div
                  ref={menuRef}
                  className="absolute right-0 top-12 w-48 bg-gray-800/80 backdrop-blur-md rounded-lg shadow-lg z-[1001] border border-gray-700/50 mt-2"
                >
                  <ul className="py-2">
                    <li>
                      <button
                        onClick={handleProfileClick}
                        className="w-full text-left block px-4 py-2 text-gray-200 hover:bg-gray-700/50"
                      >
                        Profile
                      </button>
                    </li>
                    <li>
                      <a href="#" className="block px-4 py-2 text-gray-200 hover:bg-gray-700/50">
                        Settings
                      </a>
                    </li>
                    <li>
                      <a href="#" className="block px-4 py-2 text-gray-200 hover:bg-gray-700/50">
                        Help
                      </a>
                    </li>
                    <li>
                      <button
                        onClick={handleLogout}
                        className="w-full text-left block px-4 py-2 text-gray-200 hover:bg-gray-700/50"
                      >
                        Logout
                      </button>
                    </li>
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-gray-800/50 backdrop-blur-md rounded-xl shadow-lg p-6 border border-gray-700/50">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-indigo-200">Upcoming Appointments</h2>
                <button
                  onClick={() => setViewMode(viewMode === "list" ? "calendar" : "list")}
                  className="text-indigo-400 hover:text-indigo-300 transition-colors bg-transparent"
                >
                  <MdCalendarToday className="inline mr-1" />
                  {viewMode === "list" ? "Calendar View" : "List View"}
                </button>
              </div>

              {viewMode === "list" ? (
                appointments.length === 0 ? (
                  <p className="text-gray-400">No upcoming appointments scheduled.</p>
                ) : (
                  <div
                    ref={scrollRef}
                    className="flex space-x-4 overflow-x-auto p-4 scrollbar-hide cursor-grab"
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                  >
                    {appointments.map((appointment) => {
                      const patient = patients[appointment.patientId];
                      return (
                        <motion.div
                          key={appointment.id}
                          className="min-w-[250px] bg-gray-900/50 backdrop-blur-md shadow-lg rounded-lg p-4 border border-gray-700/50"
                          whileHover={{ scale: 1.02 }}
                        >
                          <h3 className="text-lg font-semibold text-gray-200">
                            {patient?.name || "Unknown Patient"}
                          </h3>
                          <p className="text-sm text-gray-400 flex items-center">
                            <MdEvent className="mr-2" /> {appointment.date}
                          </p>
                          <p className="text-sm text-gray-400 flex items-center">
                            <MdAccessTime className="mr-2" /> {appointment.startTime} -{" "}
                            {appointment.endTime}
                          </p>
                          {patient && (
                            <>
                              <p className="text-sm text-gray-400 flex items-center">
                                <MdPhone className="mr-2" /> {patient.contactNumber || "N/A"}
                              </p>
                              <p className="text-sm text-gray-400 flex items-center">
                                <MdEmail className="mr-2" /> {patient.email || "N/A"}
                              </p>
                            </>
                          )}
                          <span
                            className={`px-3 py-1 mt-2 inline-block rounded-full text-sm ${
                              appointment.status === "confirmed"
                                ? "bg-green-900/50 text-green-300"
                                : "bg-yellow-900/50 text-yellow-300"
                            }`}
                          >
                            {appointment.status}
                          </span>
                        </motion.div>
                      );
                    })}
                  </div>
                )
              ) : (
                <CalendarView
                  appointments={appointments}
                  patients={patients}
                  doctorName={doctorData.name}
                />
              )}
            </div>

            <div className="bg-gray-800/50 backdrop-blur-md rounded-xl shadow-lg p-6 border border-gray-700/50">
              <h2 className="text-xl font-semibold text-indigo-200 mb-4">Your Schedule</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {doctorData.availableDays?.map((day: string) => (
                  <motion.div
                    key={day}
                    className="text-center p-4 bg-gray-900/50 backdrop-blur-md rounded-lg shadow-md border border-gray-700/50 transition-all duration-300 hover:bg-gray-900/70 hover:shadow-lg cursor-pointer"
                    whileHover={{ scale: 1.05 }}
                  >
                    <p className="font-semibold text-gray-200">{day}</p>
                    <div className="text-sm mt-2 text-gray-400">
                      {doctorData.selectedTimeSlots
                        ?.filter((slot: any) => slot.day === day)
                        .map((slot: any, index: number) => (
                          <p key={index}>
                            {slot.startTime} - {slot.endTime}
                          </p>
                        ))}
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            <div className="bg-gray-800/50 backdrop-blur-md rounded-xl shadow-lg p-6 border border-gray-700/50">
              <h2 className="text-xl font-semibold text-indigo-200 mb-4">Tasks</h2>
              <div className="mb-4 flex flex-col gap-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newTaskDescription}
                    onChange={(e) => setNewTaskDescription(e.target.value)}
                    placeholder="Enter new task..."
                    className="flex-1 p-2 rounded-lg bg-gray-900/50 text-white border border-gray-700/50 focus:ring-2 focus:ring-indigo-500"
                  />
                  <select
                    value={selectedPatientId || ""}
                    onChange={(e) => setSelectedPatientId(e.target.value || null)}
                    className="p-2 rounded-lg bg-gray-900/50 text-white border border-gray-700/50"
                  >
                    <option value="">No Patient</option>
                      {Object.values(patients)
                      .filter((patient) => 
                        appointments.some((appt) => appt.patientId === patient.id)
                      )
                      .map((patient) => (
                        <option key={patient.id} value={patient.id}>{patient.name}</option>
                      ))}
                  </select>
                  <button
                    onClick={addTask}
                    className="px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors"
                  >
                    Add Task
                  </button>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setFilter("all")}
                    className={`px-3 py-1 rounded-lg ${filter === "all" ? "bg-indigo-600" : "bg-gray-700"}`}
                  >
                    All
                  </button>
                  <button
                    onClick={() => setFilter("today")}
                    className={`px-3 py-1 rounded-lg ${filter === "today" ? "bg-indigo-600" : "bg-gray-700"}`}
                  >
                    Today
                  </button>
                  <button
                    onClick={() => setFilter("completed")}
                    className={`px-3 py-1 rounded-lg ${filter === "completed" ? "bg-indigo-600" : "bg-gray-700"}`}
                  >
                    Completed
                  </button>
                  <button
                    onClick={() => setFilter("pending")}
                    className={`px-3 py-1 rounded-lg ${filter === "pending" ? "bg-indigo-600" : "bg-gray-700"}`}
                  >
                    Pending
                  </button>
                </div>
              </div>
              {filteredTasks.length === 0 ? (
                <p className="text-gray-400">No tasks match the current filter.</p>
              ) : (
                <ul className="space-y-2">
                  {filteredTasks.sort((a, b) => a.timestamp - b.timestamp).map((task) => (
                    <li
                      key={task.id}
                      className="flex items-center text-gray-400 cursor-pointer hover:bg-gray-700/50 p-2 rounded"
                      onClick={() => setSelectedTask(task)}
                    >
                      <input
                        type="checkbox"
                        checked={task.completed}
                        onChange={(e) => {
                          e.stopPropagation();
                          toggleTaskCompletion(task.id);
                        }}
                        className="mr-2 h-4 w-4 text-indigo-600 border-gray-700 rounded focus:ring-indigo-500"
                      />
                      <MdTask className="text-indigo-400 mr-2" />
                      <span className={task.completed ? "line-through text-gray-500" : ""}>
                        {task.description} {task.patientId && `- ${patients[task.patientId]?.name || "Unknown Patient"}`}
                        {task.dueDate && ` (Due: ${new Date(task.dueDate).toLocaleDateString()})`}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-gray-800/50 backdrop-blur-md rounded-xl shadow-lg p-6 border border-gray-700/50">
              <h2 className="text-xl font-semibold text-indigo-200 mb-4">Patient Chats</h2>
              <div className="relative mb-4">
                <MdSearch className="absolute left-3 top-3 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search patients..."
                  className="w-full pl-10 pr-4 py-2 rounded-lg bg-gray-900/50 text-white border border-gray-700/50 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all placeholder-gray-500"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="space-y-4 max-h-[400px] overflow-y-auto">
                {filteredChats
                  .sort((a, b) => b.lastMessageTime - a.lastMessageTime)
                  .map((chat) => {
                    const patient = patients[chat.patientId];
                    const patientName = patient?.name || "Unknown Patient";
                    const isValid = isChatTimeValid(chat);
                    return (
                      <motion.div
                        key={chat.id}
                        className={`p-4 rounded-lg flex justify-between items-center ${
                          isValid
                            ? "bg-gray-900/50 hover:bg-gray-900/70 cursor-pointer"
                            : "bg-gray-700/50 cursor-not-allowed opacity-50"
                        } border border-gray-700/50`}
                        whileHover={{ scale: isValid ? 1.02 : 1 }}
                        onClick={handleChatClick(chat.id, isValid)}
                      >
                        <div>
                          <p className="font-semibold text-gray-200">{patientName}</p>
                          <p className="text-sm text-gray-400">{chat.lastMessage}</p>
                          <p className="text-xs text-gray-500">
                            {new Date(chat.lastMessageTime).toLocaleString()}
                            {chat.appointmentTime && ` | ${chat.appointmentTime}`}
                          </p>
                        </div>
                        <div className="flex items-center space-x-2">
                          {chat.unreadCount > 0 && (
                            <span className="bg-red-500 text-white rounded-full px-2 py-1 text-xs">
                              {chat.unreadCount}
                            </span>
                          )}
                          {isValid && (
                            <motion.button
                              onClick={handleVideoCallClick(chat)}
                              className="text-indigo-400 hover:text-indigo-300 transition-colors"
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                            >
                              <MdVideoCall size={24} />
                            </motion.button>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
              </div>
            </div>

            <div className="bg-gray-800/50 backdrop-blur-md rounded-xl shadow-lg p-6 border border-gray-700/50">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-indigo-200">
                  Notifications ({notifications.filter((n) => !n.read).length})
                </h2>
                <button
                  onClick={() => setIsNotificationInboxOpen(!isNotificationInboxOpen)}
                  className="text-indigo-400 hover:text-indigo-300 transition-colors bg-transparent"
                >
                  {isNotificationInboxOpen ? "Collapse" : "Expand"}
                </button>
              </div>
              {isNotificationInboxOpen && (
                <div className="max-h-[250px] overflow-y-auto scrollbar-thin scrollbar-thumb-indigo-500 scrollbar-track-gray-700">
                  {notifications.length === 0 ? (
                    <p className="text-gray-400 text-center">No notifications yet.</p>
                  ) : (
                    <ul className="space-y-3">
                      {notifications.sort((a, b) => b.timestamp - a.timestamp).map((notif) => (
                        <li
                          key={notif.id}
                          className={`flex items-start p-3 rounded-lg transition-all duration-200 ${
                            notif.read ? "bg-gray-900/30" : "bg-indigo-900/70 hover:bg-indigo-900/90"
                          } cursor-pointer`}
                          onClick={() => !notif.read && markNotificationAsRead(notif.id)}
                        >
                          <MdNotifications
                            className={`mr-3 mt-1 flex-shrink-0 ${notif.read ? "text-gray-400" : "text-yellow-400"}`}
                            size={20}
                          />
                          <div className="flex-1">
                            <p className={`text-sm ${notif.read ? "text-gray-400" : "text-gray-200 font-medium"}`}>
                              {notif.message}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                              {new Date(notif.timestamp).toLocaleString()}
                            </p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>

            <div className="bg-gray-800/50 backdrop-blur-md rounded-xl shadow-lg p-6 border border-gray-700/50">
              <h2 className="text-xl font-semibold text-indigo-200 mb-4">Analytics</h2>
              <div className="grid grid-cols-1 gap-4">
                <div className="text-center p-4 bg-gray-900/50 rounded-lg shadow border border-gray-700/50">
                  <MdAnalytics className="text-3xl mx-auto mb-2 text-indigo-400" />
                  <p className="text-lg font-semibold text-gray-200">Patients Seen</p>
                  <p className="text-2xl text-indigo-200">{appointments.length || 0}</p>
                </div>
                <div className="text-center p-4 bg-gray-900/50 rounded-lg shadow border border-gray-700/50">
                  <MdAnalytics className="text-3xl mx-auto mb-2 text-green-400" />
                  <p className="text-lg font-semibold text-gray-200">Avg. Consultation Time</p>
                  <p className="text-2xl text-green-200">25 min</p>
                </div>
                <div className="text-center p-4 bg-gray-900/50 rounded-lg shadow border border-gray-700/50">
                  <MdAnalytics className="text-3xl mx-auto mb-2 text-yellow-400" />
                  <p className="text-lg font-semibold text-gray-200">Patient Satisfaction</p>
                  <p className="text-2xl text-yellow-200">4.8/5</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-gray-800/50 backdrop-blur-md rounded-xl shadow-lg p-6 border border-gray-700/50">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-indigo-200">About Me</h2>
              <button
                className="text-indigo-400 hover:text-indigo-300 transition-colors bg-transparent"
                onClick={handleProfileClick}
              >
                <MdEdit className="inline mr-1" /> Edit
              </button>
            </div>
            <p className="text-gray-400">{doctorData.biography || "No biography available."}</p>
          </div>
        </div>

        {selectedTask && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            onClick={() => setSelectedTask(null)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              className="bg-gray-800 rounded-lg p-6 w-96 border border-gray-700/50"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-xl font-semibold text-indigo-200 mb-4">Task Details</h3>
              <p><strong>Description:</strong> {selectedTask.description}</p>
              {selectedTask.patientId && (
                <p><strong>Patient:</strong> {patients[selectedTask.patientId]?.name || "Unknown"}</p>
              )}
              <p><strong>Created:</strong> {new Date(selectedTask.timestamp).toLocaleString()}</p>
              {selectedTask.dueDate && (
                <p><strong>Due:</strong> {new Date(selectedTask.dueDate).toLocaleDateString()}</p>
              )}
              <p><strong>Status:</strong> {selectedTask.completed ? "Completed" : "Pending"}</p>
              <button
                onClick={() => setSelectedTask(null)}
                className="mt-4 px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600"
              >
                Close
              </button>
            </motion.div>
          </motion.div>
        )}

        {isChatOpen && selectedChatId && (
          <ChatComponent
            chatId={selectedChatId}
            doctorId={auth.currentUser?.uid || ""}
            onClose={() => setIsChatOpen(false)}
            extraContent={
              newAppointmentAlert && (
                <motion.div
                  className="bg-indigo-900/80 backdrop-blur-md px-4 py-2 rounded-lg shadow-lg text-indigo-200 flex items-center"
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  <MdNotifications className="mr-2" />
                  {newAppointmentAlert}
                </motion.div>
              )
            }
          />
        )}

        {isVideoCallOpen && selectedVideoChat && (
          <VideoCallComponent
            chatId={selectedVideoChat.id}
            doctorId={selectedVideoChat.doctorId}
            patientId={selectedVideoChat.patientId}
            doctorName={selectedVideoChat.doctorName}
            patientName={patients[selectedVideoChat.patientId]?.name || "Unknown Patient"}
            appointmentTime={selectedVideoChat.appointmentTime}
            endTime={selectedVideoChat.endTime}
            doctorProfilePicture={doctorData?.profilePicture}
            mediaStream={mediaStream}
            onClose={handleVideoCallClose}
          />
        )}

        <footer className="bg-gray-900/50 backdrop-blur-md text-gray-400 py-6 mt-8 border-t border-gray-700/50">
          <div className="max-w-7xl mx-auto px-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <h3 className="font-semibold text-indigo-200">Product</h3>
                <ul className="mt-2 space-y-1">
                  <li>
                    <a href="#" className="hover:text-indigo-300 transition-colors">
                      Home
                    </a>
                  </li>
                  <li>
                    <a href="#" className="hover:text-indigo-300 transition-colors">
                      About
                    </a>
                  </li>
                  <li>
                    <a href="#" className="hover:text-indigo-300 transition-colors">
                      Blog
                    </a>
                  </li>
                  <li>
                    <a href="#" className="hover:text-indigo-300 transition-colors">
                      Contact Us
                    </a>
                  </li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-indigo-200">Legal Details</h3>
                <ul className="mt-2 space-y-1">
                  <li>
                    <a href="#" className="hover:text-indigo-300 transition-colors">
                      Privacy Policy
                    </a>
                  </li>
                  <li>
                    <a href="#" className="hover:text-indigo-300 transition-colors">
                      Terms and Conditions
                    </a>
                  </li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-indigo-200">Contact Info</h3>
                <p className="mt-2">Lake Town, Kolkata, West Bengal, 700089</p>
                <p>+91 900 2841 677</p>
                <p>contact@healthmate.in</p>
                <div className="flex space-x-4 mt-2">
                  <a href="#" className="hover:text-indigo-300 transition-colors">
                    <MdPhone />
                  </a>
                  <a href="#" className="hover:text-indigo-300 transition-colors">
                    <MdEmail />
                  </a>
                </div>
              </div>
            </div>
            <div className="text-center mt-6">
              <p className="text-sm">© 2024 Healthmate. All Rights Reserved.</p>
            </div>
          </div>
        </footer>
      </div>
    </motion.div>
  );
}