"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/firebase";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
import { motion } from "framer-motion";

export default function AdminSignupLogin() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [adminRole, setAdminRole] = useState("administrator");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [darkMode, setDarkMode] = useState(false); // Kept but unused for now
  const [twoFactorCode, setTwoFactorCode] = useState(""); // Kept but unused for now
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        console.log("User authenticated, redirecting to /admin/dashboard");
        router.push("/admin/dashboard");
      }
    });
    return () => unsubscribe();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!email || !password) {
        throw new Error("Email and password are required");
      }
      if (!email.includes("@") || !email.includes(".")) {
        throw new Error("Please enter a valid email address");
      }
      if (password.length < 8) {
        throw new Error("Password must be at least 8 characters long");
      }

      if (!isLogin) {
        if (password !== confirmPassword) {
          throw new Error("Passwords don't match");
        }
        await createUserWithEmailAndPassword(auth, email, password);
        console.log("Signup successful, redirecting to /admin/dashboard");
        alert("Admin account created successfully!");
        router.push("/admin/dashboard");
      } else {
        await signInWithEmailAndPassword(auth, email, password);
        console.log("Login successful, redirecting to /admin/dashboard");
        alert("Admin login successful!");
        router.push("/admin/dashboard");
      }
    } catch (error) {
      alert(String(error));
    } finally {
      setLoading(false);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0, scale: 0.95 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: { duration: 0.8, ease: "easeOut" },
    },
  };

  const buttonVariants = {
    hover: { scale: 1.05, boxShadow: "0 0 15px rgba(99, 102, 241, 0.5)" },
    tap: { scale: 0.95 },
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

      <div className="max-w-lg w-full bg-gray-800/40 backdrop-blur-xl shadow-2xl rounded-3xl border border-gray-700/50 p-8">
        {/* Header */}
        <motion.h1
          className="text-3xl font-extrabold text-center mb-6 bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.6 }}
        >
          Admin {isLogin ? "Access" : "Initiation"}
        </motion.h1>

        {/* Tabs */}
        <div className="flex justify-center mb-8 bg-gray-800/50 rounded-full p-1 border border-gray-700/50">
          <motion.button
            onClick={() => setIsLogin(true)}
            className={`flex-1 py-2 px-6 text-sm font-medium rounded-full transition-all duration-300 ${
              isLogin
                ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg"
                : "text-gray-400 hover:bg-gray-700/50"
            }`}
            variants={buttonVariants}
            whileHover="hover"
            whileTap="tap"
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
            variants={buttonVariants}
            whileHover="hover"
            whileTap="tap"
          >
            Signup
          </motion.button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Email Input */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Admin Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@domain.com"
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
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
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
            <p className="text-xs text-gray-400 mt-1">Minimum 8 characters</p>
          </div>

          {/* Confirm Password (Signup Only) */}
          {!isLogin && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Confirm Password
              </label>
              <input
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full px-4 py-3 rounded-lg bg-gray-800/50 text-white border border-gray-700/50 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all placeholder-gray-500 hover:bg-gray-700/70"
              />
            </div>
          )}

          {/* Admin Role (Signup Only) */}
          {!isLogin && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Admin Role
              </label>
              <select
                value={adminRole}
                onChange={(e) => setAdminRole(e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-gray-800/50 text-white border border-gray-700/50 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all hover:bg-gray-700/70"
              >
                <option value="administrator">Administrator</option>
                <option value="moderator">Moderator</option>
                <option value="analyst">Analyst</option>
              </select>
            </div>
          )}

          {/* Submit Button */}
          <motion.button
            type="submit"
            disabled={loading}
            variants={buttonVariants}
            whileHover="hover"
            whileTap="tap"
            className={`w-full py-3 px-4 rounded-lg font-medium text-white transition-all duration-300 ${
              loading
                ? "bg-gray-600 cursor-not-allowed"
                : "bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 shadow-lg"
            }`}
          >
            {loading ? (
              <div className="flex items-center justify-center">
                <svg
                  className="animate-spin h-5 w-5 mr-2"
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
                Processing...
              </div>
            ) : isLogin ? (
              "Grant Access"
            ) : (
              "Deploy Admin"
            )}
          </motion.button>
        </form>

        {/* Footer Links */}
        <div className="mt-6 text-center space-y-2">
          <button
            onClick={() => router.push("/forgot-password")}
            className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            Forgot Password?
          </button>
          <p className="text-sm text-gray-400">
            <button
              onClick={() => router.push("/")}
              className="text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              Return to User Login
            </button>
          </p>
        </div>
      </div>
    </motion.div>
  );
}