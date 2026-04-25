import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText, Image as ImageIcon, Link2, Play } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import CommentSection from '@/components/CommentSection';
import { getPostDetail, registerEducationalContentView } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/lib/auth';
import { isBuyerLikeRole } from '@/lib/roles';

const PostDetail = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['post-detail', id],
    queryFn: () => getPostDetail(id ?? ''),
    enabled: Boolean(id),
  });

  const post = data?.post;
  const lesson = data?.lesson;

  useEffect(() => {
    if (!id || !post || post.type !== 'educational' || !isBuyerLikeRole(user?.role)) {
      return;
    }

    void registerEducationalContentView(id);
  }, [id, post, user?.role]);

  if (!isLoading && !post) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Post no encontrado</p>
          <Button variant="outline" onClick={() => navigate('/home')}>Volver al inicio</Button>
        </div>
      </div>
    );
  }

  const progress = lesson?.progress || 65;

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      {isLoading && <p className="text-muted-foreground mb-4">Cargando post...</p>}
      <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4 text-muted-foreground">
        <ArrowLeft className="w-4 h-4 mr-1" /> Volver
      </Button>

      {post && (
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.45fr)_minmax(500px,1fr)]">
          <div className="min-w-0">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
                {(post.videoUrl || post.thumbnailUrl) && (
                  <div className="bg-black rounded-lg h-72 md:h-96 flex items-center justify-center mb-6 relative overflow-hidden">
                    {post.videoUrl ? (
                      <video
                        src={post.videoUrl}
                        poster={post.thumbnailUrl}
                        controls
                        className="h-full w-full object-contain bg-black"
                      />
                    ) : post.thumbnailUrl ? (
                      <img src={post.thumbnailUrl} alt={post.title} className="h-full w-full object-cover" />
                    ) : null}
                  </div>
                )}

                <h1 className="text-2xl font-bold text-foreground mb-2">{post.title}</h1>
                <div className="flex items-center gap-2 mb-4">
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

                {!!post.resources?.length && (
                  <div className="mb-8">
                    <h3 className="text-base font-semibold text-foreground mb-3">Recursos complementarios</h3>
                    <div className="space-y-3">
                      {post.resources.map((resource) => (
                        <a
                          key={resource.id}
                          href={resource.url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-3 rounded-lg border border-border bg-muted/40 px-4 py-3 hover:bg-muted transition-colors"
                        >
                          {resource.type === 'link' ? <Link2 className="w-4 h-4 text-primary" /> : null}
                          {resource.type === 'image' ? <ImageIcon className="w-4 h-4 text-primary" /> : null}
                          {resource.type === 'file' ? <FileText className="w-4 h-4 text-primary" /> : null}
                          <div>
                            <p className="text-sm font-medium text-foreground">{resource.name}</p>
                            <p className="text-xs text-muted-foreground">{resource.url}</p>
                          </div>
                        </a>
                      ))}
                    </div>
                  </div>
                )}

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

          <div className="min-w-0">
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
  );
};

export default PostDetail;
