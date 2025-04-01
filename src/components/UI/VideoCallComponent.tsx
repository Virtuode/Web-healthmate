// components/UI/VideoCallComponent.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { ZegoUIKitPrebuilt } from "@zegocloud/zego-uikit-prebuilt";
import { auth } from "../../firebase"; // Adjust the path based on your firebase setup
import { motion } from "framer-motion";
import { MdClose, MdInfo } from "react-icons/md";

interface VideoCallProps {
  chatId: string;
  doctorId: string;
  patientId: string;
  doctorName: string;
  patientName: string;
  appointmentTime: string;
  appointmentDate?: string;
  doctorProfilePicture?: string;
  mediaStream?: MediaStream | null;
  onClose: () => void;
}

export default function VideoCallComponent({
  chatId,
  doctorId,
  patientId,
  doctorName,
  patientName,
  appointmentTime,
  appointmentDate,
  doctorProfilePicture,
  mediaStream,
  onClose,
}: VideoCallProps) {
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const [isCallActive, setIsCallActive] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const zpRef = useRef<ZegoUIKitPrebuilt | null>(null); // Store Zego instance for cleanup
  const [timeRemaining, setTimeRemaining] = useState<string>(""); // Display remaining time

  // ZegoCloud credentials (replace with your actual credentials)
  const appID = 1422156538; // Replace with your ZegoCloud appID
  const serverSecret = "d662c8f8e2353c62c1f75a60515808f6"; // Replace with your ZegoCloud serverSecret

  useEffect(() => {
    // Calculate the appointment end time
    let endTime: number | null = null;
    let timer: NodeJS.Timeout | null = null;

    if (appointmentDate && appointmentTime) {
      const [hours, minutes] = appointmentTime.split(":").map(Number);
      const appointmentDateTime = new Date(`${appointmentDate}T${appointmentTime}:00`);
      appointmentDateTime.setHours(hours, minutes, 0, 0);

      // Assuming the appointment duration is 30 minutes
      const appointmentDuration = 30 * 60 * 1000; // 30 minutes in milliseconds
      endTime = appointmentDateTime.getTime() + appointmentDuration;

      // Update remaining time every second
      timer = setInterval(() => {
        const now = Date.now();
        const timeLeft = endTime! - now;

        if (timeLeft <= 0) {
          // End the call when time is up
          clearInterval(timer!);
          setErrorMessage("Appointment time has ended. The call will now close.");
          setTimeout(() => {
            if (zpRef.current) {
              zpRef.current.hangUp(); // End the call using ZegoCloud's hangUp method
            }
            setIsCallActive(false);
            onClose();
          }, 3000); // Show the message for 3 seconds before closing
        } else {
          // Update remaining time display
          const minutes = Math.floor(timeLeft / (1000 * 60));
          const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);
          setTimeRemaining(`${minutes}m ${seconds}s`);
        }
      }, 1000);
    }

    const initializeVideoCall = async () => {
      if (!videoContainerRef.current || !auth.currentUser) {
        setErrorMessage("Unable to initialize video call: Missing container or user authentication.");
        return;
      }

      // Check if media permissions were granted
      if (!mediaStream) {
        setErrorMessage("Camera and microphone permissions are required to start the video call.");
        return;
      }

      try {
        const userID = doctorId; // Doctor's Firebase UID
        const userName = doctorName;

        // Generate ZegoCloud Kit Token
        const kitToken = ZegoUIKitPrebuilt.generateKitTokenForTest(
          appID,
          serverSecret,
          chatId, // Use chatId as the room ID
          userID,
          userName
        );

        // Initialize ZegoUIKitPrebuilt
        const zp = ZegoUIKitPrebuilt.create(kitToken);
        zpRef.current = zp; // Store the instance for cleanup

        // Start the call
        zp.joinRoom({
          container: videoContainerRef.current,
          scenario: {
            mode: ZegoUIKitPrebuilt.OneONoneCall, // One-to-one video call
          },
          sharedLinks: [
            {
              name: "Personal link",
              url: `${window.location.origin}/video-call?roomID=${chatId}`,
            },
          ],
          onLeaveRoom: () => {
            setIsCallActive(false);
            onClose();
          },
          onUserAvatarSetter: (users) => {
            users.forEach((user) => {
              user.setUserAvatar?.(doctorProfilePicture || "https://your-default-avatar-url.com");
            });
          },
        });

        setIsCallActive(true);

        // Notify the patient (you can trigger a Firebase function here)
        console.log(`Patient can join the call at: ${window.location.origin}/video-call?roomID=${chatId}`);
      } catch (error) {
        console.error("Failed to initialize ZegoCloud video call:", error);
        setErrorMessage("Failed to start the video call. Please try again.");
      }
    };

    initializeVideoCall();

    return () => {
      // Cleanup ZegoCloud instance
      if (zpRef.current) {
        zpRef.current.destroy();
        zpRef.current = null;
      }
      // Cleanup timer
      if (timer) {
        clearInterval(timer);
      }
    };
  }, [chatId, doctorId, doctorName, patientId, onClose, mediaStream, doctorProfilePicture, appointmentDate, appointmentTime]);

  return (
    <motion.div
      className="fixed inset-0 z-[1000] bg-gray-900/90 backdrop-blur-md flex items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="relative w-full h-full max-w-5xl max-h-[80vh] rounded-xl overflow-hidden shadow-2xl border border-gray-700/50">
        {errorMessage ? (
          <div className="flex flex-col items-center justify-center h-full bg-gray-800 text-white">
            <MdInfo className="text-4xl text-red-400 mb-4" />
            <p className="text-lg">{errorMessage}</p>
            <motion.button
              onClick={onClose}
              className="mt-6 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              Close
            </motion.button>
          </div>
        ) : (
          <>
            <div
              ref={videoContainerRef}
              className="w-full h-full"
            />
            <div className="absolute top-4 left-4 text-white bg-gray-800/80 backdrop-blur-md px-4 py-2 rounded-lg">
              <p className="text-sm">
                Call with {patientName} | {appointmentDate} at {appointmentTime}
              </p>
              {timeRemaining && (
                <p className="text-xs text-yellow-300">Time remaining: {timeRemaining}</p>
              )}
            </div>
            {!isCallActive && (
              <motion.button
                onClick={onClose}
                className="absolute top-4 right-4 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <MdClose />
              </motion.button>
            )}
          </>
        )}
      </div>
    </motion.div>
  );
}