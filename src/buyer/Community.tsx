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
    <div className="max-w-5xl mx-auto px-6 py-8">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="mb-6 rounded-3xl border border-secondary/15 bg-[var(--gradient-soft)] px-6 py-6 shadow-sm">
        <h1 className="mb-1 text-2xl font-bold text-primary">Comunidad B2B</h1>
        <p className="text-sm text-muted-foreground">
          Espacio exclusivo para compradores comparte, pregunta y aprende de tus pares.
        </p>
      </motion.div>

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar en la comunidad..."
            className="pl-10"
          />
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="w-4 h-4 mr-1" /> Nuevo Post
        </Button>
      </div>

      <div className="flex gap-2 mb-6 flex-wrap">
        <button
          onClick={() => setActiveCategory(null)}
          className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
            !activeCategory ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'
          }`}
        >
          Todos
        </button>
        {communityCategories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              activeCategory === cat.id
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:text-foreground'
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
