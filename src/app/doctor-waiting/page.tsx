"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/firebase";
import { getDatabase, ref, onValue } from "firebase/database";

export default function DoctorWaiting() {
  const router = useRouter();

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) {
      router.push("/signup-login");
      return;
    }

    const db = getDatabase();
    const doctorRef = ref(db, `doctors/${user.uid}`);

    const unsubscribe = onValue(doctorRef, (snapshot) => {
      const doctorData = snapshot.val();
      if (!doctorData) {
        // If data is removed (rejected), sign out and redirect to signup
        auth.signOut();
        router.push("/signup-login");
      } else if (doctorData.verificationStatus === "approved") {
        router.push("/dashboard");
      } else if (doctorData.verificationStatus === "rejected") {
        auth.signOut();
        router.push("/signup-login");
      }
    });

    return () => unsubscribe();
  }, [router]);

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
        <h1 className="text-2xl font-bold text-gray-800 mb-4">Awaiting Approval</h1>
        <p className="text-gray-600 mb-6">
          Your profile has been submitted for verification. Please wait for admin approval. You will be redirected to your dashboard once approved.
        </p>
        <div className="flex justify-center">
          <svg
            className="animate-spin h-8 w-8 text-blue-500"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        </div>
      </div>
    </div>
  );
}