# 🎰 Ruleta de Premios — AWS Girls Perú

Aplicación web de ruleta de premios con gestión de stock en tiempo real, desplegada en AWS Lambda + API Gateway con frontend en GitHub Pages.

---

## 🌐 URLs

| Página | URL |
|---|---|
| 🎰 Ruleta (público) | https://dicaalba.github.io/prize-roulette-wheel/ |
| 🔐 Panel Admin | https://dicaalba.github.io/prize-roulette-wheel/admin/ |
| 📺 Display / Pantalla grande | https://dicaalba.github.io/prize-roulette-wheel/display/ |
| 🔌 API Backend | https://hkhkh8v50h.execute-api.us-east-1.amazonaws.com |

---

## 🏗️ Arquitectura

```
┌─────────────────────────────────────────────────────────────┐
│                        USUARIO FINAL                        │
└──────────────┬──────────────────────────────┬──────────────┘
               │ HTTPS                        │ HTTPS
               ▼                              ▼
┌──────────────────────────┐    ┌─────────────────────────────┐
│      GitHub Pages        │    │       API Gateway           │
│  (Frontend Estático)     │───▶│     (HTTP API + CORS)       │
│                          │    │   Throttle: 20 req/s        │
│  /             Ruleta    │    └──────────────┬──────────────┘
│  /admin/       Admin     │                   │ Proxy
│  /display/     Display   │                   ▼
└──────────────────────────┘    ┌─────────────────────────────┐
                                │       AWS Lambda            │
                                │    (Node.js 20, 128MB)      │
                                │    Timeout: 10s             │
                                │    Arquitectura: x86_64     │
                                └──────────────┬──────────────┘
                                               │ Lee/Escribe
                                               ▼
                                ┌─────────────────────────────┐
                                │   /tmp/roulette.json        │
                                │  (Efímero por contenedor)   │
                                └─────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                          AWS ECR                            │
│           Imagen Docker (linux/amd64, ~120MB)               │
└─────────────────────────────────────────────────────────────┘
```

> ⚠️ **Nota sobre persistencia**: Los datos se almacenan en `/tmp` dentro de Lambda. Son efímeros — se resetean cuando el contenedor se recicla. Para un evento de pocas horas esto es suficiente. Para persistencia entre eventos, conectar DynamoDB o S3.

---

## 🧩 Componentes

### Frontend (GitHub Pages)
| Archivo | Descripción |
|---|---|
| `public/index.html` | Ruleta principal — los participantes giran aquí |
| `public/admin/` | Panel de administración — gestión de premios y stock |
| `public/display/` | Pantalla grande para el evento — muestra premios disponibles e info de la comunidad |
| `public/js/config.js` | **URL del backend** — actualizar si cambia la API |
| `public/js/wsClient.js` | Cliente HTTP polling (reemplaza WebSocket, incompatible con Lambda) |

### Backend (AWS Lambda)
| Archivo | Descripción |
|---|---|
| `lambda.js` | Handler principal de Lambda — adapta HTTP ↔ Lambda |
| `src/server-handler.js` | Router de rutas API y archivos estáticos |
| `src/routes/prizes.js` | CRUD de premios, login, spin, config |
| `src/db/database.js` | Persistencia JSON en `/tmp` |
| `src/services/spinService.js` | Lógica del giro — selección aleatoria ponderada |

### Infraestructura AWS
| Recurso | Configuración |
|---|---|
| ECR Repository | `prize-roulette-wheel` — imagen Docker |
| Lambda Function | 128MB, 10s timeout, x86_64, Node.js 20 |
| API Gateway HTTP API | CORS `*`, throttle 20 req/s, burst 50 |
| IAM Role | `prize-roulette-lambda-role` — solo logs básicos |

---

## 💰 Tabla de Costos

### Estimado para un evento de 4 horas (~500 participantes)

| Servicio | Precio | Uso estimado | Costo |
|---|---|---|---|
| **Lambda** | $0.20/millón invocaciones | ~2,000 invocaciones | **$0.00** (free tier) |
| **Lambda** (cómputo) | $0.0000166667/GB-segundo | 2,000 × 0.128GB × 0.5s | **$0.00** (free tier) |
| **API Gateway HTTP** | $1.00/millón requests | ~2,000 requests | **$0.00** (free tier) |
| **ECR** | $0.10/GB-mes | ~0.12 GB imagen | **~$0.01** |
| **CloudWatch Logs** | $0.50/GB ingestado | <1 MB logs | **$0.00** |
| **GitHub Pages** | Gratuito | — | **$0.00** |
| **TOTAL** | | | **~$0.01** |

> **Free tier mensual**: Lambda incluye 1M invocaciones y 400,000 GB-segundo gratis. API Gateway HTTP incluye 1M requests gratis durante los primeros 12 meses.

### Comparativa de opciones de deploy
| Opción | Costo/mes (uso bajo) | WebSocket | Persistencia |
|---|---|---|---|
| Lambda + API Gateway ✅ | ~$0 | ❌ (polling) | Efímera (/tmp) |
| ECS Fargate | ~$15–30 | ✅ | Efímera |
| EC2 t3.micro | ~$8 | ✅ | Persistente |
| Lambda + DynamoDB | ~$0–1 | ❌ (polling) | Persistente |

---

## 🚀 Despliegue

### Prerrequisitos
- AWS CLI configurado con credenciales activas
- Docker Desktop corriendo
- Credenciales con permisos: ECR, Lambda, IAM, API Gateway

### Primer deploy
```bash
chmod +x deploy-aws.sh
./deploy-aws.sh
```

El script:
1. Crea el repositorio ECR
2. Construye la imagen Docker (`linux/amd64`, sin cache)
3. Crea el rol IAM de Lambda
4. Crea o actualiza la función Lambda (128MB, 10s, x86_64)
5. Crea o reutiliza API Gateway con CORS y throttling
6. Muestra las URLs al finalizar

### Re-deploy (actualización de código)
```bash
./deploy-aws.sh
```
Siempre hace rebuild completo sin cache para garantizar que los últimos cambios se incluyan.

### Activar GitHub Pages
1. Ir a **Settings → Pages** en el repo
2. Source: **GitHub Actions**
3. El workflow `.github/workflows/deploy-pages.yml` se ejecuta automáticamente en cada push a `main`

### Variables de entorno opcionales
```bash
ADMIN_PASSWORD=mipassword ./deploy-aws.sh
MEETUP_URL=https://www.meetup.com/mi-grupo/ ./deploy-aws.sh
```

---

## 🔧 Desarrollo local

```bash
npm install
node src/server.js
# Abre http://localhost:3000
```

---

## 🧹 Limpieza post-evento

```bash
chmod +x cleanup-aws.sh
./cleanup-aws.sh
```

Elimina: Lambda, API Gateway, ECR repository, IAM role.

---

## ❓ FAQ

**¿Por qué no usa WebSocket?**
Lambda no soporta conexiones persistentes. El frontend hace polling HTTP cada 3 segundos como alternativa — suficiente para sincronización en tiempo real en un evento.

**¿Por qué API Gateway y no Lambda Function URL?**
La cuenta AWS tiene una política organizacional (SCP) que bloquea el acceso público a Function URLs. API Gateway HTTP API es la alternativa y tiene el mismo costo (~$0 en free tier).

**¿Los premios se resetean si reinicio?**
Sí. Lambda almacena datos en `/tmp` que es efímero. Para un evento de horas es suficiente. Si necesitas persistencia, se puede agregar DynamoDB con ~$0 adicional de costo.

---

Hecho con 💜 para [AWS Girls Perú](https://awsgirlsperu.com)
