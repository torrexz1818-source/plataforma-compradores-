# BUYER NODUS

## Stack

- Frontend: React + Vite
- Backend: NestJS
- Database: MongoDB

## Variables recomendadas

### Backend

```env
MONGODB_URI=mongodb://127.0.0.1:27017
MONGODB_DB_NAME=supplynexu
JWT_SECRET=dev-supplynexu-secret
HOST=0.0.0.0
PORT=10000
CORS_ORIGINS=https://supplynexu.com,https://www.supplynexu.com
```

### Google Calendar OAuth

El flujo ya esta implementado para que compradores y expertos conecten su Google Calendar directamente desde la plataforma.

Configuracion exacta:

- Local frontend: `http://127.0.0.1:5173`
- Local callback backend: `http://127.0.0.1:10000/experts/calendar/oauth/callback`
- Produccion frontend: `https://supplynexu.com`
- Produccion callback backend: `https://api.supplynexu.com/experts/calendar/oauth/callback`

Guia completa:

- [backend/GOOGLE_CALENDAR_OAUTH_SETUP.md](backend/GOOGLE_CALENDAR_OAUTH_SETUP.md)

## Usuario administrador inicial

- Email: `admin@supplynexu.com`
- Password: `Admin12345!`
- Email: `adolfo.mesa@supplynexu.com`
- Password: `Adolfo2026!`
- Email: `anna.torres@supplynexu.com`
- Password: `Anna2026!`

Los administradores globales de la plataforma pueden:

- Crear y eliminar videos educativos
- Crear y eliminar publicaciones
- Eliminar comentarios
- Activar y desactivar usuarios
- Consultar el panel general de administracion

## Arranque

### Frontend

```bash
npm install
npm run build
```

En produccion, el frontend queda listo para publicarse en `public_html` y consume:

```env
VITE_API_URL=https://api.supplynexu.com
```

### Backend

```bash
cd backend
npm install
npm run build
```

## Desarrollo Local

Para trabajar localmente sin afectar el deploy de cPanel:

1. Instala dependencias una sola vez:

```bash
npm install
cd backend
npm install
```

2. Inicia el backend local:

```bash
npm run dev:backend
```

3. En otra terminal, inicia el frontend local:

```bash
npm run dev:frontend
```

4. Abre:

- Frontend: `http://localhost:5173`
- Backend: `http://127.0.0.1:10000/health`

Localmente el frontend usa `VITE_API_URL=/api` desde `.env.development`, y Vite hace proxy al backend en `127.0.0.1:10000`. Produccion usa `.env.production` con `https://api.supplynexu.com`.

Para cPanel/Namecheap Node.js:

1. Usa `backend` como `App Root`.
2. Usa `app.js` como `Startup File`.
3. Configura variables de entorno del backend en el panel Node.js.
4. Si actualizas archivos manualmente, reinicia la app o toca `tmp/restart.txt`.

## Despliegue Automatico

Se agrego el workflow [deploy-namecheap.yml](C:\Users\M S I\Downloads\supplysavvy-connect-main\.github\workflows\deploy-namecheap.yml) para desplegar desde GitHub Actions:

- frontend a `public_html`
- backend a la carpeta del app Node.js en cPanel
- reinicio de Passenger via `tmp/restart.txt`

Secrets recomendados en GitHub:

- `CPANEL_FTP_HOST`
- `CPANEL_FTP_USERNAME`
- `CPANEL_FTP_PASSWORD`
- `CPANEL_FTP_PORT`
- `CPANEL_SSH_HOST` opcional
- `CPANEL_SSH_USERNAME` opcional
- `CPANEL_SSH_PASSWORD` opcional
- `CPANEL_SSH_PORT` opcional

Variables recomendadas en GitHub:

- `VITE_API_URL=https://api.supplynexu.com`
- `CPANEL_FRONTEND_DIR=/public_html/`
- `CPANEL_BACKEND_DIR=/backend/`
- `CPANEL_PASSENGER_TMP_DIR=/api.supplynexu.com/tmp/`
- `CPANEL_BACKEND_ABS_PATH=/home/supptug/backend`
- `CPANEL_PASSENGER_TMP_ABS_PATH=/home/supptug/api.supplynexu.com/tmp`

## Flujo Manual Minimo

Si aun no subes a GitHub, para probar cambios solo haces esto en local:

1. `npm run dev:backend`
2. `npm run dev:frontend`

Si ya subiste la configuracion a GitHub, para desplegar ya no subes carpetas a mano:

1. `git add .`
2. `git commit -m "tu cambio"`
3. `git push origin main`

GitHub Actions construye y sube frontend y backend automaticamente a Namecheap/cPanel.
