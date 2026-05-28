# BUYER NODUS

## Stack

- Frontend: React + Vite
- Backend: NestJS
- AI Engine: FastAPI
- Database: MongoDB
- Produccion: Render

## Produccion

Buyer Nodus se publica en Render mediante `render.yaml`.

- Frontend: `https://buyernodus.com`
- Backend API: `https://api.buyernodus.com`
- AI Engine: `https://plataforma-compradores-128y.onrender.com`
- Dominio `www`: `www.buyernodus.com` apunta a `plataforma-compradores.onrender.com`

El flujo normal de despliegue es:

1. Hacer cambios en el repo.
2. Ejecutar build local si aplica.
3. Commit y push a `main`.
4. Render ejecuta auto-deploy.
5. Verificar directamente `https://buyernodus.com`.

## Variables Recomendadas

### Backend

```env
MONGODB_URI=mongodb://127.0.0.1:27017
MONGODB_DB_NAME=buyernodus
JWT_SECRET=dev-buyernodus-secret
HOST=0.0.0.0
PORT=10000
CORS_ORIGINS=https://buyernodus.com,https://www.buyernodus.com
```

### Frontend

```env
VITE_API_URL=https://api.buyernodus.com
VITE_AI_ENGINE_URL=https://plataforma-compradores-128y.onrender.com
```

### Recuperacion De Contrasena

El flujo de "me olvide contrasena" usa SMTP desde el backend. En produccion configura estas variables en Render:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=tu-correo@gmail.com
SMTP_PASS=tu-app-password-de-google
SMTP_FROM="Buyer Nodus <tu-correo@gmail.com>"
```

Si usas Gmail, `SMTP_PASS` debe ser una App Password de Google. Despues del deploy revisa `https://api.buyernodus.com/health`: debe mostrar `email.configured: true`, `hasUser: true` y `hasPassword: true`.

## Google Calendar OAuth

El flujo ya esta implementado para que compradores y expertos conecten su Google Calendar directamente desde el ecosistema.

Configuracion exacta:

- Local frontend: `http://127.0.0.1:5173`
- Local callback backend: `http://127.0.0.1:10000/experts/calendar/oauth/callback`
- Produccion frontend: `https://buyernodus.com`
- Produccion callback backend: `https://api.buyernodus.com/experts/calendar/oauth/callback`

Guia completa:

- [backend/GOOGLE_CALENDAR_OAUTH_SETUP.md](backend/GOOGLE_CALENDAR_OAUTH_SETUP.md)

## Usuario Administrador Inicial

- Email: `adolfo.mesa@buyernodus.com`
- Password: `Adolfo2026!`
- Email: `anna.torres@buyernodus.com`
- Password: `Anna2026!`

Los administradores globales del ecosistema pueden:

- Crear y eliminar videos educativos
- Crear y eliminar publicaciones
- Eliminar comentarios
- Activar y desactivar usuarios
- Consultar el panel general de administracion

## Nodus IA - Agentes

La base de Nodus IA usa un catalogo administrable de 8 agentes:

- `terms_of_reference`: active
- `proposal_comparison`: active
- `tco_analysis`: coming_soon
- `purchase_order`: coming_soon
- `dashboard_creator`: coming_soon
- `spend_analysis`: coming_soon
- `contract_risk_analysis`: coming_soon
- `supplier_evaluation_ranking`: coming_soon

El comprador ve las cards visibles desde Nodus IA. Solo los agentes `active` se pueden ejecutar; `coming_soon` y `disabled` aparecen bloqueados, y `hidden` no se muestra. El administrador cambia estos estados en `Admin -> Gestion de agentes IA`, donde tambien ve ejecuciones, tokens, costos, PDFs generados, feedback y recomendaciones de mejora.

La data base del catalogo vive en `shared/nodusIaAgents.ts`. Frontend, backend y seed de Mongo consumen ese mismo archivo para evitar diferencias entre cards, admin y API.

MongoDB guarda el catalogo en `agents`, las ejecuciones en `agentExecutions` y el feedback en `agentFeedback`. No se guardan archivos originales ni texto documental completo: solo resultados finales y metadatos de uso. El `ai-engine` tiene endpoints base para los seis agentes nuevos y PDF compartido en `ai-engine/app/utils/pdf_report.py`.

## Desarrollo Local

Instala dependencias:

```bash
npm install
cd backend
npm install
```

Inicia el backend:

```bash
npm run dev:backend
```

En otra terminal, inicia el frontend:

```bash
npm run dev:frontend
```

Abre:

- Frontend: `http://localhost:5173`
- Backend: `http://127.0.0.1:10000/health`

Localmente el frontend usa `VITE_API_URL=/api` desde `.env.development`, y Vite hace proxy al backend en `127.0.0.1:10000`. Produccion usa `.env.production` con `https://api.buyernodus.com`.

## Build

Frontend:

```bash
npm run build
```

Backend:

```bash
npm run build:backend
```

Todo:

```bash
npm run build:all
```
