import { ElementType } from 'react';
import {
  BookOpen,
  Bot,
  BriefcaseBusiness,
  Building2,
  FileText,
  LayoutDashboard,
  MessageCircle,
  Newspaper,
  Users,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { getMyModuleActivations } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { ModuleActivationRole, ModuleActivationSetting } from '@/types';

export type ModuleKey =
  | 'dashboard'
  | 'news'
  | 'community'
  | 'educational_content'
  | 'employability'
  | 'nodus_experts'
  | 'offers_requirements'
  | 'nodus_ia'
  | 'supplier_directory'
  | 'buyer_directory'
  | 'posts'
  | 'stock_opportunities'
  | 'messages'
  | 'notifications'
  | 'reports';

export type ModuleNavItem = {
  to: string;
  label: string;
  icon: ElementType;
  moduleKey?: ModuleKey;
  children?: ModuleNavItem[];
};

export const moduleActivationCatalog: Record<ModuleActivationRole, Array<{ key: ModuleKey; label: string; defaultEnabled: boolean }>> = {
  buyer: [
    { key: 'dashboard', label: 'Dashboard', defaultEnabled: false },
    { key: 'news', label: 'Novedades', defaultEnabled: false },
    { key: 'community', label: 'Inteligencia colectiva', defaultEnabled: false },
    { key: 'educational_content', label: 'Contenido Educativo', defaultEnabled: false },
    { key: 'employability', label: 'Empleabilidad', defaultEnabled: false },
    { key: 'nodus_experts', label: 'Nodus Experts', defaultEnabled: false },
    { key: 'offers_requirements', label: 'Ofertas y requerimientos', defaultEnabled: false },
    { key: 'nodus_ia', label: 'Nodus IA', defaultEnabled: true },
    { key: 'supplier_directory', label: 'Directorio de proveedores', defaultEnabled: false },
  ],
  supplier: [
    { key: 'dashboard', label: 'Dashboard', defaultEnabled: false },
    { key: 'buyer_directory', label: 'Directorio de compradores', defaultEnabled: false },
    { key: 'posts', label: 'Publicaciones', defaultEnabled: false },
    { key: 'stock_opportunities', label: 'Oportunidades de stock', defaultEnabled: false },
    { key: 'messages', label: 'Mensajes', defaultEnabled: false },
    { key: 'notifications', label: 'Notificaciones', defaultEnabled: false },
    { key: 'reports', label: 'Reportes', defaultEnabled: false },
  ],
  expert: [],
};

export const buyerModuleNavItems: ModuleNavItem[] = [
  { to: '/buyer/dashboard', label: 'Dashboard', icon: LayoutDashboard, moduleKey: 'dashboard' },
  { to: '/novedades', label: 'Novedades', icon: Newspaper, moduleKey: 'news' },
  { to: '/community', label: 'Inteligencia colectiva', icon: MessageCircle, moduleKey: 'community' },
  {
    to: '/contenido-educativo',
    label: 'Contenido Educativo',
    icon: BookOpen,
    moduleKey: 'educational_content',
    children: [
      { to: '/empleabilidad', label: 'Empleabilidad', icon: BriefcaseBusiness, moduleKey: 'employability' },
      { to: '/nexu-experts', label: 'Nodus Experts', icon: Users, moduleKey: 'nodus_experts' },
    ],
  },
  { to: '/buyer/sale', label: 'Ofertas y requerimientos', icon: FileText, moduleKey: 'offers_requirements' },
  { to: '/nexu-ia', label: 'Nodus IA', icon: Bot, moduleKey: 'nodus_ia' },
  { to: '/buyer/directory', label: 'Directorio de proveedores', icon: Building2, moduleKey: 'supplier_directory' },
];

export const supplierModuleNavItems: ModuleNavItem[] = [
  { to: '/supplier/dashboard', label: 'Dashboard', icon: LayoutDashboard, moduleKey: 'dashboard' },
  { to: '/supplier/directory', label: 'Directorio de compradores', icon: Building2, moduleKey: 'buyer_directory' },
  { to: '/publicaciones', label: 'Publicaciones', icon: FileText, moduleKey: 'posts' },
];

export function getDefaultModuleState(role: ModuleActivationRole, moduleKey: string) {
  return moduleActivationCatalog[role].find((item) => item.key === moduleKey)?.defaultEnabled ?? false;
}

export function isModuleEnabled(settings: ModuleActivationSetting[] | undefined, role: ModuleActivationRole, moduleKey?: string) {
  if (!moduleKey) return true;
  const setting = settings?.find((item) => item.role === role && item.moduleKey === moduleKey);
  return setting?.enabled ?? getDefaultModuleState(role, moduleKey);
}

export function filterModuleNavItems(items: ModuleNavItem[], settings: ModuleActivationSetting[] | undefined, role: ModuleActivationRole) {
  return items
    .map((item) => {
      const children = item.children?.filter((child) => isModuleEnabled(settings, role, child.moduleKey));
      const enabled = isModuleEnabled(settings, role, item.moduleKey);
      if (!enabled && !children?.length) return null;
      return { ...item, children };
    })
    .filter(Boolean) as ModuleNavItem[];
}

export function useMyModuleActivations() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['module-activations', 'mine', user?.role],
    queryFn: getMyModuleActivations,
    enabled: Boolean(user?.role && user.role !== 'admin'),
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: 'always',
    refetchInterval: 5_000,
  });
}
