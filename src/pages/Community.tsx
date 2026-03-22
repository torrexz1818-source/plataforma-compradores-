import { useState } from 'react';
import { Search, Plus } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import MainLayout from '@/layouts/MainLayout';
import PostCard from '@/components/PostCard';
import CreatePostModal from '@/components/CreatePostModal';
import { getCategories, getPosts } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

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

  return (
    <MainLayout>
      <div className="max-w-5xl mx-auto px-6 py-8">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <h1 className="text-2xl font-bold text-foreground mb-1">Comunidad de Compradores</h1>
          <p className="text-muted-foreground text-sm mb-6">Comparte experiencias y encuentra recomendaciones.</p>
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
          {categories.map((cat) => (
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
          {posts.map((post, i) => (
            <PostCard key={post.id} post={post} index={i} />
          ))}
          {!isLoading && !isError && posts.length === 0 && (
            <p className="text-muted-foreground text-sm text-center py-12">No se encontraron posts.</p>
          )}
        </div>

        <CreatePostModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          categories={categories}
          onCreated={() => {
            void queryClient.invalidateQueries({ queryKey: ['community-posts'] });
          }}
        />
      </div>
    </MainLayout>
  );
};

export default Community;
