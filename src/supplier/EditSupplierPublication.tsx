import { useEffect, useState } from 'react';
import { ImagePlus } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { getSupplierPublicationById, updateSupplierPublication, uploadFile } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import BackButton from '@/components/BackButton';

const EditSupplierPublication = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [url, setUrl] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageValue, setImageValue] = useState<string | undefined>(undefined);
  const [preview, setPreview] = useState<string | undefined>(undefined);
  const [feedback, setFeedback] = useState('');

  const publicationQuery = useQuery({
    queryKey: ['supplier-publication', id],
    queryFn: async () => getSupplierPublicationById(id ?? ''),
    enabled: Boolean(id),
  });

  useEffect(() => {
    const publication = publicationQuery.data;
    if (!publication) {
      return;
    }

    if (!user?.id || publication.supplierId !== user.id) {
      navigate('/publicaciones', { replace: true });
      return;
    }

    setTitle(publication.title);
    setContent(publication.content);
    setUrl(publication.url ?? '');
    setImageFile(null);
    setImageValue(publication.image);
    setPreview(publication.image);
  }, [publicationQuery.data, navigate, user?.id]);

  useEffect(() => {
    if (publicationQuery.isError) {
      navigate('/publicaciones', { replace: true });
    }
  }, [navigate, publicationQuery.isError]);

  useEffect(() => {
    return () => {
      if (preview?.startsWith('blob:')) {
        URL.revokeObjectURL(preview);
      }
    };
  }, [preview]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      const uploadedImage = imageFile ? await uploadFile(imageFile, 'posts') : null;

      return updateSupplierPublication(id ?? '', {
        title: title.trim(),
        content: content.trim(),
        image: uploadedImage?.url ?? imageValue,
        url: url.trim(),
      });
    },
    onSuccess: async () => {
      setFeedback('Cambios guardados correctamente.');
      await queryClient.invalidateQueries({ queryKey: ['supplier-publications', user?.id] });
      await queryClient.invalidateQueries({ queryKey: ['supplier-publication', id] });
      window.setTimeout(() => navigate('/publicaciones', { replace: true }), 400);
    },
    onError: (error: Error) => {
      setFeedback(error.message);
    },
  });

  const onSelectImage = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      if (preview?.startsWith('blob:')) {
        URL.revokeObjectURL(preview);
      }

      setImageFile(file);
      setImageValue(undefined);
      setPreview(URL.createObjectURL(file));
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'No se pudo cargar la imagen.');
    }
  };

  if (publicationQuery.isLoading) {
    return <p className="text-sm text-muted-foreground">Cargando publicacion...</p>;
  }

  return (
    <div className="max-w-2xl mx-auto py-6 px-4">
      <BackButton fallback="/publicaciones" className="mb-6" />

      <h1 className="text-xl font-bold text-foreground mb-6">Editar publicacion</h1>

      <div className="bg-card border border-border rounded-xl p-5">
        <Input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Titulo"
          className="mb-3"
        />

        <Textarea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder="Descripcion"
          rows={5}
          className="resize-none mb-3"
        />

        <Input
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="URL del producto o sitio (opcional)"
          className="mb-3"
        />

        {preview && (
          <div className="mb-3 rounded-lg overflow-hidden border border-border bg-muted/30">
            <img src={preview} alt="Vista previa de la publicacion" className="w-full max-h-72 object-contain mx-auto" />
          </div>
        )}

        <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer hover:text-foreground transition-colors mb-5 w-fit">
          <ImagePlus className="w-4 h-4" />
          Cambiar imagen
          <input type="file" accept="image/*" className="hidden" onChange={onSelectImage} />
        </label>

        {feedback && (
          <p className="text-sm text-success-foreground mb-4">{feedback}</p>
        )}

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => navigate('/publicaciones')}
            disabled={updateMutation.isPending}
          >
            Cancelar
          </Button>
          <Button
            onClick={() => updateMutation.mutate()}
            disabled={updateMutation.isPending || !title.trim() || !content.trim()}
          >
            {updateMutation.isPending ? 'Guardando...' : 'Guardar cambios'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default EditSupplierPublication;
