import { Heart, MessageCircle, Share2, Play } from 'lucide-react';
import { Post } from '@/types';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { togglePostLike } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Badge } from '@/components/ui/badge';

interface PostCardProps {
  post: Post;
  index?: number;
}

const PostCard = ({ post, index = 0 }: PostCardProps) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuth();
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.4 }}
      onClick={() => navigate(`/post/${post.id}`)}
      className="bg-card p-6 rounded-lg shadow-smooth hover:shadow-smooth-hover transition-all cursor-pointer"
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center text-primary-foreground text-sm font-semibold">
          {initials}
        </div>
        <div className="flex-1">
          <h4 className="text-sm font-semibold text-foreground">{post.author.fullName}</h4>
          <p className="text-xs text-muted-foreground">{post.author.company} - {timeAgo}</p>
        </div>
        <Badge variant={post.type === 'educational' ? 'default' : 'secondary'} className="text-xs">
          {post.type === 'educational' ? 'Educativo' : post.category.name}
        </Badge>
      </div>

      <h3 className="text-base font-semibold mb-2 text-foreground">{post.title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed mb-4 line-clamp-2">{post.description}</p>

      {post.videoUrl && (
        <div className="bg-muted rounded-md h-44 flex items-center justify-center mb-4 relative overflow-hidden group">
          <div className="w-12 h-12 rounded-full bg-card/90 flex items-center justify-center shadow-smooth group-hover:scale-110 transition-transform">
            <Play className="w-5 h-5 text-primary ml-0.5" />
          </div>
        </div>
      )}

      <div className="flex gap-1 pt-3 border-t border-border">
        <button
          onClick={(e) => void handleLike(e)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
            liked ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:text-primary hover:bg-muted'
          }`}
        >
          <Heart className={`w-4 h-4 ${liked ? 'fill-primary' : ''}`} />
          {likeCount}
        </button>
        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-muted-foreground hover:text-primary hover:bg-muted transition-colors">
          <MessageCircle className="w-4 h-4" />
          {post.comments}
        </button>
        <button
          onClick={(e) => e.stopPropagation()}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-muted-foreground hover:text-primary hover:bg-muted transition-colors"
        >
          <Share2 className="w-4 h-4" />
          {post.shares}
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
