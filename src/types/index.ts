export type UserRole = 'buyer' | 'admin' | 'supplier';
export type UserStatus = 'active' | 'disabled';

export interface User {
  id: string;
  fullName: string;
  email: string;
  company: string;
  position: string;
  role: UserRole;
  status: UserStatus;
  points: number;
  avatarUrl?: string;
  createdAt: string;
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

export interface HomeFeed {
  stats: StatsData[];
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
