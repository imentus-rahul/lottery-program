use anchor_lang::prelude::*;
use anchor_lang::solana_program::program::invoke_signed;
use anchor_spl::{
    associated_token,
    token::{self},
};
use mpl_token_metadata::instruction::{create_master_edition_v3, create_metadata_accounts_v2};
use mpl_token_metadata::state::{Collection, DataV2};
use switchboard_v2::{VrfAccountData, VrfRequestRandomness};

declare_id!("5AQqMzcMdRcdvGydG6UGrsL4164VwZHuHiHcHYFWhg7");

#[program]
pub mod solana_lottery_program {

    use super::*;

    pub fn init_lottery(ctx: Context<InitLottery>, params: InitLotteryParams) -> Result<()> {
        let collection_mint_to_accounts = token::MintTo {
            mint: ctx.accounts.collection_mint.clone().to_account_info(),
            to: ctx.accounts.collection_ata.clone().to_account_info(),
            authority: ctx.accounts.lottery_manager.clone().to_account_info(),
        };

        // mint master edition collection token to collection ata
        token::mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                collection_mint_to_accounts,
                &[&[
                    b"lottery_manager",
                    params.lottery_name.as_bytes(),
                    &[*ctx.bumps.get("lottery_manager").unwrap()],
                ]],
            ),
            1,
        )?;

        // metadata params
        let collection_data = DataV2 {
            name: params.lottery_name.clone(),
            symbol: params.collection_metadata_symbol,
            uri: params.collection_metadata_uri,
            seller_fee_basis_points: 0,
            creators: None,
            collection: None,
            uses: None,
        };

        let create_collection_metadata_accounts = [
            ctx.accounts.collection_metadata.clone(),
            ctx.accounts.collection_mint.clone().to_account_info(),
            ctx.accounts.lottery_manager.clone().to_account_info(),
            ctx.accounts.admin.clone().to_account_info(),
            ctx.accounts.lottery_manager.clone().to_account_info(),
            ctx.accounts.system_program.to_account_info(),
            ctx.accounts.rent.to_account_info(),
        ];

        // create metadata account
        let collection_metadata_ix = create_metadata_accounts_v2(
            ctx.accounts.metadata_program.clone().key(),
            ctx.accounts.collection_metadata.clone().key(),
            ctx.accounts.collection_mint.clone().to_account_info().key(),
            ctx.accounts.lottery_manager.clone().key(),
            ctx.accounts.admin.clone().key(),
            ctx.accounts.lottery_manager.clone().key(),
            collection_data.name,
            collection_data.symbol,
            collection_data.uri,
            collection_data.creators,
            collection_data.seller_fee_basis_points,
            false,
            false,
            collection_data.collection,
            collection_data.uses,
        );

        invoke_signed(
            &collection_metadata_ix,
            &create_collection_metadata_accounts,
            &[&[
                b"lottery_manager",
                params.lottery_name.as_bytes(),
                &[*ctx.bumps.get("lottery_manager").unwrap()],
            ]],
        )?;

        let create_collection_master_edition_accounts = [
            ctx.accounts.collection_master_edition.clone(),
            ctx.accounts.collection_metadata.clone(),
            ctx.accounts.collection_mint.clone().to_account_info(),
            ctx.accounts.lottery_manager.clone().to_account_info(),
            ctx.accounts.admin.clone().to_account_info(),
            ctx.accounts.lottery_manager.clone().to_account_info(),
            ctx.accounts.rent.to_account_info(),
            ctx.accounts.token_program.clone().to_account_info(),
        ];

        // create master edition account
        // max_supply of 0 == unique
        let collection_master_edition_ix = create_master_edition_v3(
            ctx.accounts.metadata_program.clone().key(),
            ctx.accounts.collection_master_edition.clone().key(),
            ctx.accounts.collection_mint.clone().key(),
            ctx.accounts.lottery_manager.clone().key(),
            ctx.accounts.lottery_manager.clone().key(),
            ctx.accounts.collection_metadata.clone().key(),
            ctx.accounts.admin.clone().key(),
            Some(0),
        );

        invoke_signed(
            &collection_master_edition_ix,
            &create_collection_master_edition_accounts,
            &[&[
                b"lottery_manager",
                params.lottery_name.as_bytes(),
                &[*ctx.bumps.get("lottery_manager").unwrap()],
            ]],
        )?;

        // transfer prize from admin to prize vault
        let transfer_accounts = token::Transfer {
            from: ctx.accounts.admin_prize_ata.to_account_info(),
            to: ctx.accounts.prize_vault.to_account_info(),
            authority: ctx.accounts.admin.to_account_info(),
        };

        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                transfer_accounts,
            ),
            params.prize_amount,
        )?;

        // set VRF
        // assert account is a valid switchboard vrf account
        let vrf = VrfAccountData::new(&ctx.accounts.vrf)?;

        // client state needs to be authority in order to sign request randomness instruction
        if vrf.authority != ctx.accounts.vrf_state.key() {
            return Err(VrfErrorCode::InvalidSwitchboardVrfAccount.into());
        }

        // load account, not automatically called since its an AccountLoader
        let mut state = ctx.accounts.vrf_state.load_init()?;

        // zero out all account data
        *state = VrfClient::default();

        // set state
        state.authority = ctx.accounts.admin.key();
        state.vrf = ctx.accounts.vrf.key();
        state.bump = *ctx.bumps.get("vrf_state").unwrap();
        state.max_result = u64::MAX;

        // set vault manager config
        let lottery_manager = &mut ctx.accounts.lottery_manager;
        lottery_manager.prize_mint = ctx.accounts.prize_mint.key();
        lottery_manager.prize_vault = ctx.accounts.prize_vault.key();
        lottery_manager.draw_duration = params.draw_duration;
        lottery_manager.cutoff_time = 0;
        lottery_manager.ticket_price = params.ticket_price;
        lottery_manager.purchase_mint = ctx.accounts.purchase_mint.key();
        lottery_manager.purchase_vault = ctx.accounts.purchase_vault.key();
        lottery_manager.collection_mint = ctx.accounts.collection_mint.key();
        lottery_manager.collection_metadata = ctx.accounts.collection_metadata.key();
        lottery_manager.collection_master_edition = ctx.accounts.collection_master_edition.key();
        lottery_manager.circulating_ticket_supply = 0;
        lottery_manager.ticket_metadata_symbol = params.ticket_metadata_symbol;
        lottery_manager.ticket_metadata_uri = params.ticket_metadata_uri;
        lottery_manager.max_tickets = params.max_tickets;
        lottery_manager.guarantee_winner = params.guarantee_winner;
        lottery_manager.vrf = ctx.accounts.vrf.key();
        lottery_manager.vrf_state = ctx.accounts.vrf_state.key();
        lottery_manager.vrf_permission = ctx.accounts.vrf_permission.key();
        lottery_manager.vrf_oracle_queue = ctx.accounts.vrf_oracle_queue.key();
        lottery_manager.vrf_queue_authority = ctx.accounts.vrf_queue_authority.key();
        lottery_manager.vrf_data_buffer = ctx.accounts.vrf_data_buffer.key();
        lottery_manager.vrf_escrow = ctx.accounts.vrf_escrow.key();
        lottery_manager.vrf_payment_ata = ctx.accounts.vrf_payment_wallet.key();
        lottery_manager.vrf_program_state = ctx.accounts.vrf_program_state.key();
        lottery_manager.sb_program_id = ctx.accounts.switchboard_program.key();
        lottery_manager.vrf_state_bump = state.bump;
        lottery_manager.vrf_permission_bump = params.vrf_permission_bump;
        lottery_manager.vrf_sb_state_bump = params.vrf_sb_state_bump;

        Ok(())
    }

    pub fn buy(ctx: Context<Buy>, params: BuyParams) -> Result<()> {
        let lottery_manager = &mut ctx.accounts.lottery_manager;

        // if at or above max amount of tickets purchased dont allow any more purchases
        if lottery_manager.circulating_ticket_supply >= lottery_manager.max_tickets {
            return Err(SLPErrorCode::MaxTicketsPurchased.into());
        };

        // if cutoff_time is 0, drawing has never started
        if lottery_manager.cutoff_time == 0 {
            // get current timestamp from Clock program
            let now = get_current_time();

            // set last draw time to now
            lottery_manager.cutoff_time = now as u64 + lottery_manager.draw_duration;
        };

        // if buy is locked do not sell tickets
        if lottery_manager.locked {
            return Err(SLPErrorCode::CallDispense.into());
        }

        // create ticket PDA data
        let ticket_account = &mut ctx.accounts.ticket;
        ticket_account.ticket_mint = ctx.accounts.ticket_mint.key();
        ticket_account.lottery_manager = lottery_manager.key();
        ticket_account.pick = lottery_manager.circulating_ticket_supply;

        // increase supply by 1
        lottery_manager.circulating_ticket_supply += 1;

        // transfer tokens from user wallet to vault
        let transfer_accounts = token::Transfer {
            from: ctx.accounts.user_purchase_ata.to_account_info(),
            to: ctx.accounts.purchase_vault.to_account_info(),
            authority: ctx.accounts.user.to_account_info(),
        };

        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                transfer_accounts,
            ),
            ctx.accounts.lottery_manager.ticket_price,
        )?;

        // mint NFT to user ATA, make sure its part of the collection
        let mint_to_accounts = token::MintTo {
            mint: ctx.accounts.ticket_mint.to_account_info(),
            to: ctx.accounts.user_ticket_ata.to_account_info(),
            authority: ctx.accounts.lottery_manager.to_account_info(),
        };

        // mint master edition token to user nft ata
        token::mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                mint_to_accounts,
                &[&[
                    b"lottery_manager",
                    params.lottery_name.as_bytes(),
                    &[*ctx.bumps.get("lottery_manager").unwrap()],
                ]],
            ),
            1,
        )?;

        // metadata params
        let data = DataV2 {
            name: ctx.accounts.lottery_manager.ticket_metadata_name.clone(),
            symbol: ctx.accounts.lottery_manager.ticket_metadata_symbol.clone(),
            uri: ctx.accounts.lottery_manager.ticket_metadata_uri.clone(),
            seller_fee_basis_points: 0,
            creators: None,
            collection: Some(Collection {
                verified: false,
                key: ctx.accounts.collection_mint.key(),
            }),
            uses: None,
        };

        let create_metadata_accounts = [
            ctx.accounts.ticket_metadata.clone().to_account_info(),
            ctx.accounts.ticket_mint.clone().to_account_info(),
            ctx.accounts.lottery_manager.clone().to_account_info(),
            ctx.accounts.user.clone().to_account_info(),
            ctx.accounts.lottery_manager.clone().to_account_info(),
            ctx.accounts.system_program.clone().to_account_info(),
            ctx.accounts.rent.clone().to_account_info(),
        ];

        // create metadata account
        let metadata_ix = create_metadata_accounts_v2(
            ctx.accounts.metadata_program.key(),
            ctx.accounts.ticket_metadata.key(),
            ctx.accounts.ticket_mint.to_account_info().key(),
            ctx.accounts.lottery_manager.key(),
            ctx.accounts.user.key(),
            ctx.accounts.lottery_manager.key(),
            data.name,
            data.symbol,
            data.uri,
            data.creators,
            data.seller_fee_basis_points,
            false,
            false,
            data.collection,
            data.uses,
        );

        invoke_signed(
            &metadata_ix,
            &create_metadata_accounts,
            &[&[
                b"lottery_manager",
                params.lottery_name.as_bytes(),
                &[*ctx.bumps.get("lottery_manager").unwrap()],
            ]],
        )?;

        let create_master_edition_accounts = [
            ctx.accounts.ticket_master_edition.clone(),
            ctx.accounts.ticket_metadata.clone(),
            ctx.accounts.ticket_mint.clone().to_account_info(),
            ctx.accounts.lottery_manager.clone().to_account_info(),
            ctx.accounts.user.clone().to_account_info(),
            ctx.accounts.lottery_manager.clone().to_account_info(),
            ctx.accounts.rent.to_account_info(),
            ctx.accounts.token_program.clone().to_account_info(),
        ];

        // create master edition account
        let master_edition_ix = create_master_edition_v3(
            ctx.accounts.metadata_program.clone().key(),
            ctx.accounts.ticket_master_edition.clone().key(),
            ctx.accounts.ticket_mint.clone().key(),
            ctx.accounts.lottery_manager.clone().key(),
            ctx.accounts.lottery_manager.clone().key(),
            ctx.accounts.ticket_metadata.clone().key(),
            ctx.accounts.user.clone().key(),
            Some(0),
        );

        invoke_signed(
            &master_edition_ix,
            &create_master_edition_accounts,
            &[&[
                b"lottery_manager",
                params.lottery_name.as_bytes(),
                &[*ctx.bumps.get("lottery_manager").unwrap()],
            ]],
        )?;

        Ok(())
    }

    // draw sends a randomness request to the switchboard oracle
    // draw must be called by the admin of the lottery as the admin has permissions to request the randomness
    pub fn draw(ctx: Context<Draw>, params: DrawParams) -> Result<()> {
        let cutoff_time = ctx.accounts.lottery_manager.cutoff_time;

        // if no tickets have been purchased, do not draw
        if cutoff_time == 0 {
            return Err(SLPErrorCode::NoTicketsPurchased.into());
        }

        // if locked, dont call draw
        if ctx.accounts.lottery_manager.locked {
            return Err(SLPErrorCode::CallDispense.into());
        }

        //// if time remaining then error
        //// instead should I be counting by slots?
        //let now = get_current_time();
        //if now < cutoff_time {
        //    return Err(SLPErrorCode::TimeRemaining.into());
        //}

        let switchboard_program = ctx.accounts.switchboard_program.to_account_info();

        let vrf_request_randomness = VrfRequestRandomness {
            authority: ctx.accounts.vrf_state.to_account_info(),
            vrf: ctx.accounts.vrf.to_account_info(),
            oracle_queue: ctx.accounts.vrf_oracle_queue.to_account_info(),
            queue_authority: ctx.accounts.vrf_queue_authority.to_account_info(),
            data_buffer: ctx.accounts.vrf_data_buffer.to_account_info(),
            permission: ctx.accounts.vrf_permission.to_account_info(),
            escrow: ctx.accounts.vrf_escrow.clone(),
            payer_wallet: ctx.accounts.vrf_payment_wallet.clone(),
            payer_authority: ctx.accounts.admin.to_account_info(),
            recent_blockhashes: ctx.accounts.recent_blockhashes.to_account_info(),
            program_state: ctx.accounts.vrf_program_state.to_account_info(),
            token_program: ctx.accounts.token_program.to_account_info(),
        };

        let vrf_key = ctx.accounts.vrf.key().clone();
        let authority_key = ctx.accounts.admin.key().clone();

        let state_seeds: &[&[&[u8]]] = &[&[
            b"STATE",
            vrf_key.as_ref(),
            authority_key.as_ref(),
            &[params.vrf_client_state_bump],
        ]];

        // request randomness from the oracle
        vrf_request_randomness.invoke_signed(
            switchboard_program,
            params.switchboard_state_bump,
            params.permission_bump,
            state_seeds,
        )?;

        // do not allow buying tickets after draw is called
        // next steps are to call draw_result then dispense
        // after these 2 instructions are called, buy is unlocked
        ctx.accounts.lottery_manager.locked = true;
        Ok(())
    }

    // draw result will be called by the switchboard oracle
    // will fail if not called by oracle because only the oracle can populate the vrf account state
    pub fn draw_result(ctx: Context<DrawResult>) -> Result<()> {
        // if not locked, draw needs to be called first
        if !ctx.accounts.lottery_manager.locked {
            return Err(SLPErrorCode::CallDraw.into());
        }

        // parse vrf data account
        let vrf = VrfAccountData::new(&ctx.accounts.vrf)?;

        // get the random result
        let result_buffer = match vrf.get_result() {
            Ok(result_buffer) => result_buffer,
            Err(e) => return Err(e),
        };

        // if the result is the same as the previous, it hasn't been updated yet
        let state = &mut ctx.accounts.state.load_mut()?;
        if result_buffer == state.result_buffer {
            msg!("existing result_buffer");
            return Ok(());
        }

        // parse the randomess value
        msg!("Result buffer is {:?}", result_buffer);
        let value: &[u64] = bytemuck::cast_slice(&result_buffer[..]);

        // if guaranteed winner is enabled then mod by ticket supply so that one of the existing tickets is chosen
        // if not enabled, mod by the max allowed tickets
        let mut winning_pick: u64 = 0;
        if ctx.accounts.lottery_manager.guarantee_winner {
            winning_pick = value[0] % ctx.accounts.lottery_manager.circulating_ticket_supply;
        } else {
            winning_pick = value[0] % ctx.accounts.lottery_manager.max_tickets;
        }

        // set the new result in the client state
        if state.result != winning_pick {
            state.result_buffer = result_buffer;
            state.result = winning_pick;
            state.last_timestamp = get_current_time() as i64;
        }

        // set winning pick in the lottery manager account
        ctx.accounts.lottery_manager.winning_pick = Some(winning_pick);

        // emit event that we have new winning numbers
        emit!(DrawResultSuccessful {
            winning_pick: winning_pick,
        });

        Ok(())
    }

    // dispense prize to winner
    pub fn dispense(ctx: Context<Dispense>, params: DispenseParams) -> Result<()> {
        // if winning_pick doesnt exist, exit with an error
        let winning_pick = match ctx.accounts.lottery_manager.winning_pick {
            Some(winning_pick) => winning_pick,
            None => return Err(SLPErrorCode::CallDraw.into()),
        };

        let now = get_current_time();

        // set next cutoff time
        ctx.accounts.lottery_manager.cutoff_time = now + ctx.accounts.lottery_manager.draw_duration;

        // unlock buy tickets
        ctx.accounts.lottery_manager.locked = false;

        // reset winning pick
        ctx.accounts.lottery_manager.winning_pick = None;

        // if pick is higher or equal to the circulating ticket supply that means a winner was not drawn
        if ctx.accounts.lottery_manager.circulating_ticket_supply <= winning_pick {
            return Ok(());
        }

        // check the ticket passed in contains the winning pick
        if ctx.accounts.ticket.pick != winning_pick {
            return Err(SLPErrorCode::PassInWinningPDA.into());
        }

        // prize destination owner must be owner of the winning ticket ata
        if ctx.accounts.winner_prize_ata.clone().owner
            != ctx.accounts.winner_ticket_ata.clone().owner
        {
            return Err(SLPErrorCode::WinnerTicketAndPrizeAtasMismatch.into());
        }

        // winner ticket ata must match ticket pda mint
        if ctx.accounts.winner_ticket_ata.mint != ctx.accounts.ticket.ticket_mint {
            return Err(SLPErrorCode::IncorrectTicketMint.into());
        }

        // transfer prize amount to winner
        let transfer_accounts = token::Transfer {
            from: ctx.accounts.prize_vault.clone().to_account_info(),
            to: ctx.accounts.winner_prize_ata.clone().to_account_info(),
            authority: ctx.accounts.lottery_manager.clone().to_account_info(),
        };

        // transfer entire prize to winner
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.clone().to_account_info(),
                transfer_accounts,
                &[&[
                    b"lottery_manager",
                    params.lottery_name.as_bytes(),
                    &[*ctx.bumps.get("lottery_manager").unwrap()],
                ]],
            ),
            ctx.accounts.prize_vault.amount,
        )
    }
}

#[derive(Accounts)]
#[instruction(params: InitLotteryParams)]
pub struct InitLottery<'info> {
    pub purchase_mint: Box<Account<'info, token::Mint>>,

    #[account(init,
        payer = admin,
        token::mint = purchase_mint,
        token::authority = lottery_manager,
        seeds = [b"purchase_vault", params.lottery_name.as_bytes()], bump)]
    pub purchase_vault: Box<Account<'info, token::TokenAccount>>,

    pub prize_mint: Box<Account<'info, token::Mint>>,

    #[account(init,
        payer = admin,
        token::mint = prize_mint,
        token::authority = lottery_manager,
        seeds = [b"prize_vault", params.lottery_name.as_bytes()], bump)]
    pub prize_vault: Box<Account<'info, token::TokenAccount>>,

    #[account(init, space = LotteryManager::MAX_SIZE,
        payer = admin,
        seeds = [b"lottery_manager", params.lottery_name.as_bytes()],
        bump)]
    pub lottery_manager: Box<Account<'info, LotteryManager>>,

    #[account(init,
        payer = admin,
        seeds = [b"collection_mint", params.lottery_name.as_bytes()],
        bump,
        mint::decimals = 0,
        mint::authority = lottery_manager)]
    pub collection_mint: Box<Account<'info, token::Mint>>,

    #[account(init,
        payer = admin,
        token::mint = collection_mint,
        token::authority = lottery_manager,
        seeds = [collection_mint.key().as_ref()], bump)]
    pub collection_ata: Box<Account<'info, token::TokenAccount>>,

    /// CHECK: todo
    #[account(mut, seeds = [b"metadata", mpl_token_metadata::ID.as_ref(), collection_mint.key().as_ref()], bump, seeds::program = mpl_token_metadata::ID)]
    pub collection_metadata: AccountInfo<'info>,

    /// CHECK: todo
    #[account(mut, seeds = [b"metadata", mpl_token_metadata::ID.as_ref(), collection_mint.key().as_ref(), b"edition"], bump, seeds::program = mpl_token_metadata::ID)]
    pub collection_master_edition: AccountInfo<'info>,

    /// CHECK: todo
    #[account(mut, constraint = vrf.owner.as_ref() == switchboard_program.key().as_ref())]
    pub vrf: AccountInfo<'info>,

    #[account(init, space = VrfClient::MAX_SIZE, payer = admin, seeds = [b"STATE", vrf.key().as_ref(), admin.key().as_ref()], bump)]
    pub vrf_state: AccountLoader<'info, VrfClient>,

    /// CHECK: TODO
    pub switchboard_program: AccountInfo<'info>,

    /// CHECK: TODO
    #[account(constraint = vrf_oracle_queue.owner.as_ref() == switchboard_program.key().as_ref())]
    pub vrf_oracle_queue: AccountInfo<'info>,

    /// CHECK: TODO
    pub vrf_queue_authority: AccountInfo<'info>,

    /// CHECK: TODO
    #[account(constraint = vrf_data_buffer.owner.as_ref() == switchboard_program.key().as_ref())]
    pub vrf_data_buffer: AccountInfo<'info>,

    /// CHECK: TODO
    #[account(constraint = vrf_permission.owner.as_ref() == switchboard_program.key().as_ref())]
    pub vrf_permission: AccountInfo<'info>,

    #[account(constraint = vrf_escrow.owner == vrf_program_state.key())]
    pub vrf_escrow: Box<Account<'info, token::TokenAccount>>,

    #[account(constraint = vrf_payment_wallet.owner == admin.key())]
    pub vrf_payment_wallet: Box<Account<'info, token::TokenAccount>>,

    /// CHECK: TODO
    #[account(constraint = vrf_program_state.owner.as_ref() == switchboard_program.key().as_ref())]
    pub vrf_program_state: AccountInfo<'info>,

    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(mut, token::mint = prize_mint, token::authority = admin)]
    pub admin_prize_ata: Box<Account<'info, token::TokenAccount>>,

    pub system_program: Program<'info, System>,
    pub metadata_program: Program<'info, TokenMetadata>,
    pub token_program: Program<'info, token::Token>,
    pub rent: Sysvar<'info, Rent>,
}

#[account]
#[derive(Default)]
pub struct LotteryManager {
    pub lottery_name: String,
    pub purchase_mint: Pubkey,
    pub purchase_vault: Pubkey,
    pub prize_mint: Pubkey,
    pub prize_vault: Pubkey,
    pub collection_mint: Pubkey,
    pub collection_metadata: Pubkey,
    pub collection_master_edition: Pubkey,
    pub circulating_ticket_supply: u64,
    pub cutoff_time: u64,   // in seconds, cutoff time for next draw
    pub draw_duration: u64, // in seconds, duration until next draw time
    pub ticket_price: u64,
    pub winning_pick: Option<u64>,
    pub locked: bool, // when draw is called, lock the program until draw_result and dispense are called
    pub max_tickets: u64, // max number of tickets that can be purchased
    pub guarantee_winner: bool, // if true, on the first draw a winner will be chosen
    pub ticket_metadata_name: String,
    pub ticket_metadata_symbol: String,
    pub ticket_metadata_uri: String,
    pub vrf: Pubkey,
    pub vrf_state: Pubkey,
    pub vrf_permission: Pubkey,
    pub vrf_oracle_queue: Pubkey,
    pub vrf_queue_authority: Pubkey,
    pub vrf_data_buffer: Pubkey,
    pub vrf_escrow: Pubkey,
    pub vrf_payment_ata: Pubkey,
    pub vrf_program_state: Pubkey,
    pub sb_program_id: Pubkey,
    pub vrf_state_bump: u8,
    pub vrf_permission_bump: u8,
    pub vrf_sb_state_bump: u8,
}

impl LotteryManager {
    pub const MAX_SIZE: usize = 8
        + 50
        + 32
        + 32
        + 32
        + 32
        + 32
        + 32
        + 32
        + 8
        + 8
        + 8
        + 8
        + 9
        + 1
        + 8
        + 1
        + 50
        + 50
        + 50
        + 32
        + 32
        + 32
        + 32
        + 32
        + 32
        + 32
        + 32
        + 32
        + 32
        + 1
        + 1
        + 1;
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct InitLotteryParams {
    pub lottery_name: String,
    pub draw_duration: u64, // in seconds
    pub ticket_price: u64,
    pub prize_amount: u64,
    pub max_tickets: u64,
    pub guarantee_winner: bool,
    pub collection_metadata_symbol: String,
    pub collection_metadata_uri: String,
    pub ticket_metadata_symbol: String,
    pub ticket_metadata_uri: String,
    pub vrf_permission_bump: u8,
    pub vrf_sb_state_bump: u8,
}

#[account(zero_copy)]
#[derive(AnchorDeserialize, AnchorSerialize, Debug)]
pub struct VrfClient {
    pub bump: u8,
    pub max_result: u64,
    pub result_buffer: [u8; 32],
    pub result: u64,
    pub last_timestamp: i64,
    pub authority: Pubkey,
    pub vrf: Pubkey,
}

impl VrfClient {
    //pub const MAX_SIZE: usize = 8 + 1 + 8 + 32 + 16 + 8 + 32 + 32;
    pub const MAX_SIZE: usize = 8 + 400;
}

impl Default for VrfClient {
    fn default() -> Self {
        unsafe { std::mem::zeroed() }
    }
}

#[derive(Accounts)]
#[instruction(params: BuyParams)]
pub struct Buy<'info> {
    #[account(mut)]
    pub purchase_mint: Box<Account<'info, token::Mint>>,

    #[account(mut, token::mint = purchase_mint, token::authority = lottery_manager, seeds = [b"purchase_vault", params.lottery_name.as_bytes()], bump)]
    pub purchase_vault: Box<Account<'info, token::TokenAccount>>,

    #[account(mut, seeds = [b"lottery_manager", params.lottery_name.as_bytes()], bump)]
    pub lottery_manager: Box<Account<'info, LotteryManager>>,

    #[account(mut)]
    pub collection_mint: Account<'info, token::Mint>,

    /// CHECK: todo
    #[account(mut, seeds = [b"metadata", mpl_token_metadata::ID.as_ref(), collection_mint.key().as_ref()], bump, seeds::program = mpl_token_metadata::ID)]
    pub collection_metadata: AccountInfo<'info>,

    /// CHECK: todo
    #[account(mut, seeds = [b"metadata", mpl_token_metadata::ID.as_ref(), collection_mint.key().as_ref(), b"edition"], bump, seeds::program = mpl_token_metadata::ID)]
    pub collection_master_edition: AccountInfo<'info>,

    #[account(init, payer = user, mint::decimals = 0, mint::authority = lottery_manager)]
    pub ticket_mint: Box<Account<'info, token::Mint>>,

    /// CHECK: todo
    #[account(mut, seeds = [b"metadata", mpl_token_metadata::ID.as_ref(), ticket_mint.key().as_ref()], bump, seeds::program = mpl_token_metadata::ID)]
    pub ticket_metadata: AccountInfo<'info>,

    /// CHECK: todo
    #[account(mut, seeds = [b"metadata", mpl_token_metadata::ID.as_ref(), ticket_mint.key().as_ref(), b"edition"], bump, seeds::program = mpl_token_metadata::ID)]
    pub ticket_master_edition: AccountInfo<'info>,

    #[account(init,
        space = Ticket::MAX_SIZE,
        payer = user,
        seeds = [b"ticket", lottery_manager.key().as_ref(), ticket_mint.key().as_ref()],
        bump,
    )]
    pub ticket: Box<Account<'info, Ticket>>,

    #[account(init,
        payer = user,
        associated_token::mint = ticket_mint,
        associated_token::authority = user)]
    pub user_ticket_ata: Box<Account<'info, token::TokenAccount>>,

    #[account(mut)]
    pub user: Signer<'info>,

    #[account(mut)]
    pub user_purchase_ata: Account<'info, token::TokenAccount>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, token::Token>,
    pub associated_token_program: Program<'info, associated_token::AssociatedToken>,
    pub metadata_program: Program<'info, TokenMetadata>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct BuyParams {
    pub lottery_name: String,
}

#[account]
#[derive(Default)]
pub struct Ticket {
    pub ticket_mint: Pubkey,
    pub lottery_manager: Pubkey,
    pub pick: u64,
}

impl Ticket {
    pub const MAX_SIZE: usize = 8 + 32 + 32 + 8;
}

#[derive(Accounts)]
#[instruction(params: DrawParams)]
pub struct Draw<'info> {
    pub purchase_mint: Box<Account<'info, token::Mint>>,

    #[account(mut, token::mint = purchase_mint, token::authority = lottery_manager, seeds = [b"purchase_vault", params.lottery_name.as_bytes()], bump)]
    pub purchase_vault: Box<Account<'info, token::TokenAccount>>,

    #[account(mut)]
    pub lottery_manager: Box<Account<'info, LotteryManager>>,

    #[account(
        mut,
        seeds = [
            b"STATE",
            vrf.key().as_ref(),
            admin.key().as_ref(),
        ],
        bump,
    )]
    pub vrf_state: AccountLoader<'info, VrfClient>,

    /// CHECK: TODO
    pub switchboard_program: AccountInfo<'info>,

    /// CHECK: TODO
    #[account(mut, constraint = vrf.owner.as_ref() == switchboard_program.key().as_ref())]
    pub vrf: AccountInfo<'info>,

    /// CHECK: TODO
    #[account(mut, constraint = vrf_oracle_queue.owner.as_ref() == switchboard_program.key().as_ref())]
    pub vrf_oracle_queue: AccountInfo<'info>,

    /// CHECK: TODO
    pub vrf_queue_authority: AccountInfo<'info>,

    /// CHECK: TODO
    #[account(constraint = vrf_data_buffer.owner.as_ref() == switchboard_program.key().as_ref())]
    pub vrf_data_buffer: AccountInfo<'info>,

    /// CHECK: TODO
    #[account(mut, constraint = vrf_permission.owner.as_ref() == switchboard_program.key().as_ref())]
    pub vrf_permission: AccountInfo<'info>,

    #[account(mut, constraint = vrf_escrow.owner == vrf_program_state.key())]
    pub vrf_escrow: Account<'info, token::TokenAccount>,

    #[account(mut, constraint = vrf_payment_wallet.owner == admin.key())]
    pub vrf_payment_wallet: Account<'info, token::TokenAccount>,

    /// CHECK: TODO
    #[account(address = anchor_lang::solana_program::sysvar::recent_blockhashes::ID)]
    pub recent_blockhashes: AccountInfo<'info>,

    /// CHECK: TODO
    #[account(constraint = vrf_program_state.owner.as_ref() == switchboard_program.key().as_ref())]
    pub vrf_program_state: AccountInfo<'info>,

    #[account(mut)]
    pub admin: Signer<'info>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, token::Token>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct DrawParams {
    pub lottery_name: String,
    pub vrf_client_state_bump: u8,
    pub permission_bump: u8,
    pub switchboard_state_bump: u8,
}

#[derive(Accounts)]
pub struct DrawResult<'info> {
    #[account(mut)]
    pub state: AccountLoader<'info, VrfClient>,

    /// CHECK: TODO
    pub vrf: AccountInfo<'info>,

    #[account(mut)]
    pub lottery_manager: Account<'info, LotteryManager>,
}

#[event]
pub struct DrawResultSuccessful {
    pub winning_pick: u64,
}

#[derive(Accounts)]
#[instruction(params: DispenseParams)]
pub struct Dispense<'info> {
    pub prize_mint: Box<Account<'info, token::Mint>>,

    #[account(mut, token::mint = prize_mint, token::authority = lottery_manager, seeds = [b"prize_vault", params.lottery_name.as_bytes()], bump)]
    pub prize_vault: Box<Account<'info, token::TokenAccount>>,

    #[account(mut, seeds = [b"lottery_manager", params.lottery_name.as_bytes()], bump)]
    pub lottery_manager: Box<Account<'info, LotteryManager>>,

    #[account()]
    pub ticket_mint: Box<Account<'info, token::Mint>>,

    #[account(has_one = ticket_mint, seeds = [b"ticket", lottery_manager.key().as_ref(), ticket_mint.key().as_ref()], bump)]
    pub ticket: Box<Account<'info, Ticket>>,

    #[account()]
    pub winner_ticket_ata: Box<Account<'info, token::TokenAccount>>,

    #[account(mut)]
    pub winner_prize_ata: Account<'info, token::TokenAccount>,

    #[account(mut)]
    pub user: Signer<'info>,

    /// CHECK: TODO
    pub associated_token_program: Program<'info, associated_token::AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, token::Token>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct DispenseParams {
    pub lottery_name: String,
}

#[derive(Clone)]
pub struct TokenMetadata;

impl anchor_lang::Id for TokenMetadata {
    fn id() -> Pubkey {
        mpl_token_metadata::ID
    }
}

#[error_code]
#[derive(Eq, PartialEq)]
pub enum VrfErrorCode {
    #[msg("Not a valid Switchboard VRF account")]
    InvalidSwitchboardVrfAccount,
    #[msg("The max result must not exceed u64")]
    MaxResultExceedsMaximum,
    #[msg("Current round result is empty")]
    EmptyCurrentRoundResult,
    #[msg("Invalid authority account provided.")]
    InvalidAuthorityError,
}

#[error_code]
pub enum SLPErrorCode {
    #[msg("TimeRemaining")]
    TimeRemaining,

    #[msg("Must call Dispense")]
    CallDispense,

    #[msg("Must call Draw")]
    CallDraw,

    #[msg("Invalid Pick")]
    InvalidPick,

    #[msg("No Tickets Purchased")]
    NoTicketsPurchased,

    #[msg("Must Pass in Winning PDA to Dispense")]
    PassInWinningPDA,

    #[msg("Not enough tokens for swap")]
    NotEnoughTokens,

    #[msg("Invalid ticket price")]
    InvalidTicketPrice,

    #[msg("Invalid draw duration")]
    InvalidDrawDuration,

    #[msg("Ticket PDA does not match ticket ata mint")]
    IncorrectTicketMint,

    #[msg("Winning Prize ATA and Winning Ticket ATA owners do not match")]
    WinnerTicketAndPrizeAtasMismatch,

    #[msg("Not a valid Switchboard VRF account")]
    InvalidSwitchboardVrfAccount,

    #[msg("The max result must not exceed u64")]
    MaxResultExceedsMaximum,

    #[msg("Current round result is empty")]
    EmptyCurrentRoundResult,

    #[msg("Invalid authority account provided.")]
    InvalidAuthorityError,

    #[msg("Max Tickets Purchased")]
    MaxTicketsPurchased,
}

// retrieve current unix timestamp converted to milliseconds
fn get_current_time() -> u64 {
    return Clock::get().unwrap().unix_timestamp as u64;
}
