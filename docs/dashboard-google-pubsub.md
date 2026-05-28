# Dashboard Creator Pub/Sub Notification

El agente `dashboard_creator` puede publicar un evento opcional cuando termina de generar un dashboard correctamente.

## Evento

`dashboard_creator.completed`

## Variables de entorno

- `GOOGLE_CLOUD_PROJECT_ID`: ID del proyecto Google Cloud.
- `GOOGLE_PUBSUB_TOPIC_DASHBOARD_READY`: nombre del topic Pub/Sub.
- `GOOGLE_APPLICATION_CREDENTIALS`: ruta al archivo de credenciales de servicio, si el entorno lo requiere.

Si estas variables no existen, la generacion del dashboard continua normalmente y solo se registra un log interno informativo.

## Payload

```json
{
  "event": "dashboard_creator.completed",
  "agentKey": "dashboard_creator",
  "userId": null,
  "dashboardId": "dashboard-ejemplo-2026-05-27t19-00-00",
  "reportName": "Dashboard ejecutivo de compras",
  "status": "completed",
  "generatedAt": "2026-05-27T19:00:00Z",
  "filesCount": 2,
  "downloadFormats": ["pdf", "excel", "pptx"]
}
```

## Comportamiento

- Se publica solo despues de validar y construir un `DashboardResult` correcto.
- No se publica si falla el analisis o la validacion principal.
- Si Pub/Sub falla, el error se ignora para el usuario y se registra como warning interno.
- Google Cloud no es obligatorio para usar el agente.

## Configuracion rapida

1. Crear un topic Pub/Sub en Google Cloud.
2. Configurar una cuenta de servicio con permiso `pubsub.publisher`.
3. Configurar las variables de entorno anteriores en el servicio `buyernodus-ai-engine`.
4. Redeploy del servicio.

