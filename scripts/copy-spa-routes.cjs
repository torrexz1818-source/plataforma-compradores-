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
