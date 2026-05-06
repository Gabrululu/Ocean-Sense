use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{self, Mint, Token, TokenAccount, Transfer},
};

declare_id!("StPwsXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX11");

const HATCH_COST: u64 = 1_000_000;   // 1 USDC (6 decimals)
const MIN_FEED: u64 = 100_000;       // 0.1 USDC minimum
const HUNGER_PER_HOUR: u8 = 4;      // hunger decays 4 points/hour
const PLAY_COOLDOWN: i64 = 28_800;  // 8 hours in seconds
const XP_PER_USDC: u64 = 100;
const XP_PER_PLAY: u64 = 10;
const XP_PER_LEVEL: u64 = 1_000;

#[program]
pub mod stable_paws {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let state = &mut ctx.accounts.game_state;
        state.authority = ctx.accounts.authority.key();
        state.usdc_mint = ctx.accounts.usdc_mint.key();
        state.total_pets = 0;
        state.bump = ctx.bumps.game_state;
        Ok(())
    }

    pub fn hatch_pet(ctx: Context<HatchPet>, name: String, species: u8) -> Result<()> {
        require!(name.len() >= 1 && name.len() <= 32, StablePawsError::InvalidName);
        require!(species <= 3, StablePawsError::InvalidSpecies);

        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.player_usdc.to_account_info(),
                    to: ctx.accounts.vault.to_account_info(),
                    authority: ctx.accounts.player.to_account_info(),
                },
            ),
            HATCH_COST,
        )?;

        let clock = Clock::get()?;
        let pet = &mut ctx.accounts.pet;
        pet.owner = ctx.accounts.player.key();
        pet.name = name.clone();
        pet.species = species;
        pet.level = 1;
        pet.hunger = 80;
        pet.happiness = 100;
        pet.xp = 0;
        pet.last_fed = clock.unix_timestamp;
        pet.last_played = clock.unix_timestamp;
        pet.total_stables_fed = HATCH_COST;
        pet.birth_slot = clock.slot;
        pet.bump = ctx.bumps.pet;

        ctx.accounts.game_state.total_pets += 1;

        emit!(PetHatched {
            owner: ctx.accounts.player.key(),
            pet: ctx.accounts.pet.key(),
            name,
            species,
        });

        Ok(())
    }

    pub fn feed_pet(ctx: Context<FeedPet>, name: String, usdc_amount: u64) -> Result<()> {
        require!(usdc_amount >= MIN_FEED, StablePawsError::FeedAmountTooLow);
        msg!("Feeding pet: {}", name);

        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.player_usdc.to_account_info(),
                    to: ctx.accounts.vault.to_account_info(),
                    authority: ctx.accounts.player.to_account_info(),
                },
            ),
            usdc_amount,
        )?;

        let clock = Clock::get()?;
        let pet = &mut ctx.accounts.pet;

        // Decay hunger since last feeding
        let hours_elapsed = ((clock.unix_timestamp.saturating_sub(pet.last_fed)) / 3600) as u8;
        let current_hunger = pet.hunger.saturating_sub(hours_elapsed.saturating_mul(HUNGER_PER_HOUR));

        // 10 hunger restored per whole USDC fed
        let usdc_whole = usdc_amount / 1_000_000;
        let hunger_gain = ((usdc_whole * 10) as u8).min(100u8.saturating_sub(current_hunger));
        pet.hunger = current_hunger.saturating_add(hunger_gain);
        pet.happiness = pet.happiness.saturating_add(5).min(100);

        // XP and level up
        pet.xp = pet.xp.saturating_add(usdc_whole * XP_PER_USDC);
        let new_level = ((pet.xp / XP_PER_LEVEL) + 1).min(100) as u8;
        if new_level > pet.level {
            pet.level = new_level;
            emit!(PetLevelUp { pet: ctx.accounts.pet.key(), new_level });
        }

        pet.last_fed = clock.unix_timestamp;
        pet.total_stables_fed = pet.total_stables_fed.saturating_add(usdc_amount);

        emit!(PetFed {
            pet: ctx.accounts.pet.key(),
            amount: usdc_amount,
            new_hunger: pet.hunger,
        });

        Ok(())
    }

    pub fn play_with_pet(ctx: Context<PlayWithPet>, name: String) -> Result<()> {
        msg!("Playing with pet: {}", name);

        let clock = Clock::get()?;
        let pet = &mut ctx.accounts.pet;

        let elapsed = clock.unix_timestamp.saturating_sub(pet.last_played);
        require!(elapsed >= PLAY_COOLDOWN, StablePawsError::PlayOnCooldown);

        pet.happiness = pet.happiness.saturating_add(20).min(100);
        pet.xp = pet.xp.saturating_add(XP_PER_PLAY);
        pet.last_played = clock.unix_timestamp;

        let new_level = ((pet.xp / XP_PER_LEVEL) + 1).min(100) as u8;
        if new_level > pet.level {
            pet.level = new_level;
        }

        emit!(PetPlayed {
            pet: ctx.accounts.pet.key(),
            new_happiness: pet.happiness,
        });

        Ok(())
    }
}

// ─── Account Contexts ────────────────────────────────────────────────────────

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer = authority,
        space = 8 + GameState::SPACE,
        seeds = [b"game_state"],
        bump,
    )]
    pub game_state: Account<'info, GameState>,

    pub usdc_mint: Account<'info, Mint>,

    #[account(
        init,
        payer = authority,
        associated_token::mint = usdc_mint,
        associated_token::authority = vault_authority,
    )]
    pub vault: Account<'info, TokenAccount>,

    /// CHECK: PDA that signs transfers out of the vault
    #[account(seeds = [b"vault_authority"], bump)]
    pub vault_authority: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(name: String)]
pub struct HatchPet<'info> {
    #[account(mut)]
    pub player: Signer<'info>,

    #[account(
        init,
        payer = player,
        space = 8 + PetState::SPACE,
        seeds = [b"pet", player.key().as_ref(), name.as_bytes()],
        bump,
    )]
    pub pet: Account<'info, PetState>,

    #[account(mut, seeds = [b"game_state"], bump = game_state.bump)]
    pub game_state: Account<'info, GameState>,

    #[account(
        mut,
        token::mint = game_state.usdc_mint,
        token::authority = player,
    )]
    pub player_usdc: Account<'info, TokenAccount>,

    #[account(
        mut,
        associated_token::mint = usdc_mint,
        associated_token::authority = vault_authority,
    )]
    pub vault: Account<'info, TokenAccount>,

    /// CHECK: PDA vault owner
    #[account(seeds = [b"vault_authority"], bump)]
    pub vault_authority: UncheckedAccount<'info>,

    pub usdc_mint: Account<'info, Mint>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(name: String)]
pub struct FeedPet<'info> {
    #[account(mut)]
    pub player: Signer<'info>,

    #[account(
        mut,
        seeds = [b"pet", player.key().as_ref(), name.as_bytes()],
        bump = pet.bump,
        constraint = pet.owner == player.key() @ StablePawsError::NotOwner,
    )]
    pub pet: Account<'info, PetState>,

    #[account(seeds = [b"game_state"], bump = game_state.bump)]
    pub game_state: Account<'info, GameState>,

    #[account(
        mut,
        token::mint = game_state.usdc_mint,
        token::authority = player,
    )]
    pub player_usdc: Account<'info, TokenAccount>,

    #[account(
        mut,
        associated_token::mint = usdc_mint,
        associated_token::authority = vault_authority,
    )]
    pub vault: Account<'info, TokenAccount>,

    /// CHECK: PDA vault owner
    #[account(seeds = [b"vault_authority"], bump)]
    pub vault_authority: UncheckedAccount<'info>,

    pub usdc_mint: Account<'info, Mint>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

#[derive(Accounts)]
#[instruction(name: String)]
pub struct PlayWithPet<'info> {
    #[account(mut)]
    pub player: Signer<'info>,

    #[account(
        mut,
        seeds = [b"pet", player.key().as_ref(), name.as_bytes()],
        bump = pet.bump,
        constraint = pet.owner == player.key() @ StablePawsError::NotOwner,
    )]
    pub pet: Account<'info, PetState>,
}

// ─── State ───────────────────────────────────────────────────────────────────

#[account]
pub struct GameState {
    pub authority: Pubkey,  // 32
    pub usdc_mint: Pubkey,  // 32
    pub total_pets: u64,    // 8
    pub bump: u8,           // 1
}

impl GameState {
    const SPACE: usize = 32 + 32 + 8 + 1; // 73
}

#[account]
pub struct PetState {
    pub owner: Pubkey,           // 32
    pub name: String,            // 4 + 32
    pub species: u8,             // 1   (0=cat 1=dog 2=bunny 3=fox)
    pub level: u8,               // 1
    pub hunger: u8,              // 1   (0–100, decays over time)
    pub happiness: u8,           // 1   (0–100)
    pub xp: u64,                 // 8
    pub last_fed: i64,           // 8
    pub last_played: i64,        // 8
    pub total_stables_fed: u64,  // 8
    pub birth_slot: u64,         // 8
    pub bump: u8,                // 1
}

impl PetState {
    const SPACE: usize = 32 + (4 + 32) + 1 + 1 + 1 + 1 + 8 + 8 + 8 + 8 + 8 + 1; // 113
}

// ─── Events ──────────────────────────────────────────────────────────────────

#[event]
pub struct PetHatched {
    pub owner: Pubkey,
    pub pet: Pubkey,
    pub name: String,
    pub species: u8,
}

#[event]
pub struct PetFed {
    pub pet: Pubkey,
    pub amount: u64,
    pub new_hunger: u8,
}

#[event]
pub struct PetLevelUp {
    pub pet: Pubkey,
    pub new_level: u8,
}

#[event]
pub struct PetPlayed {
    pub pet: Pubkey,
    pub new_happiness: u8,
}

// ─── Errors ──────────────────────────────────────────────────────────────────

#[error_code]
pub enum StablePawsError {
    #[msg("Name must be between 1 and 32 characters")]
    InvalidName,
    #[msg("Species must be 0 (cat), 1 (dog), 2 (bunny), or 3 (fox)")]
    InvalidSpecies,
    #[msg("Feed amount must be at least 0.1 USDC")]
    FeedAmountTooLow,
    #[msg("Only the pet owner can do this")]
    NotOwner,
    #[msg("Your pet needs rest! Play again in 8 hours")]
    PlayOnCooldown,
}
