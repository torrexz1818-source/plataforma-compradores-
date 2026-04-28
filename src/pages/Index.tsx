import { Search, ArrowRight, Play } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import MainLayout from '@/layouts/MainLayout';
import PostCard from '@/components/PostCard';
import { getHomeFeed } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';

const Index = () => {
  const [search, setSearch] = useState('');
  const navigate = useNavigate();
  const { data, isLoading, isError } = useQuery({
    queryKey: ['home-feed'],
    queryFn: getHomeFeed,
  });

  const educationalPosts = data?.educationalPosts ?? [];
  const continueWatching = data?.continueWatching ?? [];
  const filteredPosts = educationalPosts.filter(
    (p) =>
      p.title.toLowerCase().includes(search.toLowerCase()) ||
      p.description.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <MainLayout>
      <div className="max-w-5xl mx-auto px-6 py-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="gradient-primary rounded-lg p-8 mb-8"
        >
          <h1 className="text-3xl font-bold text-primary-foreground mb-2">BUYER NODUS</h1>
          <p className="text-primary-foreground/80 text-base max-w-xl mb-6">
            La plataforma donde compradores y proveedores B2B aprenden, comparten experiencias y generan oportunidades.
          </p>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => navigate('/community')} className="font-medium">
              Comunidad <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
            <Button
              variant="outline"
              className="bg-primary-foreground/10 text-primary-foreground border-primary-foreground/20 hover:bg-primary-foreground/20"
              onClick={() => document.getElementById('continue-watching')?.scrollIntoView({ behavior: 'smooth' })}
            >
              <Play className="w-4 h-4 mr-1" /> Continuar viendo
            </Button>
          </div>
        </motion.div>

        <div className="relative mb-8">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Busca tu clase o contenido"
            className="pl-10"
          />
        </div>

        <div className="mb-10">
          <h2 className="text-lg font-medium text-foreground mb-4">Contenido Educativo</h2>
          <div className="space-y-4">
            {isLoading && <p className="text-muted-foreground text-sm">Cargando contenido...</p>}
            {isError && <p className="text-destructive text-sm">No se pudo cargar el contenido.</p>}
            {filteredPosts.map((post, i) => (
              <PostCard key={post.id} post={post} index={i} />
            ))}
            {!isLoading && !isError && filteredPosts.length === 0 && (
              <p className="text-muted-foreground text-sm text-center py-8">No se encontraron resultados.</p>
            )}
          </div>
        </div>

        <div id="continue-watching">
          <h2 className="text-lg font-medium text-foreground mb-4">Continuar Viendo</h2>
          <div className="grid md:grid-cols-3 gap-4">
            {continueWatching.map((lesson, i) => (
              <motion.div
                key={lesson.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
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
    </MainLayout>
  );
};

export default Index;
