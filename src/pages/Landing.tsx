import { useEffect, useRef } from 'react';
import {
  ArrowRight,
  BookOpen,
  Bot,
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  MessageCircle,
  Newspaper,
  PackageSearch,
  ShieldCheck,
  Sparkles,
  UserRoundCheck,
  Users,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Button } from '@/components/ui/button';

const modules = [
  {
    title: 'Novedades del sector',
    description: 'Actualidad, tendencias y senales relevantes para compras corporativas.',
    icon: Newspaper,
  },
  {
    title: 'Comunidad',
    description: 'Conversaciones y criterios compartidos entre profesionales de compras.',
    icon: Users,
  },
  {
    title: 'Educacion continua',
    description: 'Recursos para fortalecer habilidades, procesos y decisiones B2B.',
    icon: BookOpen,
  },
  {
    title: 'Empleabilidad',
    description: 'Oportunidades y herramientas para crecer profesionalmente en compras.',
    icon: BriefcaseBusiness,
  },
  {
    title: 'Nexu Experts',
    description: 'Sesiones con especialistas para necesidades concretas del negocio.',
    icon: UserRoundCheck,
  },
  {
    title: 'Liquidaciones de inventario',
    description: 'Espacios para descubrir oportunidades de stock y ofertas disponibles.',
    icon: PackageSearch,
  },
  {
    title: 'Nexu AI - Agentes & Automatizacion',
    description: 'Inteligencia aplicada para acelerar analisis, aprendizaje y accion.',
    icon: Bot,
    featured: true,
    badge: 'Nuevo',
  },
  {
    title: 'Directorio de proveedores',
    description: 'Busca, compara y conecta con proveedores registrados en el ecosistema.',
    icon: Building2,
  },
];

const designedFor = [
  'Compradores operativos',
  'Jefes de compras',
  'Gerentes de abastecimiento',
  'Directores de supply chain',
  'Analistas de compras',
];

const audienceCards = [
  {
    eyebrow: 'Para compradores',
    title: 'Compra con mejor contexto y una red profesional alrededor.',
    description:
      'Accede a comunidad, contenido educativo, expertos, proveedores, IA y oportunidades para tomar decisiones mas inteligentes.',
    cta: 'Entrar como comprador',
    to: '/register?role=buyer',
    icon: ShieldCheck,
  },
  {
    eyebrow: 'Para expertos',
    title: 'Comparte conocimiento y genera impacto en el ecosistema.',
    description:
      'Participa con sesiones, experiencias y criterios especializados para acompanar retos reales de compras.',
    cta: 'Ser Experto Nodus',
    to: '/become-expert',
    icon: Sparkles,
  },
  {
    eyebrow: 'Para proveedores',
    title: 'Forma parte del ecosistema y conecta con compradores corporativos.',
    description:
      'Crea presencia en Buyer Nodus, gana visibilidad y presenta soluciones confiables ante una comunidad B2B activa.',
    cta: 'Registrarme como proveedor',
    to: '/register?role=supplier',
    icon: Building2,
  },
];

function BrandMark({ className = '' }: { className?: string }) {
  return (
    <img
      className={className}
      src="/buyer-nodus-isotipo.svg"
      alt="Isotipo Buyer Nodus"
      loading="eager"
      decoding="async"
    />
  );
}

function HumanMomentVisual() {
  return (
    <div className="relative mx-auto aspect-[4/3] w-full max-w-[460px] overflow-hidden rounded-[28px] border border-white/14 bg-white/[0.07] shadow-[0_24px_70px_rgba(0,0,0,0.18)] backdrop-blur">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(178,235,74,0.18),transparent_34%),radial-gradient(circle_at_20%_80%,rgba(243,49,63,0.16),transparent_34%)]" />
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 420 320" role="img" aria-label="Persona trabajando y saludando">
        <g className="bn-desk-scene">
          <path d="M82 230h255" stroke="rgba(255,255,255,0.34)" strokeWidth="10" strokeLinecap="round" />
          <rect x="120" y="176" width="134" height="64" rx="10" fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.24)" />
          <path d="M146 205h82M146 220h54" stroke="#B2EB4A" strokeWidth="5" strokeLinecap="round" />
          <circle cx="304" cy="95" r="8" fill="#F3313F" />
          <circle cx="334" cy="126" r="6" fill="#B2EB4A" />
          <path d="M304 95 334 126 298 158" stroke="rgba(255,255,255,0.35)" strokeWidth="3" strokeLinecap="round" />
        </g>

        <g className="bn-person-seated">
          <circle cx="206" cy="119" r="25" fill="#ffffff" />
          <path d="M183 111c13-25 47-18 50 2-15 5-30 3-50-2Z" fill="#0E109E" />
          <path d="M178 151c21-18 53-16 72 4v59h-72Z" fill="#F3313F" />
          <path d="M179 169l-38 28M245 170l33 27" stroke="#ffffff" strokeWidth="12" strokeLinecap="round" />
          <path d="M189 213l-33 42M237 213l38 42" stroke="#0E109E" strokeWidth="14" strokeLinecap="round" />
        </g>

        <g className="bn-person-standing" opacity="0">
          <circle cx="211" cy="91" r="25" fill="#ffffff" />
          <path d="M188 83c13-25 47-18 50 2-15 5-30 3-50-2Z" fill="#0E109E" />
          <path d="M182 124c22-18 56-18 77 1v85h-77Z" fill="#F3313F" />
          <path d="M184 145l-37 26" stroke="#ffffff" strokeWidth="12" strokeLinecap="round" />
          <g className="bn-wave-arm" style={{ transformOrigin: '258px 144px' }}>
            <path d="M255 144c28-16 43-37 50-63" stroke="#ffffff" strokeWidth="12" strokeLinecap="round" />
            <path d="M304 80c11-6 19-6 26 1" stroke="#B2EB4A" strokeWidth="5" strokeLinecap="round" />
          </g>
          <path d="M199 208l-18 56M241 208l26 56" stroke="#0E109E" strokeWidth="14" strokeLinecap="round" />
        </g>
      </svg>
    </div>
  );
}

const Landing = () => {
  const navigate = useNavigate();
  const pageRef = useRef<HTMLDivElement>(null);
  const typingRef = useRef<HTMLSpanElement>(null);
  const humanRef = useRef<HTMLElement>(null);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const ctx = gsap.context(() => {
      if (typingRef.current) {
        const fullWidth = typingRef.current.scrollWidth;
        gsap.set(typingRef.current, { width: 0 });
        gsap.set('.bn-hero-copy, .bn-hero-cta, .bn-hero-signal', { opacity: 0, y: 18 });
        gsap.set('.bn-brand-mark', { opacity: 0, scale: 0.82, rotate: -24 });

        const intro = gsap.timeline({ defaults: { ease: 'power3.out' } });
        intro
          .to('.bn-brand-mark', {
            opacity: 1,
            scale: 1,
            rotate: reduceMotion ? 0 : 360,
            duration: reduceMotion ? 0.4 : 1.15,
          })
          .to(typingRef.current, { width: fullWidth, duration: reduceMotion ? 0.2 : 1.25, ease: 'steps(11)' }, '-=0.08')
          .to('.bn-hero-copy, .bn-hero-cta, .bn-hero-signal', { opacity: 1, y: 0, stagger: 0.08, duration: 0.55 }, '-=0.15');
      }

      gsap.from('.bn-reveal', {
        scrollTrigger: {
          trigger: '.bn-value-section',
          start: 'top 78%',
        },
        opacity: 0,
        y: 28,
        stagger: 0.08,
        duration: 0.75,
        ease: 'power3.out',
      });

      if (humanRef.current) {
        const humanTl = gsap.timeline({
          scrollTrigger: {
            trigger: humanRef.current,
            start: 'top 72%',
            end: 'bottom 46%',
            scrub: reduceMotion ? false : 0.65,
          },
        });

        humanTl
          .from('.bn-human-copy', { opacity: 0, y: 26, duration: 0.55, ease: 'power2.out' })
          .to('.bn-person-seated', { opacity: 0, y: -8, duration: 0.45 }, '+=0.1')
          .to('.bn-person-standing', { opacity: 1, y: -12, duration: 0.55 }, '<')
          .to('.bn-wave-arm', { rotate: -18, yoyo: true, repeat: reduceMotion ? 0 : 3, duration: 0.22, ease: 'sine.inOut' });
      }
    }, pageRef);

    return () => ctx.revert();
  }, []);

  return (
    <div ref={pageRef} className="min-h-screen overflow-x-clip bg-[#0E109E] text-white">
      <nav className="fixed inset-x-0 top-0 z-50 border-b border-white/12 bg-[#0E109E]/84 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="flex items-center gap-2 text-left"
            aria-label="Ir al inicio de Buyer Nodus"
          >
            <BrandMark className="h-9 w-9" />
            <span className="text-sm font-bold tracking-[0.18em] text-white">BUYER <span className="text-[#F3313F]">NODUS</span></span>
          </button>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate('/login')} className="text-white hover:text-white">
              Iniciar sesion
            </Button>
            <Button size="sm" onClick={() => navigate('/register')} className="bg-[#B2EB4A] text-[#0E109E] hover:bg-white">
              Registrarse
            </Button>
          </div>
        </div>
      </nav>

      <main>
        <section className="relative isolate flex min-h-screen items-center justify-center overflow-hidden px-4 pb-16 pt-24 text-center sm:px-6">
          <div className="absolute inset-0 -z-20 bg-[radial-gradient(circle_at_48%_35%,rgba(90,49,213,0.58),transparent_34%),radial-gradient(circle_at_18%_46%,rgba(243,49,63,0.12),transparent_26%),linear-gradient(135deg,#0E109E_0%,#1710A3_54%,#2712B8_100%)]" />
          <div className="absolute inset-0 -z-20 opacity-25 [background-image:linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:96px_96px]" />
          <svg className="pointer-events-none absolute inset-0 -z-10 h-full w-full opacity-55" viewBox="0 0 1440 760" preserveAspectRatio="none" aria-hidden="true">
            <g fill="none" strokeLinecap="round">
              <path d="M110 255 C315 260 505 268 720 316 S1045 330 1298 255" stroke="rgba(243,49,63,0.23)" strokeDasharray="7 12" />
              <path d="M338 0 C460 110 570 218 720 316" stroke="rgba(178,235,74,0.16)" strokeDasharray="8 13" />
              <path d="M602 0 C620 126 660 234 720 316" stroke="rgba(255,255,255,0.13)" strokeDasharray="8 13" />
              <path d="M920 0 C852 130 792 238 720 316" stroke="rgba(243,49,63,0.18)" strokeDasharray="8 13" />
              <path d="M1220 0 C1050 128 910 240 720 316" stroke="rgba(255,255,255,0.12)" strokeDasharray="8 13" />
              <path d="M0 120 C260 174 482 242 720 316" stroke="rgba(255,255,255,0.11)" strokeDasharray="8 13" />
              <path d="M0 382 C238 354 498 334 720 316" stroke="rgba(178,235,74,0.12)" strokeDasharray="8 13" />
            </g>
            <g>
              <circle cx="135" cy="300" r="7" fill="#F3313F" opacity="0.45" />
              <circle cx="375" cy="336" r="7" fill="#B2EB4A" opacity="0.32" />
              <circle cx="885" cy="266" r="7" fill="#F3313F" opacity="0.32" />
              <circle cx="720" cy="316" r="5" fill="#B2EB4A" opacity="0.72" />
            </g>
          </svg>

          <div className="mx-auto flex w-full max-w-6xl flex-col items-center">
            <div className="bn-hero-signal mb-9 text-[10px] font-bold uppercase tracking-[0.56em] text-[#B2EB4A] sm:text-xs">
              Ecosistema B2B conectado
            </div>

            <h1 className="w-full text-[clamp(2.25rem,8vw,7rem)] font-medium leading-none tracking-normal text-white">
              <span ref={typingRef} className="inline-block max-w-full overflow-hidden whitespace-nowrap border-r-2 border-[#B2EB4A] align-bottom">
                BUYER <span className="text-[#F3313F]">NODUS</span>
              </span>
            </h1>

            <p className="bn-hero-copy mt-14 max-w-3xl text-base leading-8 text-white/86 sm:text-lg">
              El ecosistema donde compradores, expertos y proveedores se conectan para compartir conocimiento,
              descubrir oportunidades y tomar mejores decisiones con inteligencia aplicada.
            </p>

            <div className="bn-hero-cta mt-12 flex w-full max-w-[460px] flex-col justify-center gap-3 border-t border-white/12 pt-8 sm:flex-row">
              <Button
                size="lg"
                onClick={() => navigate('/register')}
                className="h-12 rounded-none bg-[#F3313F] px-9 text-xs font-bold uppercase tracking-[0.1em] text-white shadow-none hover:bg-[#B2EB4A] hover:text-[#0E109E]"
              >
                Crear cuenta <ArrowRight className="h-4 w-4" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => navigate('/login')}
                className="h-12 rounded-none border-white/18 bg-transparent px-9 text-xs font-bold uppercase tracking-[0.1em] text-white shadow-none hover:bg-white/10 hover:text-white"
              >
                Iniciar sesion
              </Button>
            </div>

            <div className="bn-hero-copy mt-16 text-[10px] font-bold uppercase tracking-[0.42em] text-white/42">
              Scroll para explorar
            </div>
          </div>
        </section>

        <section className="bn-value-section bg-white px-4 py-20 text-[#0E109E] sm:px-6 lg:py-28">
          <div className="mx-auto max-w-7xl">
            <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
              <div className="bn-reveal">
                <p className="text-sm font-bold uppercase tracking-[0.2em] text-[#F3313F]">Que es Buyer Nodus</p>
                <h2 className="mt-4 text-3xl font-bold leading-tight text-[#0E109E] sm:text-5xl">
                  Un ecosistema para convertir conexiones en mejores decisiones B2B.
                </h2>
              </div>
              <p className="bn-reveal text-base leading-8 text-[#0E109E]/70 sm:text-lg">
                Buyer Nodus integra comunidad, aprendizaje, expertos, proveedores, oportunidades y Nodus IA en una
                experiencia profesional para compradores y empresas que buscan crecer con informacion confiable.
              </p>
            </div>
          </div>
        </section>

        <section className="relative overflow-hidden bg-[#0E109E] px-4 py-20 sm:px-6 lg:py-28">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_18%,rgba(243,49,63,0.16),transparent_28%),radial-gradient(circle_at_86%_74%,rgba(178,235,74,0.16),transparent_30%)]" />
          <div className="relative mx-auto grid max-w-7xl gap-12 lg:grid-cols-[1fr_0.9fr] lg:items-start">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.36em] text-[#B2EB4A]">Que es Buyer Nodus?</p>
              <h2 className="mt-7 text-4xl font-bold leading-tight text-white sm:text-6xl">
                El ecosistema construido <span className="text-[#F3313F]">exclusivamente</span> para compradores
              </h2>
              <p className="mt-8 max-w-2xl text-base leading-8 text-white/82">
                Buyer Nodus es un ecosistema digital B2B especializado. Compradores corporativos encuentran aqui todo
                lo necesario para crecer profesionalmente, conectar con pares y automatizar su trabajo.
              </p>
              <p className="mt-7 max-w-2xl text-sm font-semibold leading-8 text-white/52">
                Comunidad, educacion, directorio de proveedores e inteligencia artificial, todo en una red disenada
                100% para el area de compras.
              </p>
            </div>
            <div className="rounded-lg border border-white/16 bg-white/[0.04] p-8 shadow-[0_24px_70px_rgba(0,0,0,0.16)] backdrop-blur">
              <p className="text-xs font-bold uppercase tracking-[0.36em] text-[#B2EB4A]">Disenada para</p>
              <div className="mt-8 divide-y divide-white/14">
                {designedFor.map((item, index) => (
                  <div key={item} className="flex items-center gap-4 py-4 text-sm font-bold text-white">
                    <span className={index % 2 === 0 ? 'text-[#F3313F]' : 'text-[#B2EB4A]'}>●</span>
                    <span className="flex-1">{item}</span>
                    <span className="text-xs font-medium text-white/50">{String(index + 1).padStart(2, '0')}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="relative overflow-hidden bg-white px-4 py-20 text-[#0E109E] sm:px-6 lg:py-28">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(90,49,213,0.08),transparent_24%),radial-gradient(circle_at_76%_78%,rgba(243,49,63,0.07),transparent_28%)]" />
          <div className="mx-auto max-w-7xl">
            <div className="relative mx-auto max-w-3xl text-center">
              <p className="text-xs font-bold uppercase tracking-[0.34em] text-[#5A31D5]">Ecosistema</p>
              <h2 className="mt-3 text-3xl font-bold leading-tight text-[#0E109E] sm:text-5xl">
                8 modulos para el comprador moderno
              </h2>
              <p className="mx-auto mt-5 max-w-2xl text-sm leading-7 text-[#0E109E]/68">
                Cada modulo fue disenado para las necesidades del area de compras corporativa.
              </p>
            </div>
            <div className="relative mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {modules.map((module, index) => (
                <article
                  key={module.title}
                  className={
                    module.featured
                      ? 'group relative min-h-[178px] overflow-hidden rounded-lg border border-[#B2EB4A]/40 bg-[linear-gradient(135deg,#F3313F_0%,#5A31D5_100%)] p-6 shadow-[0_22px_60px_rgba(243,49,63,0.20)]'
                      : 'group relative min-h-[178px] rounded-lg border border-[#0E109E]/12 bg-white p-6 shadow-[0_18px_42px_rgba(14,16,158,0.08)] transition-colors hover:border-[#5A31D5]/22 hover:bg-[#0E109E]/[0.025]'
                  }
                >
                  <div className="mb-5 flex items-center justify-between">
                    <span className={module.featured ? 'text-xs font-bold text-white' : 'text-xs font-bold text-[#5A31D5]'}>
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    {module.badge && (
                      <span className="rounded-sm border border-white/28 bg-white/12 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-white">
                        {module.badge}
                      </span>
                    )}
                  </div>
                  <div className={module.featured ? 'mb-5 flex h-12 w-12 items-center justify-center rounded-md border border-white/34 bg-white/12 text-white' : 'mb-5 flex h-12 w-12 items-center justify-center rounded-md border border-[#5A31D5]/26 bg-[#5A31D5]/8 text-[#5A31D5]'}>
                    <module.icon className="h-5 w-5" />
                  </div>
                  <h3 className={module.featured ? 'text-base font-bold leading-snug text-white' : 'text-base font-bold leading-snug text-[#0E109E]'}>
                    {module.title}
                  </h3>
                  <p className={module.featured ? 'mt-3 text-sm leading-6 text-white/74' : 'mt-3 text-sm leading-6 text-[#0E109E]/68'}>
                    {module.description}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-[#F6F7FF] px-4 py-20 text-[#0E109E] sm:px-6 lg:py-28">
          <div className="mx-auto grid max-w-7xl gap-5 lg:grid-cols-3">
            {audienceCards.map((card) => (
              <article key={card.eyebrow} className="flex min-h-[360px] flex-col rounded-lg border border-[#0E109E]/10 bg-white p-6 shadow-[0_18px_42px_rgba(14,16,158,0.08)]">
                <div className="mb-8 flex h-12 w-12 items-center justify-center rounded-lg bg-[#0E109E]/8 text-[#F3313F]">
                  <card.icon className="h-6 w-6" />
                </div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#5A31D5]">{card.eyebrow}</p>
                <h2 className="mt-4 text-2xl font-bold leading-snug text-[#0E109E]">{card.title}</h2>
                <p className="mt-4 flex-1 text-sm leading-7 text-[#0E109E]/68">{card.description}</p>
                <Button onClick={() => navigate(card.to)} className="mt-8 w-full bg-[#B2EB4A] text-[#0E109E] hover:bg-[#F3313F] hover:text-white">
                  {card.cta} <ArrowRight className="h-4 w-4" />
                </Button>
              </article>
            ))}
          </div>
        </section>

        <section ref={humanRef} className="relative overflow-hidden bg-[#0E109E] px-4 py-20 sm:px-6 lg:py-28">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_20%,rgba(178,235,74,0.16),transparent_26%),radial-gradient(circle_at_80%_70%,rgba(243,49,63,0.18),transparent_30%)]" />
          <div className="relative mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div className="bn-human-copy">
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-[#B2EB4A]">Momento 3 / Cierre humano</p>
              <h2 className="mt-4 text-3xl font-bold leading-tight text-white sm:text-5xl">
                Tecnologia con personas al centro.
              </h2>
              <p className="mt-6 text-base leading-8 text-white/72 sm:text-lg">
                Buyer Nodus acerca compradores, expertos y proveedores con una experiencia seria, profesional y humana:
                una comunidad lista para compartir, conectar y saludar nuevas oportunidades.
              </p>
            </div>
            <HumanMomentVisual />
          </div>
        </section>

        <section className="bg-white px-4 py-20 text-center text-[#0E109E] sm:px-6 lg:py-24">
          <div className="mx-auto max-w-3xl">
            <CheckCircle2 className="mx-auto mb-5 h-10 w-10 text-[#F3313F]" />
            <h2 className="text-3xl font-bold leading-tight text-[#0E109E] sm:text-5xl">
              Empieza a conectar con el ecosistema Buyer Nodus.
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-8 text-[#0E109E]/68">
              Crea tu cuenta y encuentra comunidad, conocimiento, expertos, proveedores y oportunidades en un solo lugar.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Button size="lg" onClick={() => navigate('/register')} className="bg-[#B2EB4A] text-[#0E109E] hover:bg-[#F3313F] hover:text-white">
                Crear cuenta gratis <ArrowRight className="h-4 w-4" />
              </Button>
              <Button size="lg" variant="outline" onClick={() => navigate('/login')}>
                Iniciar sesion
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/12 bg-[#0E109E] px-4 py-8 text-white sm:px-6">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-2">
            <BrandMark className="h-9 w-9" />
            <span className="text-sm font-bold tracking-[0.18em]">BUYER <span className="text-[#F3313F]">NODUS</span></span>
          </div>
          <p className="text-xs text-white/58">
            © {new Date().getFullYear()} BUYER NODUS. Todos los derechos reservados.
          </p>
        </div>
      </footer>

      <a
        href="https://wa.me/51999999999"
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full bg-[#B2EB4A] px-5 py-3 text-[#0E109E] shadow-[0_18px_40px_rgba(0,0,0,0.18)] transition-colors hover:bg-white"
      >
        <MessageCircle className="h-5 w-5" />
        <span className="hidden text-sm font-medium sm:inline">Hablar por WhatsApp</span>
      </a>
    </div>
  );
};

export default Landing;
