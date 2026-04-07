import { Search, Play } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import PostCard from '@/components/PostCard';
import { getHomeFeed } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { useHighlight } from '@/hooks/useHighlight';

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
    <div className="max-w-5xl mx-auto px-6 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Contenido educativo</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Recursos y guias para optimizar tus compras y relaciones con proveedores
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
        <h2 className="text-lg font-semibold text-foreground mb-4">Guias y articulos</h2>
        <div className="space-y-4">
          {isLoading && <p className="text-muted-foreground text-sm">Cargando contenido...</p>}
          {isError && <p className="text-destructive text-sm">No se pudo cargar el contenido.</p>}
          {filteredPosts.map((post, index) => (
            <div key={post.id} id={`item-${post.id}`}>
              <PostCard post={post} index={index} />
            </div>
          ))}
          {!isLoading && !isError && filteredPosts.length === 0 && (
            <p className="text-muted-foreground text-sm text-center py-8">No se encontraron resultados.</p>
          )}
        </div>
      </div>

      <div id="continue-watching">
        <h2 className="text-lg font-semibold text-foreground mb-4">Continuar viendo</h2>
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
                <h3 className="text-sm font-semibold text-foreground mb-1 line-clamp-1">{lesson.title}</h3>
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
