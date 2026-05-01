import {
  AdminDashboardData,
  AuthResponse,
  BuyerDirectoryItem,
  BuyerProfile,
  SupplierDirectoryItem,
  SupplierOnboardingSession,
  SupplierProfileData,
  SupplierReview,
  SupplierSector,
  BuyerSector,
  Comment,
  ConversationMessage,
  ConversationSummary,
  MessageAttachment,
  HomeFeed,
  Lesson,
  NotificationItem,
  NewsComment,
  NewsPost,
  MonthlyReport,
  Post,
  PostCategory,
  PostResource,
  PostDetailData,
  PlatformStats,
  SupplierPublication,
  ExpertAppointment,
  ExpertAvailability,
  ExpertAvailabilitySettings,
  ExpertCalendarConnectionStatus,
  ExpertProfile,
  ExpertSummary,
  Agent,
  AgentExecution,
  EmployabilityFeed,
  EmployabilityJob,
  EmployabilityTalentProfile,
  User,
  UserStatus,
} from '@/types';

const DEFAULT_PRODUCTION_API_URL = 'https://api.buyernodus.com';
const RAW_API_BASE_URL = import.meta.env.VITE_API_URL?.trim() || DEFAULT_PRODUCTION_API_URL;

const API_BASE_URL = RAW_API_BASE_URL.endsWith('/')
  ? RAW_API_BASE_URL.slice(0, -1)
  : RAW_API_BASE_URL;

const TOKEN_KEY = 'supplynexu_token';

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

type SupplierOnboardingSessionResponse = {
  session: SupplierOnboardingSession;
};

type UploadedFileResponse = {
  file: {
    url: string;
    name: string;
    mimeType?: string;
    size?: number;
  };
};

type NewsListResponse = {
  items: NewsPost[];
};

type NewsPostMutationResponse = {
  post: NewsPost;
};

type NewsCommentMutationResponse = {
  comment: NewsComment;
};

const ADMIN_VIDEO_CHUNK_SIZE = 5 * 1024 * 1024;

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

function isBrowserLocalHost(hostname: string) {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    isPrivateIpv4Host(hostname)
  );
}

function getApiBaseFromCurrentDomain() {
  if (typeof window === 'undefined') {
    return DEFAULT_PRODUCTION_API_URL;
  }

  const { protocol, hostname } = window.location;

  if (isBrowserLocalHost(hostname)) {
    return DEFAULT_PRODUCTION_API_URL;
  }

  if (hostname.startsWith('api.')) {
    return `${protocol}//${hostname}`;
  }

  const rootHost = hostname.replace(/^www\./, '');
  return `${protocol}//api.${rootHost}`;
}

function getRuntimeApiBaseUrl() {
  if (
    typeof window === 'undefined' ||
    isBrowserLocalHost(window.location.hostname)
  ) {
    return API_BASE_URL;
  }

  if (API_BASE_URL === '/api' || API_BASE_URL === DEFAULT_PRODUCTION_API_URL) {
    return getApiBaseFromCurrentDomain();
  }

  return API_BASE_URL;
}

function buildUrl(path: string) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${getRuntimeApiBaseUrl()}${normalizedPath}`;
}

function getApiOrigin() {
  try {
    return new URL(getRuntimeApiBaseUrl()).origin;
  } catch {
    return '';
  }
}

export function resolveApiAssetUrl(url?: string | null) {
  if (!url) {
    return '';
  }

  if (/^(blob:|data:)/i.test(url)) {
    return url;
  }

  const apiOrigin = getApiOrigin();

  if (/^https?:\/\//i.test(url)) {
    try {
      const parsedUrl = new URL(url);

      if (parsedUrl.pathname.startsWith('/uploads/')) {
        return apiOrigin ? `${apiOrigin}${parsedUrl.pathname}${parsedUrl.search}` : url;
      }
    } catch {
      return url;
    }

    return url;
  }

  if (url.startsWith('/api/uploads/')) {
    const uploadsPath = url.replace(/^\/api\/uploads/, '/uploads');
    return apiOrigin ? `${apiOrigin}${uploadsPath}` : url;
  }

  if (url.startsWith('/uploads/')) {
    return apiOrigin ? `${apiOrigin}${url}` : `/api${url}`;
  }

  return url;
}

function normalizePostAssetUrls<T extends Post>(post: T): T {
  return {
    ...post,
    videoUrl: resolveApiAssetUrl(post.videoUrl),
    thumbnailUrl: resolveApiAssetUrl(post.thumbnailUrl),
    resources: post.resources?.map((resource) => ({
      ...resource,
      url: resolveApiAssetUrl(resource.url),
    })),
  };
}

function normalizeNewsPostAssetUrls<T extends NewsPost>(post: T): T {
  return {
    ...post,
    imageUrl: resolveApiAssetUrl(post.imageUrl),
    pdfUrl: resolveApiAssetUrl(post.pdfUrl),
  };
}

function normalizeLessonAssetUrls<T extends Lesson>(lesson: T): T {
  return {
    ...lesson,
    videoUrl: resolveApiAssetUrl(lesson.videoUrl),
    thumbnailUrl: resolveApiAssetUrl(lesson.thumbnailUrl),
  };
}

function isPrivateIpv4Host(hostname: string) {
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) {
    return false;
  }

  const octets = hostname.split('.').map((part) => Number(part));

  if (octets.some((octet) => Number.isNaN(octet) || octet < 0 || octet > 255)) {
    return false;
  }

  return (
    octets[0] === 10 ||
    octets[0] === 127 ||
    (octets[0] === 169 && octets[1] === 254) ||
    (octets[0] === 192 && octets[1] === 168) ||
    (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31)
  );
}

function getFallbackBaseUrls() {
  if (typeof window === 'undefined') {
    return [];
  }

  const isLocalEnvironment =
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    isPrivateIpv4Host(window.location.hostname);

  return API_BASE_URL === '/api' ? [DEFAULT_PRODUCTION_API_URL] : [];
}

function getConnectionErrorMessage() {
  if (typeof window === 'undefined') {
    return 'No se pudo conectar con el servidor.';
  }

  const isLocalEnvironment =
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    isPrivateIpv4Host(window.location.hostname);

  return `No se pudo conectar con el backend publicado. Verifica que ${DEFAULT_PRODUCTION_API_URL} este activo y accesible.`;
}

async function performFetch(url: string, options: RequestInit) {
  return fetch(url, options);
}

async function tryFallbackFetch(path: string, options: RequestInit) {
  const fallbackBaseUrls = getFallbackBaseUrls();

  for (const fallbackBaseUrl of fallbackBaseUrls) {
    try {
      const normalizedPath = path.startsWith('/') ? path : `/${path}`;
      return await performFetch(`${fallbackBaseUrl}${normalizedPath}`, options);
    } catch {
      // keep trying fallback URLs
    }
  }

  return null;
}

async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set('Accept', 'application/json');

  if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  if (options.auth) {
    const token = getStoredToken();

    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
  }

  const requestOptions = {
    ...options,
    headers,
  };

  let response: Response;

  try {
    response = await performFetch(buildUrl(path), requestOptions);
  } catch (primaryError) {
    const fallbackResponse = await tryFallbackFetch(path, requestOptions);
    if (!fallbackResponse) {
      if (typeof window !== 'undefined') {
        throw new Error(getConnectionErrorMessage());
      }

      throw primaryError;
    }

    response = fallbackResponse;
  }

  if (!response.ok && response.status >= 500) {
    const fallbackResponse = await tryFallbackFetch(path, requestOptions);

    if (fallbackResponse) {
      response = fallbackResponse;
    }
  }

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

  const raw = await response.text();

  if (!raw.trim()) {
    return undefined as T;
  }

  return JSON.parse(raw) as T;
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
  commercialName?: string;
  position: string;
  ruc?: string;
  phone?: string;
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
  };
  supplierOnboarding?: {
    sessionId: string;
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
  role?: 'buyer' | 'supplier' | 'expert';
  email: string;
  password: string;
}) {
  return apiRequest<AuthResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function createSupplierOnboardingSession(existingSessionId?: string) {
  const data = await apiRequest<SupplierOnboardingSessionResponse>(
    '/auth/supplier-onboarding/session',
    {
      method: 'POST',
      body: JSON.stringify(
        existingSessionId ? { sessionId: existingSessionId } : {},
      ),
    },
  );
  return data.session;
}

export async function getSupplierOnboardingSession(sessionId: string) {
  const data = await apiRequest<SupplierOnboardingSessionResponse>(
    `/auth/supplier-onboarding/session/${sessionId}`,
  );
  return data.session;
}

export async function registerSupplierOnboardingShare(
  sessionId: string,
  payload: { method?: 'copy' | 'native' },
) {
  const data = await apiRequest<SupplierOnboardingSessionResponse>(
    `/auth/supplier-onboarding/session/${sessionId}/share`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );
  return data.session;
}

export async function getMe() {
  const data = await apiRequest<{ user: User }>('/auth/me', { auth: true });
  return data.user;
}

export async function getHomeFeed() {
  const data = await apiRequest<HomeFeed>('/posts/home', { auth: true });

  return {
    ...data,
    educationalPosts: data.educationalPosts.map(normalizePostAssetUrls),
    continueWatching: data.continueWatching.map(normalizeLessonAssetUrls),
  };
}

export async function getCategories() {
  const data = await apiRequest<ListResponse<PostCategory>>('/posts/categories');
  return data.items;
}

export async function getPosts(params: {
  type?: 'educational' | 'community' | 'liquidation';
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

  return data.items.map(normalizePostAssetUrls);
}

export async function getPostDetail(id: string) {
  const data = await apiRequest<PostDetailData>(`/posts/${id}`, { auth: true });

  return {
    ...data,
    post: normalizePostAssetUrls(data.post),
    relatedPosts: data.relatedPosts?.map(normalizePostAssetUrls),
    lesson: data.lesson ? normalizeLessonAssetUrls(data.lesson) : data.lesson,
  };
}

export async function createPost(payload: {
  title: string;
  description: string;
  categoryId: string;
  type?: 'educational' | 'community' | 'liquidation';
  learningRoute?: 'ruta-1' | 'ruta-2' | 'ruta-3' | 'ruta-4' | 'ruta-5';
  mediaType?: 'video' | 'image';
  videoUrl?: string;
  thumbnailUrl?: string;
  resources?: PostResource[];
}) {
  return apiRequest<PostMutationResponse>('/posts', {
    method: 'POST',
    auth: true,
    body: JSON.stringify(payload),
  });
}

export async function uploadFile(
  file: File,
  purpose: 'general' | 'messages' | 'posts' | 'resources' = 'general',
) {
  const formData = new FormData();
  formData.append('file', file);

  const data = await apiRequest<UploadedFileResponse>(
    `/uploads/file${buildQuery({ purpose })}`,
    {
      method: 'POST',
      auth: true,
      body: formData,
    },
  );

  return data.file;
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

export async function toggleCommentLike(postId: string, commentId: string) {
  return apiRequest<LikeResponse>(`/posts/${postId}/comments/${commentId}/like`, {
    method: 'POST',
    auth: true,
  });
}

export async function getAdminDashboard() {
  const data = await apiRequest<AdminDashboardData>('/admin/dashboard', { auth: true });

  return {
    ...data,
    posts: data.posts.map(normalizePostAssetUrls),
  };
}

export async function adminCreatePost(payload: {
  title: string;
  description: string;
  contentBody?: string;
  categoryId: string;
  type: 'educational' | 'community' | 'liquidation';
  learningRoute?: 'ruta-1' | 'ruta-2' | 'ruta-3' | 'ruta-4' | 'ruta-5';
  mediaType?: 'video' | 'image';
  videoUrl?: string;
  thumbnailUrl?: string;
  resources?: PostResource[];
  status?: 'draft' | 'published' | 'archived';
  accessType?: 'free' | 'professional' | 'premium';
  isFeatured?: boolean;
  expertName?: string;
} | FormData) {
  return apiRequest<PostMutationResponse>('/admin/posts', {
    method: 'POST',
    auth: true,
    body: payload instanceof FormData ? payload : JSON.stringify(payload),
  });
}

export async function adminUpdatePost(postId: string, payload: FormData) {
  return apiRequest<PostMutationResponse>(`/admin/posts/${postId}`, {
    method: 'PATCH',
    auth: true,
    body: payload,
  });
}

export async function adminArchivePost(postId: string) {
  return apiRequest<PostMutationResponse>(`/admin/posts/${postId}/archive`, {
    method: 'PATCH',
    auth: true,
  });
}

export async function uploadAdminVideoInChunks(
  file: File,
  onProgress?: (progress: number) => void,
) {
  const totalChunks = Math.max(1, Math.ceil(file.size / ADMIN_VIDEO_CHUNK_SIZE));
  const initResponse = await apiRequest<{
    uploadId: string;
    chunkSize: number;
    totalChunks: number;
  }>('/admin/uploads/init', {
    method: 'POST',
    auth: true,
    body: JSON.stringify({
      originalName: file.name,
      totalChunks,
      totalSize: file.size,
      mimeType: file.type,
    }),
  });

  const chunkSize = initResponse.chunkSize || ADMIN_VIDEO_CHUNK_SIZE;

  for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex += 1) {
    const start = chunkIndex * chunkSize;
    const end = Math.min(start + chunkSize, file.size);
    const formData = new FormData();

    formData.append('uploadId', initResponse.uploadId);
    formData.append('chunkIndex', String(chunkIndex));
    formData.append('chunk', file.slice(start, end), `${file.name}.part-${chunkIndex}`);

    await apiRequest('/admin/uploads/chunk', {
      method: 'POST',
      auth: true,
      body: formData,
    });

    onProgress?.(Math.round(((chunkIndex + 1) / totalChunks) * 100));
  }

  const completeResponse = await apiRequest<{ url: string }>('/admin/uploads/complete', {
    method: 'POST',
    auth: true,
    body: JSON.stringify({
      uploadId: initResponse.uploadId,
      originalName: file.name,
      totalChunks,
      mimeType: file.type,
    }),
  });

  return completeResponse.url;
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

export async function getNewsPosts() {
  const data = await apiRequest<NewsListResponse>('/news', { auth: true });
  return data.items.map(normalizeNewsPostAssetUrls);
}

export async function createNewsPost(payload: {
  title: string;
  body?: string;
  image?: File | null;
  pdf?: File | null;
  resourceUrl?: string;
}) {
  const formData = new FormData();
  formData.set('title', payload.title);

  if (payload.body?.trim()) {
    formData.set('body', payload.body.trim());
  }

  if (payload.image) {
    formData.append('image', payload.image);
  }

  if (payload.pdf) {
    formData.append('pdf', payload.pdf);
  }

  if (payload.resourceUrl?.trim()) {
    formData.set('resourceUrl', payload.resourceUrl.trim());
  }

  return apiRequest<NewsPostMutationResponse>('/news', {
    method: 'POST',
    auth: true,
    body: formData,
  });
}

export async function toggleNewsLike(postId: string) {
  return apiRequest<LikeResponse>(`/news/${postId}/like`, {
    method: 'POST',
    auth: true,
  });
}

export async function createNewsComment(
  postId: string,
  payload: { content: string; parentId?: string },
) {
  return apiRequest<NewsCommentMutationResponse>(`/news/${postId}/comments`, {
    method: 'POST',
    auth: true,
    body: JSON.stringify(payload),
  });
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
  attachments?: MessageAttachment[];
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
  attachments?: MessageAttachment[];
}) {
  return sendMessage(payload);
}

export async function getPlatformStats() {
  return apiRequest<PlatformStats>('/stats', { auth: true });
}

export async function getMonthlyReport(month?: string) {
  return apiRequest<MonthlyReport>(`/reportes${buildQuery({ month })}`, { auth: true });
}

export async function registerEducationalContentView(contentId: string) {
  return apiRequest<{ success: true; contentId: string }>(`/educational-content/${contentId}/view`, {
    method: 'POST',
    auth: true,
  });
}

export async function getConversations() {
  return apiRequest<ConversationSummary[]>('/conversations', { auth: true });
}

export async function getConversationByPair(buyerId: string, supplierId: string, publicationId?: string) {
  return apiRequest<ConversationSummary | null>(
    `/conversations${buildQuery({ buyerId, supplierId, publicationId })}`,
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

export async function sendConversationMessage(
  conversationId: string,
  payload: { message: string; attachments?: MessageAttachment[] },
) {
  return apiRequest<{ id: string; conversationId: string; createdAt: string }>(
    `/conversations/${conversationId}/messages`,
    {
      method: 'POST',
      auth: true,
      body: JSON.stringify(payload),
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

export async function getExperts() {
  const data = await apiRequest<{ items: ExpertSummary[] }>('/experts', { auth: true });
  return data.items;
}

export async function getEmployabilityFeed(search?: string) {
  return apiRequest<EmployabilityFeed>(
    `/employability${buildQuery({ search })}`,
    { auth: true },
  );
}

export async function createEmployabilityJob(payload: {
  title: string;
  description: string;
  skillsRequired: string[];
  experienceRequired: string;
  location?: string;
}) {
  return apiRequest<{ job: EmployabilityJob }>('/employability/jobs', {
    method: 'POST',
    auth: true,
    body: JSON.stringify(payload),
  });
}

export async function updateEmployabilityJob(
  jobId: string,
  payload: {
    title: string;
    description: string;
    skillsRequired: string[];
    experienceRequired: string;
    location?: string;
  },
) {
  return apiRequest<{ job: EmployabilityJob }>(`/employability/jobs/${jobId}`, {
    method: 'PATCH',
    auth: true,
    body: JSON.stringify(payload),
  });
}

export async function applyToEmployabilityJob(jobId: string) {
  return apiRequest<{ success: true; applicationId: string }>(`/employability/jobs/${jobId}/apply`, {
    method: 'POST',
    auth: true,
  });
}

export async function upsertEmployabilityTalentProfile(payload: {
  description: string;
  skills: string[];
  experience: string;
  certifications?: string[];
  availability?: string;
}) {
  return apiRequest<{ talentProfile: EmployabilityTalentProfile }>('/employability/talent-profile', {
    method: 'POST',
    auth: true,
    body: JSON.stringify(payload),
  });
}

export async function getExpertProfile(id: string) {
  return apiRequest<ExpertProfile>(`/experts/${id}`, { auth: true });
}

export async function getExpertAvailability(expertId: string, date?: string) {
  return apiRequest<ExpertAvailability>(
    `/experts/${expertId}/availability${buildQuery({ date })}`,
    { auth: true },
  );
}

export async function getMyExpertAppointments() {
  return apiRequest<{ role: 'buyer' | 'expert'; items: ExpertAppointment[] }>(
    '/experts/appointments/mine',
    { auth: true },
  );
}

export async function createExpertAppointment(payload: {
  expertId: string;
  startsAt: string;
  topic: string;
}) {
  return apiRequest<{ appointment: ExpertAppointment; emailWarning?: string }>(
    '/experts/appointments',
    {
      method: 'POST',
      auth: true,
      body: JSON.stringify(payload),
    },
  );
}

export async function rescheduleExpertAppointment(
  appointmentId: string,
  payload: { startsAt: string },
) {
  return apiRequest<{ appointment: ExpertAppointment }>(
    `/experts/appointments/${appointmentId}`,
    {
      method: 'PATCH',
      auth: true,
      body: JSON.stringify(payload),
    },
  );
}

export async function cancelExpertAppointment(appointmentId: string) {
  return apiRequest<{ appointment: ExpertAppointment }>(
    `/experts/appointments/${appointmentId}`,
    {
      method: 'DELETE',
      auth: true,
    },
  );
}

export async function getMyExpertCalendarConnection() {
  return apiRequest<ExpertCalendarConnectionStatus>('/experts/me/calendar', {
    auth: true,
  });
}

export async function getMyCalendarOauthUrl(frontendPath?: string) {
  return apiRequest<{ url: string }>(
    `/experts/me/calendar/oauth-url${buildQuery({ frontendPath })}`,
    {
      auth: true,
    },
  );
}

export async function getMyExpertAvailabilitySettings() {
  return apiRequest<ExpertAvailabilitySettings>('/experts/me/availability', {
    auth: true,
  });
}

export async function updateMyExpertAvailabilitySettings(payload: {
  weeklyAvailability: Array<{
    day: string;
    enabled: boolean;
    slots: Array<{
      id: string;
      startTime: string;
      endTime: string;
    }>;
  }>;
}) {
  return apiRequest<ExpertAvailabilitySettings>('/experts/me/availability', {
    method: 'POST',
    auth: true,
    body: JSON.stringify(payload),
  });
}

export async function connectMyExpertCalendar(payload: {
  refreshToken: string;
  calendarId?: string;
  timezone?: string;
  googleEmail?: string;
}) {
  return apiRequest<ExpertCalendarConnectionStatus>(
    '/experts/me/calendar/connect',
    {
      method: 'POST',
      auth: true,
      body: JSON.stringify(payload),
    },
  );
}

export async function disconnectMyExpertCalendar() {
  return apiRequest<{ connected: false }>('/experts/me/calendar/disconnect', {
    method: 'POST',
    auth: true,
  });
}

export async function getAgents(params?: {
  category?: string;
  automationType?: string;
}) {
  const data = await apiRequest<{ items: Agent[] }>(
    `/agents${buildQuery({
      category: params?.category,
      automationType: params?.automationType,
    })}`,
    { auth: true },
  );
  return data.items;
}

export async function getAgentDetail(id: string) {
  return apiRequest<Agent>(`/agents/${id}`, { auth: true });
}

export async function activateAgent(agentId: string) {
  return apiRequest<{ agent: Agent; message: string }>('/agents/activate', {
    method: 'POST',
    auth: true,
    body: JSON.stringify({ agentId }),
  });
}

export async function runAgent(payload: {
  agentId: string;
  inputData: Record<string, unknown>;
}) {
  return apiRequest<{ execution: AgentExecution }>('/agents/run', {
    method: 'POST',
    auth: true,
    body: JSON.stringify(payload),
  });
}

export async function getMyAgentExecutions() {
  const data = await apiRequest<{ items: AgentExecution[] }>('/agents/executions/mine', {
    auth: true,
  });
  return data.items;
}

export async function runN8nComparativeWebhook(payload: {
  agentId: string;
  agentName: string;
  files: File[];
}) {
  const webhookUrl = import.meta.env.VITE_N8N_COMPARATIVE_WEBHOOK?.trim();
  const webhookToken = import.meta.env.VITE_N8N_COMPARATIVE_TOKEN?.trim();

  if (!webhookUrl) {
    throw new Error(
      'Falta configurar VITE_N8N_COMPARATIVE_WEBHOOK en el frontend para conectar el flujo de n8n.',
    );
  }

  const formData = new FormData();
  formData.append('agentId', payload.agentId);
  formData.append('agentName', payload.agentName);

  payload.files.forEach((file, index) => {
    formData.append(`file_${index + 1}`, file, file.name);
    formData.append('files', file, file.name);
  });

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      ...(webhookToken ? { 'x-n8n-token': webhookToken } : {}),
    },
    body: formData,
  });

  if (!response.ok) {
    let message = 'No se pudo ejecutar el flujo de n8n.';

    try {
      const data = (await response.json()) as { message?: string };
      if (data.message) {
        message = data.message;
      }
    } catch {
      message = response.statusText || message;
    }

    throw new Error(message);
  }

  const contentType = response.headers.get('content-type')?.toLowerCase() || '';

  if (contentType.includes('application/pdf')) {
    const blob = await response.blob();

    return {
      pdfUrl: URL.createObjectURL(blob),
      fileName: 'comparativo-cotizaciones.pdf',
    } as Record<string, unknown>;
  }

  const raw = await response.text();

  if (!raw.trim()) {
    return {};
  }

  const parsed = JSON.parse(raw) as Record<string, unknown>;
  const pdfUrl =
    typeof parsed.pdfUrl === 'string'
      ? parsed.pdfUrl
      : typeof parsed.downloadUrl === 'string'
        ? parsed.downloadUrl
        : typeof parsed.fileUrl === 'string'
          ? parsed.fileUrl
          : typeof parsed.url === 'string'
            ? parsed.url
            : undefined;

  return {
    ...parsed,
    ...(pdfUrl ? { pdfUrl } : {}),
  };
}
