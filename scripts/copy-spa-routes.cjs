const { copyFileSync, existsSync, mkdirSync } = require('fs');
const { dirname, join } = require('path');

const distDir = join(__dirname, '..', 'dist');
const indexPath = join(distDir, 'index.html');
const routes = [
  'admin',
  'admin/dashboard',
  'become-expert',
  'buyer',
  'buyer/dashboard',
  'buyer/directory',
  'buyer/sale',
  'calendar-setup',
  'community',
  'contenido-educativo',
  'directorio-compradores',
  'directorio-proveedores',
  'empleabilidad',
  'expert/calendar-setup',
  'forgot-password',
  'home',
  'inicio',
  'login',
  'mensajes',
  'nexu-experts',
  'nexu-ia',
  'nexu-ia/terms_of_reference',
  'nexu-ia/elaboracion-terminos-referencia',
  'nexu-ia/proposal_comparison',
  'nexu-ia/comparativos-propuestas-proveedores',
  'nexu-ia/tco_analysis',
  'nexu-ia/analisis-costo-total-tco',
  'nexu-ia/purchase_order',
  'nexu-ia/elaboracion-orden-compra',
  'nexu-ia/dashboard_creator',
  'nexu-ia/creador-dashboard',
  'nexu-ia/spend_analysis',
  'nexu-ia/analisis-gastos',
  'nexu-ia/contract_risk_analysis',
  'nexu-ia/analisis-contratos-riesgos',
  'nexu-ia/supplier_evaluation_ranking',
  'nexu-ia/evaluacion-ranking-proveedores',
  'notificaciones',
  'notifications',
  'novedades',
  'perfil',
  'post',
  'publicaciones',
  'register',
  'reportes',
  'supplier',
  'supplier/dashboard',
  'supplier/directory',
  'supplier/inicio',
  'supplier/sale',
];

if (!existsSync(indexPath)) {
  throw new Error('dist/index.html was not found. Run the Vite build first.');
}

for (const route of routes) {
  const targetPath = join(distDir, route, 'index.html');
  mkdirSync(dirname(targetPath), { recursive: true });
  copyFileSync(indexPath, targetPath);
}

copyFileSync(indexPath, join(distDir, '404.html'));
