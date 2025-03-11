"use client";

import { useEffect, useState, useRef } from "react";
import { auth } from "../../firebase";
import { getDatabase, ref, onValue } from "firebase/database";
import { useRouter } from "next/navigation";
import Image from "next/image";
import ChatComponent from "@/components/ChatComponent";
import HamburgerMenu from "@/components/HamburgerMenu";
import { MdEvent, MdAccessTime, MdPhone, MdEmail, MdSearch, MdNotifications, MdEdit, MdCalendarToday, MdAnalytics, MdTask } from "react-icons/md";

interface Chat {
  id: string;
  active: boolean;
  appointmentId: string;
  appointmentTime: string;
  doctorId: string;
  doctorImageUrl: string;
  doctorName: string;
  lastMessage: string;
  lastMessageTime: number;
  patientId: string;
  remainingDays?: number;
  status?: string;
  unreadCount: number;
}

interface Appointment {
  id: string;
  patientId: string;
  date: string;
  timeSlot: string;
  status: string;
}

interface Patient {
  id: string;
  name: string;
  contactNumber?: string;
  email?: string;
}

export default function DoctorDashboard() {
  const [doctorData, setDoctorData] = useState<any>(null);
  const [chats, setChats] = useState<Chat[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [patients, setPatients] = useState<{ [key: string]: Patient }>({});
  const [loading, setLoading] = useState(true);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [greetingState, setGreetingState] = useState<"hidden" | "slide-down" | "slide-up">("hidden");
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (!user) {
        router.push("/");
        return;
      }

      const db = getDatabase();
      const doctorRef = ref(db, "doctors/" + user.uid);
      const chatsRef = ref(db, "chats");
      const patientsRef = ref(db, "patients");

      onValue(doctorRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
          setDoctorData(data);
          const rawAppts = Object.entries(data.appointments || {}).map(([id, appt]: [string, any]) => ({
            id,
            patientId: appt.patientId,
            date: appt.date,
            timeSlot: appt.timeSlot,
            status: appt.status,
          }));
          const filteredAppts = rawAppts.filter((appt) => {
            const apptDate = new Date(`${appt.date}T${appt.timeSlot}:00`);
            const now = new Date();
            return apptDate.getTime() > now.getTime();
          });
          setAppointments(filteredAppts);

          // Show greeting on every load
          setGreetingState("slide-down");
          setTimeout(() => setGreetingState("slide-up"), 3000); // Slide up after 3 seconds
          setTimeout(() => setGreetingState("hidden"), 3500); // Hide after animation
        }
        setLoading(false);
      });

      onValue(chatsRef, (snapshot) => {
        const chatsData = snapshot.val();
        if (chatsData) {
          const doctorChats = Object.values(chatsData)
            .filter((chat: any) => chat.doctorId === user.uid)
            .map((chat: any) => ({
              ...chat,
              remainingDays: chat.remainingDays ?? 0,
              status: chat.status ?? "unknown",
            }));
          setChats(doctorChats as Chat[]);
        }
      });

      onValue(patientsRef, (snapshot) => {
        const patientsData = snapshot.val();
        if (patientsData) {
          const formattedPatients = Object.entries(patientsData).reduce((acc, [id, patient]: [string, any]) => {
            acc[id] = {
              id,
              name: `${patient.survey?.basicInfo?.firstName || ""} ${patient.survey?.basicInfo?.middleName || ""} ${patient.survey?.basicInfo?.lastName || ""}`.trim(),
              contactNumber: patient.survey?.basicInfo?.contactNumber,
              email: patient.survey?.emergencyContact?.email || "N/A",
            };
            return acc;
          }, {} as { [key: string]: Patient });
          setPatients(formattedPatients);
        }
      });
    });

    return () => unsubscribe();
  }, [router]);

  const handleLogout = async () => {
    await auth.signOut();
    router.push("/");
  };

  const toggleChat = () => {
    setIsChatOpen(!isChatOpen);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!scrollRef.current) return;
    setIsDragging(true);
    setStartX(e.pageX - scrollRef.current.offsetLeft);
    setScrollLeft(scrollRef.current.scrollLeft);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !scrollRef.current) return;
    e.preventDefault();
    const x = e.pageX - scrollRef.current.offsetLeft;
    const walk = (x - startX) * 2;
    scrollRef.current.scrollLeft = scrollLeft - walk;
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const filteredChats = chats.filter((chat) => {
    const patient = patients[chat.patientId];
    const patientName = patient?.name || "Unknown Patient";
    return patientName.toLowerCase().includes(searchQuery.toLowerCase());
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!doctorData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-red-500">No doctor data found.</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative">
        {/* Greeting at the top center */}
        {greetingState !== "hidden" && (
          <div className={`fixed top-0 left-0 right-0 flex justify-center z-50 ${greetingState === "slide-down" ? "animate-slide-down" : "animate-slide-up"}`}>
            <div className="text-3xl font-bold text-gray-800 dark:text-gray-200 bg-white dark:bg-gray-800 px-6 py-3 rounded-b-lg shadow-lg">
              Welcome, Dr. {doctorData.name}
            </div>
          </div>
        )}

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6 relative">
          <div className="flex items-center mb-4">
            <div className="relative w-20 h-20 rounded-full overflow-hidden">
              <Image
                src={doctorData.profilePicture || "/placeholder.png"}
                alt="Profile Picture"
                fill
                sizes="100px"
                style={{ objectFit: "cover" }}
                className="rounded-full"
              />
            </div>
            <div className="ml-4 mb-10">
              <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-200">Dr. {doctorData.name}</h1>
            
            </div>
          </div>

          <div className="ml-24 mt-[-57px] text-left mb-10">
            <p className="text-sm font-semibold text-gray-400">Specialization: {doctorData.specialization}</p>
            <p className="text-sm font-semibold mt-[3x] text-gray-400">Experience: {doctorData.experience} years</p>
            <button
              className="mt-2 text-blue-500 hover:underline bg-transparent focus:outline-none"
              onClick={() => router.push("/dashboard/ProfilePage")}
            >
              Edit Profile
            </button>
          </div>

          <div className="absolute top-12 right-10">
            <HamburgerMenu onToggle={toggleMenu} isOpen={isMenuOpen} />
            {isMenuOpen && (
              <div className="absolute right-0 top-12 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg z-50">
                <ul className="py-2">
                  <li>
                    <a
                      href="#"
                      className="block px-4 py-2 text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                      onClick={() => router.push("/dashboard/ProfilePage")}
                    >
                      Profile
                    </a>
                  </li>
                  <li>
                    <a href="#" className="block px-4 py-2 text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700">Settings</a>
                  </li>
                  <li>
                    <a href="#" className="block px-4 py-2 text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700">Help</a>
                  </li>
                  <li>
                    <a href="#" onClick={handleLogout} className="block px-4 py-2 text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700">Logout</a>
                  </li>
                </ul>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-gray-50 dark:bg-gray-700 p-6 rounded-lg shadow">
              <h2 className="text-xl font-semibold mb-4">Profile Overview</h2>
              <div className="space-y-2">
                {/* <p><strong>Email:</strong> {doctorData.email}</p>
                <p><strong>Phone:</strong> {doctorData.phone}</p>
                <p><strong>Languages:</strong> {doctorData.languages?.join(", ") || "N/A"}</p> */}
              </div>
            </div>

            <div className="bg-gray-50 dark:bg-gray-700 p-6 rounded-lg shadow">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Upcoming Appointments</h2>
                <button className="text-blue-500 hover:underline bg-transparent focus:outline-none">
                  <MdCalendarToday className="inline mr-1" /> Calendar View
                </button>
              </div>
              {appointments.length === 0 ? (
                <p className="text-gray-600 dark:text-gray-300">No upcoming appointments scheduled.</p>
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
                      <div
                        key={appointment.id}
                        className="min-w-[250px] bg-white dark:bg-gray-800 shadow-lg rounded-lg p-4 relative"
                      >
                        <h3 className="text-lg font-semibold">{patient?.name || "Unknown Patient"}</h3>
                        <p className="text-gray-600 flex items-center">
                          <MdEvent className="mr-2" /> {appointment.date}
                        </p>
                        <p className="text-gray-600 flex items-center">
                          <MdAccessTime className="mr-2" /> {appointment.timeSlot}
                        </p>
                        {patient && (
                          <>
                            <p className="text-gray-600 text-sm flex items-center">
                              <MdPhone className="mr-2" /> {patient.contactNumber || "N/A"}
                            </p>
                            <p className="text-gray-600 text-sm flex items-center">
                              <MdEmail className="mr-2" /> {patient.email || "N/A"}
                            </p>
                          </>
                        )}
                        <span
                          className={`px-3 py-1 mt-2 inline-block rounded-full text-sm ${
                            appointment.status === "confirmed"
                              ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                              : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
                          }`}
                        >
                          {appointment.status}
                        </span>
                        <MdNotifications className="absolute top-2 right-2 text-yellow-500" />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="bg-gray-50 dark:bg-gray-700 p-6 rounded-lg shadow">
              <h2 className="text-xl font-semibold mb-4">Patient Chats</h2>
              <div className="relative mb-4">
                <MdSearch className="absolute left-3 top-3 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search patients..."
                  className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                    return (
                      <div
                        key={chat.id}
                        className={`p-4 rounded-lg flex justify-between items-center ${
                          chat.active
                            ? "bg-blue-50 dark:bg-gray-900 cursor-pointer hover:bg-blue-100 dark:hover:bg-gray-800"
                            : "bg-gray-100 dark:bg-gray-700 cursor-not-allowed opacity-50"
                        }`}
                        onClick={() => {
                          if (chat.active) {
                            setSelectedChatId(chat.id);
                            setIsChatOpen(true);
                          }
                        }}
                      >
                        <div>
                          <p className="font-semibold">{patientName}</p>
                          <p className="text-sm text-gray-600 dark:text-gray-300">{chat.lastMessage}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {new Date(chat.lastMessageTime).toLocaleString()}
                            {chat.appointmentTime && ` | ${chat.appointmentTime}`}
                          </p>
                        </div>
                        {chat.unreadCount > 0 && (
                          <span className="bg-red-500 text-white rounded-full px-2 py-1 text-xs">{chat.unreadCount}</span>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>

          <div className="mt-6 bg-gray-50 dark:bg-gray-700 p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4">Your Schedule</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {doctorData.availableDays?.map((day: string) => (
                <div
                  key={day}
                  className="text-center p-3 bg-white bg-opacity-5 backdrop-blur-xl border border-white border-opacity-30 rounded-xl shadow-md transition-all duration-300 hover:scale-105 hover:shadow-lg hover:bg-opacity-10 cursor-pointer"
                  onClick={() => {/* Placeholder for updating availability */}}
                >
                  <p className="font-semibold text-gray-800 dark:text-gray-100">{day}</p>
                  <div className="text-sm mt-2">
                    {doctorData.selectedTimeSlots
                      ?.filter((slot: any) => slot.day === day)
                      .map((slot: any, index: number) => (
                        <p key={index} className="text-gray-600 dark:text-gray-200">
                          {slot.startTime} - {slot.endTime}
                        </p>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 bg-gray-50 dark:bg-gray-700 p-6 rounded-lg shadow">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">About Me</h2>
              <button className="text-blue-500 hover:underline bg-transparent ">
                <MdEdit className="inline mr-1" /> Edit
              </button>
            </div>
            <p className="text-gray-600 dark:text-gray-300">{doctorData.biography || "No biography available."}</p>
          </div>

          <div className="mt-6 bg-gray-50 dark:bg-gray-700 p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4">Analytics</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
                <MdAnalytics className="text-3xl mx-auto mb-2 text-blue-500" />
                <p className="text-lg font-semibold">Patients Seen</p>
                <p className="text-2xl">{appointments.length || 0}</p>
              </div>
              <div className="text-center p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
                <MdAnalytics className="text-3xl mx-auto mb-2 text-green-500" />
                <p className="text-lg font-semibold">Avg. Consultation Time</p>
                <p className="text-2xl">25 min</p>
              </div>
              <div className="text-center p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
                <MdAnalytics className="text-3xl mx-auto mb-2 text-yellow-500" />
                <p className="text-lg font-semibold">Patient Satisfaction</p>
                <p className="text-2xl">4.8/5</p>
              </div>
            </div>
          </div>

          <div className="mt-6 bg-gray-50 dark:bg-gray-700 p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4">Tasks</h2>
            <ul className="space-y-2">
              <li className="flex items-center">
                <MdTask className="text-blue-500 mr-2" />
                <span>Follow up with Patient A</span>
              </li>
              <li className="flex items-center">
                <MdTask className="text-blue-500 mr-2" />
                <span>Review lab results for Patient B</span>
              </li>
              <li className="flex items-center">
                <MdTask className="text-blue-500 mr-2" />
                <span>Prepare prescription for Patient C</span>
              </li>
            </ul>
          </div>

          <div className="mt-6 bg-gray-50 dark:bg-gray-700 p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4">Notifications</h2>
            <ul className="space-y-2">
              {appointments.slice(0, 2).map((appt) => (
                <li key={appt.id} className="flex items-center">
                  <MdNotifications className="text-yellow-500 mr-2" />
                  <span>Appointment reminder: {patients[appt.patientId]?.name || "Patient"} at {appt.timeSlot}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {!isChatOpen && (
          <button
            className="fixed bottom-4 right-4 bg-blue-500 text-white rounded-full p-3 shadow-lg hover:bg-blue-600 transition z-40"
            onClick={toggleChat}
          >
            Chat
          </button>
        )}

        {isChatOpen && selectedChatId && (
          <ChatComponent
            chatId={selectedChatId}
            doctorId={auth.currentUser?.uid}
            onClose={toggleChat}
          />
        )}

        <footer className="bg-blue-900 text-white py-6 mt-8">
          <div className="max-w-7xl mx-auto px-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <h3 className="font-semibold">Product</h3>
                <ul className="mt-2">
                  <li><a href="#" className="hover:underline">Home</a></li>
                  <li><a href="#" className="hover:underline">About</a></li>
                  <li><a href="#" className="hover:underline">Blog</a></li>
                  <li><a href="#" className="hover:underline">Contact Us</a></li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold">Legal Details</h3>
                <ul className="mt-2">
                  <li><a href="#" className="hover:underline">Privacy Policy</a></li>
                  <li><a href="#" className="hover:underline">Terms and Conditions</a></li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold">Contact Info</h3>
                <p className="mt-2">Lake Town, Kolkata, West Bengal, 700089</p>
                <p>+91 900 2841 677</p>
                <p>contact@healthmate.in</p>
                <div className="flex space-x-4 mt-2">
                  <a href="#" className="hover:text-gray-300"><MdPhone /></a>
                  <a href="#" className="hover:text-gray-300"><MdEmail /></a>
                </div>
              </div>
            </div>
            <div className="text-center mt-6">
              <p className="text-sm">© 2024 Healthmate. All Rights Reserved.</p>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}