import { Search, Play } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { getHomeFeed, resolveApiAssetUrl } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { useHighlight } from '@/hooks/useHighlight';
import { Post } from '@/types';

interface EducationalPostCardProps {
  post: Post;
  index: number;
  onOpen: () => void;
}

const formatPostDate = (date: string) =>
  new Date(date).toLocaleDateString('es-PE', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

const EducationalPostCard = ({ post, index, onOpen }: EducationalPostCardProps) => {
  const hasMedia = Boolean(post.thumbnailUrl);

  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.35 }}
      onClick={onOpen}
      className="group flex h-full cursor-pointer flex-col overflow-hidden rounded-2xl border border-border/80 bg-card shadow-smooth transition-all hover:-translate-y-1 hover:border-primary/30 hover:shadow-smooth-hover"
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-muted">
        {hasMedia ? (
          <img
            src={resolveApiAssetUrl(post.thumbnailUrl)}
            alt={post.title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-end bg-[var(--gradient-brand)] px-5 py-5 text-left">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-white/80">
                Contenido educativo
              </p>
              <p className="mt-2 line-clamp-3 text-base font-medium leading-tight text-white">
                {post.title}
              </p>
            </div>
          </div>
        )}

        {hasMedia && <div className="absolute inset-0 bg-gradient-to-t from-primary/55 via-primary/10 to-transparent" />}
        <div className="absolute left-4 top-4 rounded-full bg-primary px-3 py-1 text-[11px] font-medium text-primary-foreground shadow-sm">
          {post.mediaType === 'video' || post.videoUrl ? 'Video' : 'Articulo'}
        </div>
        {(post.mediaType === 'video' || post.videoUrl) && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/95 shadow-smooth transition-transform group-hover:scale-110">
              <Play className="ml-0.5 h-5 w-5 text-primary" />
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col p-5">
        <h3 className="line-clamp-3 text-xl font-medium leading-snug text-foreground">
          {post.title}
        </h3>
        <p className="mt-3 line-clamp-2 text-sm leading-6 text-muted-foreground">
          {post.description}
        </p>
        <div className="mt-auto pt-6">
          <p className="text-sm text-muted-foreground">{formatPostDate(post.createdAt)}</p>
        </div>
      </div>
    </motion.article>
  );
};

const EducationalContent = () => {
  const [search, setSearch] = useState('');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const highlightedId = searchParams.get('highlight');
  useHighlight(highlightedId);
  const { data, isLoading, isError } = useQuery({
    queryKey: ['home-feed'],
    queryFn: getHomeFeed,
  });

  const educationalPosts = data?.educationalPosts ?? [];
  const continueWatching = data?.continueWatching ?? [];
  const filteredPosts = useMemo(
    () =>
      educationalPosts.filter(
        (post) =>
          post.title.toLowerCase().includes(search.toLowerCase()) ||
          post.description.toLowerCase().includes(search.toLowerCase()),
      ),
    [educationalPosts, search],
  );

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <div className="mb-8 rounded-3xl border border-secondary/15 bg-[var(--gradient-soft)] px-6 py-6 shadow-sm">
        <h1 className="text-2xl font-bold text-primary">Contenido educativo</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Educación especializada en compras: tips, guías, casos reales y tecnología aplicada para una formación continua y estratégica.
        </p>
      </div>

      <div className="relative mb-8">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Busca tu clase o contenido"
          className="pl-10"
        />
      </div>

      <div className="mb-10">
        <h2 className="text-lg font-medium text-foreground mb-4">Videos y articulos</h2>
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
          {isLoading && <p className="text-muted-foreground text-sm">Cargando contenido...</p>}
          {isError && <p className="text-destructive text-sm">No se pudo cargar el contenido.</p>}
          {filteredPosts.map((post, index) => (
            <div key={post.id} id={`item-${post.id}`}>
              <EducationalPostCard
                post={post}
                index={index}
                onOpen={() => navigate(`/post/${post.id}`)}
              />
            </div>
          ))}
          {!isLoading && !isError && filteredPosts.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground sm:col-span-2 xl:col-span-4">
              No se encontraron resultados.
            </p>
          )}
        </div>
      </div>

      <div id="continue-watching">
        <h2 className="text-lg font-medium text-foreground mb-4">Continuar viendo</h2>
        <div className="grid md:grid-cols-3 gap-4">
          {continueWatching.map((lesson, index) => (
            <motion.div
              key={lesson.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              onClick={() => navigate(`/post/${lesson.postId}`)}
              className="bg-card rounded-lg shadow-smooth overflow-hidden hover:shadow-smooth-hover transition-shadow cursor-pointer"
            >
              <div className="bg-muted h-28 flex items-center justify-center">
                <div className="w-10 h-10 rounded-full bg-card/90 flex items-center justify-center shadow-smooth">
                  <Play className="w-4 h-4 text-primary ml-0.5" />
                </div>
              </div>
              <div className="p-4">
                <h3 className="text-sm font-medium text-foreground mb-1 line-clamp-1">{lesson.title}</h3>
                <p className="text-xs text-muted-foreground mb-3">{lesson.duration}</p>
                <div className="flex items-center gap-2">
                  <Progress value={lesson.progress} className="h-1.5 flex-1" />
                  <span className="text-xs font-medium text-muted-foreground">{lesson.progress}%</span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default EducationalContent;
