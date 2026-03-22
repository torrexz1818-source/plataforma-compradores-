import {
  AdminDashboardData,
  AuthResponse,
  Comment,
  HomeFeed,
  Post,
  PostCategory,
  PostDetailData,
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