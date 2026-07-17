# Despliegue en AWS Lambda (Serverless)

La opción más económica para correr la ruleta unas horas. Pagas solo por invocación (~$0 para un evento).

## Prerrequisitos

1. **AWS CLI** configurado con credenciales (`aws configure`)
2. **Docker** instalado y corriendo

## Despliegue Rápido

```bash
# Configurar variables (opcional)
export ADMIN_PASSWORD="tu_contraseña_secreta"
export MEETUP_URL="https://www.meetup.com/awsgirlsperu"
export AWS_REGION="us-east-1"

# Desplegar
chmod +x deploy-aws.sh
./deploy-aws.sh
```

El script te dará la URL pública de la aplicación.

## Variables de Entorno

| Variable | Default | Descripción |
|----------|---------|-------------|
| `ADMIN_PASSWORD` | `admin123` | Contraseña del panel admin |
| `MEETUP_URL` | `https://www.meetup.com` | URL del grupo en Meetup |
| `WEB_APP_URL` | (auto) | URL pública de la app (para el QR) |
| `AWS_REGION` | `us-east-1` | Región de AWS |

## Estimación de Costos

Para un evento de 2-4 horas con ~100 participantes:

| Recurso | Costo Estimado |
|---------|---------------|
| Lambda invocaciones | ~$0.00 (free tier: 1M requests/mes) |
| Lambda duración | ~$0.00 (free tier: 400,000 GB-s/mes) |
| ECR storage | ~$0.01 (por la imagen Docker) |
| **Total** | **~$0.01** |

## Limitaciones en Lambda

- **WebSocket no disponible**: El frontend detecta automáticamente la falta de WebSocket y usa HTTP polling (cada 3 segundos) como fallback.
- **Storage efímero**: Los datos se guardan en `/tmp` que se pierde entre invocaciones. Para un evento de pocas horas con tráfico constante, la función se mantiene "caliente" y los datos persisten.
- **Cold start**: La primera invocación tarda 2-3 segundos. Después es instantáneo.

## Alternativa: Servidor Local

Si necesitas WebSocket en tiempo real o el evento dura más:

```bash
# Instalar y correr localmente
npm start
```

Para exponer localmente a internet, usa [ngrok](https://ngrok.com):
```bash
ngrok http 3000
```

## Limpieza (Después del Evento)

```bash
chmod +x cleanup-aws.sh
./cleanup-aws.sh
```

Esto elimina todos los recursos de AWS para evitar cargos futuros.

## Arquitectura

```
Internet → Lambda Function URL → Lambda Container → Express Handler
                                                   ├── /api/prizes (CRUD)
                                                   ├── /api/spin
                                                   ├── /api/auth/login
                                                   ├── / (Ruleta)
                                                   ├── /admin (Panel)
                                                   └── /display (QR Screen)
```
