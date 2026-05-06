
# StablePaws

> Tamagotchi on-chain en Solana. Cría mascotas adorables, aliméntalas con USDC y hazlas crecer nivel a nivel.

```
  /\_____/\
 (  o   o  )   "¡Tengo hambre! Págame en USDC."
 (  =   =  )
  (m) (m)     StablePaws — Solana Devnet
```

**Stack:** Anchor · Rust · SPL Token (USDC) · Solana Playground

---

## Contenido

1. [¿Qué es StablePaws?](#qué-es-stablepaws)
2. [Mecánicas del juego](#mecánicas-del-juego)
3. [Instrucciones del programa](#instrucciones-del-programa)
4. [Arquitectura on-chain](#arquitectura-on-chain)
5. [Quickstart en Solana Playground](#quickstart-en-solana-playground)
6. [Tests](#tests)
7. [Errores personalizados](#errores-personalizados)
8. [Roadmap](#roadmap)

---

## ¿Qué es StablePaws?

StablePaws es un juego Tamagotchi on-chain donde cada acción de cuidado mueve stablecoins reales (USDC) hacia un vault del protocolo. Las mascotas viven como PDAs en Solana: su hambre decae con el tiempo según el reloj on-chain, acumulan XP al ser alimentadas y suben de nivel.

**¿Por qué crypto?**
- El estado de la mascota es **inmutable y verificable** — nadie puede hacer trampa
- El hambre decae usando `Clock::unix_timestamp` real, sin servidor central
- El vault acumula USDC real, habilitando mecánicas de recompensas futuras
- Las mascotas son **componibles** — otros programas pueden leer su estado

---

## Mecánicas del Juego

### Ciclo de vida de una mascota

```
  [HUEVO]  --1 USDC-->  [NIVEL 1]  --XP-->  [NIVEL 2..100]
                            |
                    decae 4 hambre/hora
                            |
                     alimentar con USDC  -->  +hambre +XP
                     jugar (8h cooldown) -->  +felicidad
```

### Acciones disponibles

| Acción | Costo | Efecto en la mascota |
|--------|-------|----------------------|
| `hatch_pet` | **1 USDC** | Nace con hambre=80, felicidad=100, nivel=1 |
| `feed_pet` | **≥ 0.1 USDC** | +10 hambre por USDC · +5 felicidad · +100 XP por USDC |
| `play_with_pet` | **Gratis** (cooldown 8h) | +20 felicidad · +10 XP |

### Sistema de hambre

El hambre se calcula en tiempo real al leer la cuenta:

```
hambre_actual = hambre_guardada - (horas_desde_última_comida × 4)
```

| Hambre | Estado |
|--------|--------|
| 70–100 | Satisfecha |
| 40–69 | Algo de hambre |
| 20–39 | Hambrienta |
| 0–19 | Hambrienta y triste |

### Sistema de XP y niveles

```
XP ganado al alimentar = (USDC enteros) × 100
XP ganado al jugar     = 10
XP necesario por nivel = 1,000

Nivel actual = floor(XP total / 1,000) + 1   (máx. 100)
```

### Especies

| ID | Especie |
|----|---------|
| 0 | Gato |
| 1 | Perro |
| 2 | Conejo |
| 3 | Zorro |

---

## Instrucciones del Programa

### `initialize`
Crea el vault global de USDC. Se llama una sola vez al desplegar.

```
Cuentas: authority, game_state (PDA), vault (ATA), vault_authority (PDA),
         usdc_mint, token_program, associated_token_program, system_program
```

### `hatch_pet(name: String, species: u8)`
Hace eclosionar una mascota nueva. Transfiere 1 USDC del jugador al vault.

```
Cuentas: player, pet (PDA), game_state, player_usdc, vault,
         vault_authority, usdc_mint, token_program, system_program
```

### `feed_pet(name: String, usdc_amount: u64)`
Alimenta la mascota con USDC. Mínimo 0.1 USDC (100,000 unidades).

```
Cuentas: player, pet (PDA), game_state, player_usdc, vault,
         vault_authority, usdc_mint, token_program
```

### `play_with_pet(name: String)`
Juega con la mascota. Gratis, pero tiene cooldown de 8 horas.

```
Cuentas: player, pet (PDA)
```

---

## Arquitectura On-Chain

### PDAs y cuentas

```
Player Wallet (signer)
    │
    ├── PetState PDA
    │   seeds: ["pet", player_pubkey, pet_name]
    │   space: 8 + 113 bytes
    │   │
    │   Campos:
    │   ├── owner:              Pubkey
    │   ├── name:               String (max 32)
    │   ├── species:            u8
    │   ├── level:              u8  (1–100)
    │   ├── hunger:             u8  (0–100, decae 4/hora)
    │   ├── happiness:          u8  (0–100)
    │   ├── xp:                 u64
    │   ├── last_fed:           i64 (unix timestamp)
    │   ├── last_played:        i64 (unix timestamp)
    │   ├── total_stables_fed:  u64 (acumulado en USDC)
    │   └── birth_slot:         u64
    │
    └── USDC flow
        player_usdc ──[hatch/feed]──> vault ATA
                                      (vault_authority PDA firma retiros)

GameState PDA
    seeds: ["game_state"]
    Almacena: authority, usdc_mint, total_pets, bump

Vault (ATA)
    mint:      USDC
    authority: vault_authority PDA  (seeds: ["vault_authority"])
```

### ¿Por qué PDAs?

- **Sin custodia:** la llave privada del vault no existe — solo el programa puede moverlo
- **Determinístico:** cualquier cliente deriva la dirección de cualquier mascota conociendo su dueño y nombre
- **Componible:** otros programas pueden leer el estado de cualquier mascota sin permisos

---

## Quickstart en Solana Playground

### Requisitos
- Cuenta en [beta.solpg.io](https://beta.solpg.io)
- Wallet Phantom conectada a **Devnet**
- Al menos **3–4 SOL de Devnet** para deploy + tests

### Paso 1 — Crear proyecto

En Playground: **"Create a new project"** → selecciona **Anchor (Rust)**.

### Paso 2 — Pegar el programa

Reemplaza todo el contenido de `src/lib.rs` con el archivo `program/src/lib.rs` de este repositorio.

### Paso 3 — Build y Deploy

```bash
build
connect
solana airdrop 5
deploy
```

Playground mostrará el **Program ID** asignado. Guárdalo.

### Paso 4 — Crear USDC de prueba

En la terminal de Playground:

```bash
# Crear mint con 6 decimales (igual que USDC real)
spl-token create-token --decimals 6

# Crear cuenta para tu wallet
spl-token create-account <MINT_ADDRESS>

# Acuñar 20 USDC de prueba
spl-token mint <MINT_ADDRESS> 20

# Verificar saldo
spl-token balance <MINT_ADDRESS>
```

### Paso 5 — Configurar el cliente

Abre `program/client/client.ts` y reemplaza:

```typescript
const USDC_MINT = new PublicKey("REPLACE_WITH_YOUR_USDC_MINT_ADDRESS");
//                               ↑ pega aquí la dirección del paso 4
```

### Paso 6 — Correr los tests

Reemplaza `tests/anchor.test.ts` con el archivo `program/tests/anchor.test.ts` de este repositorio y haz clic en **Test**.

---

## Tests

```
StablePaws
  ✔ Inicializa el vault del juego
  ✔ Hace eclosionar un gato llamado Mochi por 1 USDC
  ✔ Alimenta a Mochi con 2 USDC — sube XP y mejora el hambre
  ✔ Rechaza alimentar con menos de 0.1 USDC
  ✔ Rechaza especie invalida al hacer eclosionar
  ✔ Rechaza jugar si el cooldown no ha pasado
  ✔ Muestra estadisticas finales de Mochi

7 passing
```

---

## Errores Personalizados

| Código | Nombre | Descripción |
|--------|--------|-------------|
| `6000` | `InvalidName` | Nombre vacío o mayor a 32 caracteres |
| `6001` | `InvalidSpecies` | Especie fuera de rango (0 = gato, 1 = perro, 2 = conejo, 3 = zorro) |
| `6002` | `FeedAmountTooLow` | Monto menor al mínimo de 0.1 USDC |
| `6003` | `NotOwner` | Solo el dueño puede modificar su mascota |
| `6004` | `PlayOnCooldown` | Cooldown de 8 horas activo — la mascota necesita descanso |

---

## Roadmap

### Fase 1 — Core (actual)
- [x] Eclosión de mascotas con pago en USDC
- [x] Hambre con decaimiento real basado en `Clock::unix_timestamp`
- [x] Felicidad y juego con cooldown on-chain
- [x] Sistema de XP y niveles (hasta nivel 100)
- [x] Vault USDC controlado por PDA
- [x] Eventos on-chain: `PetHatched`, `PetFed`, `PetLevelUp`, `PetPlayed`

### Fase 2 — Batallas PvP
- [ ] `challenge_battle`: challenger bloquea USDC en escrow PDA
- [ ] `accept_battle`: defensor bloquea USDC, batalla se resuelve en la misma tx
- [ ] Power score = nivel × 10 + hambre / 10 + felicidad / 10 + XP / 100
- [ ] Ganador recibe 95% del pozo (5% al protocolo)
- [ ] `cancel_battle`: reembolso si nadie acepta el desafío

### Fase 3 — Producto Completo
- [ ] NFTs por mascota (Metaplex Core)
- [ ] Marketplace de compra/venta de mascotas
- [ ] Leaderboard on-chain (top niveles y XP)
- [ ] Frontend con pixel art — React + Tailwind
- [ ] Soporte para USDT y otras stablecoins

---

## Estructura del Proyecto

```
stable-paws/
├── program/                ← Programa Anchor (Solana Playground)
│   ├── src/
│   │   └── lib.rs          ← Contrato en Rust
│   ├── tests/
│   │   └── anchor.test.ts  ← Tests TypeScript (Playground)
│   └── client/
│       └── client.ts       ← Cliente de interacción
├── frontend/               ← Aplicación React (Vite + Tailwind)
│   ├── src/
│   │   ├── App.tsx
│   │   ├── idl.ts          ← IDL del programa
│   │   ├── constants.ts    ← Program ID, USDC mint
│   │   ├── hooks/
│   │   │   └── useStablePaws.ts
│   │   └── components/
│   │       ├── PetCard.tsx
│   │       └── HatchModal.tsx
│   └── package.json
└── README.md
```

---

*Construido con Anchor · Solana Devnet · 2026*
