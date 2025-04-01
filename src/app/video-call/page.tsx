// app/video-call/page.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ZegoUIKitPrebuilt } from "@zegocloud/zego-uikit-prebuilt";
import { auth } from "../../firebase";
import { getDatabase, ref, onValue } from "firebase/database";
import { motion } from "framer-motion";

export default function VideoCallPage() {
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const [isCallActive, setIsCallActive] = useState(false);
  const [patientData, setPatientData] = useState<any>(null);
  const [appointmentTime, setAppointmentTime] = useState<string | null>(null);
  const [appointmentDate, setAppointmentDate] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const router = useRouter();

  const roomID = searchParams.get("roomID");

  // ZegoCloud credentials (same as in VideoCallComponent)
  const appID = 1422156538; // Replace with your ZegoCloud appID
  const serverSecret = "d662c8f8e2353c62c1f75a60515808f6"; // Replace with your ZegoCloud serverSecret

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (!user || !roomID) {
        router.push("/login");
        return;
      }

      const db = getDatabase();
      const patientRef = ref(db, `patients/${user.uid}`);
      onValue(patientRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
          setPatientData({
            id: user.uid,
            name: `${data.survey?.basicInfo?.firstName || ""} ${
              data.survey?.basicInfo?.middleName || ""
            } ${data.survey?.basicInfo?.lastName || ""}`.trim(),
          });
        }
      });

      const initializeVideoCall = async () => {
        if (!videoContainerRef.current || !patientData) return;

        const userID = patientData.id;
        const userName = patientData.name;

        // Generate ZegoCloud Kit Token
        const kitToken = ZegoUIKitPrebuilt.generateKitTokenForTest(
          appID,
          serverSecret,
          roomID,
          userID,
          userName
        );

        // Initialize ZegoUIKitPrebuilt
        const zp = ZegoUIKitPrebuilt.create(kitToken);

        // Join the call
        zp.joinRoom({
          container: videoContainerRef.current,
          scenario: {
            mode: ZegoUIKitPrebuilt.OneONoneCall,
          },
          onLeaveRoom: () => {
            setIsCallActive(false);
            router.push("/"); // Redirect to patient dashboard or home
          },
        });

        setIsCallActive(true);
      };
      

      if (patientData) {
        initializeVideoCall();
      }

      return () => {
        unsubscribe();
      };
    });
  }, [roomID, router, patientData]);

  return (
    <motion.div
      className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 flex items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.8 }}
    >
      <div
        ref={videoContainerRef}
        className="w-full h-full max-w-5xl max-h-[80vh] rounded-xl overflow-hidden shadow-2xl border border-gray-700/50"
      />
      {!isCallActive && (
        <motion.button
          onClick={() => router.push("/")}
          className="absolute top-4 right-4 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          Close
        </motion.button>
      )}
    </motion.div>
  );
}