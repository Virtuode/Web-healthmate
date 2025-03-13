"use client";

import { useState, useEffect } from "react";
import { storage, auth } from "@/firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { getDatabase, ref as dbRef, set, runTransaction, get } from "firebase/database";
import { useRouter } from "next/navigation";
import TimeSlotCard from "@/components/TimeSlotCard";
import { TimeSlot } from "@/models/TimeSlot";
import { motion } from "framer-motion";
import { onAuthStateChanged } from "firebase/auth";

export default function DoctorProfileSetup() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [specialization, setSpecialization] = useState("");
  const [education, setEducation] = useState("");
  const [documentUrl, setDocumentUrl] = useState<File | null>(null);
  const [verificationMessage, setVerificationMessage] = useState("");
  const [isDocumentVerified, setIsDocumentVerified] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [licenseNumber, setLicenseNumber] = useState("");
  const [availableDays, setAvailableDays] = useState<string[]>([]);
  const [selectedTimeSlots, setSelectedTimeSlots] = useState<TimeSlot[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [experience, setExperience] = useState("");
  const [gender, setGender] = useState("");
  const [biography, setBiography] = useState("");
  const [profilePicture, setProfilePicture] = useState<File | null>(null);
  const [languages, setLanguages] = useState<string[]>([]);
  const [user, setUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const daysOfWeek = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const router = useRouter();

  const validateLicenseNumber = (license: string) => /^NMC-\d{6,}$/.test(license);

  // Monitor authentication state and check if profile exists
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) {
        router.push("/login");
      } else {
        setUser(currentUser);
      }
      setAuthLoading(false);
    });
  
    return () => unsubscribe();
  }, [router]);

  useEffect(() => {
    if (licenseNumber && !validateLicenseNumber(licenseNumber)) {
      setVerificationMessage("License must start with 'NMC-' followed by 6+ digits");
    } else if (licenseNumber) {
      setVerificationMessage("");
    }
  }, [licenseNumber]);

  const handleDayChange = (e: React.MouseEvent, day: string) => {
    e.preventDefault();
    setAvailableDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
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
        setErrorMessage(`Time slot ${timeSlot.startTime}-${timeSlot.endTime} conflicts with existing selection`);
        return prev;
      }
      setErrorMessage("");
      return [...prev, timeSlot];
    });
  };

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isDocumentVerified) {
      setErrorMessage("Please verify your document before submitting.");
      return;
    }
    if (!user) {
      setErrorMessage("You must be logged in to submit your profile.");
      return;
    }
    setLoading(true);
    setErrorMessage("");

    try {
      let profilePictureUrl = "";
      if (profilePicture) {
        const profileStorageRef = ref(storage, `doctor-profiles/${Date.now()}-${profilePicture.name}`);
        await uploadBytes(profileStorageRef, profilePicture);
        profilePictureUrl = await getDownloadURL(profileStorageRef);
      }

      let documentDownloadUrl = "";
      if (documentUrl) {
        const docStorageRef = ref(storage, `doctor-documents/${Date.now()}-${documentUrl.name}`);
        await uploadBytes(docStorageRef, documentUrl);
        documentDownloadUrl = await getDownloadURL(docStorageRef);
      }

      const formattedTimeSlots = selectedTimeSlots.map((slot) => ({
        id: slot.id,
        day: slot.day,
        startTime: slot.startTime,
        endTime: slot.endTime,
        isAvailable: true,
        bookedBy: null,
      }));

      const db = getDatabase();
      const doctorRef = dbRef(db, `doctors/${user.uid}`);

      const doctorData = {
        name,
        email,
        phone,
        specialization,
        education,
        experience: parseInt(experience) || 0,
        gender,
        biography,
        documentUrl: documentDownloadUrl,
        licenseNumber,
        availableDays,
        selectedTimeSlots: formattedTimeSlots,
        isVerified: false,
        verificationStatus: "pending",
        languages,
        profilePicture: profilePictureUrl,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await runTransaction(doctorRef, (currentData) => {
        if (currentData) {
          throw new Error("Profile already exists for this user.");
        }
        return doctorData;
      });

      alert("Profile submitted for admin approval!");
      router.push("/doctor-waiting");
    } catch (error: any) {
      console.error("Error setting up profile:", error);
      setErrorMessage(error.message || "Failed to set up profile. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const verifyDocument = async () => {
    if (!documentUrl || !licenseNumber) {
      setVerificationMessage("Please upload a document and enter a license number");
      return;
    }
    if (!validateLicenseNumber(licenseNumber)) {
      setVerificationMessage("Invalid license format (e.g., NMC-123456)");
      return;
    }
    if (documentUrl.type !== "application/pdf") {
      setVerificationMessage("Please upload a PDF file");
      return;
    }

    setIsVerifying(true);
    setVerificationMessage("Verifying document...");

    try {
      const storageRef = ref(storage, `doctor-documents/${Date.now()}-${documentUrl.name}`);
      await uploadBytes(storageRef, documentUrl);
      const downloadURL = await getDownloadURL(storageRef);

      const verificationResult = await simulateDocumentVerification(downloadURL, licenseNumber.trim());

      if (verificationResult) {
        setIsDocumentVerified(true);
        setVerificationMessage("Document verified successfully!");
      } else {
        setIsDocumentVerified(false);
        setVerificationMessage("Verification failed. Please check your inputs.");
      }
    } catch (error) {
      console.error("Error during document verification:", error);
      setVerificationMessage("An error occurred during verification. Please try again.");
    } finally {
      setIsVerifying(false);
    }
  };

  const simulateDocumentVerification = async (documentUrl: string, license: string) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(license.startsWith("NMC-"));
      }, 2000);
    });
  };

  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } },
  };

  const buttonVariants = {
    hover: { scale: 1.05, boxShadow: "0 0 15px rgba(99, 102, 241, 0.5)" },
    tap: { scale: 0.95 },
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-gray-900 to-gray-800">
        <p className="text-white">Loading...</p>
      </div>
    );
  }

  return (
    <motion.div
      className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 px-4 py-8"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <form
        onSubmit={handleSubmit}
        className="space-y-6 max-w-2xl mx-auto bg-gray-800/50 backdrop-blur-md rounded-xl shadow-2xl border border-gray-700/50 p-6"
        noValidate
      >
        <motion.h2
          className="text-3xl font-semibold text-center mb-6 bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.6 }}
        >
          Doctor Profile Setup
        </motion.h2>

        {/* Document Verification */}
        <div className="bg-gray-900/50 backdrop-blur-md p-6 rounded-lg shadow-md border border-gray-700/50">
          <h3 className="text-xl font-semibold text-indigo-200 mb-4">Document Verification</h3>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-300 mb-1">Medical License Number</label>
            <input
              type="text"
              value={licenseNumber}
              onChange={(e) => setLicenseNumber(e.target.value)}
              placeholder="e.g., NMC-123456"
              className="w-full px-4 py-3 rounded-lg bg-gray-900/50 text-white border border-gray-700/50 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all placeholder-gray-500 hover:bg-gray-900/70"
              required
            />
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-300 mb-1">Upload Medical Certificate (PDF)</label>
            <input
              type="file"
              accept=".pdf"
              onChange={(e) => setDocumentUrl(e.target.files ? e.target.files[0] : null)}
              className="w-full px-4 py-3 rounded-lg bg-gray-900/50 text-gray-300 border border-gray-700/50 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:bg-indigo-600 file:text-white hover:file:bg-indigo-700 transition-all"
              required
            />
          </div>
          <motion.button
            type="button"
            onClick={verifyDocument}
            disabled={isVerifying || !documentUrl || !licenseNumber || !validateLicenseNumber(licenseNumber)}
            variants={buttonVariants}
            whileHover="hover"
            whileTap="tap"
            className={`w-full py-3 px-4 rounded-lg font-semibold text-white transition-all duration-300 ${
              isVerifying || !documentUrl || !licenseNumber || !validateLicenseNumber(licenseNumber)
                ? "bg-gray-600 cursor-not-allowed"
                : "bg-gradient-to-r from-green-600 to-green-500 hover:from-green-700 hover:to-green-600 shadow-lg"
            }`}
          >
            {isVerifying ? "Verifying..." : "Verify Document"}
          </motion.button>
          {verificationMessage && (
            <div
              className={`mt-4 p-4 rounded-lg text-sm ${
                isDocumentVerified
                  ? "bg-green-900/50 text-green-300 border border-green-700/50"
                  : "bg-red-900/50 text-red-300 border border-red-700/50"
              }`}
            >
              {verificationMessage}
            </div>
          )}
        </div>

        {/* Profile Picture */}
        <div className="flex items-center">
          <label className="block text-sm font-medium text-gray-300 mr-4">Profile Picture</label>
          <input
            type="file"
            onChange={(e) => setProfilePicture(e.target.files ? e.target.files[0] : null)}
            className="w-full px-4 py-3 rounded-lg bg-gray-900/50 text-gray-300 border border-gray-700/50 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:bg-indigo-600 file:text-white hover:file:bg-indigo-700 transition-all"
          />
        </div>

        {/* Form Fields */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full px-4 py-3 rounded-lg bg-gray-900/50 text-white border border-gray-700/50 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all placeholder-gray-500 hover:bg-gray-900/70"
            placeholder="Enter your name"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-4 py-3 rounded-lg bg-gray-900/50 text-white border border-gray-700/50 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all placeholder-gray-500 hover:bg-gray-900/70"
            placeholder="Enter your email"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Phone</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
            className="w-full px-4 py-3 rounded-lg bg-gray-900/50 text-white border border-gray-700/50 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all placeholder-gray-500 hover:bg-gray-900/70"
            placeholder="Enter your phone number"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Specialization</label>
          <input
            type="text"
            value={specialization}
            onChange={(e) => setSpecialization(e.target.value)}
            required
            className="w-full px-4 py-3 rounded-lg bg-gray-900/50 text-white border border-gray-700/50 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all placeholder-gray-500 hover:bg-gray-900/70"
            placeholder="Enter your specialization"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Experience (in years)</label>
          <input
            type="number"
            value={experience}
            onChange={(e) => setExperience(e.target.value)}
            required
            min="0"
            className="w-full px-4 py-3 rounded-lg bg-gray-900/50 text-white border border-gray-700/50 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all placeholder-gray-500 hover:bg-gray-900/70"
            placeholder="Enter years of experience"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Education</label>
          <input
            type="text"
            value={education}
            onChange={(e) => setEducation(e.target.value)}
            required
            className="w-full px-4 py-3 rounded-lg bg-gray-900/50 text-white border border-gray-700/50 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all placeholder-gray-500 hover:bg-gray-900/70"
            placeholder="Enter your education details"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Biography</label>
          <textarea
            value={biography}
            onChange={(e) => setBiography(e.target.value)}
            required
            className="w-full px-4 py-3 rounded-lg bg-gray-900/50 text-white border border-gray-700/50 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all placeholder-gray-500 hover:bg-gray-900/70 h-32 resize-none"
            placeholder="Write a brief description about yourself"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Languages</label>
          <div className="flex flex-wrap gap-4">
            {["English", "Hindi", "Nepali", "Other"].map((lang) => (
              <div key={lang} className="flex items-center">
                <input
                  type="checkbox"
                  id={`lang-${lang}`}
                  checked={languages.includes(lang)}
                  onChange={() => {
                    setLanguages((prev) =>
                      prev.includes(lang) ? prev.filter((l) => l !== lang) : [...prev, lang]
                    );
                  }}
                  className="mr-2 h-4 w-4 text-indigo-600 border-gray-700/50 rounded focus:ring-indigo-500"
                />
                <label htmlFor={`lang-${lang}`} className="text-gray-300">{lang}</label>
              </div>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Gender</label>
          <select
            value={gender}
            onChange={(e) => setGender(e.target.value)}
            required
            className="w-full px-4 py-3 rounded-lg bg-gray-900/50 text-white border border-gray-700/50 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all hover:bg-gray-900/70"
          >
            <option value="">Select Gender</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div className="mt-6">
          <h3 className="text-lg font-semibold text-indigo-200 mb-4">Available Days</h3>
          <div className="grid grid-cols-7 gap-2">
            {daysOfWeek.map((day) => (
              <motion.button
                key={day}
                type="button"
                onClick={(e) => handleDayChange(e, day)}
                variants={buttonVariants}
                whileHover="hover"
                whileTap="tap"
                className={`p-2 rounded-lg text-sm font-medium transition-all duration-300 ${
                  availableDays.includes(day)
                    ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg"
                    : "bg-gray-900/50 text-gray-300 hover:bg-gray-900/70 border border-gray-700/50"
                }`}
              >
                {day}
              </motion.button>
            ))}
          </div>
        </div>

        {availableDays.map((day) => (
          <div key={day} className="mt-6">
            <h4 className="text-md font-semibold text-indigo-200 mb-2">{day}</h4>
            <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
              {generateTimeSlots(day).map((timeSlot) => (
                <TimeSlotCard
                  key={timeSlot.id}
                  timeSlot={timeSlot}
                  isSelected={selectedTimeSlots.some(
                    (slot) => slot.day === timeSlot.day && slot.startTime === timeSlot.startTime
                  )}
                  onSelect={handleTimeSlotSelect}
                />
              ))}
            </div>
          </div>
        ))}

        <motion.button
          type="submit"
          disabled={!isDocumentVerified || loading}
          variants={buttonVariants}
          whileHover="hover"
          whileTap="tap"
          className={`w-full py-3 px-4 rounded-lg font-semibold text-white transition-all duration-300 ${
            loading || !isDocumentVerified
              ? "bg-gray-600 cursor-not-allowed"
              : "bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 shadow-lg"
          }`}
        >
          {loading ? "Submitting..." : "Submit for Approval"}
        </motion.button>

        {errorMessage && (
          <div className="text-red-300 text-center bg-red-900/50 p-4 rounded-lg border border-red-700/50">
            {errorMessage}
          </div>
        )}
      </form>
    </motion.div>
  );
}