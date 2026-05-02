import { UserRole } from './user-role.enum';
import { UserStatus } from './user-status.enum';

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  fullName: string;
  company: string;
  commercialName?: string;
  position: string;
  phone?: string;
  ruc?: string;
  sector?: string;
  location?: string;
  description?: string;
  employeeCount?: string;
  digitalPresence?: {
    linkedin?: string;
    website?: string;
    whatsapp?: string;
    instagram?: string;
  };
  buyerProfile?: {
    interestCategories?: string[];
    purchaseVolume?: string;
    isCompanyDigitalized?: string;
    usesGenerativeAI?: string;
  };
  supplierProfile?: {
    supplierType?: string;
    productsOrServices?: string[];
    hasDigitalCatalog?: string;
    isCompanyDigitalized?: string;
    usesGenerativeAI?: string;
    coverage?: string;
    province?: string;
    district?: string;
    yearsInMarket?: string;
    homologationCertificates?: SupplierOnboardingFile[];
    logoFile?: SupplierOnboardingFile;
    catalogFile?: SupplierOnboardingFile;
    onboarding?: {
      sessionId?: string;
      shareCount?: number;
      requiredShares?: number;
      completedAt?: Date;
    };
  };
  expertProfile?: {
    weeklyAvailability?: Array<{
      day: string;
      enabled: boolean;
      slots: Array<{
        id: string;
        startTime: string;
        endTime: string;
      }>;
    }>;
    currentProfessionalProfile?: string;
    industry?: string;
    specialty?: string;
    experience?: string;
    skills?: string[];
    biography?: string;
    companies?: string;
    education?: string;
    achievements?: string;
    photo?: string;
    service?: string;
    availabilityDays?: string[];
    googleCalendarConnected?: boolean;
  };
  role: UserRole;
  status: UserStatus;
  points: number;
  avatarUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SupplierOnboardingFile {
  url: string;
  name: string;
  mimeType?: string;
  size?: number;
}
