# SupplySavvy Connect

## Stack

- Frontend: React + Vite
- Backend: NestJS
- Database: MongoDB

## Variables recomendadas

### Backend

```env
MONGODB_URI=mongodb://127.0.0.1:27017
MONGODB_DB_NAME=supplyconnect
JWT_SECRET=dev-supplyconnect-secret
PORT=3000
```

## Usuario administrador inicial

- Email: `admin@supplyconnect.com`
- Password: `Admin12345!`

Solo puede existir un administrador global en toda la plataforma. Ese usuario puede:

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

### Backend

```bash
cd backend
npm install
npm run build
```
