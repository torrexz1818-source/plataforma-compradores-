import { useState } from 'react';
import { Search, Plus } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import PostCard from '@/components/PostCard';
import CreatePostModal from '@/components/CreatePostModal';
import { getCategories, getPosts } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const COMMUNITY_ALLOWED_CATEGORY_SLUGS = new Set([
  'tips',
  'pregunta',
  'recomendacion',
  'experiencia',
]);

const CATEGORY_PILL_CLASSES: Record<string, { idle: string; active: string }> = {
  tips: {
    idle: 'bg-[#1512A8] text-white hover:bg-[#1D1AAE]',
    active: 'bg-[#1512A8] text-white shadow-[0_10px_22px_rgba(21,18,168,0.18)]',
  },
  recomendacion: {
    idle: 'bg-[#5A36D8] text-white hover:bg-[#4f2dca]',
    active: 'bg-[#5A36D8] text-white shadow-[0_10px_22px_rgba(90,54,216,0.18)]',
  },
  experiencia: {
    idle: 'bg-[#F72A3A] text-white hover:bg-[#de2130]',
    active: 'bg-[#F72A3A] text-white shadow-[0_10px_22px_rgba(247,42,58,0.18)]',
  },
  pregunta: {
    idle: 'bg-[#A7E13F] text-[#0F172A] hover:bg-[#C3E971]',
    active: 'bg-[#A7E13F] text-[#0F172A] shadow-[0_10px_22px_rgba(167,225,63,0.22)]',
  },
};

const Community = () => {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const queryClient = useQueryClient();

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: getCategories,
  });

  const { data: posts = [], isLoading, isError } = useQuery({
    queryKey: ['community-posts', search, activeCategory],
    queryFn: () =>
      getPosts({
        type: 'community',
        search: search || undefined,
        categoryId: activeCategory || undefined,
      }),
  });
  const communityCategories = categories.filter((category) =>
    COMMUNITY_ALLOWED_CATEGORY_SLUGS.has(category.slug),
  );
  const buyerPosts = posts.filter(
    (post) =>
      post.author.role === 'buyer' &&
      COMMUNITY_ALLOWED_CATEGORY_SLUGS.has(post.category.slug),
  );

  return (
    <div className="mx-auto w-full max-w-5xl px-3 py-5 sm:px-6 sm:py-8">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="hero-brand relative mb-8 overflow-hidden rounded-[28px] p-5 shadow-[var(--shadow-purple)] sm:p-8"
        style={{
          background: 'var(--gradient-brand)',
        }}
      >
        <div className="pointer-events-none absolute -right-12 -top-14 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute right-24 bottom-[-42px] h-32 w-32 rounded-full bg-secondary/10 blur-2xl" />
        <div className="hero-radial-light pointer-events-none absolute inset-y-0 right-0 w-[42%]" />

        <div className="relative flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="mb-4 inline-flex items-center rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-white/85">
              Comunidad de compradores
            </div>
            <h1 className="mb-3 text-3xl font-bold tracking-tight text-primary-foreground lg:text-4xl">
              Ecosistema B2B
            </h1>
            <p className="max-w-xl text-base leading-7 text-primary-foreground/85 lg:text-lg">
              Espacio exclusivo para compradores donde comparten experiencias, hacen preguntas y aprenden de sus pares.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row lg:flex-col lg:min-w-[240px]">
            <Button
              className="h-11 rounded-xl border border-[#E6EAF2] bg-white text-[#1D1AAE] font-medium shadow-sm hover:bg-[rgba(29,26,174,0.06)] hover:text-[#1512A8]"
              onClick={() => setShowCreateModal(true)}
            >
              <Plus className="w-4 h-4 mr-1" /> Nuevo Post
            </Button>
          </div>
        </div>
      </motion.div>

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#1D1AAE]" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar en la comunidad..."
            className="border-0 bg-white pl-10 text-[#0F172A] shadow-[var(--shadow-soft)] placeholder:text-[#61708F] focus-visible:ring-2 focus-visible:ring-[#5A36D8]/20"
          />
        </div>
      </div>

      <div className="flex gap-2 mb-6 flex-wrap">
        <button
          onClick={() => setActiveCategory(null)}
          className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
            !activeCategory ? 'bg-[#1512A8] text-white shadow-[0_10px_22px_rgba(21,18,168,0.14)]' : 'bg-[#1512A8]/10 text-[#1512A8] hover:bg-[#1512A8]/16'
          }`}
        >
          Todos
        </button>
        {communityCategories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
              activeCategory === cat.id
                ? CATEGORY_PILL_CLASSES[cat.slug]?.active ?? 'bg-[#1512A8] text-white shadow-[0_10px_22px_rgba(21,18,168,0.14)]'
                : CATEGORY_PILL_CLASSES[cat.slug]?.idle ?? 'bg-[#1512A8]/10 text-[#1512A8] hover:bg-[#1512A8]/16'
            }`}
          >
            {cat.name}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {isLoading && <p className="text-muted-foreground text-sm text-center py-12">Cargando posts...</p>}
        {isError && <p className="text-destructive text-sm text-center py-12">No se pudo cargar la comunidad.</p>}
        {buyerPosts.map((post, i) => (
          <PostCard key={post.id} post={post} index={i} />
        ))}
        {!isLoading && !isError && buyerPosts.length === 0 && (
          <p className="text-muted-foreground text-sm text-center py-12">No se encontraron posts.</p>
        )}
      </div>

      <CreatePostModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        categories={communityCategories}
        onCreated={() => {
          void queryClient.invalidateQueries({ queryKey: ['community-posts'] });
        }}
      />
    </div>
  );
};

export default Community;
