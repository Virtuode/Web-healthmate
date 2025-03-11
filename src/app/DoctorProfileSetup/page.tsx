"use client";

import { useState, useEffect } from "react";
import { storage, auth } from "@/firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { getDatabase, ref as dbRef, set, runTransaction } from "firebase/database";
import { useRouter } from "next/navigation";
import { AES, enc, SHA256 } from "crypto-js";
import TimeSlotCard from "@/components/TimeSlotCard";
import { TimeSlot } from "@/models/TimeSlot";

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

  const daysOfWeek = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const router = useRouter();

  const secretSalt = process.env.NEXT_PUBLIC_ENCRYPTION_SALT || "default-salt";

  const getEncryptionKey = (uid: string) => SHA256(uid + secretSalt).toString();

  const encryptField = (text: string, key: string) => AES.encrypt(text, key).toString();

  const validateLicenseNumber = (license: string) => /^NMC-\d{6,}$/.test(license);

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
    setLoading(true);
    setErrorMessage("");

    try {
      const user = auth.currentUser;
      if (!user) throw new Error("No authenticated user found");
      const encryptionKey = getEncryptionKey(user.uid);

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
        phone: encryptField(phone, encryptionKey),
        specialization,
        education,
        experience: parseInt(experience) || 0,
        gender,
        biography: encryptField(biography, encryptionKey),
        documentUrl: documentDownloadUrl,
        licenseNumber,
        availableDays,
        selectedTimeSlots: formattedTimeSlots,
        isVerified: false, // Initially false until admin approves
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
      router.push("/doctor-waiting"); // Redirect to waiting screen
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

  return (
    <div className="container mx-auto px-4 py-8 animate-fade-in bg-gradient-to-r from-blue-100 to-blue-200 min-h-screen">
      <form
        onSubmit={handleSubmit}
        className="space-y-6 max-w-2xl mx-auto bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6"
        noValidate
      >
        <h2 className="text-2xl font-bold text-center mb-4">Doctor Profile Setup</h2>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md mb-6">
          <h2 className="text-xl font-semibold mb-4">Document Verification</h2>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Medical License Number
            </label>
            <input
              type="text"
              value={licenseNumber}
              onChange={(e) => setLicenseNumber(e.target.value)}
              placeholder="e.g., NMC-123456"
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Upload Medical Certificate (PDF)
            </label>
            <input
              type="file"
              accept=".pdf"
              onChange={(e) => setDocumentUrl(e.target.files ? e.target.files[0] : null)}
              className="w-full px-4 py-2 border rounded-lg"
              required
            />
          </div>
          <button
            type="button"
            onClick={verifyDocument}
            disabled={isVerifying || !documentUrl || !licenseNumber || !validateLicenseNumber(licenseNumber)}
            className={`w-full py-2 px-4 rounded-lg transition-colors ${
              isVerifying || !documentUrl || !licenseNumber || !validateLicenseNumber(licenseNumber)
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-green-500 hover:bg-green-600 text-white"
            }`}
          >
            {isVerifying ? "Verifying..." : "Verify Document"}
          </button>
          {verificationMessage && (
            <div
              className={`mt-4 p-4 rounded-lg ${
                isDocumentVerified
                  ? "bg-green-100 text-green-700 border border-green-400"
                  : "bg-red-100 text-red-700 border border-red-400"
              }`}
            >
              {verificationMessage}
            </div>
          )}
        </div>

        <div className="flex items-center mb-4">
          <label className="block text-sm font-medium text-gray-700 mr-4">Profile Picture</label>
          <input
            type="file"
            onChange={(e) => setProfilePicture(e.target.files ? e.target.files[0] : null)}
            className="border rounded-lg p-2 transition duration-300 ease-in-out hover:shadow-lg"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-800 dark:text-gray-200 mb-1">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-200"
            placeholder="Enter your name"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-800 dark:text-gray-200 mb-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-200"
            placeholder="Enter your email"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-800 dark:text-gray-200 mb-1">Phone</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-200"
            placeholder="Enter your phone number"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-800 dark:text-gray-200 mb-1">Specialization</label>
          <input
            type="text"
            value={specialization}
            onChange={(e) => setSpecialization(e.target.value)}
            required
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-200"
            placeholder="Enter your specialization"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-800 dark:text-gray-200 mb-1">Experience (in years)</label>
          <input
            type="number"
            value={experience}
            onChange={(e) => setExperience(e.target.value)}
            required
            min="0"
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-200"
            placeholder="Enter years of experience"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-800 dark:text-gray-200 mb-1">Education</label>
          <input
            type="text"
            value={education}
            onChange={(e) => setEducation(e.target.value)}
            required
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-200"
            placeholder="Enter your education details"
          />
        </div>

        <div className="mt-6">
          <h3 className="text-lg font-semibold mb-4">Biography</h3>
          <textarea
            value={biography}
            onChange={(e) => setBiography(e.target.value)}
            required
            className="w-full px-4 py-2 border rounded-lg h-32 resize-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-200"
            placeholder="Write a brief description about yourself"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-800 dark:text-gray-200 mb-1">Languages</label>
          <div className="flex flex-wrap gap-2">
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
                  className="mr-2"
                />
                <label htmlFor={`lang-${lang}`} className="text-gray-800 dark:text-gray-200">{lang}</label>
              </div>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-800 dark:text-gray-200 mb-1">Gender</label>
          <select
            value={gender}
            onChange={(e) => setGender(e.target.value)}
            required
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-200"
          >
            <option value="">Select Gender</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div className="mt-6">
          <h3 className="text-lg font-semibold mb-4">Available Days</h3>
          <div className="grid grid-cols-7 gap-2">
            {daysOfWeek.map((day) => (
              <button
                type="button"
                key={day}
                onClick={(e) => handleDayChange(e, day)}
                className={`p-2 rounded ${
                  availableDays.includes(day) ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {day}
              </button>
            ))}
          </div>
        </div>

        {availableDays.map((day) => (
          <div key={day} className="mt-6">
            <h4 className="text-md font-semibold mb-2">{day}</h4>
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

        <button
          type="submit"
          disabled={!isDocumentVerified || loading}
          className={`w-full py-2 px-4 rounded-lg transition-colors duration-300 ease-in-out ${
            loading || !isDocumentVerified
              ? "bg-gray-400 cursor-not-allowed text-gray-200"
              : "bg-blue-500 hover:bg-blue-600 text-white shadow-lg"
          }`}
        >
          {loading ? "Submitting..." : "Submit for Approval"}
        </button>

        {errorMessage && <div className="text-red-500 text-center">{errorMessage}</div>}
      </form>
    </div>
  );
}