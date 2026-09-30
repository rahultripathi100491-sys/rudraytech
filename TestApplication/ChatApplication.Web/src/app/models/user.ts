export interface User {
  id: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  email: string;
  password: string;
  isEmailConfirmed: boolean;
  profileImage: string;
  isActive: boolean;
  joinedDate: string;
  isOnLine: boolean;
  lastSeen: string;
}