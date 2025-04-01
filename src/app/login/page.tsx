"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth } from "../../firebase";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
import { getDatabase, ref, get } from "firebase/database";
import { motion } from "framer-motion";
import Image from 'next/image';

export default function Page() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  // Minimal useEffect: only check if user is authenticated to reset form
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        // Reset form if user is already logged in (optional)
        setEmail("");
        setPassword("");
        setConfirmPassword("");
      }
    });
    return () => unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); // Clear previous errors

    if (!email || !password) {
      setError("Email and password are required.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }
    if (!isLogin && password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      if (isLogin) {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        const db = getDatabase();
        const doctorRef = ref(db, `doctors/${user.uid}`);
        const doctorSnapshot = await get(doctorRef);

        if (doctorSnapshot.exists()) {
          const doctorData = doctorSnapshot.val();
          if (doctorData.verificationStatus === "pending") {
            router.push("/doctor-waiting");
          } else if (doctorData.verificationStatus === "approved") {
            router.push("/dashboard");
          } else {
            setError("Your profile has been rejected. Please sign up again or contact support.");
          }
        } else {
          setError("No doctor profile found. Please sign up as a doctor first.");
        }
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
        router.push("/DoctorProfileSetup");
      }
    } catch (error) {
      setError(String(error));
    } finally {
      setLoading(false);
    }
  };

  const handleAdminRedirect = () => {
    router.push("/AdminPage/admin-signup-login");
  };

  const containerVariants = {
    hidden: { opacity: 0, scale: 0.95 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: { duration: 0.8, ease: "easeOut" },
    },
  };

  return (
    <motion.div
      className="min-h-screen w-full bg-gradient-to-tr from-gray-900 via-indigo-900 to-purple-900 flex items-center justify-center p-8 relative overflow-hidden"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Background Effects */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(99,_102,_241,_0.2)_0%,_rgba(0,_0,_0,_0.8)_100%)] pointer-events-none" />
      <div className="absolute top-0 left-0 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl animate-pulse delay-1000" />

      <div className="max-w-6xl w-full grid md:grid-cols-2 gap-8 items-center bg-gray-800/40 backdrop-blur-xl shadow-2xl rounded-3xl border border-gray-700/50 overflow-hidden">
        {/* Left Section - Welcome */}
        <div className="p-10 flex flex-col justify-center text-white relative">
          <motion.div
            className="mb-8"
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.6 }}
          >
            <img
              src="/logo-dark.png"
              alt="Platform Logo"
              className="h-28 w-auto object-contain filter drop-shadow-lg"
            />
          </motion.div>
          <motion.h1
            className="text-5xl font-extrabold tracking-tight mb-4 bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.8 }}
          >
            Welcome to Our Platform
          </motion.h1>
          <motion.h2
            className="text-2xl font-bold mb-3 text-indigo-200"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.8 }}
          >
            {isLogin ? "Access Granted" : "Initiate Your Journey"}
          </motion.h2>
          <motion.p
            className="text-gray-300 opacity-80"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.8 }}
          >
            {isLogin
              ? "Enter your credentials to unlock your dashboard."
              : "Join the network and experience the future."}
          </motion.p>
        </div>

        {/* Right Section - Form */}
        <div className="p-10 bg-gray-900/60 backdrop-blur-md rounded-r-3xl">
          {/* Tabs */}
          <div className="flex justify-center mb-8 bg-gray-800/50 rounded-full p-1 border border-gray-700/50">
            <motion.button
              onClick={() => setIsLogin(true)}
              className={`flex-1 py-2 px-6 text-sm font-medium rounded-full transition-all duration-300 ${
                isLogin
                  ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg"
                  : "text-gray-400 hover:bg-gray-700/50"
              }`}
              whileHover={{ scale: 1.05, boxShadow: "0 0 15px rgba(99, 102, 241, 0.5)" }}
            >
              Login
            </motion.button>
            <motion.button
              onClick={() => setIsLogin(false)}
              className={`flex-1 py-2 px-6 text-sm font-medium rounded-full transition-all duration-300 ${
                !isLogin
                  ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg"
                  : "text-gray-400 hover:bg-gray-700/50"
              }`}
              whileHover={{ scale: 1.05, boxShadow: "0 0 15px rgba(99, 102, 241, 0.5)" }}
            >
              Signup
            </motion.button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Email Input */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Email Address
              </label>
              <input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-lg bg-gray-800/50 text-white border border-gray-700/50 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all placeholder-gray-500 hover:bg-gray-700/70"
              />
            </div>

            {/* Password Input */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-4 py-3 rounded-lg bg-gray-800/50 text-white border border-gray-700/50 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all placeholder-gray-500 hover:bg-gray-700/70"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-4 text-gray-400 hover:text-indigo-400 transition-colors"
                >
                  {showPassword ? (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                      />
                    </svg>
                  ) : (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                      />
                    </svg>
                  )}
                </button>
              </div>
              {password.length > 0 && (
                <div className="mt-1 text-sm text-gray-400">
                  Password length: {password.length} characters{' '}
                  {password.length < 6 && (
                    <span className="text-red-400">(minimum 6 required)</span>
                  )}
                </div>
              )}
            </div>

            {/* Confirm Password Input (Signup Only) */}
            {!isLogin && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Confirm Password
                </label>
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Confirm your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="w-full px-4 py-3 rounded-lg bg-gray-800/50 text-white border border-gray-700/50 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all placeholder-gray-500 hover:bg-gray-700/70"
                />
                {confirmPassword.length > 0 && password !== confirmPassword && (
                  <div className="mt-1 text-sm text-red-400">
                    Passwords do not match
                  </div>
                )}
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="text-red-400 text-sm text-center bg-red-900/20 p-3 rounded-lg border border-red-700/50">
                {error}
              </div>
            )}

            {/* Submit Button */}
            <motion.button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold shadow-lg hover:from-indigo-700 hover:to-purple-700 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-900 transition-all duration-300 disabled:bg-gray-600 disabled:cursor-not-allowed"
              whileHover={{ scale: 1.05, boxShadow: "0 0 20px rgba(99, 102, 241, 0.7)" }}
              whileTap={{ scale: 0.95 }}
            >
              {loading ? "Processing..." : isLogin ? "Login" : "Activate Account"}
            </motion.button>
          </form>

          {/* Admin Portal Button */}
          <motion.div
            className="mt-6 text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
          >
            <motion.button
              onClick={handleAdminRedirect}
              variants={{
                hover: {
                  scale: 1.05,
                  boxShadow: "0px 0px 8px rgb(255,255,255)",
                  transition: { duration: 0.3, yoyo: Infinity },
                },
                tap: { scale: 0.95 },
              }}
              whileHover="hover"
              whileTap="tap"
              className="group relative inline-flex items-center justify-center px-6 py-3 overflow-hidden font-medium text-white transition duration-300 ease-out bg-gradient-to-r from-purple-600 to-indigo-600 rounded-lg shadow-lg"
            >
              <span className="absolute inset-0 w-full h-full bg-gradient-to-br from-purple-600 via-indigo-600 to-blue-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300 ease-out"></span>
              <span className="relative flex items-center gap-2">
                Admin Portal
                <svg
                  className="w-5 h-5 transform group-hover:translate-x-1 transition-transform duration-300"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </span>
            </motion.button>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}