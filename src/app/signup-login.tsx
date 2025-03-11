"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth } from "../firebase";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
import { getDatabase, ref, get } from "firebase/database";
import { motion } from "framer-motion";

export default function SignupLogin() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        const db = getDatabase();
        const doctorRef = ref(db, `doctors/${user.uid}`);
        get(doctorRef).then((snapshot) => {
          if (snapshot.exists()) {
            const doctorData = snapshot.val();
            if (doctorData.verificationStatus === "pending") {
              router.push("/doctor-waiting");
            } else if (doctorData.verificationStatus === "approved") {
              router.push("/dashboard");
            } else {
              router.push("/DoctorProfileSetup");
            }
          } else {
            router.push("/DoctorProfileSetup");
          }
        });
      }
    });
    return () => unsubscribe();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      alert("Email and password are required.");
      return;
    }
    if (password.length < 6) {
      alert("Password must be at least 6 characters long.");
      return;
    }
    if (!isLogin && password !== confirmPassword) {
      alert("Passwords do not match.");
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
            alert("Login successful!");
            router.push("/dashboard");
          } else {
            alert("Your profile has been rejected. Please sign up again.");
            await auth.signOut();
          }
        } else {
          await auth.signOut();
          alert("No doctor profile found. Please sign up as a doctor first.");
        }
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
        alert("Signup successful!");
        router.push("/DoctorProfileSetup");
      }
    } catch (error) {
      alert(String(error));
    } finally {
      setLoading(false);
    }
  };

  const handleAdminRedirect = () => {
    router.push("/AdminPage/admin-signup-login");
  };

  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5, ease: "easeOut" },
    },
  };

  // Define consistent input styles
  const inputStyles = {
    backgroundColor: "#374151", // gray-700
    color: "#ffffff", // White text
  };

  return (
    <motion.div
      className="min-h-screen w-full"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <div className="container mx-auto">
        <div className="relative mb-8">
          <div className="flex flex-col items-start">
            <div className="mb-4" style={{ height: "200px" }}>
              <img
                src="/logo-dark.png"
                alt="Platform Logo"
                style={{ height: "100%", width: "auto", objectFit: "contain" }}
              />
            </div>
            <h1
              className="text-3xl font-bold"
              style={{ color: "var(--text-color)" }}
            >
              Welcome to Our Platform
            </h1>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-8 items-center -mt-40">
          <div className="hidden md:block">
            <h2
              className="text-2xl font-semibold mb-4"
              style={{ color: "var(--text-color)" }}
            >
              {isLogin ? "Welcome Back!" : "Join Our Community"}
            </h2>
            <p className="mb-4" style={{ color: "var(--text-color)" }}>
              {isLogin
                ? "Log in to access your account and continue your journey with us."
                : "Create an account to get started and explore all our features."}
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 shadow-xl rounded-xl p-8">
            <div className="mb-6">
              <div className="flex justify-center border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
                <motion.button
                  onClick={() => setIsLogin(true)}
                  className={`relative flex-1 py-3 px-6 text-sm font-semibold transition-all duration-300 ${
                    isLogin
                      ? "text-white bg-gradient-to-r from-blue-500 to-indigo-600 shadow-md"
                      : "text-gray-600 dark:text-gray-300 hover:text-white hover:bg-gradient-to-r hover:from-blue-500/10 hover:to-indigo-600/10"
                  } rounded-t-lg`}
                  whileHover={{ scale: 1.02 }}
                >
                  Login
                  {isLogin && (
                    <motion.div
                      className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-400 to-indigo-500 rounded-full"
                      layoutId="tabIndicator"
                      transition={{ type: "spring", stiffness: 400, damping: 25 }}
                    />
                  )}
                </motion.button>
                <motion.button
                  onClick={() => setIsLogin(false)}
                  className={`relative flex-1 py-3 px-6 text-sm font-semibold transition-all duration-300 ${
                    !isLogin
                      ? "text-white bg-gradient-to-r from-blue-500 to-indigo-600 shadow-md"
                      : "text-gray-600 dark:text-gray-300 hover:text-white hover:bg-gradient-to-r hover:from-blue-500/10 hover:to-indigo-600/10"
                  } rounded-t-lg`}
                  whileHover={{ scale: 1.02 }}
                >
                  Signup
                  {!isLogin && (
                    <motion.div
                      className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-400 to-indigo-500 rounded-full"
                      layoutId="tabIndicator"
                      transition={{ type: "spring", stiffness: 400, damping: 25 }}
                    />
                  )}
                </motion.button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  className="block text-sm font-medium mb-1"
                  style={{ color: "var(--text-color)" }}
                >
                  Email Address
                </label>
                <input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:outline-none placeholder-gray-400"
                  style={inputStyles}
                />
              </div>
              <div>
                <label
                  className="block text-sm font-medium mb-1"
                  style={{ color: "var(--text-color)" }}
                >
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:outline-none pr-10 placeholder-gray-400"
                    style={inputStyles}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 bg-transparent focus:outline-none hover:bg-transparent"
                    style={{ color: "#ffffff" }}
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
                  <div className="mt-1 text-sm" style={{ color: "var(--text-color)" }}>
                    Password length: {password.length} characters{' '}
                    {password.length < 6 && (
                      <span className="text-red-500">(minimum 6 required)</span>
                    )}
                  </div>
                )}
              </div>
              
              {!isLogin && (
                <div>
                  <label
                    className="block text-sm font-medium mb-1"
                    style={{ color: "var(--text-color)" }}
                  >
                    Confirm Password
                  </label>
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="Confirm your password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:outline-none placeholder-gray-400"
                    style={inputStyles}
                  />
                  {confirmPassword.length > 0 && password !== confirmPassword && (
                    <div className="mt-1 text-sm text-red-500">
                      Passwords do not match
                    </div>
                  )}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2 px-4 rounded-lg transition-colors"
                style={{
                  backgroundColor: loading
                    ? "#9ca3af"
                    : "var(--button-background)",
                  cursor: loading ? "not-allowed" : "pointer",
                }}
              >
                {loading ? "Please wait..." : isLogin ? "Login" : "Create Account"}
              </button>
            </form>

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
      </div>
    </motion.div>
  );
}