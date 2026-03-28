import { UserRole } from './user-role.enum';
import { UserStatus } from './user-status.enum';

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  fullName: string;
  company: string;
  position: string;
  phone?: string;
  ruc?: string;
  sector?: string;
  location?: string;
  description?: string;
  role: UserRole;
  status: UserStatus;
  points: number;
  avatarUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}
