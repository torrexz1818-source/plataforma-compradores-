import { Heart, Image as ImageIcon, MessageCircle, Play } from 'lucide-react';
import { Post } from '@/types';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { resolveApiAssetUrl, togglePostLike } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Badge } from '@/components/ui/badge';

interface PostCardProps {
  post: Post;
  index?: number;
}

function getCategoryStyles(slug?: string) {
  if (slug === 'experiencia') return 'border border-[#F72A3A]/20 bg-[#F72A3A]/12 text-[#D91F2E] hover:bg-[#F72A3A]/18';
  if (slug === 'pregunta') return 'border border-[#A7E13F]/35 bg-[#A7E13F]/22 text-[#0E109E] hover:bg-[#A7E13F]/30';
  if (slug === 'tips') return 'border border-[#1512A8]/20 bg-[#1512A8]/12 text-[#1512A8] hover:bg-[#1512A8]/18';
  return 'border border-[#5A36D8]/20 bg-[#5A36D8]/12 text-[#4B2BC7] hover:bg-[#5A36D8]/18';
}

const PostCard = ({ post, index = 0 }: PostCardProps) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuth();
  const isEducational = post.type === 'educational';
  const isCommunity = post.type === 'community';
  const educationalBadgeLabel = post.mediaType === 'video' || post.videoUrl ? 'Video' : 'Articulo';
  const [liked, setLiked] = useState(post.isLiked);
  const [likeCount, setLikeCount] = useState(post.likes);

  const likeMutation = useMutation({
    mutationFn: () => togglePostLike(post.id),
    onSuccess: (result) => {
      setLiked(result.liked);
      setLikeCount(result.likes);
      void queryClient.invalidateQueries({ queryKey: ['home-feed'] });
      void queryClient.invalidateQueries({ queryKey: ['community-posts'] });
      void queryClient.invalidateQueries({ queryKey: ['post-detail', post.id] });
      void queryClient.invalidateQueries({ queryKey: ['community-post-detail', post.id] });
    },
  });

  useEffect(() => {
    setLiked(post.isLiked);
    setLikeCount(post.likes);
  }, [post.isLiked, post.likes]);

  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();

    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    await likeMutation.mutateAsync();
  };

  const initials = post.author.fullName.split(' ').map((n) => n[0]).join('').slice(0, 2);
  const timeAgo = getTimeAgo(post.createdAt);
  const createdAtLabel = new Date(post.createdAt).toLocaleString('es-PE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  const openAuthorProfile = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/perfil/${post.author.role}/${post.author.id}`);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.4 }}
      onClick={() =>
        navigate(isCommunity ? `/community/post/${post.id}` : `/post/${post.id}`, {
          state: isCommunity ? { post } : undefined,
        })
      }
      className={`cursor-pointer overflow-hidden rounded-2xl border-0 bg-card shadow-smooth transition-all hover:shadow-smooth-hover ${
        isEducational ? 'hover:-translate-y-0.5' : ''
      }`}
    >
      {isEducational ? (
        <div className="mb-1 flex items-start justify-between gap-3 p-6">
          <div className="min-w-0">
            <h3 className="line-clamp-2 text-2xl font-bold leading-tight text-foreground">{post.title}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{timeAgo}</p>
          </div>
          <Badge variant="default" className="shrink-0 rounded-full px-3 py-1 text-xs">
            {educationalBadgeLabel}
          </Badge>
        </div>
      ) : (
        <div className="relative p-5 pb-4">
          <Badge className={`absolute right-5 top-5 rounded-full px-3 py-1 text-[11px] ${getCategoryStyles(post.category.slug)}`}>
            {post.category.name}
          </Badge>
          <div className="mb-4 flex items-start gap-3">
            <button
              type="button"
              onClick={openAuthorProfile}
              className="flex h-11 w-11 items-center justify-center rounded-full gradient-primary text-sm font-medium text-primary-foreground shadow-sm"
              aria-label={`Ver perfil de ${post.author.fullName}`}
            >
              {initials}
            </button>
            <button type="button" onClick={openAuthorProfile} className="min-w-0 flex-1 text-left">
              <div className="flex flex-wrap items-center gap-2 pr-20">
                <h4 className="text-sm font-medium text-foreground transition-colors hover:text-primary">
                  {post.author.fullName}
                </h4>
              </div>
              <p className="truncate text-xs text-muted-foreground">{post.author.company}</p>
              <p className="text-xs text-muted-foreground">{timeAgo} - {createdAtLabel}</p>
            </button>
          </div>

          <div className="space-y-3">
            <h3 className="text-lg font-medium leading-snug text-foreground">{post.title}</h3>
            <p className="whitespace-pre-wrap break-words text-sm leading-7 text-foreground/85">
              {post.description}
            </p>
          </div>
        </div>
      )}

      {isEducational && (
        <div className="px-6">
          <p className="mb-4 line-clamp-3 text-sm leading-relaxed text-muted-foreground">{post.description}</p>
        </div>
      )}

      {(post.videoUrl || post.thumbnailUrl) && (
        <div
          className={`group relative flex items-center justify-center overflow-hidden bg-muted ${
            isEducational ? 'mx-6 mb-4 h-56 rounded-xl ring-1 ring-border/50' : 'h-72 sm:h-80'
          }`}
        >
          {post.thumbnailUrl ? (
            <>
              <img src={resolveApiAssetUrl(post.thumbnailUrl)} alt={post.title} className="absolute inset-0 h-full w-full object-cover" />
              {isEducational && <div className="absolute inset-0 bg-gradient-to-t from-primary/45 via-primary/10 to-transparent" />}
            </>
          ) : null}
          <div
            className={`relative z-10 flex items-center justify-center rounded-full bg-card/90 shadow-smooth transition-transform group-hover:scale-110 ${
              isEducational ? 'h-14 w-14 backdrop-blur-sm' : 'h-12 w-12'
            }`}
          >
            {post.mediaType === 'image' && !post.videoUrl ? (
              <ImageIcon className="h-5 w-5 text-primary" />
            ) : (
              <Play className="ml-0.5 h-5 w-5 text-primary" />
            )}
          </div>
          {isEducational && (
            <div className="absolute bottom-4 left-4 right-4 z-10">
              <p className="mb-1 text-xs uppercase tracking-[0.16em] text-white/90">Ver contenido</p>
              <p className="line-clamp-1 text-base font-medium text-white">{post.title}</p>
            </div>
          )}
        </div>
      )}

      {isCommunity && (
        <div className="px-5 py-3 text-xs text-muted-foreground">
          <div className="flex items-center justify-between gap-3">
            <span>{likeCount.toLocaleString()} Me gusta</span>
            <span>{post.comments.toLocaleString()} comentarios</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-1 p-2">
        <button
          onClick={(e) => void handleLike(e)}
          className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
            liked ? 'bg-[rgba(247,42,58,0.10)] text-[#F72A3A]' : 'text-[#61708F] hover:bg-[rgba(247,42,58,0.14)] hover:text-[#F72A3A]'
          }`}
        >
          <Heart className={`h-4 w-4 text-[#F72A3A] ${liked ? 'fill-[#F72A3A]' : ''}`} />
          Me gusta
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (isCommunity) {
              navigate(`/community/post/${post.id}#community-comments`, {
                state: { post },
              });
              return;
            }
            navigate(`/post/${post.id}`);
          }}
          className="flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-[#1D1AAE] transition-colors hover:bg-[rgba(29,26,174,0.06)] hover:text-[#1512A8]"
        >
          <MessageCircle className="h-4 w-4" />
          Comentar
        </button>
      </div>
    </motion.div>
  );
};

function getTimeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Hoy';
  if (diffDays === 1) return 'Ayer';
  if (diffDays < 7) return `Hace ${diffDays} dias`;
  return `Hace ${Math.floor(diffDays / 7)} semanas`;
}

export default PostCard;
