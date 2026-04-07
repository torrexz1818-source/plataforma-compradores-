import {
  AdminDashboardData,
  AuthResponse,
  BuyerDirectoryItem,
  BuyerProfile,
  SupplierDirectoryItem,
  SupplierProfileData,
  SupplierReview,
  SupplierSector,
  BuyerSector,
  Comment,
  ConversationMessage,
  ConversationSummary,
  HomeFeed,
  NotificationItem,
  MonthlyReport,
  Post,
  PostCategory,
  PostDetailData,
  PlatformStats,
  SupplierPublication,
  SupplierInboxMessage,
  User,
  UserStatus,
} from '@/types';

const RAW_API_BASE_URL = import.meta.env.VITE_API_URL?.trim() || '/api';
const API_BASE_URL = RAW_API_BASE_URL.endsWith('/')
  ? RAW_API_BASE_URL.slice(0, -1)
  : RAW_API_BASE_URL;

const TOKEN_KEY = 'supplyconnect_token';

type RequestOptions = RequestInit & {
  auth?: boolean;
};

type ListResponse<T> = {
  items: T[];
};

type PostMutationResponse = {
  post: Post;
};

type CommentMutationResponse = {
  comment: Comment;
};

type LikeResponse = {
  liked: boolean;
  likes: number;
};

type ForgotPasswordVerifyResponse = {
  message: string;
  resetToken: string;
};

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string | null) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
    return;
  }

  localStorage.removeItem(TOKEN_KEY);
}

function buildUrl(path: string) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
}

async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set('Accept', 'application/json');

  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  if (options.auth) {
    const token = getStoredToken();

    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
  }

  const response = await fetch(buildUrl(path), {
    ...options,
    headers,
  });

  if (!response.ok) {
    let message = 'No se pudo completar la solicitud';

    try {
      const data = (await response.json()) as { message?: string | string[] };

      if (Array.isArray(data.message)) {
        message = data.message.join(', ');
      } else if (data.message) {
        message = data.message;
      }
    } catch {
      message = response.statusText || message;
    }

    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

function buildQuery(params: Record<string, string | undefined>) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value) {
      searchParams.set(key, value);
    }
  });

  const query = searchParams.toString();
  return query ? `?${query}` : '';
}

export async function login(payload: { email: string; password: string }) {
  return apiRequest<AuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function register(payload: {
  fullName: string;
  company: string;
  position: string;
  ruc?: string;
  phone?: string;
  sector?: string;
  location?: string;
  description?: string;
  role?: 'buyer' | 'supplier';
  email: string;
  password: string;
}) {
  return apiRequest<AuthResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function getMe() {
  const data = await apiRequest<{ user: User }>('/auth/me', { auth: true });
  return data.user;
}

export async function getHomeFeed() {
  return apiRequest<HomeFeed>('/posts/home', { auth: true });
}

export async function getCategories() {
  const data = await apiRequest<ListResponse<PostCategory>>('/posts/categories');
  return data.items;
}

export async function getPosts(params: {
  type?: 'educational' | 'community';
  search?: string;
  categoryId?: string;
}) {
  const data = await apiRequest<ListResponse<Post>>(
    `/posts${buildQuery({
      type: params.type,
      search: params.search,
      categoryId: params.categoryId,
    })}`,
    { auth: true },
  );

  return data.items;
}

export async function getPostDetail(id: string) {
  return apiRequest<PostDetailData>(`/posts/${id}`, { auth: true });
}

export async function createPost(payload: {
  title: string;
  description: string;
  categoryId: string;
  type?: 'educational' | 'community';
  videoUrl?: string;
  thumbnailUrl?: string;
}) {
  return apiRequest<PostMutationResponse>('/posts', {
    method: 'POST',
    auth: true,
    body: JSON.stringify(payload),
  });
}

export async function createComment(
  postId: string,
  payload: {
    content: string;
    parentId?: string;
  },
) {
  return apiRequest<CommentMutationResponse>(`/posts/${postId}/comments`, {
    method: 'POST',
    auth: true,
    body: JSON.stringify(payload),
  });
}

export async function togglePostLike(postId: string) {
  return apiRequest<LikeResponse>(`/posts/${postId}/like`, {
    method: 'POST',
    auth: true,
  });
}

export async function getAdminDashboard() {
  return apiRequest<AdminDashboardData>('/admin/dashboard', { auth: true });
}

export async function adminCreatePost(payload: {
  title: string;
  description: string;
  categoryId: string;
  type: 'educational' | 'community';
  videoUrl?: string;
  thumbnailUrl?: string;
}) {
  return apiRequest<PostMutationResponse>('/admin/posts', {
    method: 'POST',
    auth: true,
    body: JSON.stringify(payload),
  });
}

export async function adminDeletePost(postId: string) {
  return apiRequest<{ deleted: true }>(`/admin/posts/${postId}`, {
    method: 'DELETE',
    auth: true,
  });
}

export async function adminDeleteComment(commentId: string) {
  return apiRequest<{ deleted: true; removedCount: number }>(`/admin/comments/${commentId}`, {
    method: 'DELETE',
    auth: true,
  });
}

export async function updateUserStatus(userId: string, status: UserStatus) {
  return apiRequest<{ user: User }>(`/admin/users/${userId}/status`, {
    method: 'PATCH',
    auth: true,
    body: JSON.stringify({ status }),
  });
}

export async function getAdminMemberships() {
  return apiRequest<Array<{
    userId: string;
    userRole: 'buyer' | 'supplier' | 'admin';
    plan: string;
    status: 'pending' | 'active' | 'expired' | 'suspended';
    adminApproved: boolean;
    approvedAt?: string;
    approvedBy?: string;
    expiresAt?: string;
    createdAt: string;
  }>>('/admin/memberships', { auth: true });
}

export async function updateMembershipByAdmin(
  userId: string,
  payload: {
    plan?: string;
    status?: 'pending' | 'active' | 'expired' | 'suspended';
    adminApproved?: boolean;
    expiresAt?: string;
  },
) {
  return apiRequest(`/admin/memberships/${userId}`, {
    method: 'PATCH',
    auth: true,
    body: JSON.stringify(payload),
  });
}

export async function getNotifications(role: 'buyer' | 'supplier') {
  return apiRequest<NotificationItem[]>(
    `/notifications${buildQuery({ role })}`,
    { auth: true },
  );
}

export async function getNotificationsV2(params?: {
  isRead?: boolean;
  type?: string;
  limit?: number;
  offset?: number;
}) {
  return apiRequest<NotificationItem[]>(
    `/notifications${buildQuery({
      isRead: typeof params?.isRead === 'boolean' ? String(params.isRead) : undefined,
      type: params?.type,
      limit: params?.limit ? String(params.limit) : undefined,
      offset: params?.offset ? String(params.offset) : undefined,
    })}`,
    { auth: true },
  );
}

export async function getUnreadNotificationsCount() {
  return apiRequest<{ count: number }>('/notifications/unread-count', { auth: true });
}

export async function markNotificationAsRead(id: string) {
  return apiRequest<{ success: true; id: string }>(`/notifications/${id}/read`, {
    method: 'PATCH',
    auth: true,
  });
}

export async function markAllNotificationsAsRead() {
  return apiRequest<{ success: true; updated: number }>('/notifications/read-all', {
    method: 'PATCH',
    auth: true,
  });
}

export async function deleteNotification(id: string) {
  return apiRequest<{ success: true; id: string }>(`/notifications/${id}`, {
    method: 'DELETE',
    auth: true,
  });
}

export async function requestPasswordReset(email: string) {
  return apiRequest<{ message: string }>('/auth/forgot-password/request', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export async function verifyPasswordResetCode(email: string, code: string) {
  return apiRequest<ForgotPasswordVerifyResponse>('/auth/forgot-password/verify', {
    method: 'POST',
    body: JSON.stringify({ email, code }),
  });
}

export async function resetPasswordWithToken(payload: {
  email: string;
  resetToken: string;
  newPassword: string;
}) {
  return apiRequest<{ message: string }>('/auth/forgot-password/reset', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function getBuyerSectors() {
  return apiRequest<BuyerSector[]>('/buyer-sectors', { auth: true });
}

export async function getBuyersBySector(sector: string) {
  return apiRequest<BuyerDirectoryItem[]>(
    `/buyers${buildQuery({ sector })}`,
    { auth: true },
  );
}

export async function getBuyerById(id: string) {
  return apiRequest<BuyerProfile>(`/buyers/${id}`, { auth: true });
}

export async function getSupplierSectors() {
  return apiRequest<SupplierSector[]>('/supplier-sectors', { auth: true });
}

export async function getSuppliersBySector(sector: string) {
  return apiRequest<SupplierDirectoryItem[]>(
    `/suppliers${buildQuery({ sector })}`,
    { auth: true },
  );
}

export async function getSupplierById(id: string) {
  return apiRequest<SupplierProfileData>(`/suppliers/${id}`, { auth: true });
}

export async function getSupplierReviews(id: string) {
  const data = await apiRequest<{ items: SupplierReview[] }>(`/suppliers/${id}/reviews`, { auth: true });
  return data.items;
}

export async function createSupplierReview(
  supplierId: string,
  payload: { rating: number; comment: string },
) {
  return apiRequest<{ review: SupplierReview }>(`/suppliers/${supplierId}/reviews`, {
    method: 'POST',
    auth: true,
    body: JSON.stringify(payload),
  });
}

export async function sendMessage(payload: {
  supplierId: string;
  buyerId?: string;
  message: string;
  publicationId?: string;
  postId?: string;
}) {
  return apiRequest<{ id: string; createdAt: string }>('/messages', {
    method: 'POST',
    auth: true,
    body: JSON.stringify(payload),
  });
}

export async function sendSupplierMessage(payload: {
  supplierId: string;
  buyerId: string;
  message: string;
  publicationId?: string;
  postId?: string;
}) {
  return sendMessage(payload);
}

export async function getPlatformStats() {
  return apiRequest<PlatformStats>('/stats', { auth: true });
}

export async function getMonthlyReport(month?: string) {
  return apiRequest<MonthlyReport>(`/reportes${buildQuery({ month })}`, { auth: true });
}

export async function getRecommendedSuppliers(params?: { buyerId?: string; limit?: number }) {
  return apiRequest<Array<{
    id: string;
    name: string;
    company: string;
    sector: string;
    averageRating: number;
    matchReasons: string[];
    score: number;
  }>>(
    `/suppliers/recommended${buildQuery({
      buyerId: params?.buyerId,
      limit: params?.limit ? String(params.limit) : undefined,
    })}`,
    { auth: true },
  );
}

export async function getTopEducationalContent(month?: string, limit = 3) {
  return apiRequest<Array<{ id: string; title: string; description: string; viewCount?: number; views?: number }>>(
    `/educational-content/top${buildQuery({ month, limit: String(limit) })}`,
    { auth: true },
  );
}

export async function getRecommendedEducationalContent(params?: { buyerId?: string; limit?: number }) {
  return apiRequest<Array<{ id: string; title: string; description: string; score: number }>>(
    `/educational-content/recommended${buildQuery({
      buyerId: params?.buyerId,
      limit: params?.limit ? String(params.limit) : undefined,
    })}`,
    { auth: true },
  );
}

export async function registerEducationalContentView(contentId: string) {
  return apiRequest<{ success: true; contentId: string }>(`/educational-content/${contentId}/view`, {
    method: 'POST',
    auth: true,
  });
}

export async function getSupplierInboxMessages() {
  return apiRequest<SupplierInboxMessage[]>('/messages/inbox', { auth: true });
}

export async function getConversations() {
  return apiRequest<ConversationSummary[]>('/conversations', { auth: true });
}

export async function getConversationByPair(buyerId: string, supplierId: string) {
  return apiRequest<ConversationSummary | null>(
    `/conversations${buildQuery({ buyerId, supplierId })}`,
    { auth: true },
  );
}

export async function createConversation(payload: { toUserId: string; publicationId?: string | null }) {
  return apiRequest<ConversationSummary>('/conversations', {
    method: 'POST',
    auth: true,
    body: JSON.stringify(payload),
  });
}

export async function getConversationMessages(conversationId: string) {
  return apiRequest<ConversationMessage[]>(`/conversations/${conversationId}/messages`, {
    auth: true,
  });
}

export async function sendConversationMessage(conversationId: string, message: string) {
  return apiRequest<{ id: string; conversationId: string; createdAt: string }>(
    `/conversations/${conversationId}/messages`,
    {
      method: 'POST',
      auth: true,
      body: JSON.stringify({ message }),
    },
  );
}

export async function getSupplierPublications() {
  const data = await apiRequest<{ items: SupplierPublication[] }>(
    '/publications?supplierId=me',
    { auth: true },
  );
  return data.items;
}

export async function getSupplierPublicationById(id: string) {
  const data = await apiRequest<{ publication: SupplierPublication }>(`/publications/${id}`, {
    auth: true,
  });
  return data.publication;
}

export async function updateSupplierPublication(
  id: string,
  payload: { title?: string; content?: string; image?: string; url?: string },
) {
  const data = await apiRequest<{ publication: SupplierPublication }>(`/publications/${id}`, {
    method: 'PATCH',
    auth: true,
    body: JSON.stringify(payload),
  });
  return data.publication;
}
