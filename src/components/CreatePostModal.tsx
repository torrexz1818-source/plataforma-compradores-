import { useState } from 'react';
import { X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { createPost } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { PostCategory } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { motion, AnimatePresence } from 'framer-motion';

interface CreatePostModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: PostCategory[];
  onCreated?: () => void;
}

const CreatePostModal = ({ isOpen, onClose, categories, onCreated }: CreatePostModalProps) => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [selectedCategory, setSelectedCategory] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const createPostMutation = useMutation({
    mutationFn: createPost,
  });

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!selectedCategory) newErrors.category = 'Selecciona una categoria';
    if (!title.trim()) newErrors.title = 'El titulo es requerido';
    if (!description.trim()) newErrors.description = 'La descripcion es requerida';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const resetForm = () => {
    setSelectedCategory('');
    setTitle('');
    setDescription('');
    setErrors({});
  };

  const handleSubmit = async () => {
    if (!isAuthenticated) {
      onClose();
      navigate('/login');
      return;
    }

    if (!validate()) return;

    await createPostMutation.mutateAsync({
      title,
      description,
      categoryId: selectedCategory,
      type: 'community',
    });

    resetForm();
    onClose();
    onCreated?.();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-foreground/50 z-50 flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-card rounded-lg shadow-smooth-hover w-full max-w-lg"
          >
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h2 className="text-lg font-medium text-foreground">Nuevo Post</h2>
              <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <p className="text-sm text-muted-foreground">
                Espacio exclusivo para compradores comparte, pregunta y aprende de tus pares.
              </p>

              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">Categoria</label>
                <div className="flex flex-wrap gap-2">
                  {categories.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCategory(cat.id)}
                      className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                        selectedCategory === cat.id
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {cat.name}
                    </button>
                  ))}
                </div>
                {errors.category && <p className="text-xs text-destructive mt-1">{errors.category}</p>}
              </div>

              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">Titulo</label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Escribe un titulo descriptivo"
                  maxLength={100}
                />
                {errors.title && <p className="text-xs text-destructive mt-1">{errors.title}</p>}
              </div>

              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">Descripcion</label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Comparte tu experiencia, pregunta o recomendacion..."
                  className="min-h-[120px]"
                  maxLength={1000}
                />
                {errors.description && <p className="text-xs text-destructive mt-1">{errors.description}</p>}
                {createPostMutation.error && (
                  <p className="text-xs text-destructive mt-1">
                    {createPostMutation.error instanceof Error
                      ? createPostMutation.error.message
                      : 'No se pudo publicar el post'}
                  </p>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3 p-5 border-t border-border">
              <Button variant="outline" onClick={onClose}>Cancelar</Button>
              <Button onClick={() => void handleSubmit()} disabled={createPostMutation.isPending}>
                {createPostMutation.isPending ? 'Publicando...' : 'Publicar'}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default CreatePostModal;
