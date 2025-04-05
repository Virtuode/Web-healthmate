"use client";

import { useEffect, useRef, useState } from "react";
import { ZegoUIKitPrebuilt } from "@zegocloud/zego-uikit-prebuilt";
import { auth } from "../../firebase";
import { motion } from "framer-motion";
import { MdClose, MdInfo } from "react-icons/md";

interface VideoCallProps {
  chatId: string;
  doctorId: string;
  patientId: string;
  doctorName: string;
  patientName: string;
  appointmentTime: string; // "yyyy-MM-dd HH:mm"
  endTime?: string; // "HH:mm"
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
  endTime,
  doctorProfilePicture,
  mediaStream,
  onClose,
}: VideoCallProps) {
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const [isCallActive, setIsCallActive] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const zpRef = useRef<InstanceType<typeof ZegoUIKitPrebuilt> | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<string>("");
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 2;

  const appID = Number(process.env.NEXT_PUBLIC_ZEGO_APP_ID) || 1422156538;
  const serverSecret = process.env.NEXT_PUBLIC_ZEGO_SERVER_SECRET || "d662c8f8e2353c62c1f75a60515808f6";

  // Define cleanup functions at component scope
  const cleanup = () => {
    if (zpRef.current) {
      zpRef.current.hangUp();
      zpRef.current.destroy();
      zpRef.current = null;
    }
    if (mediaStream) {
      mediaStream.getTracks().forEach(track => {
        track.stop();
        track.enabled = false; // Ensure audio is muted
      });
    }
  };

  const cleanupAndClose = () => {
    cleanup();
    onClose();
  };

  // Suppress createSpan error
  useEffect(() => {
    const originalConsoleError = console.error;
    console.error = (...args) => {
      if (args[0]?.includes?.("createSpan")) {
        console.warn("Suppressed ZegoCloud createSpan error:", ...args);
        setErrorMessage("Video call failed due to an internal error. Retrying...");
        setIsCallActive(false);
        if (retryCount < maxRetries) {
          setRetryCount(prev => prev + 1);
        } else {
          setErrorMessage("Failed to start video call after retries. Please try again later.");
          setTimeout(() => cleanupAndClose(), 3000); // Now accessible
        }
        return;
      }
      originalConsoleError(...args);
    };
    return () => {
      console.error = originalConsoleError;
    };
  }, [retryCount]);

  // Main initialization effect
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;

    if (appointmentTime) {
      const startTime = new Date(appointmentTime).getTime();
      const datePart = appointmentTime.split(" ")[0];
      const endTimeFull = endTime
        ? `${datePart}T${endTime}:00`
        : new Date(startTime + 30 * 60 * 1000).toISOString();
      const endTimeMs = new Date(endTimeFull).getTime();
      const currentTime = Date.now();

      if (currentTime < startTime || currentTime > endTimeMs) {
        setErrorMessage("Video call is only available during the appointment time.");
        setTimeout(() => cleanupAndClose(), 3000);
        return;
      }

      timer = setInterval(() => {
        const now = Date.now();
        const timeLeft = endTimeMs - now;

        if (timeLeft <= 0) {
          clearInterval(timer!);
          setErrorMessage("Appointment time has ended. The call will now close.");
          setTimeout(() => {
            setIsCallActive(false);
            cleanupAndClose(); // Ensure full cleanup on timeout
          }, 3000);
        } else {
          const minutes = Math.floor(timeLeft / (1000 * 60));
          const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);
          setTimeRemaining(`${minutes}m ${seconds}s`);
        }
      }, 1000);
    }

    const initializeVideoCall = async () => {
      if (!videoContainerRef.current) {
        console.error("Video container ref is null at initialization");
        setErrorMessage("Video call container is not available.");
        return;
      }
      const container = videoContainerRef.current;

      if (!auth.currentUser) {
        setErrorMessage("User authentication is required.");
        return;
      }
      if (!mediaStream) {
        setErrorMessage("Camera and microphone permissions are required.");
        return;
      }
      console.log("Initializing with media stream:", mediaStream.getTracks());

      const userID = doctorId;
      const userName = doctorName;

      const kitToken = ZegoUIKitPrebuilt.generateKitTokenForTest(
        appID,
        serverSecret,
        chatId,
        userID,
        userName
      );

      const zp = ZegoUIKitPrebuilt.create(kitToken);
      zpRef.current = zp;

      const joinRoomWithRetry = async (attempts = 3, delayMs = 500) => {
        for (let i = 0; i < attempts; i++) {
          try {
            await new Promise(resolve => setTimeout(resolve, delayMs * (i + 1)));
            zp.joinRoom({
              container: container,
              scenario: { mode: ZegoUIKitPrebuilt.OneONoneCall },
              sharedLinks: [
                {
                  name: "Personal link",
                  url: `${window.location.origin}/video-call?roomID=${chatId}`,
                },
              ],
              onLeaveRoom: () => {
                setIsCallActive(false);
                cleanupAndClose(); // Ensure cleanup on leave
              },
              onUserAvatarSetter: (users) => {
                users.forEach((user) => {
                  user.setUserAvatar?.(doctorProfilePicture || "https://via.placeholder.com/150");
                });
              },
            });
            setIsCallActive(true);
            return;
          } catch (error: any) {
            console.warn(`Join room attempt ${i + 1} failed:`, error);
            if (i === attempts - 1) {
              throw error;
            }
          }
        }
      };

      try {
        await joinRoomWithRetry();
      } catch (error) {
        console.warn("Failed to initialize ZegoCloud video call:", error);
        setErrorMessage("Failed to start the video call. Please try again.");
      }
    };

    initializeVideoCall();

    // Cleanup function now only needs to clear the timer since cleanup is hoisted
    return () => {
      if (timer) clearInterval(timer);
      cleanup(); // Call cleanup on unmount
    };
  }, [chatId, doctorId, doctorName, patientId, mediaStream, doctorProfilePicture, appointmentTime, endTime, retryCount]);

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
              onClick={onClose} // Changed to onClose directly since cleanup is handled elsewhere
              className="mt-6 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              Close
            </motion.button>
          </div>
        ) : (
          <>
            <div ref={videoContainerRef} className="w-full h-full" />
            <div className="absolute top-4 left-4 text-white bg-gray-800/80 backdrop-blur-md px-4 py-2 rounded-lg">
              <p className="text-sm">
                Call with {patientName} | {appointmentTime}
              </p>
              {timeRemaining && (
                <p className="text-xs text-yellow-300">Time remaining: {timeRemaining}</p>
              )}
            </div>
            <motion.button
              onClick={cleanupAndClose} // Use cleanupAndClose here for manual close
              className="absolute top-4 right-4 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <MdClose />
            </motion.button>
          </>
        )}
      </div>
    </motion.div>
  );
}