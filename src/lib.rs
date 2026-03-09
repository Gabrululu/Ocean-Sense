use anchor_lang::prelude::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod ocean_sense {
    use super::*;

    // ─────────────────────────────────────────────
    // INSTRUCCIÓN 1: Registrar una nueva boya
    // ─────────────────────────────────────────────
    pub fn register_buoy(
        ctx: Context<RegisterBuoy>,
        buoy_id: String,
        latitude: i64,   // ej: -1234567 representa -12.34567°
        longitude: i64,  // ej: -7698765 representa -76.98765°
        location_name: String,
    ) -> Result<()> {
        require!(buoy_id.len() <= 32, OceanSenseError::StringTooLong);
        require!(location_name.len() <= 64, OceanSenseError::StringTooLong);

        // Guardamos las keys ANTES del borrow mutable para evitar conflicto
        let buoy_key = ctx.accounts.buoy.key();
        let operator_key = ctx.accounts.operator.key();

        let buoy = &mut ctx.accounts.buoy;
        buoy.owner = operator_key;
        buoy.buoy_id = buoy_id;
        buoy.latitude = latitude;
        buoy.longitude = longitude;
        buoy.location_name = location_name;
        buoy.is_active = true;
        buoy.total_readings = 0;
        buoy.total_rewards = 0;
        buoy.bump = ctx.bumps.buoy;

        emit!(BuoyRegistered {
            buoy: buoy_key,
            owner: operator_key,
            buoy_id: buoy.buoy_id.clone(),
            latitude: buoy.latitude,
            longitude: buoy.longitude,
        });

        msg!("Boya registrada: {}", buoy.buoy_id);
        Ok(())
    }

    // ─────────────────────────────────────────────
    // INSTRUCCIÓN 2: Enviar lectura oceánica
    // ─────────────────────────────────────────────
    pub fn submit_reading(
        ctx: Context<SubmitReading>,
        temperature: i32,      // en centésimas de grado: 2150 = 21.50°C
        salinity: u32,         // en centésimas de PSU: 3510 = 35.10 PSU
        wave_height: u32,      // en centímetros: 120 = 1.20m
        pollution_level: u8,   // 0=limpio, 1=leve, 2=moderado, 3=crítico
        timestamp: i64,        // Unix timestamp del sensor
    ) -> Result<()> {
        require!(pollution_level <= 3, OceanSenseError::InvalidPollutionLevel);
        require!(
            ctx.accounts.buoy.is_active,
            OceanSenseError::BuoyNotActive
        );
        require!(
            ctx.accounts.buoy.owner == ctx.accounts.operator.key(),
            OceanSenseError::Unauthorized
        );

        // Calcular recompensa base en lamports
        // Lecturas de contaminación crítica valen más (incentivo de alerta)
        let reward: u64 = match pollution_level {
            3 => 5_000_000, // 0.005 SOL — alerta crítica
            2 => 2_000_000, // 0.002 SOL — moderado
            _ => 1_000_000, // 0.001 SOL — normal
        };

        // Extraer valores ANTES de borrows mutables (regla de ownership en Rust)
        let buoy_key = ctx.accounts.buoy.key();
        let operator_key = ctx.accounts.operator.key();
        let reading_index = ctx.accounts.buoy.total_readings;
        let buoy_latitude = ctx.accounts.buoy.latitude;
        let buoy_longitude = ctx.accounts.buoy.longitude;
        let buoy_id_str = ctx.accounts.buoy.buoy_id.clone();
        let location_name_str = ctx.accounts.buoy.location_name.clone();

        // Guardar la lectura en su PDA
        let reading = &mut ctx.accounts.reading;
        reading.buoy = buoy_key;
        reading.operator = operator_key;
        reading.temperature = temperature;
        reading.salinity = salinity;
        reading.wave_height = wave_height;
        reading.pollution_level = pollution_level;
        reading.timestamp = timestamp;
        reading.reward_lamports = reward;
        reading.reading_index = reading_index;

        // Actualizar estadísticas de la boya
        let buoy = &mut ctx.accounts.buoy;
        buoy.total_readings = buoy.total_readings.checked_add(1)
            .ok_or(OceanSenseError::Overflow)?;
        buoy.total_rewards = buoy.total_rewards.checked_add(reward)
            .ok_or(OceanSenseError::Overflow)?;
        buoy.last_reading_timestamp = timestamp;

        emit!(ReadingSubmitted {
            buoy: buoy_key,
            operator: operator_key,
            temperature,
            salinity,
            pollution_level,
            reward_lamports: reward,
            timestamp,
        });

        // Alerta especial si hay contaminación crítica
        if pollution_level == 3 {
            emit!(PollutionAlert {
                buoy: buoy_key,
                latitude: buoy_latitude,
                longitude: buoy_longitude,
                pollution_level,
                timestamp,
            });
            msg!("⚠️  ALERTA: Contaminación crítica detectada en {}", location_name_str);
        }

        msg!(
            "Lectura registrada | Boya: {} | Temp: {}.{}°C | Contaminación: {} | Recompensa: {} lamports",
            buoy_id_str,
            temperature / 100,
            temperature.abs() % 100,
            pollution_level,
            reward
        );
        Ok(())
    }

    // ─────────────────────────────────────────────
    // INSTRUCCIÓN 3: Activar / desactivar boya
    // ─────────────────────────────────────────────
    pub fn toggle_buoy(ctx: Context<ToggleBuoy>, active: bool) -> Result<()> {
        require!(
            ctx.accounts.buoy.owner == ctx.accounts.operator.key(),
            OceanSenseError::Unauthorized
        );
        ctx.accounts.buoy.is_active = active;
        msg!(
            "Boya {} → {}",
            ctx.accounts.buoy.buoy_id,
            if active { "ACTIVA ✅" } else { "INACTIVA ⛔" }
        );
        Ok(())
    }
}

// ─────────────────────────────────────────────────────
// CONTEXTOS DE CUENTAS
// ─────────────────────────────────────────────────────

#[derive(Accounts)]
#[instruction(buoy_id: String)]
pub struct RegisterBuoy<'info> {
    /// PDA que representa la boya — seeds: ["buoy", buoy_id, operator]
    #[account(
        init,
        payer = operator,
        space = BuoyState::SPACE,
        seeds = [b"buoy", buoy_id.as_bytes(), operator.key().as_ref()],
        bump
    )]
    pub buoy: Account<'info, BuoyState>,

    #[account(mut)]
    pub operator: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SubmitReading<'info> {
    #[account(mut)]
    pub buoy: Account<'info, BuoyState>,

    /// PDA de la lectura — seeds: ["reading", buoy, total_readings]
    #[account(
        init,
        payer = operator,
        space = OceanReading::SPACE,
        seeds = [
            b"reading",
            buoy.key().as_ref(),
            &buoy.total_readings.to_le_bytes()
        ],
        bump
    )]
    pub reading: Account<'info, OceanReading>,

    #[account(mut)]
    pub operator: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ToggleBuoy<'info> {
    #[account(mut)]
    pub buoy: Account<'info, BuoyState>,

    pub operator: Signer<'info>,
}

// ─────────────────────────────────────────────────────
// ESTADOS ON-CHAIN (structs almacenados en cuentas)
// ─────────────────────────────────────────────────────

#[account]
pub struct BuoyState {
    pub owner: Pubkey,             // 32
    pub buoy_id: String,           // 4 + 32
    pub latitude: i64,             // 8
    pub longitude: i64,            // 8
    pub location_name: String,     // 4 + 64
    pub is_active: bool,           // 1
    pub total_readings: u64,       // 8
    pub total_rewards: u64,        // 8
    pub last_reading_timestamp: i64, // 8
    pub bump: u8,                  // 1
}

impl BuoyState {
    // 8 (discriminador Anchor) + todos los campos
    pub const SPACE: usize = 8 + 32 + (4 + 32) + 8 + 8 + (4 + 64) + 1 + 8 + 8 + 8 + 1;
}

#[account]
pub struct OceanReading {
    pub buoy: Pubkey,          // 32
    pub operator: Pubkey,      // 32
    pub temperature: i32,      // 4  (centésimas de °C)
    pub salinity: u32,         // 4  (centésimas de PSU)
    pub wave_height: u32,      // 4  (centímetros)
    pub pollution_level: u8,   // 1
    pub timestamp: i64,        // 8
    pub reward_lamports: u64,  // 8
    pub reading_index: u64,    // 8
}

impl OceanReading {
    pub const SPACE: usize = 8 + 32 + 32 + 4 + 4 + 4 + 1 + 8 + 8 + 8;
}

// ─────────────────────────────────────────────────────
// EVENTOS (útiles para indexar desde el cliente/frontend)
// ─────────────────────────────────────────────────────

#[event]
pub struct BuoyRegistered {
    pub buoy: Pubkey,
    pub owner: Pubkey,
    pub buoy_id: String,
    pub latitude: i64,
    pub longitude: i64,
}

#[event]
pub struct ReadingSubmitted {
    pub buoy: Pubkey,
    pub operator: Pubkey,
    pub temperature: i32,
    pub salinity: u32,
    pub pollution_level: u8,
    pub reward_lamports: u64,
    pub timestamp: i64,
}

#[event]
pub struct PollutionAlert {
    pub buoy: Pubkey,
    pub latitude: i64,
    pub longitude: i64,
    pub pollution_level: u8,
    pub timestamp: i64,
}

// ─────────────────────────────────────────────────────
// ERRORES PERSONALIZADOS
// ─────────────────────────────────────────────────────

#[error_code]
pub enum OceanSenseError {
    #[msg("El string excede el tamaño permitido")]
    StringTooLong,
    #[msg("Nivel de contaminación inválido (0-3)")]
    InvalidPollutionLevel,
    #[msg("La boya no está activa")]
    BuoyNotActive,
    #[msg("Solo el operador dueño puede realizar esta acción")]
    Unauthorized,
    #[msg("Overflow aritmético")]
    Overflow,
}