"use client";

import { useEffect, useState } from "react";
import { getDatabase, ref, onValue, set } from "firebase/database";
import { FaExpand, FaCompress, FaTimes } from "react-icons/fa";

interface Message {
  id: string;
  senderId: string;
  message: string;
  timestamp: number;
}

interface ChatComponentProps {
  chatId: string;
  doctorId: string | undefined;
  onClose: () => void;
}

const ChatComponent: React.FC<ChatComponentProps> = ({ chatId, doctorId, onClose }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isMaximized, setIsMaximized] = useState(false);
  const [isOpen, setIsOpen] = useState(true);
  const db = getDatabase();

  useEffect(() => {
    const messagesRef = ref(db, `messages/${chatId}`);
    onValue(messagesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const messagesArray = Object.values(data) as Message[];
        setMessages(messagesArray.sort((a, b) => a.timestamp - b.timestamp));
      }
    });
  }, [chatId, db]);

  const handleSendMessage = async () => {
    if (newMessage.trim() === "") return;

    const messageId = Date.now().toString();
    const messageData = {
      id: messageId,
      senderId: doctorId,
      message: newMessage,
      timestamp: Date.now(),
    };

    await set(ref(db, `messages/${chatId}/${messageId}`), messageData);
    setNewMessage("");
  };

  const getDateLabel = (timestamp: number) => {
    const messageDate = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    const isToday = messageDate.toDateString() === today.toDateString();
    const isYesterday = messageDate.toDateString() === yesterday.toDateString();

    if (isToday) return "Today";
    if (isYesterday) return "Yesterday";
    return messageDate.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const formatMessageTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const isDifferentDay = (prevTimestamp: number, currentTimestamp: number) => {
    const prevDate = new Date(prevTimestamp).toDateString();
    const currentDate = new Date(currentTimestamp).toDateString();
    return prevDate !== currentDate;
  };

  return (
    <>
      {isOpen && (
        <>
          {/* Blurred Backdrop */}
          <div
            className="fixed inset-0 bg-gray-800 bg-opacity-50 backdrop-blur-sm z-[998] transition-opacity duration-300"
            onClick={() => {
              setIsOpen(false);
              onClose();
            }}
          />

          {/* Chat Container */}
          <div
            className={`fixed bottom-4 right-4 flex flex-col bg-white dark:bg-gray-900 shadow-2xl rounded-lg overflow-hidden transition-all duration-300 ease-in-out z-[1000] ${
              isMaximized
                ? "w-[95vw] h-[90vh] md:w-[80vw] lg:w-[70vw]"
                : "w-[90vw] h-[50vh] md:w-[40vw] lg:w-[30vw]"
            }`}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-3 bg-gray-200 dark:bg-gray-800 rounded-t-lg">
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setIsMaximized(!isMaximized)}
                  className="text-blue-500 hover:text-blue-700 transition-transform duration-300 transform hover:scale-110 bg-transparent focus:outline-none"
                >
                  {isMaximized ? <FaCompress size={20} /> : <FaExpand size={20} />}
                </button>
                <h2 className="font-semibold text-gray-800 dark:text-gray-100">Chat</h2>
              </div>
              <button
                onClick={() => {
                  setIsOpen(false);
                  onClose();
                }}
                className="text-gray-500 hover:text-red-500 transition-all duration-300 transform hover:rotate-90 hover:scale-110 bg-transparent focus:outline-none"
              >
                <FaTimes size={20} />
              </button>
            </div>

            {/* Chat Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 bg-gray-50 dark:bg-gray-900 space-y-3">
              {messages.length === 0 ? (
                <div className="flex justify-center items-center h-full">
                  <p className="text-gray-500 dark:text-gray-400">No messages yet. Start the conversation!</p>
                </div>
              ) : (
                messages.map((msg, index) => (
                  <div key={msg.id}>
                    {(index === 0 || isDifferentDay(messages[index - 1].timestamp, msg.timestamp)) && (
                      <div className="flex justify-center my-2">
                        <span className="px-3 py-1 text-xs text-gray-800 bg-gray-200 dark:bg-gray-700 dark:text-gray-200 rounded-full shadow-sm">
                          {getDateLabel(msg.timestamp)}
                        </span>
                      </div>
                    )}
                    <div
                      className={`flex ${
                        msg.senderId === doctorId ? "justify-end" : "justify-start"
                      }`}
                    >
                      <div
                        className={`max-w-[70%] p-3 rounded-lg shadow-md transition-all duration-200 ${
                          msg.senderId === doctorId
                            ? "bg-green-500 text-white rounded-br-none"
                            : "bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 rounded-bl-none"
                        }`}
                      >
                        <p className="text-sm">{msg.message}</p>
                        <span className="text-xs opacity-75 block text-right mt-1">
                          {formatMessageTime(msg.timestamp)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Message Input Area */}
            <div className="p-3 border-t bg-white dark:bg-gray-800 dark:border-gray-700">
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
                  placeholder="Type a message..."
                  className="flex-1 p-2 rounded-full border dark:border-gray-700 dark:bg-gray-700 text-gray-800 dark:text-gray-100 shadow-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <button
                  onClick={handleSendMessage}
                  className="px-4 py-2 bg-blue-500 text-white rounded-full hover:bg-blue-600 transition-transform duration-200 transform hover:scale-105"
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        </>
      )}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-4 right-4 w-12 h-12 flex items-center justify-center bg-blue-500 text-white rounded-full shadow-lg hover:bg-blue-600 transition-all duration-300 transform hover:scale-110 z-[1001]"
        >
          <FaExpand size={20} />
        </button>
      )}
    </>
  );
};

export default ChatComponent;