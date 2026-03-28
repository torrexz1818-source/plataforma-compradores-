import {
  ArrowRight,
  Users,
  Building2,
  FileText,
  Zap,
  MessageCircle,
  CheckCircle2,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';

const metrics = [
  { value: '+2500', label: 'Compradores activos', icon: Users },
  { value: '+500', label: 'Proveedores registrados', icon: Building2 },
  { value: '+150', label: 'Publicaciones semanales', icon: FileText },
  { value: '+30K', label: 'Interacciones', icon: Zap },
];

const steps = [
  {
    number: '1',
    title: 'Registrate',
    description:
      'Crea tu cuenta como comprador o proveedor en menos de 2 minutos.',
  },
  {
    number: '2',
    title: 'Conecta con la comunidad',
    description:
      'Participa en conversaciones, comparte experiencias y aprende de otros profesionales.',
  },
  {
    number: '3',
    title: 'Encuentra oportunidades',
    description:
      'Descubre proveedores, genera leads y mejora tus decisiones de compra.',
  },
];

const Landing = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <nav className="sticky top-0 z-50 bg-card/80 backdrop-blur-md border-b border-border">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <span className="text-lg font-bold text-gradient">SUPPLYCONNECT</span>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate('/login')}>
              Iniciar sesion
            </Button>
            <Button size="sm" onClick={() => navigate('/register')}>
              Registrarse
            </Button>
          </div>
        </div>
      </nav>

      <section className="gradient-primary py-24 px-6">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="max-w-3xl mx-auto text-center"
        >
          <h1 className="text-4xl md:text-5xl font-extrabold text-primary-foreground mb-4 tracking-tight">
            SUPPLYCONNECT
          </h1>
          <p className="text-primary-foreground/85 text-lg md:text-xl max-w-2xl mx-auto mb-8 leading-relaxed">
            La plataforma donde compradores y proveedores se conectan, aprenden
            y generan oportunidades de negocio.
          </p>
          <div className="flex gap-3 justify-center flex-wrap">
            <Button
              size="lg"
              variant="secondary"
              onClick={() => navigate('/register')}
              className="font-semibold"
            >
              Registrarse <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => navigate('/login')}
              className="bg-primary-foreground/10 text-primary-foreground border-primary-foreground/20 hover:bg-primary-foreground/20 font-semibold"
            >
              Iniciar sesion
            </Button>
          </div>
        </motion.div>
      </section>

      <section className="py-20 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-2xl font-bold text-foreground mb-4">
              Que es SupplyConnect?
            </h2>
            <p className="text-muted-foreground text-base leading-relaxed">
              SupplyConnect es una plataforma B2B donde los compradores
              encuentran proveedores confiables, aprenden mejores practicas de
              compras y toman decisiones mas inteligentes.
            </p>
          </motion.div>
        </div>
      </section>

      <section className="py-16 px-6 bg-muted/50">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-foreground text-center mb-10">
            Nuestra comunidad en numeros
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {metrics.map((m, i) => (
              <motion.div
                key={m.label}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="bg-card rounded-lg shadow-smooth p-6 text-center"
              >
                <m.icon className="w-6 h-6 text-primary mx-auto mb-3" />
                <p className="text-2xl font-bold text-foreground">{m.value}</p>
                <p className="text-sm text-muted-foreground mt-1">{m.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-foreground text-center mb-12">
            Como funciona?
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            {steps.map((step, i) => (
              <motion.div
                key={step.number}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15 }}
                className="text-center"
              >
                <div className="w-12 h-12 rounded-full gradient-primary text-primary-foreground flex items-center justify-center text-lg font-bold mx-auto mb-4">
                  {step.number}
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  {step.title}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {step.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 px-6 gradient-primary">
        <div className="max-w-2xl mx-auto text-center">
          <CheckCircle2 className="w-10 h-10 text-primary-foreground/80 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-primary-foreground mb-3">
            Unete a SupplyConnect hoy
          </h2>
          <p className="text-primary-foreground/80 mb-6">
            Empieza a conectar con la comunidad B2B mas grande de la region.
          </p>
          <Button
            size="lg"
            variant="secondary"
            onClick={() => navigate('/register')}
            className="font-semibold"
          >
            Crear cuenta gratis <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </section>

      <footer className="py-8 px-6 bg-card border-t border-border">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-sm font-semibold text-gradient">
            SUPPLYCONNECT
          </span>
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} SupplyConnect. Todos los derechos
            reservados.
          </p>
        </div>
      </footer>

      <a
        href="https://wa.me/51999999999"
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-[hsl(142,76%,36%)] hover:bg-[hsl(142,76%,30%)] text-white rounded-full px-5 py-3 shadow-lg transition-colors"
      >
        <MessageCircle className="w-5 h-5" />
        <span className="text-sm font-medium hidden sm:inline">
          Hablar por WhatsApp
        </span>
      </a>
    </div>
  );
};

export default Landing;
