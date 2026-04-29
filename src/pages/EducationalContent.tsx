import { Play, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { getHomeFeed, getPosts, resolveApiAssetUrl } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { useHighlight } from '@/hooks/useHighlight';
import { Post } from '@/types';
import {
  LEARNING_ROUTES,
  LearningRouteId,
  normalizeLearningRouteId,
} from '@/lib/learningRoutes';

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

const resolvePostLearningRoute = (post: Post) => normalizeLearningRouteId(post.learningRoute);

interface LearningRoutesSectionProps {
  activeRouteId: LearningRouteId | null;
  countsByRoute: Record<LearningRouteId, number>;
  firstPostByRoute: Partial<Record<LearningRouteId, Post>>;
  onSelectRoute: (routeId: LearningRouteId) => void;
}

const LearningRoutesSection = ({
  activeRouteId,
  countsByRoute,
  firstPostByRoute,
  onSelectRoute,
}: LearningRoutesSectionProps) => (
  <section className="mb-10">
    <div className="mb-5">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/70">
        Rutas tematicas
      </p>
      <h2 className="mt-1 text-2xl font-bold text-primary">Rutas tematicas de aprendizaje</h2>
    </div>

    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
      {LEARNING_ROUTES.map((route, index) => {
        const firstPost = firstPostByRoute[route.id];

        return (
          <motion.article
            key={route.id}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.07, duration: 0.35 }}
            onClick={() => onSelectRoute(route.id)}
            role="button"
            tabIndex={0}
            aria-label={`Ver videos de ${route.title}`}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onSelectRoute(route.id);
              }
            }}
            className={`group flex min-h-[280px] cursor-pointer flex-col rounded-3xl p-6 text-white shadow-[0_16px_34px_rgba(14,16,158,0.12)] transition-transform duration-200 hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 ${
              activeRouteId === route.id ? 'ring-4 ring-primary/20' : ''
            }`}
            style={{ backgroundColor: route.color }}
          >
            <div className="mb-6">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/80">
                {route.label}
              </p>
            </div>

            <h3 className="text-xl font-bold leading-tight text-white">{route.title}</h3>
            <p className="mt-4 text-sm leading-6 text-white/85">{route.description}</p>

            <div className="mt-auto pt-7">
              <span className="inline-flex rounded-full border border-white/35 bg-white/85 px-4 py-2 text-sm font-bold text-[#0E109E] shadow-[0_8px_18px_rgba(14,16,158,0.14)] transition-colors group-hover:bg-white group-active:bg-white/75">
                {countsByRoute[route.id]} {countsByRoute[route.id] === 1 ? 'contenido' : 'contenidos'}
              </span>
              {firstPost && (
                <p className="mt-3 line-clamp-2 text-xs font-medium leading-5 text-white/88">
                  Ultimo video: {firstPost.title}
                </p>
              )}
            </div>
          </motion.article>
        );
      })}
    </div>
  </section>
);

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
        <div className="absolute left-4 top-4 rounded-full border border-[#0E109E]/18 bg-[#0E109E]/14 px-3 py-1 text-[11px] font-medium text-[#0E109E] shadow-[0_8px_18px_rgba(14,16,158,0.08)] backdrop-blur-sm">
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
  const [searchParams, setSearchParams] = useSearchParams();
  const highlightedId = searchParams.get('highlight');
  const routeParam = searchParams.get('route');
  const activeRouteId = normalizeLearningRouteId(routeParam ?? undefined) ?? null;
  useHighlight(highlightedId);
  const homeFeedQuery = useQuery({
    queryKey: ['home-feed'],
    queryFn: getHomeFeed,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });
  const educationalPostsQuery = useQuery({
    queryKey: ['educational-posts'],
    queryFn: () => getPosts({ type: 'educational' }),
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });

  const educationalPosts = useMemo(() => {
    const directPosts = educationalPostsQuery.data ?? [];
    return directPosts.length ? directPosts : homeFeedQuery.data?.educationalPosts ?? [];
  }, [educationalPostsQuery.data, homeFeedQuery.data?.educationalPosts]);
  const continueWatching = useMemo(() => homeFeedQuery.data?.continueWatching ?? [], [homeFeedQuery.data?.continueWatching]);
  const isLoading = homeFeedQuery.isLoading || educationalPostsQuery.isLoading;
  const isError = homeFeedQuery.isError && educationalPostsQuery.isError;
  const countsByRoute = useMemo(
    () =>
      LEARNING_ROUTES.reduce(
        (acc, route) => ({
          ...acc,
          [route.id]: educationalPosts.filter((post) => resolvePostLearningRoute(post) === route.id).length,
        }),
        {} as Record<LearningRouteId, number>,
      ),
    [educationalPosts],
  );
  const firstPostByRoute = useMemo(
    () =>
      LEARNING_ROUTES.reduce((acc, route) => {
        const firstPost = educationalPosts.find((post) => resolvePostLearningRoute(post) === route.id);
        return {
          ...acc,
          ...(firstPost ? { [route.id]: firstPost } : {}),
        };
      }, {} as Partial<Record<LearningRouteId, Post>>),
    [educationalPosts],
  );
  const filteredPosts = useMemo(
    () =>
      educationalPosts.filter(
        (post) =>
          (!activeRouteId || resolvePostLearningRoute(post) === activeRouteId) &&
          (post.title.toLowerCase().includes(search.toLowerCase()) ||
            post.description.toLowerCase().includes(search.toLowerCase())),
      ),
    [activeRouteId, educationalPosts, search],
  );
  const activeRoute = LEARNING_ROUTES.find((route) => route.id === activeRouteId) ?? null;

  const selectLearningRoute = (routeId: LearningRouteId) => {
    setSearch('');
    void homeFeedQuery.refetch();
    void educationalPostsQuery.refetch();
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('route', routeId);
    nextParams.delete('highlight');
    setSearchParams(nextParams);
    window.requestAnimationFrame(() => {
      document.getElementById('educational-content-list')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    });
  };

  const clearLearningRoute = () => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('route');
    setSearchParams(nextParams);
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-3 py-5 sm:px-6 sm:py-8 2xl:max-w-[1440px]">
      <div className="mb-8 overflow-hidden rounded-[30px] bg-[linear-gradient(110deg,#1f20b7_0%,#3620b6_50%,#6235de_100%)] px-5 py-6 text-white shadow-[0_18px_44px_rgba(14,16,158,0.16)] sm:px-10 sm:py-9">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <span className="inline-flex rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/95 shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]">
              Formacion y aprendizaje
            </span>
            <h1 className="mt-5 text-3xl font-bold leading-tight text-white sm:text-[3.1rem] sm:leading-[1.04]">
              Contenido Educativo
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-white/88 sm:text-[1.05rem]">
              Accede a recursos, materiales y contenidos especializados para fortalecer tus capacidades en compras.
            </p>
          </div>

          <button
            type="button"
            onClick={() => document.getElementById('educational-content-list')?.scrollIntoView({ behavior: 'smooth' })}
            className="inline-flex min-h-10 w-full items-center justify-center rounded-[18px] bg-white px-8 py-3 text-base font-medium text-[#1f20b7] shadow-sm transition-transform hover:-translate-y-0.5 sm:w-[240px]"
          >
            Explorar contenido
          </button>
        </div>
      </div>

      <LearningRoutesSection
        activeRouteId={activeRouteId}
        countsByRoute={countsByRoute}
        firstPostByRoute={firstPostByRoute}
        onSelectRoute={selectLearningRoute}
      />

      <div className="relative mb-8">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Busca tu clase o contenido"
          className="pl-10"
        />
      </div>

      <div id="educational-content-list" className="mb-10 scroll-mt-6">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-medium text-foreground">
              {activeRoute ? activeRoute.title : 'Videos y articulos'}
            </h2>
            {activeRoute && (
              <p className="mt-1 text-sm text-muted-foreground">
                Mostrando videos y contenidos relacionados con {activeRoute.title.toLowerCase()}.
              </p>
            )}
          </div>
          {activeRoute && (
            <button
              type="button"
              onClick={clearLearningRoute}
              className="w-fit rounded-full bg-muted px-4 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
            >
              Ver todos
            </button>
          )}
        </div>
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
              {activeRoute
                ? 'Todavia no hay videos asociados a esta ruta.'
                : 'No se encontraron resultados.'}
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
