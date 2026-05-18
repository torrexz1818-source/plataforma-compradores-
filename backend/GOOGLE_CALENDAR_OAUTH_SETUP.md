# Google Calendar OAuth Setup

## URLs de esta plataforma

### Desarrollo local

- Frontend: `http://127.0.0.1:5173`
- Backend: `http://127.0.0.1:10000`
- Callback OAuth: `http://127.0.0.1:10000/experts/calendar/oauth/callback`

### Produccion actual

- Frontend: `https://buyernodus.com`
- Backend: `https://api.buyernodus.com`
- Callback OAuth: `https://api.buyernodus.com/experts/calendar/oauth/callback`

## Configuracion en Google Cloud Console

1. Entra a `APIs & Services > OAuth consent screen`.
2. Configura la app y agrega el scope:
   - `https://www.googleapis.com/auth/calendar`
   - `openid`
   - `email`
3. Ve a `Credentials > Create Credentials > OAuth client ID`.
4. Elige `Web application`.
5. Agrega estos `Authorized redirect URIs`:
   - `http://127.0.0.1:10000/experts/calendar/oauth/callback`
   - `https://api.buyernodus.com/experts/calendar/oauth/callback`
6. Agrega estos `Authorized JavaScript origins`:
   - `http://127.0.0.1:5173`
   - `https://buyernodus.com`
   - `https://www.buyernodus.com`
7. Copia el `Client ID` y el `Client Secret`.

## Variables de entorno backend

### Desarrollo local

```env
GOOGLE_CLIENT_ID=tu-client-id-google
GOOGLE_CLIENT_SECRET=tu-client-secret-google
GOOGLE_OAUTH_REDIRECT_URI=http://127.0.0.1:10000/experts/calendar/oauth/callback
FRONTEND_URL=http://127.0.0.1:5173
GOOGLE_CALENDAR_TIMEZONE=America/Lima
APP_TIMEZONE=America/Lima
```

### Produccion

```env
GOOGLE_CLIENT_ID=tu-client-id-google
GOOGLE_CLIENT_SECRET=tu-client-secret-google
GOOGLE_OAUTH_REDIRECT_URI=https://api.buyernodus.com/experts/calendar/oauth/callback
FRONTEND_URL=https://buyernodus.com
GOOGLE_CALENDAR_TIMEZONE=America/Lima
APP_TIMEZONE=America/Lima
```

## Flujo final en la plataforma

1. El comprador o experto entra a `Conectar Google Calendar`.
2. La app pide una URL OAuth al backend.
3. El usuario autoriza en Google.
4. Google redirige al backend en `/experts/calendar/oauth/callback`.
5. El backend intercambia el `code`, guarda el `refresh token` y marca la cuenta como conectada.
6. El usuario vuelve automaticamente a la plataforma ya conectado.

## Nota importante

Para que Google entregue `refresh token`, la app ya fuerza `access_type=offline` y `prompt=consent`. Si alguna cuenta ya autorizo antes y no devuelve refresh token, revoca el acceso previo en Google y vuelve a conectar.
