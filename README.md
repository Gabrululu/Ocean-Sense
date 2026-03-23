# 🌊 Ocean-Sense Network

**DePIN para Monitoreo Oceánico Descentralizado del Litoral Peruano**

> Red descentralizada de boyas IoT operadas por pescadores artesanales que registran datos oceánicos en tiempo real en la blockchain de Solana, con recompensas automáticas por cada dato válido reportado.

---

## El Problema

Perú tiene **3,080 km de costa** sin datos oceánicos en tiempo real. La ausencia de información confiable sobre temperatura, corrientes y contaminación impacta directamente a los **40,000 pescadores artesanales** que operan en el litoral.

El fenómeno de **El Niño 2023–2024** causó **$3B en pérdidas económicas**, en gran parte porque no existía infraestructura de monitoreo descentralizada que permitiera alertas tempranas.

Los sistemas de monitoreo actuales son:
- **Centralizados**: operados por pocas instituciones (IMARPE, SENAHMI)
- **Escasos**: cobertura insuficiente para los 3,080 km de litoral
- **Lentos**: los datos no llegan en tiempo real a quienes más los necesitan
- **Opacos**: sin incentivos para que comunidades locales participen

---

## La Solución

Ocean-Sense Network es una red **DePIN** (Decentralized Physical Infrastructure Network) donde:

1. **Pescadores artesanales** operan boyas IoT de bajo costo en sus zonas de pesca
2. Las boyas miden parámetros oceánicos y envían datos a Solana vía transacciones
3. El programa on-chain valida y registra cada lectura de forma **inmutable y pública**
4. Los operadores reciben **recompensas en SOL** automáticamente por cada dato válido
5. Las alertas de contaminación crítica se detectan y emiten **en tiempo real**

---

## Fase 1 — Programa On-Chain (actual)

### Instrucciones del programa

| Instrucción | Descripción |
|---|---|
| `register_buoy` | Registra una boya con ID único, coordenadas GPS y nombre de zona |
| `submit_reading` | Envía lectura oceánica: temperatura, salinidad, oleaje y nivel de contaminación |
| `toggle_buoy` | Activa o desactiva una boya (solo el operador dueño) |

### Parámetros oceánicos registrados on-chain

| Parámetro | Tipo | Unidad on-chain | Ejemplo real |
|---|---|---|---|
| Temperatura | `i32` | centésimas de °C | `2250` = 22.50°C |
| Salinidad | `u32` | centésimas de PSU | `3510` = 35.10 PSU |
| Altura de ola | `u32` | centímetros | `85` = 0.85 m |
| Contaminación | `u8` | nivel 0–3 | `3` = crítico 🚨 |
| Timestamp | `i64` | Unix timestamp | del sensor IoT |

> **¿Por qué enteros y no decimales?** Solana no tiene soporte nativo para floats en programas on-chain. Usar enteros escalados (centésimas) evita problemas de precisión y es una práctica estándar en el ecosistema.

### Modelo de recompensas

Las recompensas incentivan tanto la cobertura continua como el reporte urgente de eventos críticos:

| Nivel de contaminación | Descripción | Recompensa |
|---|---|---|
| `0` | Agua limpia | 0.001 SOL |
| `1` | Contaminación leve | 0.001 SOL |
| `2` | Contaminación moderada | 0.002 SOL |
| `3` | Contaminación crítica 🚨 | 0.005 SOL |

---

## Arquitectura On-Chain

### Modelo de cuentas (PDAs)

```
Operator Wallet (Signer — pescador artesanal)
    │
    ├── PDA: BuoyState
    │   seeds: ["buoy", buoy_id, operator_pubkey]
    │   space: 182 bytes
    │   │
    │   Almacena:
    │   ├── owner: Pubkey
    │   ├── buoy_id: String (max 32 chars)
    │   ├── latitude / longitude: i64
    │   ├── location_name: String (max 64 chars)
    │   ├── is_active: bool
    │   ├── total_readings: u64
    │   ├── total_rewards: u64
    │   └── last_reading_timestamp: i64
    │
    └── PDA: OceanReading (una cuenta por lectura)
        seeds: ["reading", buoy_pubkey, reading_index_le]
        space: 109 bytes
        │
        Almacena:
        ├── buoy: Pubkey
        ├── operator: Pubkey
        ├── temperature, salinity, wave_height
        ├── pollution_level: u8
        ├── timestamp: i64
        ├── reward_lamports: u64
        └── reading_index: u64
```

### ¿Por qué PDAs?

- **Sin custodia**: no existe llave privada que controle el estado de una boya — solo el programa puede modificarlo
- **Determinístico**: cualquier cliente puede derivar la dirección de cualquier boya o lectura conociendo sus seeds
- **Indexable**: cada lectura tiene su propia cuenta con un índice, fácil de paginar y consultar
- **Composable**: otros programas pueden leer el estado de Ocean-Sense sin permisos especiales

### Eventos emitidos

El programa emite eventos que cualquier indexador o frontend puede escuchar:

| Evento | Cuándo se emite |
|---|---|
| `BuoyRegistered` | Al registrar una nueva boya |
| `ReadingSubmitted` | Por cada lectura enviada exitosamente |
| `PollutionAlert` | Solo cuando `pollution_level == 3` 🚨 |

---

## Quickstart en Solana Playground

### Requisitos
- Cuenta en [beta.solpg.io](https://beta.solpg.io) (no requiere instalación local)
- Wallet de Phantom o similar conectada a Devnet
- SOL de prueba (mínimo 4–5 SOL en Devnet para el deploy)

### Paso 1 — Crear proyecto
Ve a [beta.solpg.io](https://beta.solpg.io), clic en **"Create a new project"** y selecciona **Anchor (Rust)**.

### Paso 2 — Pegar el programa
Reemplaza todo el contenido de `src/lib.rs` con el archivo `lib.rs` de este repositorio.

### Paso 3 — Build
Haz clic en **Build** o ejecuta en la terminal:
```
build
```
Tiempo esperado: ~10 segundos.

### Paso 4 — Obtener SOL de prueba
En la terminal de Playground:
```
connect
solana airdrop 5
```
O usa el faucet web: [faucet.solana.com](https://faucet.solana.com)

> El deploy inicial cuesta ~1.82 SOL (refundable al cerrar el programa). Ten al menos 4–5 SOL disponibles.

### Paso 5 — Deploy
Haz clic en **Deploy**. Playground publicará el programa en Devnet y te asignará un **Program ID** único.

### Paso 6 — Tests
Reemplaza el contenido de `tests/anchor.test.ts` con el archivo de tests de este repositorio y haz clic en **Test**.

Resultado esperado:
```
🌊 Ocean-Sense Network
  ✔ Registra una boya en el litoral peruano
  ✔ Envía una lectura oceánica (agua limpia)
  ✔ Detecta contaminación crítica y da mayor recompensa
  ✔ Desactiva la boya (mantenimiento)
  ✔ Rechaza lecturas cuando la boya está inactiva
  ✔ Reactiva la boya y muestra estadísticas finales

6 passing
```

---

## Estructura del Proyecto

```
ocean-sense/
├── programs/
│   └── ocean-sense/
│       └── src/
│           └── lib.rs              ← Programa Anchor en Rust
├── tests/
│   └── anchor.test.ts              ← Tests en TypeScript (para Playground)
└── README.md
```

---

## Errores personalizados

| Código | Error | Descripción |
|---|---|---|
| `6000` | `StringTooLong` | El campo string supera el tamaño máximo permitido |
| `6001` | `InvalidPollutionLevel` | El nivel de contaminación debe ser 0–3 |
| `6002` | `BuoyNotActive` | La boya está desactivada, no acepta lecturas |
| `6003` | `Unauthorized` | Solo el operador dueño puede ejecutar esta acción |
| `6004` | `Overflow` | Error de overflow aritmético en contadores |

---

## Roadmap

### ✅ Fase 1 — Programa base (actual)
- [x] Registro de boyas on-chain con PDAs
- [x] Lecturas oceánicas inmutables y verificables
- [x] Sistema de recompensas automático en SOL
- [x] Alertas de contaminación crítica en tiempo real
- [x] Errores personalizados y validaciones de seguridad
- [x] Tests completos en TypeScript

### 🔜 Fase 2 — Token y gobernanza
- [ ] Token SPL propio (`$OCEAN`) como moneda de recompensas
- [ ] Staking para operadores de boyas (skin in the game)
- [ ] Mecanismo de validación entre pares (detectar lecturas falsas)
- [ ] Oracle de condiciones oceánicas para ajustar recompensas dinámicamente

### 🔮 Fase 3 — Producto completo
- [ ] Frontend con mapa interactivo del litoral peruano en tiempo real
- [ ] Integración con hardware IoT real (ESP32 + sensores CTD)
- [ ] Predicción de zonas óptimas de pesca con IA
- [ ] Dashboard para autoridades (PRODUCE, SERNANP, DICAPI, Marina de Guerra)
- [ ] Marketplace de datos oceánicos para investigadores y aseguradoras

---

## Contexto — ¿Por qué Solana?

| Criterio | Por qué importa para Ocean-Sense |
|---|---|
| **Bajo costo por transacción** | Los pescadores envían decenas de lecturas al día — fees altos harían inviable el modelo |
| **Alta velocidad** | Alertas de contaminación deben llegar en segundos, no minutos |
| **DePIN ecosystem** | Solana es el ecosistema líder en proyectos DePIN (Helium, Hivemapper, GEODNET) |
| **Anchor framework** | Simplifica el desarrollo seguro del programa on-chain |
| **Composabilidad** | Otros protocolos pueden leer y construir sobre los datos de Ocean-Sense |

---

## Contribuir

Este proyecto está en fase temprana. Si eres:
- **Pescador artesanal o cooperativa** → contacto para piloto en Paita, Callao o Ilo
- **Desarrollador Solana** → issues y PRs bienvenidos
- **Investigador oceanográfico** → colaboración en validación de datos
- **Inversor o aceleradora** → [contacto]

---

*Construido con ❤️ para el litoral peruano — Solana Devnet 2026*