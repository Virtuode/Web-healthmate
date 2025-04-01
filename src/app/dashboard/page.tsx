"use client";

import { useEffect, useState, useRef } from "react";
import { auth } from "../../firebase";
import { signOut } from "firebase/auth";
import { getDatabase, ref, onValue, off, push, set, remove, runTransaction } from "firebase/database";
import { useRouter } from "next/navigation";
import Image from "next/image";
import dynamic from "next/dynamic";
import ChatComponent from "@/components/ChatComponent";
import HamburgerMenu from "@/components/HamburgerMenu";
import CalendarView from "@/components/CalendarView";
import { MdEvent, MdAccessTime, MdPhone, MdEmail, MdSearch, MdNotifications, MdEdit, MdCalendarToday, MdAnalytics, MdTask, MdVideoCall, MdClose } from "react-icons/md";
import { motion } from "framer-motion";
import { getMessaging, getToken } from "firebase/messaging";

// Dynamically import VideoCallComponent with SSR disabled
const VideoCallComponent = dynamic(() => import("@/components/UI/VideoCallComponent"), { ssr: false });

// Interfaces
interface Chat {
  id: string;
  active: boolean;
  appointmentId: string;
  appointmentTime: string;
  doctorId: string;
  doctorImageUrl?: string;
  doctorName?: string;
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
  type: "appointment" | "message" | "system";
  relatedId?: string;
}

export default function DoctorDashboard() {
  const [doctorData, setDoctorData] = useState<any>(null);
  const [chats, setChats] = useState<Chat[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [patients, setPatients] = useState<{ [key: string]: Patient }>({});
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [chatLoading, setChatLoading] = useState(true);
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
      const pendingAppointmentsRef = ref(db, "pendingAppointments");

      onValue(doctorRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
          setDoctorData(data);
          setGreetingState("slide-down");
          setTimeout(() => setGreetingState("slide-up"), 3000);
          setTimeout(() => setGreetingState("hidden"), 3500);
        }
        setLoading(false);
      });

      const fetchAppointments = () => {
        let allAppointments: Appointment[] = [];
        onValue(appointmentsRef, (snapshot) => {
          const apptData = snapshot.val();
          if (apptData) {
            allAppointments = Object.entries(apptData).map(([id, appt]: [string, any]) => ({
              id,
              patientId: appt.patientId,
              date: appt.date,
              timeSlot: appt.startTime,
              status: appt.status,
              doctorId: appt.doctorId,
              startTime: appt.startTime,
              endTime: appt.endTime,
              createdAt: appt.createdAt ?? Date.now(),
              consultationType: appt.consultationType,
            }));
            filterAndSetAppointments(allAppointments);
          }
        });

        onValue(pendingAppointmentsRef, (snapshot) => {
          const pendingData = snapshot.val();
          if (pendingData) {
            const pendingAppts = Object.entries(pendingData)
              .filter(([_, appt]: [string, any]) => appt.doctorId === user.uid)
              .map(([id, appt]: [string, any]) => ({
                id,
                patientId: appt.patientId,
                date: appt.date,
                timeSlot: appt.startTime,
                status: appt.status,
                doctorId: appt.doctorId,
                startTime: appt.startTime,
                endTime: appt.endTime,
                createdAt: appt.createdAt ?? Date.now(),
                consultationType: appt.consultationType,
              }));
            allAppointments = [...allAppointments.filter(a => !pendingAppts.some(p => p.id === a.id)), ...pendingAppts];
            filterAndSetAppointments(allAppointments);
          }
        });
      };

      const filterAndSetAppointments = (appts: Appointment[]) => {
        const now = Date.now();
        const filteredAppts = appts.map(appt => {
          const apptDate = new Date(`${appt.date}T${appt.startTime}:00`).getTime();
          const apptEnd = new Date(`${appt.date}T${appt.endTime}:00`).getTime();
          if (appt.status === "confirmed" && now >= apptDate && now <= apptEnd) {
            return { ...appt, status: "ongoing" };
          }
          return appt;
        }).filter(appt => new Date(`${appt.date}T${appt.startTime}:00`).getTime() > now || appt.status === "ongoing");

        const newAppt = filteredAppts.find(
          (appt) => (appt.createdAt ?? Date.now()) > lastSeenTimestamp && !appointments.some((a) => a.id === appt.id)
        );
        if (newAppt && patients[newAppt.patientId] && !document.hasFocus()) {
          const patientName = patients[newAppt.patientId]?.name || "Unknown Patient";
          const notifMessage = `New ${newAppt.status} appointment with ${patientName} on ${newAppt.date} at ${newAppt.startTime}`;
          addNotification(user.uid, notifMessage, "appointment", newAppt.id);
          setNewAppointmentAlert(notifMessage);
          setTimeout(() => setNewAppointmentAlert(null), 5000);
          setLastSeenTimestamp(Date.now());
        }
        setAppointments(filteredAppts);
      };

      fetchAppointments();

      onValue(chatsRef, (snapshot) => {
        const chatsData = snapshot.val();
        if (chatsData) {
          const doctorChats = Object.values(chatsData)
            .filter((chat: any) => chat.doctorId === user.uid && chat.active)
            .map((chat: any) => ({
              ...chat,
              remainingDays: chat.remainingDays ?? 0,
              status: chat.status ?? "unknown",
              unreadCount: chat.unreadCount ?? 0,
            }));
          setChats(doctorChats.sort((a, b) => {
            const aOngoing = isOngoing(a.appointmentTime) ? 1 : 0;
            const bOngoing = isOngoing(b.appointmentTime) ? 1 : 0;
            return bOngoing - aOngoing || b.unreadCount - a.unreadCount || b.lastMessageTime - a.lastMessageTime;
          }));
          setChatLoading(false);
        }
      });

      onValue(patientsRef, (snapshot) => {
        const patientsData = snapshot.val();
        if (patientsData) {
          setPatients(Object.entries(patientsData).reduce((acc, [id, patient]: [string, any]) => {
            acc[id] = {
              id,
              name: `${patient.survey?.basicInfo?.firstName || ""} ${patient.survey?.basicInfo?.lastName || ""}`.trim(),
              contactNumber: patient.survey?.basicInfo?.contactNumber,
              email: patient.survey?.emergencyContact?.email || "N/A",
            };
            return acc;
          }, {} as { [key: string]: Patient }));
        }
      });

      onValue(notificationsRef, (snapshot) => {
        const notifData = snapshot.val();
        if (notifData) {
          setNotifications(Object.entries(notifData).map(([id, notif]: [string, any]) => ({
            id,
            message: notif.message,
            timestamp: notif.timestamp,
            read: notif.read,
            type: notif.type,
            relatedId: notif.relatedId,
          })));
        }
      });

      return () => {
        unsubscribe();
        off(doctorRef);
        off(chatsRef);
        off(patientsRef);
        off(notificationsRef);
        off(appointmentsRef);
        off(pendingAppointmentsRef);
        if (mediaStream) mediaStream.getTracks().forEach(track => track.stop());
      };
    });
  }, [router]);

  const addNotification = (userId: string, message: string, type: Notification["type"], relatedId?: string) => {
    const db = getDatabase();
    const notifRef = ref(db, `notifications/${userId === auth.currentUser?.uid ? "doctors" : "patients"}/${userId}`);
    push(notifRef).then(newNotifRef => set(newNotifRef, { message, timestamp: Date.now(), read: false, type, relatedId }));
  };

  const markNotificationAsRead = (notifId: string) => {
    const db = getDatabase();
    const notifRef = ref(db, `notifications/doctors/${auth.currentUser?.uid}/${notifId}`);
    const notif = notifications.find((n) => n.id === notifId);
    if (notif) set(notifRef, { ...notif, read: true });
  };

  const createChatForAppointment = async (appointment: Appointment) => {
    const db = getDatabase();
    const chatRef = ref(db, "chats");
    const newChatRef = push(chatRef);
    const chatId = newChatRef.key!;
    await set(newChatRef, {
      id: chatId,
      active: true,
      appointmentId: appointment.id,
      appointmentTime: appointment.startTime,
      doctorId: appointment.doctorId,
      patientId: appointment.patientId,
      lastMessage: "",
      lastMessageTime: Date.now(),
      unreadCount: 0,
      videoCallInitiated: false,
    });
    return chatId;
  };

  const handleApproveAppointment = async (appointment: Appointment) => {
    if (appointment.status !== "pending") return;
    const db = getDatabase();
    const doctorApptRef = ref(db, `doctors/${appointment.doctorId}/appointments/${appointment.id}`);
    const pendingRef = ref(db, `pendingAppointments/${appointment.id}`);
    const patientApptRef = ref(db, `patients/${appointment.patientId}/appointments/${appointment.id}`);

    try {
      await runTransaction(doctorApptRef, (current) =>
        current?.status === "pending" ? { ...appointment, status: "confirmed" } : current
      );
      await set(patientApptRef, { ...appointment, status: "confirmed" });
      await remove(pendingRef);
      await createChatForAppointment(appointment);
      setAppointments(prev => prev.map(appt => appt.id === appointment.id ? { ...appt, status: "confirmed" } : appt));
      const patientName = patients[appointment.patientId]?.name || "Unknown Patient";
      addNotification(
        appointment.patientId,
        `Your appointment with Dr. ${doctorData.name} on ${appointment.date} at ${appointment.startTime} has been confirmed.`,
        "appointment",
        appointment.id
      );
    } catch (error) {
      setErrorMessage("Failed to approve appointment. Please try again.");
      setTimeout(() => setErrorMessage(null), 5000);
    }
  };

  const handleRejectAppointment = async (appointment: Appointment) => {
    if (appointment.status !== "pending") return;
    const db = getDatabase();
    const pendingRef = ref(db, `pendingAppointments/${appointment.id}`);
    const patientApptRef = ref(db, `patients/${appointment.patientId}/appointments/${appointment.id}`);

    try {
      await set(patientApptRef, { ...appointment, status: "rejected" });
      await remove(pendingRef);
      setAppointments(prev => prev.filter(appt => appt.id !== appointment.id));
      const patientName = patients[appointment.patientId]?.name || "Unknown Patient";
      addNotification(
        appointment.patientId,
        `Your appointment with Dr. ${doctorData.name} on ${appointment.date} at ${appointment.startTime} was rejected due to schedule conflict.`,
        "appointment",
        appointment.id
      );
    } catch (error) {
      setErrorMessage("Failed to reject appointment. Please try again.");
      try { await set(patientApptRef, { ...appointment, status: "pending" }); } catch {}
      setTimeout(() => setErrorMessage(null), 5000);
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
      setSelectedChatId(null);
      setIsChatOpen(false);
      setIsMenuOpen(false);
      await router.push("/login");
    } catch (error) {
      console.error("Logout failed:", error);
      setLoading(false);
      setErrorMessage("Failed to log out. Please try again.");
      setTimeout(() => setErrorMessage(null), 5000);
    }
  };

  const isOngoing = (appointmentTime: string): boolean => {
    if (!appointmentTime) return false;
    const [hours, minutes] = appointmentTime.split(":").map(Number);
    const now = new Date();
    const apptStart = new Date(now); apptStart.setHours(hours, minutes, 0, 0);
    const apptEnd = new Date(apptStart.getTime() + 30 * 60 * 1000); // Assuming 30-min slots
    return now >= apptStart && now <= apptEnd;
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

  const handleChatClick = (chatId: string, active: boolean) => (e: React.MouseEvent) => {
    e.stopPropagation();
    if (active) {
      setSelectedChatId(chatId);
      setIsChatOpen(true);
    }
  };

  const handleVideoCallClick = (chat: Chat) => async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (chat.active) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        setMediaStream(stream);
        setSelectedVideoChat(chat);
        setIsVideoCallOpen(true);
        const db = getDatabase();
        const chatRef = ref(db, `chats/${chat.id}/videoCallInitiated`);
        await set(chatRef, true);
        const messaging = getMessaging();
        getToken(messaging).then(token => {
          fetch("/api/send-fcm", {
            method: "POST",
            body: JSON.stringify({ token, message: { data: { chatId: chat.id, type: "videoCallInitiated" } } }),
          });
        }).catch(error => console.error("FCM token error:", error));
      } catch (error) {
        console.error("Failed to start video call:", error);
        setErrorMessage("Failed to access camera/microphone. Please check permissions and try again.");
        setTimeout(() => setErrorMessage(null), 5000);
      }
    }
  };

  const handleVideoCallClose = () => {
    if (selectedVideoChat) {
      const db = getDatabase();
      set(ref(db, `chats/${selectedVideoChat.id}/videoCallInitiated`), false);
    }
    setIsVideoCallOpen(false);
    if (mediaStream) mediaStream.getTracks().forEach(track => track.stop());
    setMediaStream(null);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isMenuOpen && menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isMenuOpen]);

  const filteredChats = chats.filter(chat =>
    patients[chat.patientId]?.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
                    {appointments.map((appointment) => (
                      <motion.div
                        key={appointment.id}
                        className="min-w-[250px] bg-gray-900/50 backdrop-blur-md shadow-lg rounded-lg p-4 border border-gray-700/50"
                        whileHover={{ scale: 1.02 }}
                      >
                        <h3 className="text-lg font-semibold text-gray-200">
                          {patients[appointment.patientId]?.name || "Unknown Patient"}
                        </h3>
                        <p className="text-sm text-gray-400 flex items-center">
                          <MdEvent className="mr-2" /> {appointment.date}
                        </p>
                        <p className="text-sm text-gray-400 flex items-center">
                          <MdAccessTime className="mr-2" /> {appointment.startTime} - {appointment.endTime}
                        </p>
                        {patients[appointment.patientId] && (
                          <>
                            <p className="text-sm text-gray-400 flex items-center">
                              <MdPhone className="mr-2" /> {patients[appointment.patientId].contactNumber || "N/A"}
                            </p>
                            <p className="text-sm text-gray-400 flex items-center">
                              <MdEmail className="mr-2" /> {patients[appointment.patientId].email || "N/A"}
                            </p>
                          </>
                        )}
                        <div className="flex items-center mt-2 space-x-2">
                          <span
                            className={`px-3 py-1 inline-block rounded-full text-sm ${
                              appointment.status === "confirmed"
                                ? "bg-green-900/50 text-green-300"
                                : appointment.status === "ongoing"
                                ? "bg-blue-900/50 text-blue-300"
                                : "bg-yellow-900/50 text-yellow-300"
                            }`}
                          >
                            {appointment.status}
                          </span>
                          {appointment.status === "pending" && (
                            <>
                              <button
                                onClick={() => handleApproveAppointment(appointment)}
                                className="px-3 py-1 bg-green-600 text-white rounded-full text-sm hover:bg-green-700 transition-colors"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => handleRejectAppointment(appointment)}
                                className="px-3 py-1 bg-red-600 text-white rounded-full text-sm hover:bg-red-700 transition-colors"
                              >
                                Reject
                              </button>
                            </>
                          )}
                        </div>
                      </motion.div>
                    ))}
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
                          <p key={`${day}-${index}`}>
                            {slot.startTime} - {slot.endTime}
                          </p>
                        ))}
                    </div>
                  </motion.div>
                ))}
              </div>
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
              {chatLoading ? (
                <div className="flex justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500"></div>
                </div>
              ) : filteredChats.length === 0 ? (
                <p className="text-gray-400">No active chats.</p>
              ) : (
                <div className="space-y-4 max-h-[400px] overflow-y-auto">
                  {filteredChats.map((chat) => (
                    <motion.div
                      key={chat.id}
                      className={`p-4 rounded-lg flex justify-between items-center ${
                        chat.active ? "bg-gray-900/50 hover:bg-gray-900/70 cursor-pointer" : "bg-gray-700/50 cursor-not-allowed opacity-50"
                      } border border-gray-700/50`}
                      whileHover={{ scale: chat.active ? 1.02 : 1 }}
                      onClick={handleChatClick(chat.id, chat.active)}
                    >
                      <div>
                        <p className="font-semibold text-gray-200">
                          {patients[chat.patientId]?.name || "Unknown Patient"}
                        </p>
                        <p className="text-sm text-gray-400">{chat.lastMessage}</p>
                        <p className="text-xs text-gray-500">
                          {new Date(chat.lastMessageTime).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex items-center space-x-2">
                        {chat.unreadCount > 0 && (
                          <span className="bg-red-500 text-white rounded-full px-2 py-1 text-xs">
                            {chat.unreadCount}
                          </span>
                        )}
                        {chat.active && isOngoing(chat.appointmentTime) && (
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
                  ))}
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
                <div className="max-h-[300px] overflow-y-auto">
                  {notifications.length === 0 ? (
                    <p className="text-gray-400">No notifications yet.</p>
                  ) : (
                    <ul className="space-y-2">
                      {notifications
                        .sort((a, b) => b.timestamp - a.timestamp)
                        .map((notif) => (
                          <li
                            key={notif.id}
                            className={`flex items-center p-2 rounded-lg ${
                              notif.read ? "bg-gray-900/30" : "bg-indigo-900/50"
                            } cursor-pointer`}
                            onClick={() => !notif.read && markNotificationAsRead(notif.id)}
                          >
                            <MdNotifications
                              className={`mr-2 ${notif.read ? "text-gray-400" : "text-yellow-400"}`}
                            />
                            <div>
                              <p className={notif.read ? "text-gray-400" : "text-gray-200"}>
                                {notif.message}
                              </p>
                              <p className="text-xs text-gray-500">
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

          <div className="bg-gray-800/50 backdrop-blur-md rounded-xl shadow-lg p-6 border border-gray-700/50">
            <h2 className="text-xl font-semibold text-indigo-200 mb-4">Tasks</h2>
            <ul className="space-y-2">
              {[
                "Follow up with Patient A",
                "Review lab results for Patient B",
                "Prepare prescription for Patient C",
              ].map((task, index) => (
                <li key={`task-${index}`} className="flex items-center text-gray-400">
                  <MdTask className="text-indigo-400 mr-2" />
                  <span>{task}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

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
            doctorName={doctorData.name}
            patientName={patients[selectedVideoChat.patientId]?.name || "Unknown Patient"}
            appointmentTime={selectedVideoChat.appointmentTime}
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
                  <li><a href="#" className="hover:text-indigo-300 transition-colors">Home</a></li>
                  <li><a href="#" className="hover:text-indigo-300 transition-colors">About</a></li>
                  <li><a href="#" className="hover:text-indigo-300 transition-colors">Blog</a></li>
                  <li><a href="#" className="hover:text-indigo-300 transition-colors">Contact Us</a></li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-indigo-200">Legal Details</h3>
                <ul className="mt-2 space-y-1">
                  <li><a href="#" className="hover:text-indigo-300 transition-colors">Privacy Policy</a></li>
                  <li><a href="#" className="hover:text-indigo-300 transition-colors">Terms and Conditions</a></li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-indigo-200">Contact Info</h3>
                <p className="mt-2">Lake Town, Kolkata, West Bengal, 700089</p>
                <p>+91 900 2841 677</p>
                <p>contact@healthmate.in</p>
                <div className="flex space-x-4 mt-2">
                  <a href="#" className="hover:text-indigo-300 transition-colors"><MdPhone /></a>
                  <a href="#" className="hover:text-indigo-300 transition-colors"><MdEmail /></a>
                </div>
              </div>
            </div>
            <div className="text-center mt-6">
              <p className="text-sm">© 2025 Healthmate. All Rights Reserved.</p>
            </div>
          </div>
        </footer>
      </div>
    </motion.div>
  );
}