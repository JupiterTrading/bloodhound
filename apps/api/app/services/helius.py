"""
Helius API integration — enriched transactions, webhooks, DAS.
"""

import httpx
from typing import Any
from app.core.config import get_settings

settings = get_settings()

HELIUS_BASE = "https://api.helius.xyz/v0"
HELIUS_RPC = f"https://mainnet.helius-rpc.com/?api-key={settings.helius_api_key}"

# Source platform lookup — map program addresses to readable names
SOURCE_PROGRAMS: dict[str, str] = {
    "9W959DqEETiGZocYWCQPaJ6sBmUzgfxXfqGeTEdp3aQP": "orca",
    "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8": "raydium",
    "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P": "pump_fun",
    "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4": "jupiter",
    "jito*": "jito",  # Jito tip programs (prefix match)
}


async def get_wallet_transactions(
    address: str,
    before: str | None = None,
    limit: int = 100,
) -> list[dict[str, Any]]:
    """
    Fetch enriched/parsed transactions for a wallet from Helius.
    Uses Enhanced Transactions API — returns typed events (SWAP, TRANSFER, etc.)
    """
    url = f"{HELIUS_BASE}/addresses/{address}/transactions"
    params = {
        "api-key": settings.helius_api_key,
        "limit": limit,
        "type": "all",
    }
    if before:
        params["before"] = before

    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.get(url, params=params)
        response.raise_for_status()
        return response.json()


async def get_token_accounts(address: str) -> dict[str, Any]:
    """
    Get token holdings for a wallet via Helius DAS API.
    """
    payload = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "getAssetsByOwner",
        "params": {
            "ownerAddress": address,
            "page": 1,
            "limit": 1000,
            "displayOptions": {
                "showFungible": True,
                "showNativeBalance": True,
            },
        },
    }
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(HELIUS_RPC, json=payload)
        response.raise_for_status()
        return response.json()


async def get_nft_holdings(address: str) -> list[dict[str, Any]]:
    """
    Fetch NFT holdings for a wallet via Helius DAS getAssetsByOwner.
    Returns non-fungible assets only. Paginates up to 5 pages (500 NFTs).
    Includes compressed NFT detection via compression field.
    """
    NFT_INTERFACES = {"V1_NFT", "ProgrammableNFT", "MplCoreAsset", "V1_PRINT"}
    all_items: list[dict[str, Any]] = []

    for page in range(1, 6):
        payload = {
            "jsonrpc": "2.0",
            "id": page,
            "method": "getAssetsByOwner",
            "params": {
                "ownerAddress": address,
                "page": page,
                "limit": 100,
                "displayOptions": {
                    "showFungible": False,
                    "showNativeBalance": False,
                    "showCollectionMetadata": True,
                },
            },
        }
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(HELIUS_RPC, json=payload)
            response.raise_for_status()
            data = response.json()

        items = data.get("result", {}).get("items", [])
        if not items:
            break
        all_items.extend(items)
        if len(items) < 100:
            break

    nfts: list[dict[str, Any]] = []
    for item in all_items:
        if item.get("interface") not in NFT_INTERFACES:
            continue

        content = item.get("content", {})
        metadata = content.get("metadata", {})
        links = content.get("links", {})
        files = content.get("files") or []
        grouping = item.get("grouping") or []
        compression = item.get("compression", {})
        
        collection_address = next(
            (g.get("group_value") for g in grouping if g.get("group_key") == "collection"),
            None,
        )
        # Best image: links.image → first file cdn_uri → first file uri
        image = (
            links.get("image")
            or (files[0].get("cdn_uri") if files else None)
            or (files[0].get("uri") if files else None)
        )
        
        # Detect compressed NFT (cNFT)
        is_compressed = compression.get("compressed", False) if compression else False

        nfts.append({
            "mint": item.get("id", ""),
            "name": metadata.get("name") or "Unknown NFT",
            "symbol": metadata.get("symbol"),
            "image": image,
            "collection_address": collection_address,
            "attributes": metadata.get("attributes", []),
            "interface": item.get("interface"),
            "is_compressed": is_compressed,
        })

    # Fetch floor prices for collections
    collection_addresses = list(set(n["collection_address"] for n in nfts if n["collection_address"]))
    floor_prices = await _get_collection_floors(collection_addresses)
    
    # Fetch listing prices for individual NFTs
    nft_mints = [n["mint"] for n in nfts]
    listings = await _get_nft_listings(nft_mints)
    
    # Add floor prices and listing info to NFTs
    for nft in nfts:
        if nft["collection_address"]:
            nft["floor_price_sol"] = floor_prices.get(nft["collection_address"])
        else:
            nft["floor_price_sol"] = None
        
        listing = listings.get(nft["mint"])
        if listing:
            nft["listing_price_sol"] = listing.get("price_sol")
            nft["is_listed"] = True
        else:
            nft["listing_price_sol"] = None
            nft["is_listed"] = False
    
    return nfts


async def _get_collection_floors(collection_addresses: list[str]) -> dict[str, float]:
    """Fetch floor prices for NFT collections from Magic Eden API."""
    if not collection_addresses:
        return {}
    
    floors: dict[str, float] = {}
    
    # Magic Eden collection stats API
    for addr in collection_addresses[:20]:  # Limit to avoid rate limits
        try:
            url = f"https://api-mainnet.magiceden.dev/v2/collections/{addr}/stats"
            async with httpx.AsyncClient(timeout=5) as client:
                r = await client.get(url)
                if r.is_success:
                    data = r.json()
                    floor = data.get("floorPrice")
                    if floor:
                        floors[addr] = floor / 1_000_000_000  # lamports to SOL
        except Exception:
            pass
    
    return floors


async def _get_nft_listings(mints: list[str]) -> dict[str, dict]:
    """Fetch listing info for individual NFTs from Magic Eden API."""
    if not mints:
        return {}
    
    listings: dict[str, dict] = {}
    
    # Magic Eden token listing API - batch query
    for mint in mints[:30]:  # Limit to avoid rate limits
        try:
            url = f"https://api-mainnet.magiceden.dev/v2/tokens/{mint}/listings"
            async with httpx.AsyncClient(timeout=5) as client:
                r = await client.get(url)
                if r.is_success:
                    data = r.json()
                    # Get the lowest active listing
                    if data and len(data) > 0:
                        lowest = min(data, key=lambda x: x.get("price", float("inf")))
                        price = lowest.get("price")
                        if price:
                            listings[mint] = {
                                "price_sol": price / 1_000_000_000,  # lamports to SOL
                                "seller": lowest.get("seller"),
                                "marketplace": lowest.get("source", "magic_eden"),
                            }
        except Exception:
            pass
    
    return listings


def detect_source_platform(tx: dict[str, Any]) -> str:
    """
    Detect which platform/app originated a transaction.
    Maps program addresses to human-readable source names.
    """
    instructions = tx.get("instructions", [])
    program_ids = [ix.get("programId", "") for ix in instructions]

    for program_id in program_ids:
        if program_id in SOURCE_PROGRAMS:
            return SOURCE_PROGRAMS[program_id]
        # Jito prefix match
        if any(program_id.startswith("J") and "jito" in program_id.lower()
               for _ in [1]):
            return "jito"

    # Fall back to Helius source field if available
    source = tx.get("source", "").lower()
    if source in {"raydium", "orca", "pump_fun", "jupiter", "phantom",
                  "coinbase", "jito", "axiom", "meteora"}:
        return source

    return "unknown"


async def get_sol_balance(address: str) -> float:
    """Get native SOL balance for a wallet via Helius RPC."""
    payload = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "getBalance",
        "params": [address],
    }
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.post(HELIUS_RPC, json=payload)
        response.raise_for_status()
        data = response.json()
    lamports = (data.get("result") or {}).get("value", 0) or 0
    return lamports / 1_000_000_000


async def get_account_info(address: str) -> dict[str, Any]:
    """Fetch basic account info (owner, lamports, executable, data)."""
    payload = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "getAccountInfo",
        "params": [address, {"encoding": "base64"}],
    }
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.post(HELIUS_RPC, json=payload)
        response.raise_for_status()
        data = response.json()
    return (data.get("result") or {}).get("value") or {}


async def get_transaction(sig: str) -> dict[str, Any] | None:
    """
    Fetch a single enriched transaction by signature from Helius Enhanced API.
    Returns None if not found.
    """
    url = f"{HELIUS_BASE}/transactions"
    params = {"api-key": settings.helius_api_key}
    async with httpx.AsyncClient(timeout=15) as client:
        response = await client.post(url, params=params, json=[sig])
        response.raise_for_status()
        data = response.json()
    if not data:
        return None
    return data[0]


async def fetch_full_history(address: str) -> list[dict[str, Any]]:
    """
    Paginate through ALL available transaction history for a wallet.
    Fetches until no more results. Use for initial wallet indexing.
    """
    all_txs = []
    before = None

    while True:
        batch = await get_wallet_transactions(address, before=before, limit=100)
        if not batch:
            break
        all_txs.extend(batch)
        before = batch[-1]["signature"]
        # Helius returns < 100 if we've reached the end
        if len(batch) < 100:
            break

    return all_txs
