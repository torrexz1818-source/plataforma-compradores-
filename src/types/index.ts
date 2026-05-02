export type UserRole = 'buyer' | 'expert' | 'admin' | 'supplier';
export type UserStatus = 'active' | 'disabled';

export interface User {
  id: string;
  fullName: string;
  email: string;
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
      completedAt?: string;
    };
  };
  expertProfile?: {
    weeklyAvailability?: ExpertWeeklyAvailabilityItem[];
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
  createdAt: string;
  hasSensitiveAccess?: boolean;
  membership?: {
    userId: string;
    userRole: UserRole;
    plan: string;
    status: 'pending' | 'active' | 'expired' | 'suspended';
    adminApproved: boolean;
    approvedAt?: string;
    approvedBy?: string;
    expiresAt?: string;
    createdAt: string;
  } | null;
}

export interface PostCategory {
  id: string;
  name: string;
  slug: string;
}

export interface SupplierOnboardingFile {
  url: string;
  name: string;
  mimeType?: string;
  size?: number;
}

export interface PostResource {
  id: string;
  type: 'image' | 'file' | 'link';
  name: string;
  url: string;
}

export interface Post {
  id: string;
  author: User;
  category: PostCategory;
  title: string;
  description: string;
  contentBody?: string;
  learningRoute?: 'ruta-1' | 'ruta-2' | 'ruta-3' | 'ruta-4' | 'ruta-5';
  mediaType?: 'video' | 'image';
  videoUrl?: string;
  thumbnailUrl?: string;
  resources?: PostResource[];
  status?: 'draft' | 'published' | 'archived';
  accessType?: 'free' | 'professional' | 'premium';
  isFeatured?: boolean;
  expertName?: string;
  metrics?: {
    views: number;
    downloads: number;
    saves: number;
    comments: number;
  };
  type: 'educational' | 'community' | 'liquidation';
  likes: number;
  comments: number;
  shares: number;
  isLiked: boolean;
  createdAt: string;
}

export interface Comment {
  id: string;
  postId: string;
  user: User;
  content: string;
  likes: number;
  isLiked: boolean;
  replies: Comment[];
  createdAt: string;
}

export interface Lesson {
  id: string;
  postId: string;
  title: string;
  description: string;
  videoUrl: string;
  thumbnailUrl: string;
  duration: string;
  progress: number;
  author: User;
}

export interface StatsData {
  label: string;
  value: string;
  icon: string;
}

export interface HomeDashboardSummary {
  averageLessonProgress: number;
  commentsLast7Days: number;
  educationalPostsCount: number;
}

export interface HomeDashboardActivityPoint {
  date: string;
  posts: number;
}

export interface HomeDashboardTopPost {
  id: string;
  title: string;
  engagement: number;
  likes: number;
  comments: number;
}

export interface HomeDashboard {
  summary: HomeDashboardSummary;
  activityByDay: HomeDashboardActivityPoint[];
  topEducationalPosts: HomeDashboardTopPost[];
}

export interface HomeFeed {
  stats: StatsData[];
  dashboard: HomeDashboard;
  educationalPosts: Post[];
  continueWatching: Lesson[];
}

export interface PostDetailData {
  post: Post;
  comments: Comment[];
  relatedPosts: Post[];
  lesson: Lesson | null;
}

export interface AuthResponse {
  accessToken: string;
  user: User;
}

export interface SupplierOnboardingSession {
  id: string;
  shareCount: number;
  requiredShares: number;
  remainingShares: number;
  status: 'draft' | 'completed' | 'consumed';
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  consumedAt?: string;
  expiresAt: string;
}

export interface AdminOverview {
  totalUsers: number;
  activeUsers: number;
  totalPosts: number;
  educationalPosts: number;
  totalComments: number;
}

export interface AdminComment {
  id: string;
  postId: string;
  postTitle: string;
  user: User;
  content: string;
  createdAt: string;
  repliesCount: number;
}

export interface AdminDashboardData {
  overview: AdminOverview;
  categories: PostCategory[];
  users: User[];
  posts: Post[];
  comments: AdminComment[];
}

export type NotificationIconName =
  | 'Building2'
  | 'MessageCircle'
  | 'FileText'
  | 'Star';

export interface NotificationItem {
  id: string;
  userId?: string;
  type?: string;
  icon: NotificationIconName;
  title: string;
  description: string;
  body?: string;
  entityType?: 'publication' | 'message' | 'user' | 'report' | 'content' | 'review';
  entityId?: string;
  fromUserId?: string;
  time: string;
  read?: boolean;
  isRead?: boolean;
  url?: string;
  createdAt?: string;
}

export interface NewsComment {
  id: string;
  postId: string;
  content: string;
  createdAt: string;
  user: {
    id: string;
    fullName: string;
    company: string;
    role: UserRole;
  };
  replies: NewsComment[];
}

export interface NewsPost {
  id: string;
  title: string;
  body?: string;
  imageUrl?: string;
  pdfUrl?: string;
  resourceUrl?: string;
  timestamp: string;
  likes: number;
  isLiked: boolean;
  commentsCount: number;
  comments: NewsComment[];
}

export interface BuyerSector {
  sector: string;
  count: number;
}

export interface BuyerDirectoryItem {
  id: string;
  name: string;
  company: string;
  sector: string;
  location: string;
  description: string;
  email?: string;
  phone?: string;
  ruc?: string;
  isActiveBuyer: boolean;
  createdAt: string;
}

export interface BuyerProfile extends Omit<BuyerDirectoryItem, 'isActiveBuyer'> {
  email: string;
  phone: string;
}

export interface SupplierSector {
  sector: string;
  count: number;
}

export interface SupplierDirectoryItem {
  id: string;
  name: string;
  company: string;
  sector: string;
  location: string;
  coverage: string;
  province: string;
  district: string;
  description: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  isActiveSupplier: boolean;
  createdAt: string;
}

export interface SupplierProfileData extends Omit<SupplierDirectoryItem, 'isActiveSupplier'> {
  email: string;
  phone: string;
  reviewsCount: number;
  averageRating: number;
  hasContacted: boolean;
}

export interface SupplierReview {
  id: string;
  rating: number;
  comment: string;
  createdAt: string;
  buyer: {
    id: string;
    name: string;
    company: string;
  };
}

export interface StatsSectorBreakdownItem {
  sector: string;
  count: number;
}

export interface StatsLatestUserItem {
  id: string;
  name: string;
  company: string;
  sector: string;
  role: 'buyer' | 'expert' | 'supplier';
}

export interface PlatformStats {
  totalUsers: number;
  buyers: number;
  suppliers: number;
  sectorBreakdown: StatsSectorBreakdownItem[];
  latestUsers: StatsLatestUserItem[];
}

export interface PublicationMessage {
  id: string;
  publicationId: string;
  supplierId: string;
  buyerId: string;
  buyerName: string;
  buyerCompany: string;
  content: string;
  reply?: string;
  status: 'pending' | 'replied';
  createdAt: string;
}

export interface SupplierPublication {
  id: string;
  title: string;
  content: string;
  image?: string;
  url?: string;
  createdAt: string;
  supplierId: string;
  messages: PublicationMessage[];
}

export interface ConversationSummary {
  id: string;
  buyerId: string;
  supplierId: string;
  participantIds?: string[];
  isNew?: boolean;
  publicationId?: string;
  buyerName: string;
  buyerCompany: string;
  supplierName: string;
  supplierCompany: string;
  supplierSector: string;
  otherUserId?: string;
  otherUserName?: string;
  otherUserCompany?: string;
  otherUserRole?: UserRole | string;
  lastMessage: string;
  unreadCount: number;
  updatedAt: string;
  createdAt: string;
}

export interface MessageAttachment {
  id: string;
  kind: 'image' | 'file' | 'location' | 'publication' | 'profile';
  name: string;
  url?: string;
  mimeType?: string;
  size?: number;
  latitude?: number;
  longitude?: number;
  label?: string;
  publicationId?: string;
  profileId?: string;
  description?: string;
  thumbnailUrl?: string;
}

export interface ConversationMessage {
  id: string;
  conversationId: string;
  senderId: string;
  text: string;
  attachments: MessageAttachment[];
  isOwn: boolean;
  isRead: boolean;
  createdAt: string;
}

export interface MonthlyReportSupplier {
  month: string;
  role: 'supplier';
  metrics: {
    profileViews: number;
    likes: number;
    messages: number;
    newBuyers: number;
    variationVsPreviousMonth: number;
  };
  topPublications: Array<{
    id: string;
    title: string;
    engagement: number;
    likes: number;
    comments: number;
  }>;
  topBuyers: Array<{
    id: string;
    name: string;
    company: string;
    interactions: number;
  }>;
  reviews: {
    average: number;
    latest: Array<{
      id: string;
      rating: number;
      comment: string;
      createdAt: string;
    }>;
  };
  educationalTop: Array<{
    id: string;
    title: string;
    description: string;
    views?: number;
  }>;
}

export interface MonthlyReportBuyer {
  month: string;
  role: 'buyer';
  metrics: {
    suppliersVisited: number;
    messagesSent: number;
    contentsViewed: number;
    newSuppliersInMyCategories: number;
  };
  topEducational: Array<{
    id: string;
    title: string;
    description: string;
    views?: number;
  }>;
  recommendedSuppliers: Array<{
    id: string;
    name: string;
    company: string;
    sector: string;
    stars: number;
    matchReasons: string[];
  }>;
  visitedSuppliers: Array<{
    id: string;
    name: string;
    company: string;
  }>;
}

export type MonthlyReport = MonthlyReportBuyer | MonthlyReportSupplier;

export interface ExpertSummary {
  id: string;
  fullName: string;
  photo: string;
  specialty: string;
  industry: string;
  experience: string;
  shortBio: string;
  service: string;
  skills: string[];
  availabilityDays: string[];
  weeklyAvailability: ExpertWeeklyAvailabilityItem[];
  googleCalendarConnected: boolean;
  meetingsCount: number;
}

export interface ExpertWeeklyAvailabilityItem {
  day: string;
  enabled: boolean;
  slots: ExpertWeeklyAvailabilitySlot[];
}

export interface ExpertWeeklyAvailabilitySlot {
  id: string;
  startTime: string;
  endTime: string;
}

export interface ExpertProfile {
  id: string;
  fullName: string;
  email: string;
  photo: string;
  specialty: string;
  industry: string;
  experience: string;
  professionalProfile: string;
  biography: string;
  description: string;
  companies: string;
  education: string;
  achievements: string;
  service: string;
  skills: string[];
  availabilityDays: string[];
  weeklyAvailability: ExpertWeeklyAvailabilityItem[];
  googleCalendarConnected: boolean;
  upcomingMeetings: number;
}

export interface ExpertAvailabilitySlot {
  startsAt: string;
  endsAt: string;
  label: string;
  available: boolean;
  maxParticipants: number;
  bookedParticipants: number;
  remainingSpots: number;
}

export interface ExpertAvailability {
  expertId: string;
  date: string;
  weekday: string;
  availabilityDays: string[];
  weeklyAvailability: ExpertWeeklyAvailabilityItem[];
  slots: ExpertAvailabilitySlot[];
}

export interface ExpertAppointment {
  id: string;
  buyerId: string;
  expertId: string;
  buyerName: string;
  expertName: string;
  buyerEmail: string;
  expertEmail: string;
  startsAt: string;
  endsAt: string;
  topic: string;
  status: 'scheduled' | 'cancelled';
  googleCalendarEventId?: string;
  googleCalendarHtmlLink?: string;
  buyerGoogleCalendarEventId?: string;
  buyerGoogleCalendarHtmlLink?: string;
  googleMeetLink?: string;
  emailSent: boolean;
  emailError?: string;
  createdAt: string;
  maxParticipants?: number;
}

export interface ExpertCalendarConnectionStatus {
  connected: boolean;
  googleEmail?: string;
  calendarId?: string;
  calendarName?: string;
  timezone?: string;
  connectedAt?: string;
  updatedAt?: string;
}

export interface ExpertAvailabilitySettings {
  availabilityDays: string[];
  weeklyAvailability: ExpertWeeklyAvailabilityItem[];
}

export interface EmployabilityPublicUser {
  id: string;
  fullName: string;
  company: string;
  position: string;
  role: UserRole | string;
}

export interface EmployabilityJob {
  id: string;
  title: string;
  company: string;
  author: EmployabilityPublicUser;
  description: string;
  skillsRequired: string[];
  experienceRequired: string;
  location: string;
  applicants: number;
  hasApplied: boolean;
  createdAt: string;
  isOwner?: boolean;
}

export interface EmployabilityTalentProfile {
  id: string;
  user: EmployabilityPublicUser;
  headline: string;
  description: string;
  skills: string[];
  experience: string;
  certifications: string[];
  availability: string;
  createdAt: string;
  isOwner: boolean;
}

export interface EmployabilityFeed {
  jobs: EmployabilityJob[];
  talentProfiles: EmployabilityTalentProfile[];
  stats: {
    jobs: number;
    talentProfiles: number;
    applications: number;
  };
}

export interface Agent {
  id: string;
  slug: string;
  name: string;
  description: string;
  longDescription: string;
  category: string;
  automationType: string;
  useCase: string;
  functionalities: string[];
  benefits: string[];
  inputs: string[];
  outputs: string[];
  isActive: boolean;
  accentColor: string;
  icon: string;
  createdAt: string;
  updatedAt: string;
  executions?: number;
}

export interface AgentExecution {
  id: string;
  agentId: string;
  userId: string;
  agentName: string;
  inputData: Record<string, unknown>;
  outputData: Record<string, unknown>;
  executedAt: string;
}
