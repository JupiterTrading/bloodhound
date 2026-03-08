from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # Supabase
    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_service_role_key: str = ""

    # Helius
    helius_api_key: str = ""
    helius_webhook_secret: str = ""
    helius_webhook_id: str = ""

    # ClickHouse
    clickhouse_host: str = ""
    clickhouse_user: str = "default"
    clickhouse_password: str = ""
    clickhouse_db: str = "bloodhound"

    # Anthropic
    anthropic_api_key: str = ""

    # Redis
    upstash_redis_rest_url: str = ""
    upstash_redis_rest_token: str = ""

    # Birdeye
    birdeye_api_key: str = ""

    # Solscan (optional — Pro API for broader entity labels)
    solscan_api_key: str = ""

    # Ably (real-time alerts)
    ably_api_key: str = ""

    # Stripe
    stripe_secret_key: str = ""
    stripe_publishable_key: str = ""
    stripe_webhook_secret: str = ""

    # Resend (email)
    resend_api_key: str = ""

    # Twitter/X
    twitter_bearer_token: str = ""
    twitter_api_key: str = ""
    twitter_api_secret: str = ""

    # Clerk
    next_public_clerk_publishable_key: str = ""
    clerk_secret_key: str = ""
    clerk_jwks_url: str = ""

    # Admin
    admin_api_key: str = ""          # Set in Railway — protects /admin endpoints

    # App
    api_url: str = "http://localhost:8000"
    next_public_app_url: str = "http://localhost:3000"

    # Classification thresholds
    whale_wallet_usd_threshold: float = 50000
    whale_wallet_sol_balance_threshold: float = 500
    whale_wallet_volume_sol_30d: float = 2000
    smart_money_win_rate_threshold: float = 0.60
    smart_money_min_trades: int = 20
    side_wallet_min_confidence: float = 0.50

    class Config:
        env_file = "../../.env.local"
        env_file_encoding = "utf-8"
        case_sensitive = False


@lru_cache()
def get_settings() -> Settings:
    return Settings()
