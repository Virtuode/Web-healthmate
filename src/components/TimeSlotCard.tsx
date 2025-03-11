import React from 'react';
import { TimeSlot } from '../models/TimeSlot';

interface TimeSlotCardProps {
  timeSlot: TimeSlot;
  isSelected: boolean;
  onSelect: (timeSlot: TimeSlot) => void;
}

export default function TimeSlotCard({ timeSlot, isSelected, onSelect }: TimeSlotCardProps) {
  const cardStyle = `
    p-4 rounded-lg transition-all duration-200 
    ${!timeSlot.isAvailable 
      ? 'bg-gray-100 dark:bg-gray-700 cursor-not-allowed' 
      : isSelected 
        ? 'bg-blue-500 text-white shadow-lg transform scale-105' 
        : 'bg-white dark:bg-gray-800 hover:bg-blue-50 dark:hover:bg-gray-700 cursor-pointer'
    }
  `;

  const handleClick = () => {
    if (timeSlot.isAvailable) {
      onSelect(timeSlot);
    }
  };

  return (
    <div className={cardStyle} onClick={handleClick}>
      <div className="text-center">
        <p className="font-semibold">{timeSlot.startTime}</p>
        <p className="text-sm opacity-75">{timeSlot.endTime}</p>
        <p className={`text-xs mt-1 ${
          timeSlot.isAvailable 
            ? 'text-green-500' 
            : 'text-red-500'
        }`}>
          {timeSlot.isAvailable ? 'Available' : 'Booked'}
        </p>
      </div>
    </div>
  );
} 