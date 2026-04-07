export type UserRole = 'buyer' | 'admin' | 'supplier';
export type UserStatus = 'active' | 'disabled';

export interface User {
  id: string;
  fullName: string;
  email: string;
  company: string;
  position: string;
  sector?: string;
  location?: string;
  description?: string;
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

export interface Post {
  id: string;
  author: User;
  category: PostCategory;
  title: string;
  description: string;
  videoUrl?: string;
  thumbnailUrl?: string;
  type: 'educational' | 'community';
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
  role: 'buyer' | 'supplier';
}

export interface PlatformStats {
  totalUsers: number;
  buyers: number;
  suppliers: number;
  sectorBreakdown: StatsSectorBreakdownItem[];
  latestUsers: StatsLatestUserItem[];
}

export interface SupplierInboxMessage {
  id: string;
  buyerId: string;
  buyerName: string;
  buyerCompany: string;
  text: string;
  createdAt: string;
  publicationId?: string;
  postId?: string;
  replied: boolean;
  replyText?: string;
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
  publicationId?: string;
  buyerName: string;
  buyerCompany: string;
  supplierName: string;
  supplierCompany: string;
  supplierSector: string;
  lastMessage: string;
  updatedAt: string;
  createdAt: string;
}

export interface ConversationMessage {
  id: string;
  conversationId: string;
  senderId: string;
  text: string;
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
