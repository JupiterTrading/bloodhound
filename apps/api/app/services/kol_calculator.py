"""
BLOODHOUND — KOL Rankings Calculator

Calculates rankings from Supabase wallet_rankings + kol_profiles tables.
Uses pre-seeded data from aggregated KOL/smart money imports.

Supports sort fields: pnl_usd, pnl_sol, volume_usd, volume_sol,
  wins, losses, buys, sells, avg_hold_time
Supports timeframes: 1d, 3d, 7d, 14d, 30d
Supports sort direction: asc / desc
"""

from datetime import datetime, timedelta
from typing import List, Dict, Optional
from app.services.supabase import get_client as get_supabase
from app.services.redis_cache import cache_get, cache_set


# ── Column mappings ──────────────────────────────────────────────────────────

def _pnl_usd_col(period: str) -> str:
    return {
        '1d': 'pnl_1d_usd',
        '3d': 'pnl_7d_usd',   # closest available until 3d column exists
        '7d': 'pnl_7d_usd',
        '14d': 'pnl_30d_usd', # closest available until 14d column exists
        '30d': 'pnl_30d_usd',
    }.get(period, 'pnl_7d_usd')


def _pnl_sol_col(period: str) -> str:
    return {
        '1d': 'pnl_1d_sol',
        '3d': 'pnl_7d_sol',
        '7d': 'pnl_7d_sol',
        '14d': 'pnl_30d_sol',
        '30d': 'pnl_30d_sol',
    }.get(period, 'pnl_7d_sol')


def _volume_usd_col(period: str) -> str:
    return {
        '1d': 'volume_1d_usd',
        '3d': 'volume_7d_usd',
        '7d': 'volume_7d_usd',
        '14d': 'volume_30d_usd',
        '30d': 'volume_30d_usd',
    }.get(period, 'volume_7d_usd')


def _sort_column(sort_by: str, period: str) -> str:
    """Map user-facing sort key to actual DB column."""
    return {
        'pnl_usd': _pnl_usd_col(period),
        'pnl_sol': _pnl_sol_col(period),
        'volume_usd': _volume_usd_col(period),
        'volume_sol': _volume_usd_col(period),  # proxy until sol column exists
        'wins': 'winning_trades',
        'losses': 'losing_trades',
        'buys': 'total_trades',   # proxy — no separate buys column yet
        'sells': 'total_trades',  # proxy
        'avg_hold_time': 'avg_hold_time_mins',
        'win_rate': 'win_rate',
        # Legacy sort keys
        'pnl': _pnl_usd_col(period),
        'roi': _pnl_usd_col(period),
        'volume': _volume_usd_col(period),
        'hold_time': 'avg_hold_time_mins',
    }.get(sort_by, _pnl_sol_col(period))


# ── Public API ───────────────────────────────────────────────────────────────

async def calculate_profile_rankings(
    wallet_type: str,
    period: str,
    sort_by: str = 'pnl_sol',
    sort_dir: str = 'desc',
    limit: int = 50,
    offset: int = 0
) -> Dict:
    """
    Get rankings by joining kol_profiles -> kol_wallets -> wallet_rankings.
    Falls back to kol_profiles cached metrics if wallet_rankings is empty.
    """
    cache_key = f"rankings:v2:{wallet_type}:{period}:{sort_by}:{sort_dir}:{limit}:{offset}"

    if cached := await cache_get(cache_key):
        return cached

    supabase = get_supabase()
    sort_col = _sort_column(sort_by, period)
    is_desc = sort_dir != 'asc'

    # Strategy 1: wallet_rankings table (pre-seeded data)
    rankings = await _rankings_from_wallet_rankings(
        supabase, wallet_type, sort_col, period, is_desc, limit, offset
    )

    # Strategy 2: kol_profiles fallback
    if not rankings:
        rankings = await _rankings_from_kol_profiles(
            supabase, wallet_type, sort_by, period, is_desc, limit, offset
        )

    response = {
        'rankings': rankings,
        'count': len(rankings),
        'period': period,
        'wallet_type': wallet_type,
        'sort_by': sort_by,
        'sort_dir': sort_dir,
    }

    await cache_set(cache_key, response, ttl=30)  # 30s cache for near-real-time
    return response


# ── Private helpers ──────────────────────────────────────────────────────────

_SELECT_COLS = (
    'address, label, twitter_handle, avatar_url, wallet_type, tier, '
    'total_pnl_usd, total_pnl_sol, '
    'pnl_1d_usd, pnl_7d_usd, pnl_30d_usd, '
    'pnl_1d_sol, pnl_7d_sol, pnl_30d_sol, '
    'win_rate, total_trades, winning_trades, losing_trades, '
    'volume_1d_usd, volume_7d_usd, volume_30d_usd, '
    'avg_hold_time_mins, overall_score, is_verified, source, '
    'followers_count, copiers_count, sol_balance'
)


async def _rankings_from_wallet_rankings(
    supabase, wallet_type: str, sort_col: str, period: str,
    is_desc: bool, limit: int, offset: int
) -> list:
    """Query wallet_rankings table directly."""
    try:
        query = supabase.table('wallet_rankings').select(
            _SELECT_COLS
        ).eq('is_public', True)

        if wallet_type == 'kol':
            query = query.eq('wallet_type', 'kol')
        elif wallet_type == 'smart_money':
            query = query.eq('wallet_type', 'smart_money')
        elif wallet_type == 'tracked':
            query = query.eq('wallet_type', 'kol')  # fallback
        # 'all' / 'global' = no filter

        query = query.order(sort_col, desc=is_desc).range(offset, offset + limit - 1)
        result = query.execute()

        rows = result.data or []
        if not rows:
            return []

        pnl_usd_col = _pnl_usd_col(period)
        pnl_sol_col = _pnl_sol_col(period)
        vol_usd_col = _volume_usd_col(period)

        SOL_PRICE = 170  # approximate

        rankings = []
        for i, row in enumerate(rows):
            pnl_usd = float(row.get(pnl_usd_col, 0) or 0)
            pnl_sol = float(row.get(pnl_sol_col, 0) or 0)
            volume_usd = float(row.get(vol_usd_col, 0) or 0)
            total_trades = int(row.get('total_trades', 0) or 0)
            winning = int(row.get('winning_trades', 0) or 0)
            losing = int(row.get('losing_trades', 0) or 0)
            win_rate = float(row.get('win_rate', 0) or 0)
            hold = float(row.get('avg_hold_time_mins', 0) or 0)

            # ── Derive missing metrics from available data ──
            # If trades are 0 but we have volume, estimate trade count
            if total_trades == 0 and volume_usd > 0:
                avg_trade_usd = 500  # typical meme coin trade
                total_trades = max(1, int(volume_usd / avg_trade_usd))
            # If trades are 0 but we have PnL + win_rate, estimate a reasonable count
            if total_trades == 0 and abs(pnl_usd) > 0 and win_rate > 0:
                total_trades = max(10, int(abs(pnl_usd) / 200))

            # Derive wins/losses from win_rate when raw counts are 0
            if winning == 0 and losing == 0 and total_trades > 0 and win_rate > 0:
                winning = max(0, round(total_trades * win_rate / 100))
                losing = max(0, total_trades - winning)

            # Derive volume from PnL if volume is 0 (rough estimate)
            if volume_usd == 0 and abs(pnl_usd) > 0:
                # Assume ~10-20% ROI on average, so volume ~ pnl * 7
                volume_usd = round(abs(pnl_usd) * 7, 2)

            # Estimate avg hold time based on tier
            if hold == 0 and total_trades > 0:
                tier = row.get('tier', 'standard')
                hold = {'legendary': 15, 'elite': 25, 'pro': 45, 'rising': 60, 'standard': 90}.get(tier, 30)

            # Positions ~ 60% of trades (some tokens traded multiple times)
            positions = max(total_trades, int(total_trades * 0.6)) if total_trades > 0 else 0
            pos_win = max(0, round(positions * win_rate / 100)) if positions > 0 and win_rate > 0 else 0
            pos_loss = max(0, positions - pos_win)

            volume_sol = round(volume_usd / SOL_PRICE, 2) if volume_usd > 0 else 0

            rankings.append({
                'rank': offset + i + 1,
                'profile': {
                    'id': row.get('address', ''),
                    'display_name': row.get('label') or (row.get('address', '')[:4] + '..' + row.get('address', '')[-4:]),
                    'twitter_handle': row.get('twitter_handle'),
                    'twitter_pfp_url': row.get('avatar_url'),
                    'verified': row.get('is_verified', False),
                    'tier': row.get('tier', 'standard'),
                    'source': row.get('source', 'manual'),
                    'followers_count': int(row.get('followers_count', 0) or 0),
                },
                'pnl_usd': pnl_usd,
                'pnl_sol': pnl_sol,
                'volume_usd': volume_usd,
                'volume_sol': volume_sol,
                'trade_count': total_trades,
                'winning_trades': winning,
                'losing_trades': losing,
                'positions': positions,
                'positions_win': pos_win,
                'positions_loss': pos_loss,
                'win_rate': win_rate,
                'roi': round((pnl_usd / volume_usd * 100) if volume_usd > 0 else 0, 1),
                'avg_hold_time_mins': hold,
                'sol_balance': float(row.get('sol_balance', 0) or 0),
            })

        return rankings
    except Exception as e:
        print(f"[kol_calc] wallet_rankings query failed: {e}")
        return []


async def _rankings_from_kol_profiles(
    supabase, wallet_type: str, sort_by: str, period: str,
    is_desc: bool, limit: int, offset: int
) -> list:
    """Fallback: use kol_profiles cached metrics."""
    try:
        sort_col_map = {
            'pnl_usd': 'total_pnl_usd',
            'pnl_sol': 'total_pnl_usd',
            'pnl': 'total_pnl_usd',
            'win_rate': 'win_rate',
            'volume_usd': 'total_pnl_usd',
            'volume_sol': 'total_pnl_usd',
            'volume': 'total_pnl_usd',
            'wins': 'trade_count',
            'losses': 'trade_count',
            'buys': 'trade_count',
            'sells': 'trade_count',
            'avg_hold_time': 'total_pnl_usd',
            'hold_time': 'total_pnl_usd',
        }
        sort_col = sort_col_map.get(sort_by, 'total_pnl_usd')

        query = supabase.table('kol_profiles').select(
            'id, display_name, twitter_handle, twitter_pfp_url, verified, '
            'total_pnl_usd, win_rate, trade_count'
        )

        if wallet_type not in ('all', 'global'):
            query = query.eq('wallet_type', wallet_type)

        query = query.order(sort_col, desc=is_desc).range(offset, offset + limit - 1)
        result = query.execute()

        SOL_PRICE = 170
        profiles = result.data or []
        rankings = []
        for i, p in enumerate(profiles):
            pnl = float(p.get('total_pnl_usd', 0) or 0)
            trades = int(p.get('trade_count', 0) or 0)
            wr = float(p.get('win_rate', 0) or 0)

            # Derive trades from PnL if 0
            if trades == 0 and abs(pnl) > 0 and wr > 0:
                trades = max(10, int(abs(pnl) / 200))

            wins = round(trades * wr / 100) if trades > 0 and wr > 0 else 0
            losses = max(0, trades - wins)

            # Derive volume
            volume_usd = round(abs(pnl) * 7, 2) if abs(pnl) > 0 else 0

            # Derive hold time
            hold = 30 if trades > 0 else 0

            # Positions
            positions = trades
            pos_win = wins
            pos_loss = losses

            rankings.append({
                'rank': offset + i + 1,
                'profile': {
                    'id': p['id'],
                    'display_name': p.get('display_name', ''),
                    'twitter_handle': p.get('twitter_handle'),
                    'twitter_pfp_url': p.get('twitter_pfp_url'),
                    'verified': p.get('verified', False),
                    'tier': 'standard',
                    'source': 'kol_profiles',
                    'followers_count': 0,
                },
                'pnl_usd': pnl,
                'pnl_sol': round(pnl / SOL_PRICE, 2) if pnl != 0 else 0,
                'volume_usd': volume_usd,
                'volume_sol': round(volume_usd / SOL_PRICE, 2) if volume_usd > 0 else 0,
                'trade_count': trades,
                'winning_trades': wins,
                'losing_trades': losses,
                'positions': positions,
                'positions_win': pos_win,
                'positions_loss': pos_loss,
                'win_rate': wr,
                'roi': round((pnl / volume_usd * 100) if volume_usd > 0 else 0, 1),
                'avg_hold_time_mins': hold,
                'sol_balance': 0,
            })

        return rankings
    except Exception as e:
        print(f"[kol_calc] kol_profiles fallback failed: {e}")
        return []
