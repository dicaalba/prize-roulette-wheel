# Ruleta de Premios — AWS Girls Perú

Aplicación web de ruleta de premios con gestión de stock en tiempo real, desplegada en AWS Lambda + API Gateway + S3 con frontend en GitHub Pages.

---

## URLs

| Página | URL |
|---|---|
| Ruleta (público) | https://dicaalba.github.io/prize-roulette-wheel/ |
| Panel Admin | https://dicaalba.github.io/prize-roulette-wheel/admin/ |
| Display / Pantalla grande | https://dicaalba.github.io/prize-roulette-wheel/display/ |
| API Backend | https://hkhkh8v50h.execute-api.us-east-1.amazonaws.com |

---

## Arquitectura

```
┌──────────────────────────────────────────────────────────────────┐
│                         PARTICIPANTES                            │
│               (escanean QR → GitHub Pages)                       │
└────────────────────────┬─────────────────────────────────────────┘
                         │ HTTPS
                         ▼
┌────────────────────────────────────┐
│           GitHub Pages             │
│       (Frontend Estático)          │
│                                    │
│  /            Ruleta               │
│  /admin/      Panel Admin          │──── polling HTTP /15s ────┐
│  /display/    Display evento       │                           │
└────────────────────────────────────┘                           │
                                                                  ▼
                                              ┌───────────────────────────────┐
                                              │        API Gateway            │
                                              │    (HTTP API + CORS)          │
                                              │   Throttle: 20 req/s          │
                                              └───────────────┬───────────────┘
                                                              │ Proxy
                                                              ▼
                                              ┌───────────────────────────────┐
                                              │         AWS Lambda            │
                                              │     (Node.js 20, 128MB)       │
                                              │     Timeout: 10s              │
                                              └───────────────┬───────────────┘
                                                              │ Lee/Escribe
                                                              ▼
                                              ┌───────────────────────────────┐
                                              │  S3: prize-roulette-data-     │
                                              │      703216893961             │
                                              │  Archivo: roulette.json       │
                                              │  (Persistencia permanente)    │
                                              └───────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│                       ORGANIZADORAS (evento)                     │
│              Laptop conectada al proyector                       │
└──────────┬────────────────────────────┬─────────────────────────┘
           │                            │
           ▼                            ▼
┌─────────────────────┐      ┌─────────────────────────┐
│  localhost:3000/    │      │  localhost:3000/display/ │
│  admin/             │      │  (Pantalla TV/Proyector)  │
│  (Panel Admin)      │      │                          │
└──────────┬──────────┘      └──────────┬───────────────┘
           │  WebSocket (ws://)          │  WebSocket (ws://)
           └──────────┬──────────────────┘
                      ▼
           ┌─────────────────────┐
           │  localhost:3000     │
           │  (Servidor Node.js) │
           │  + WebSocket real   │
           └──────────┬──────────┘
                      │ Lee/Escribe
                      ▼
           ┌─────────────────────┐
           │  data/roulette.json │
           │  (Local, persiste   │
           │   mientras corre)   │
           └─────────────────────┘
```

**Dos modos de operación:**

| Modo | Cuándo | Sincronización | Persistencia |
|---|---|---|---|
| **Localhost** | Desarrollo / evento en laptop | WebSocket real (instantáneo) | `data/roulette.json` local |
| **Producción** | GitHub Pages + Lambda | HTTP polling cada 15s | S3 `prize-roulette-data-703216893961` |

> En localhost el admin y el display se sincronizan por WebSocket sin hacer ninguna llamada a AWS. Los participantes en GitHub Pages consultan Lambda, que persiste en S3.

---

## Componentes

### Frontend (GitHub Pages)
| Archivo | Descripción |
|---|---|
| `public/index.html` | Ruleta principal — los participantes giran aquí |
| `public/admin/` | Panel de administración — gestión de premios y stock |
| `public/display/` | Pantalla grande para el evento — premios e info de comunidad |
| `public/js/config.js` | URL del backend — automático: vacío en localhost, AWS en producción |
| `public/js/wsClient.js` | WebSocket en localhost / polling cada 15s en producción |

### Backend (AWS Lambda)
| Archivo | Descripción |
|---|---|
| `lambda.js` | Handler principal de Lambda |
| `src/server.js` | Servidor local con WebSocket real |
| `src/server-handler.js` | Router de rutas API y archivos estáticos |
| `src/routes/prizes.js` | CRUD de premios, login, spin, config |
| `src/db/database.js` | Persistencia JSON — local en `/data/`, S3 en Lambda |
| `src/services/spinService.js` | Lógica del giro — selección aleatoria ponderada |

### Infraestructura AWS
| Recurso | Nombre / Config |
|---|---|
| S3 Bucket | `prize-roulette-data-703216893961` |
| ECR Repository | `prize-roulette-wheel` |
| Lambda Function | 128MB, 10s timeout, x86_64, Node.js 20 |
| API Gateway | HTTP API, CORS `*`, throttle 20 req/s, burst 50 |
| IAM Role | `prize-roulette-lambda-role` |

---

## Costos AWS

### Estimado para un evento de 4 horas (~500 participantes)

Con polling reducido a 15s y admin/display usando WebSocket local:

| Servicio | Precio | Uso estimado | Costo |
|---|---|---|---|
| **Lambda** invocaciones | $0.20/millón | ~7,000 (spins + polls) | **$0.00** (free tier) |
| **Lambda** cómputo | $0.0000166667/GB-s | 7,000 × 0.128GB × 0.3s | **$0.00** (free tier) |
| **API Gateway HTTP** | $1.00/millón requests | ~7,000 requests | **$0.00** (free tier) |
| **S3** almacenamiento | $0.023/GB-mes | ~10KB JSON | **$0.00** |
| **S3** operaciones PUT | $0.005/1,000 | ~100 writes (admin CRUD) | **$0.00** |
| **S3** operaciones GET | $0.0004/1,000 | ~50 reads (cold starts) | **$0.00** |
| **ECR** | $0.10/GB-mes | ~0.12 GB imagen | **~$0.01** |
| **CloudWatch Logs** | $0.50/GB ingestado | <1 MB | **$0.00** |
| **GitHub Pages** | Gratuito | — | **$0.00** |
| **TOTAL** | | | **~$0.01** |

> **Free tier mensual:** Lambda — 1M invocaciones y 400,000 GB-segundo gratis. API Gateway HTTP — 1M requests gratis los primeros 12 meses. S3 — 5GB almacenamiento, 20,000 GETs y 2,000 PUTs gratis.

### Desglose de llamadas API (antes vs después)

| Fuente | Antes (polling 3s) | Después (WS/15s) | Reducción |
|---|---|---|---|
| Admin (localhost) | 1,200/hora | **0** (WebSocket) | **100%** |
| Display (localhost) | 1,200/hora | **0** (WebSocket) | **100%** |
| Participantes (GitHub Pages) | 1,200/hora c/u | 240/hora c/u | **80%** |
| **Total evento 4h** | ~10,000+ | ~7,000 | **~30% menos** |

### Comparativa de opciones de deploy

| Opción | Costo/mes | WebSocket | Persistencia |
|---|---|---|---|
| **Lambda + API Gateway + S3** ✅ | ~$0.01 | WS en local / polling en prod | Permanente (S3) |
| Lambda + API Gateway (sin S3) | ~$0.01 | WS en local / polling en prod | Efímera (/tmp) |
| ECS Fargate | ~$15–30 | Sí | Efímera (necesita EFS/RDS) |
| EC2 t3.micro | ~$8 | Sí | Persistente |
| Lambda + DynamoDB | ~$0–1 | Polling | Permanente |

---

## Despliegue

### Prerrequisitos
- AWS CLI configurado con credenciales activas
- Docker Desktop corriendo
- Permisos: ECR, Lambda, IAM, API Gateway, S3

### Configurar S3 para persistencia (obligatorio para producción)

El Lambda necesita la variable de entorno `S3_BUCKET` para guardar los cambios de premios permanentemente. Sin esto, los datos se pierden cuando el container Lambda se recicla (~15 min de inactividad).

**Desde la consola AWS** → Lambda → tu función → Configuration → Environment variables:
```
S3_BUCKET = prize-roulette-data-703216893961
```

**O al hacer deploy:**
```bash
S3_BUCKET=prize-roulette-data-703216893961 ./deploy-aws.sh
```

El bucket ya existe. El IAM role de Lambda necesita permisos `s3:GetObject` y `s3:PutObject` sobre ese bucket.

### Primer deploy
```bash
chmod +x deploy-aws.sh
./deploy-aws.sh
```

### Re-deploy (actualización de código)
```bash
./deploy-aws.sh
```

### Activar GitHub Pages
1. Ir a **Settings → Pages** en el repo
2. Source: **GitHub Actions**
3. El workflow `.github/workflows/deploy-pages.yml` se ejecuta en cada push a `main`

### Variables de entorno Lambda
```
S3_BUCKET        = prize-roulette-data-703216893961   # Persistencia (obligatorio)
ADMIN_PASSWORD   = tu-password-seguro
MEETUP_URL       = https://www.meetup.com/aws-girls-peru/
WEB_APP_URL      = https://dicaalba.github.io/prize-roulette-wheel/
```

---

## Desarrollo local

```bash
npm install
node src/server.js
```

| URL | Descripción |
|---|---|
| http://localhost:3000/ | Ruleta principal |
| http://localhost:3000/admin/ | Panel admin (con la barra final) |
| http://localhost:3000/display/ | Pantalla evento |

**En localhost:**
- Todas las llamadas API van al servidor local (no a AWS)
- Admin y display se sincronizan por WebSocket real — sin polling, sin costo
- Los datos persisten en `data/roulette.json` mientras el servidor esté corriendo

---

## Limpieza post-evento

```bash
chmod +x cleanup-aws.sh
./cleanup-aws.sh
```

Elimina: Lambda, API Gateway, ECR repository, IAM role.
El bucket S3 **no se elimina** (tiene los datos del evento).

---

## FAQ

**¿Por qué no usa WebSocket en producción?**
Lambda no soporta conexiones persistentes. El frontend detecta el entorno: usa WebSocket real en localhost y polling HTTP cada 15s en producción. Para WebSocket en producción se necesitaría API Gateway WebSocket (~$0 extra) o migrar a ECS/EC2.

**¿Por qué API Gateway y no Lambda Function URL?**
La cuenta AWS tiene una política organizacional (SCP) que bloquea el acceso público a Function URLs. API Gateway HTTP API es la alternativa con el mismo costo (~$0 en free tier).

**¿Los premios se resetean si reinicio el servidor local?**
No. Los datos se guardan en `data/roulette.json` y persisten entre reinicios del servidor local.

**¿Los premios se resetean en Lambda?**
No, si `S3_BUCKET` está configurado. Cada escritura (crear/editar/eliminar premio, giro ganador) se guarda en S3. Cada nuevo container Lambda carga desde S3 al iniciar.

**¿El admin de GitHub Pages y el admin de localhost comparten datos?**
No directamente. El admin en localhost modifica `data/roulette.json` local. El admin en GitHub Pages modifica el estado en Lambda/S3. Para el evento, se recomienda usar el admin en localhost para tener WebSocket en tiempo real con el display.

---

Hecho con amor para [AWS Girls Perú](https://awsgirlsperu.com)
