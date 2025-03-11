export interface TimeSlot {
  id: string;
  day: string;
  startTime: string;
  endTime: string;
  isAvailable: boolean;
}

export class TimeSlotUtil {
  static getTimeRange(startTime: string, endTime: string): string {
    return `${startTime} - ${endTime}`;
  }

  static isValidTimeRange(startTime: string, endTime: string): boolean {
    try {
      const start = new Date(`1970-01-01T${startTime}`);
      const end = new Date(`1970-01-01T${endTime}`);
      return start < end;
    } catch (e) {
      return false;
    }
  }

  static getFormattedTimeString(day: string, time: string): string {
    return `${day} ${time}`;
  }
} 