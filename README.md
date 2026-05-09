# UñaPezuña — Full Serverless App en AWS

> Proyecto 5 del portfolio AWS · Aplicación de reservas para negocio real de manicura en Madrid

🌐 **[Ver en producción → unapezuna.es](https://unapezuna.es)**

---

## ¿Qué es esto?

Aplicación web completa y serverless para un negocio real de manicura en Madrid. Cubre el flujo completo: registro de clientas, autenticación, reserva de citas, confirmación por email y panel de administración.

Construido como parte de un portfolio de AWS para demostrar arquitectura serverless real en producción, no solo demos.

---

## Stack

### Frontend
- React + Vite + CSS Modules
- Autenticación con `amazon-cognito-identity-js`
- Desplegado en **Amazon S3** + **Amazon CloudFront**
- Dominio propio con **Amazon Route 53** + SSL con **AWS Certificate Manager**

### Backend
- 17 funciones **AWS Lambda** en Python
- **Amazon API Gateway** HTTP con autorizador JWT de Cognito
- **Amazon DynamoDB** — 4 tablas (reservas, clientes, servicios, disponibilidad)
- **Amazon SQS** + DLQ para mensajería asíncrona
- **Amazon S3** para almacenamiento de fotos (presigned URLs)
- Emails transaccionales con **Resend** (dominio propio verificado)

### Auth
- **Amazon Cognito** — User Pool con grupos (Admins / Clientes)
- JWT refresh automático con `cognitoUserRef`

---

## Arquitectura

```
Usuario
  ├── unapezuna.es → Route53 → CloudFront → S3 (React SPA)
  └── Login → Amazon Cognito → JWT
                    │
                    ▼
          Amazon API Gateway HTTP
                    │ (valida JWT automáticamente)
                    ▼
          AWS Lambda (Python)
                    ├── Amazon DynamoDB
                    ├── Amazon S3 (fotos privadas)
                    └── Amazon SQS → Lambda → Resend API

Cognito Post Confirmation → Lambda crear-cliente → DynamoDB
```

---

## Funcionalidades

### Clientas
- Registro y login con verificación de email
- Catálogo de servicios con precio y duración
- Reserva de citas en 5 pasos con calendario visual
- Filtro de huecos por duración del servicio (slots consecutivos)
- Confirmación de reserva por email
- Historial de citas con opción de cancelación

### Panel Admin
- Calendario mensual con días en verde/rojo según disponibilidad
- Panel del día: reservas, huecos libres y bloqueados
- Crear huecos en rango horario
- Bloquear huecos manualmente
- Historial completo de cada clienta
- Subida de fotos antes/después por reserva (presigned URLs a S3)
- Reservas manuales para clientas sin cuenta (sinPerfil)
- Búsqueda de clientas por email

---

## Lambdas

| Función | Ruta | Descripción |
|---|---|---|
| unapezuna-listar-servicios | GET /servicios | Catálogo de servicios |
| unapezuna-listar-disponibilidad | GET /disponibilidad | Huecos por fecha |
| unapezuna-listar-disponibilidad-mes | GET /disponibilidad/mes | Vista mensual para calendario |
| unapezuna-crear-cliente | (Cognito trigger) | Crea perfil tras verificación de email |
| unapezuna-crear-reserva | POST /reservas | Crea reserva + bloquea huecos + envía a SQS |
| unapezuna-cancelar-reserva | DELETE /reservas | Cancela y libera huecos |
| unapezuna-historial-citas | GET /reservas | Citas de la clienta autenticada |
| unapezuna-enviar-email | (SQS trigger) | Confirmación por email vía Resend |
| unapezuna-panel-admin | GET /admin | Reservas del día para el admin |
| unapezuna-crear-disponibilidad | POST /disponibilidad | Crea huecos en rango horario |
| unapezuna-bloquear-hueco | POST /disponibilidad/bloquear | Bloquea hueco manualmente |
| unapezuna-admin-historial-cliente | GET /admin/cliente | Historial completo + presigned URLs fotos |
| unapezuna-admin-buscar-cliente | GET /admin/buscar-cliente | Busca clienta por email |
| unapezuna-admin-actualizar-contacto | PATCH /admin/contacto | Actualiza datos de contacto |
| unapezuna-admin-fotos-url | POST /admin/fotos/url | Genera presigned PUT URL para subida a S3 |
| unapezuna-admin-fotos-guardar | PUT /admin/fotos/guardar | Guarda s3Key en la reserva |
| formulario-contacto | POST /contacto | Formulario de contacto vía SES |

---

## Tablas DynamoDB

| Tabla | PK | SK | GSI |
|---|---|---|---|
| unapezuna-servicios | servicioId | — | — |
| unapezuna-clientes | clienteId | — | — |
| unapezuna-reservas | clienteId | reservaId | fecha-index (PK: fecha, SK: horaInicio) |
| unapezuna-disponibilidad | fecha | horaInicio | — |

---

## Decisiones técnicas destacadas

**SQS entre crear-reserva y enviar-email** — desacopla la creación de la reserva del envío del email. Si Resend falla, el mensaje se reintenta 3 veces automáticamente. Si falla todo, va a la DLQ sin perderse. La reserva y el email son independientes.

**OAC en CloudFront + S3 privado** — el bucket S3 no tiene acceso público. Solo CloudFront puede leer su contenido mediante Origin Access Control. Mejor práctica actual (reemplaza al antiguo OAI).

**JWT refresh automático** — `cognitoUserRef` mantiene el objeto CognitoUser en memoria por tab. `getToken()` usa la SDK para refrescar el token automáticamente cuando caduca (1h), usando el Refresh Token (30 días). Ninguna llamada a la API usa `user.token` directamente.

**Presigned URLs para fotos** — las fotos nunca pasan por Lambda. El frontend sube directamente a S3 con una presigned PUT URL (15 min). Para ver las fotos, se generan presigned GET URLs (2h). Sin límite de tamaño de Lambda, sin coste de transferencia adicional.

**CloudFront Functions para redirects** — `unapezuna.com` y `uñapezuña.es` redirigen a `unapezuna.es` mediante una CloudFront Function en el evento Viewer Request. La función intercepta antes de llegar al origen, sin coste real de S3.

---

## Coste real en producción

| Servicio | Coste/mes |
|---|---|
| CloudFront + S3 | ~$0.50 |
| Route 53 (3 hosted zones) | ~$1.50 |
| DynamoDB (on-demand) | ~$0.50 |
| Lambda / SQS / SES / Resend | ~$0 |
| **Total estimado** | **~$3/mes** |

---

## Región

`us-east-1` — ACM para CloudFront requiere us-east-1 obligatoriamente.

---

## Autor

**Yucami** · AWS Certified Solutions Architect Associate  
[yucami.com](https://yucami.com) · [contacto@yucami.com](mailto:contacto@yucami.com)
