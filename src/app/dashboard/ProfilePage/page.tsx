"use client";

import { useEffect, useState } from "react";
import { auth, db } from "@/firebase";
import { ref, onValue, update } from "firebase/database";
import { useRouter } from "next/navigation";
import { Input } from "@/components/UI/input";
import { Button } from "@/components/UI/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/UI/card";

interface DoctorData {
  email: string;
  phone: string;
  languages: string;
  specialization: string;
  experience: number;
  biography: string;
}

export default function ProfilePage() {
  const [doctorData, setDoctorData] = useState<DoctorData | null>(null);
  const [editableData, setEditableData] = useState<DoctorData | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (!user) {
        router.push("/");
        return;
      }
      setUserId(user.uid);
      const doctorRef = ref(db, "doctors/" + user.uid);
      onValue(doctorRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
          setDoctorData(data);
          setEditableData(data);
        }
      });
    });
    return () => unsubscribe();
  }, [router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (editableData) {
      setEditableData({ ...editableData, [e.target.name]: e.target.value });
    }
  };

  const handleSave = async () => {
    if (userId && editableData) {
      try {
        const doctorRef = ref(db, "doctors/" + userId);
        await update(doctorRef, editableData);
        setDoctorData(editableData);
        alert("Profile updated successfully!");
      } catch (error) {
        console.error("Error updating profile:", error);
        alert("Failed to update profile. Please try again.");
      }
    }
  };

  if (!editableData) {
    return <div className="flex items-center justify-center min-h-screen text-lg">Loading...</div>;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900 p-6">
      <Card className="w-full max-w-2xl shadow-xl">
        <CardHeader>
          <CardTitle className="text-2xl font-semibold text-center">Profile Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium">Email</label>
              <Input name="email" value={editableData.email} onChange={handleChange} disabled />
            </div>
            <div>
              <label className="block text-sm font-medium">Phone</label>
              <Input name="phone" value={editableData.phone} onChange={handleChange} />
            </div>
            <div>
              <label className="block text-sm font-medium">Languages (comma separated)</label>
              <Input name="languages" value={editableData.languages} onChange={handleChange} />
            </div>
            <div>
              <label className="block text-sm font-medium">Specialization</label>
              <Input name="specialization" value={editableData.specialization} onChange={handleChange} />
            </div>
            <div>
              <label className="block text-sm font-medium">Experience (years)</label>
              <Input type="number" name="experience" value={editableData.experience} onChange={handleChange} />
            </div>
            <div>
              <label className="block text-sm font-medium">Biography</label>
              <textarea name="biography" className="w-full p-2 border rounded" value={editableData.biography} onChange={handleChange} rows={4} />
            </div>
            <Button onClick={handleSave} className="w-full mt-4">Save Changes</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
