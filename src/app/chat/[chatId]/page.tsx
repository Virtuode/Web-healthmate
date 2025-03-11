"use client";

import { useEffect, useState } from 'react';
import { auth } from '../../../firebase';
import { getDatabase, ref, onValue, push, set } from 'firebase/database';
import { useRouter } from 'next/navigation';

interface Message {
  id: string;
  senderId: string;
  text: string;
  timestamp: number;
}

export default function ChatPage({ params }: { params: { chatId: string } }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (!user) {
        router.push('/');
        return;
      }

      const db = getDatabase();
      const messagesRef = ref(db, `messages/${params.chatId}`);

      onValue(messagesRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
          const messageList = Object.values(data) as Message[];
          setMessages(messageList.sort((a, b) => a.timestamp - b.timestamp));
        }
        setLoading(false);
      });
    });

    return () => unsubscribe();
  }, [params.chatId, router]);

  const sendMessage = async () => {
    if (!newMessage.trim()) return;

    const db = getDatabase();
    const messagesRef = ref(db, `messages/${params.chatId}`);
    const newMessageRef = push(messagesRef);

    const messageData = {
      id: newMessageRef.key,
      senderId: auth.currentUser?.uid,
      text: newMessage.trim(),
      timestamp: Date.now(),
    };

    await set(newMessageRef, messageData);
    setNewMessage('');
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-900">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${
              message.senderId === auth.currentUser?.uid
                ? 'justify-end'
                : 'justify-start'
            }`}
          >
            <div
              className={`max-w-xs md:max-w-md p-3 rounded-lg ${
                message.senderId === auth.currentUser?.uid
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200 dark:bg-gray-700'
              }`}
            >
              <p>{message.text}</p>
              <p className="text-xs mt-1 opacity-70">
                {new Date(message.timestamp).toLocaleString()}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="p-4 border-t dark:border-gray-700">
        <div className="flex space-x-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
            placeholder="Type a message..."
            className="flex-1 p-3 rounded-lg border dark:border-gray-700 dark:bg-gray-800 shadow-md focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={sendMessage}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}