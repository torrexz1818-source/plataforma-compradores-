import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Play } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import MainLayout from '@/layouts/MainLayout';
import CommentSection from '@/components/CommentSection';
import { getPostDetail } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

const PostDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['post-detail', id],
    queryFn: () => getPostDetail(id ?? ''),
    enabled: Boolean(id),
  });

  const post = data?.post;
  const lesson = data?.lesson;

  if (!isLoading && !post) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <p className="text-muted-foreground mb-4">Post no encontrado</p>
            <Button variant="outline" onClick={() => navigate('/')}>Volver al inicio</Button>
          </div>
        </div>
      </MainLayout>
    );
  }

  const progress = lesson?.progress || 65;

  return (
    <MainLayout>
      <div className="max-w-6xl mx-auto px-6 py-8">
        {isLoading && <p className="text-muted-foreground mb-4">Cargando post...</p>}
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4 text-muted-foreground">
          <ArrowLeft className="w-4 h-4 mr-1" /> Volver
        </Button>

        {post && (
          <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
                {post.videoUrl && (
                  <div className="bg-muted rounded-lg h-72 md:h-96 flex items-center justify-center mb-6 relative overflow-hidden">
                    <div className="w-16 h-16 rounded-full bg-card/90 flex items-center justify-center shadow-smooth cursor-pointer hover:scale-110 transition-transform">
                      <Play className="w-7 h-7 text-primary ml-1" />
                    </div>
                  </div>
                )}

                <h1 className="text-2xl font-bold text-foreground mb-2">{post.title}</h1>
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-sm text-muted-foreground">{post.author.fullName}</span>
                  <span className="text-muted-foreground">•</span>
                  <span className="text-sm text-muted-foreground">{post.author.company}</span>
                </div>

                {post.videoUrl && (
                  <div className="mb-6">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-foreground">Progreso de la leccion</span>
                      <span className="text-sm font-medium text-primary">{progress}%</span>
                    </div>
                    <Progress value={progress} className="h-2" />
                  </div>
                )}

                <p className="text-foreground/80 leading-relaxed mb-8">{post.description}</p>

                {post.type === 'educational' && (
                  <div className="mb-8">
                    <h3 className="text-base font-semibold text-foreground mb-3">Mas lecciones</h3>
                    <div className="space-y-3">
                      {(data?.relatedPosts ?? []).map((relatedPost) => (
                        <div
                          key={relatedPost.id}
                          onClick={() => navigate(`/post/${relatedPost.id}`)}
                          className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg cursor-pointer hover:bg-muted transition-colors"
                        >
                          <div className="w-16 h-12 bg-muted rounded flex items-center justify-center flex-shrink-0">
                            <Play className="w-4 h-4 text-primary" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-foreground">{relatedPost.title}</p>
                            <p className="text-xs text-muted-foreground">{relatedPost.author.fullName}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            </div>

            <div className="lg:col-span-1">
              <div className="bg-card rounded-lg shadow-smooth p-5 sticky top-20">
                <CommentSection
                  postId={post.id}
                  comments={data?.comments ?? []}
                  onCommentAdded={() => {
                    void queryClient.invalidateQueries({ queryKey: ['post-detail', id] });
                  }}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default PostDetail;
