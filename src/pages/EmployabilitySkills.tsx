import { ArrowRight, ExternalLink, FileText, Image as ImageIcon, Link2, Play, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { getCategories, getPosts, resolveApiAssetUrl } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Post, PostResource } from '@/types';

const SKILL_CATEGORY_SLUG = 'mejorar-skill';

const formatPostDate = (date: string) =>
  new Date(date).toLocaleDateString('es-PE', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

function getResourceLabel(resource: PostResource) {
  if (resource.type === 'link') return 'URL externa';
  if (resource.type === 'image') return 'Imagen';
  return 'Archivo';
}

const SkillContentCard = ({ post }: { post: Post }) => {
  const navigate = useNavigate();
  const primaryResource = post.resources?.[0];
  const hasThumbnail = Boolean(post.thumbnailUrl);
  const isVideo = post.mediaType === 'video' || Boolean(post.videoUrl);

  return (
    <Card className="group h-full overflow-hidden rounded-[26px] border-primary/10 bg-white shadow-[var(--shadow-card)] transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-elevated)]">
      <CardContent className="flex h-full flex-col p-0">
        <div className="relative aspect-[16/10] overflow-hidden bg-primary/5">
          {hasThumbnail ? (
            <img
              src={resolveApiAssetUrl(post.thumbnailUrl)}
              alt={post.title}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-end bg-[var(--gradient-brand)] p-5 text-white">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/80">
                  Mejorar skill
                </p>
                <p className="mt-2 line-clamp-3 text-base font-bold leading-tight text-white">
                  {post.title}
                </p>
              </div>
            </div>
          )}
          {hasThumbnail && <div className="absolute inset-0 bg-gradient-to-t from-primary/55 via-primary/10 to-transparent" />}
          <Badge className="absolute left-4 top-4 rounded-full bg-white text-primary shadow-sm hover:bg-white">
            {isVideo ? 'Video' : primaryResource ? getResourceLabel(primaryResource) : 'Articulo'}
          </Badge>
          {isVideo && (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/95 shadow-[var(--shadow-card)]">
                <Play className="ml-0.5 h-5 w-5 text-primary" />
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-1 flex-col p-5">
          <h2 className="text-xl font-bold leading-snug text-foreground">{post.title}</h2>
          <p className="mt-3 line-clamp-3 text-sm leading-6 text-muted-foreground">{post.description}</p>

          {post.resources && post.resources.length > 0 && (
            <div className="mt-4 space-y-2">
              {post.resources.slice(0, 2).map((resource) => (
                <a
                  key={resource.id}
                  href={resolveApiAssetUrl(resource.url)}
                  target="_blank"
                  rel="noreferrer"
                  className="flex min-w-0 items-center gap-2 rounded-xl bg-primary/5 px-3 py-2 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
                >
                  {resource.type === 'link' ? <Link2 className="h-3.5 w-3.5 shrink-0" /> : null}
                  {resource.type === 'image' ? <ImageIcon className="h-3.5 w-3.5 shrink-0" /> : null}
                  {resource.type === 'file' ? <FileText className="h-3.5 w-3.5 shrink-0" /> : null}
                  <span className="truncate">{resource.name}</span>
                  <ExternalLink className="ml-auto h-3.5 w-3.5 shrink-0" />
                </a>
              ))}
            </div>
          )}

          <div className="mt-auto flex flex-col gap-3 pt-5">
            <p className="text-xs text-muted-foreground">{formatPostDate(post.createdAt)}</p>
            <Button
              type="button"
              className="rounded-2xl bg-secondary/15 text-secondary hover:bg-secondary/20"
              onClick={() => navigate(`/post/${post.id}`)}
            >
              Ver contenido
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const EmployabilitySkills = () => {
  const [search, setSearch] = useState('');

  const categoriesQuery = useQuery({
    queryKey: ['post-categories'],
    queryFn: getCategories,
  });

  const skillCategory = useMemo(
    () => categoriesQuery.data?.find((category) => category.slug === SKILL_CATEGORY_SLUG) ?? null,
    [categoriesQuery.data],
  );

  const postsQuery = useQuery({
    queryKey: ['employability-skill-posts', skillCategory?.id],
    queryFn: () => getPosts({ type: 'educational', categoryId: skillCategory?.id }),
    enabled: Boolean(skillCategory?.id),
  });

  const filteredPosts = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    const posts = postsQuery.data ?? [];

    if (!normalizedSearch) {
      return posts;
    }

    return posts.filter(
      (post) =>
        post.title.toLowerCase().includes(normalizedSearch) ||
        post.description.toLowerCase().includes(normalizedSearch),
    );
  }, [postsQuery.data, search]);

  const isLoading = categoriesQuery.isLoading || postsQuery.isLoading;
  const isError = categoriesQuery.isError || postsQuery.isError;

  return (
    <div className="mx-auto w-full max-w-7xl space-y-8 px-3 py-5 sm:px-6 sm:py-8 2xl:max-w-[1440px]">
      <section className="overflow-hidden rounded-[30px] bg-[linear-gradient(110deg,#1f20b7_0%,#3620b6_50%,#6235de_100%)] px-5 py-6 text-white shadow-[0_18px_44px_rgba(14,16,158,0.16)] sm:px-10 sm:py-9">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <span className="inline-flex rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/95">
              Empleabilidad
            </span>
            <h1 className="mt-5 text-3xl font-bold leading-tight text-white sm:text-[3.1rem] sm:leading-[1.04]">
              Mejorar skill
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-white/88 sm:text-[1.05rem]">
              Explora contenidos seleccionados para fortalecer tus competencias y oportunidades profesionales.
            </p>
          </div>
          <Link
            to="/empleabilidad"
            className="inline-flex min-h-10 w-full items-center justify-center rounded-[18px] bg-white px-6 py-3 text-sm font-medium text-[#1f20b7] shadow-sm transition-transform hover:-translate-y-0.5 sm:w-auto"
          >
            Volver a Empleabilidad
          </Link>
        </div>
      </section>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar contenido por titulo o descripcion"
          className="h-11 rounded-2xl border-primary/15 bg-primary/5 pl-10"
        />
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Cargando contenidos...</p>}
      {isError && <p className="text-sm text-destructive">No se pudo cargar el contenido de Mejorar skill.</p>}

      {!isLoading && !isError && (
        <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {filteredPosts.map((post) => (
            <SkillContentCard key={post.id} post={post} />
          ))}
          {filteredPosts.length === 0 && (
            <Card className="rounded-3xl border-dashed border-primary/25 sm:col-span-2 xl:col-span-3 2xl:col-span-4">
              <CardContent className="p-10 text-center text-sm text-muted-foreground">
                Todavía no hay contenidos disponibles para mejorar skills.
              </CardContent>
            </Card>
          )}
        </section>
      )}
    </div>
  );
};

export default EmployabilitySkills;
