use once_cell::sync::Lazy;
use std::collections::HashMap;

/// Static mapping from Artemis symbol names to Coinbase product IDs
pub static ARTEMIS_TO_COINBASE: Lazy<HashMap<&'static str, &'static str>> = Lazy::new(|| {
    let mut m = HashMap::new();

    // Major cryptocurrencies
    m.insert("bitcoin", "BTC-USD");
    m.insert("ethereum", "ETH-USD");
    m.insert("solana", "SOL-USD");
    m.insert("cardano", "ADA-USD");
    m.insert("avalanche", "AVAX-USD");
    m.insert("polkadot", "DOT-USD");
    m.insert("chainlink", "LINK-USD");
    m.insert("polygon", "POL-USD");
    m.insert("litecoin", "LTC-USD");
    m.insert("uniswap", "UNI-USD");
    m.insert("stellar", "XLM-USD");
    m.insert("cosmos", "ATOM-USD");
    m.insert("near", "NEAR-USD");
    m.insert("algorand", "ALGO-USD");
    m.insert("filecoin", "FIL-USD");
    m.insert("internet-computer", "ICP-USD");
    m.insert("aptos", "APT-USD");
    m.insert("arbitrum", "ARB-USD");
    m.insert("optimism", "OP-USD");
    m.insert("sui", "SUI-USD");
    m.insert("hedera", "HBAR-USD");

    // DeFi protocols
    m.insert("aave", "AAVE-USD");
    m.insert("maker", "MKR-USD");
    m.insert("render", "RENDER-USD");
    m.insert("injective", "INJ-USD");
    m.insert("sei", "SEI-USD");
    m.insert("celestia", "TIA-USD");
    m.insert("stacks", "STX-USD");
    m.insert("the-graph", "GRT-USD");
    m.insert("eos", "EOS-USD");
    m.insert("flow", "FLOW-USD");

    // Gaming & Metaverse
    m.insert("axie-infinity", "AXS-USD");
    m.insert("decentraland", "MANA-USD");
    m.insert("the-sandbox", "SAND-USD");
    m.insert("enjin-coin", "ENJ-USD");
    m.insert("gala", "GALA-USD");
    m.insert("immutable-x", "IMX-USD");

    // Staking & Liquid Staking
    m.insert("lido-dao", "LDO-USD");
    m.insert("rocket-pool", "RPL-USD");

    // DeFi Protocols
    m.insert("compound", "COMP-USD");
    m.insert("sushi", "SUSHI-USD");
    m.insert("1inch", "1INCH-USD");
    m.insert("curve-dao-token", "CRV-USD");
    m.insert("yearn-finance", "YFI-USD");
    m.insert("synthetix", "SNX-USD");

    // AI & Data
    m.insert("fetch-ai", "FET-USD");
    m.insert("ocean-protocol", "OCEAN-USD");
    m.insert("theta", "THETA-USD");

    // Legacy cryptocurrencies
    m.insert("tezos", "XTZ-USD");
    m.insert("iota", "IOTA-USD");
    m.insert("zcash", "ZEC-USD");
    m.insert("dash", "DASH-USD");
    m.insert("ethereum-classic", "ETC-USD");
    m.insert("bitcoin-cash", "BCH-USD");

    // Meme coins
    m.insert("dogecoin", "DOGE-USD");
    m.insert("shiba-inu", "SHIB-USD");
    m.insert("pepe", "PEPE-USD");
    m.insert("bonk", "BONK-USD");
    m.insert("floki", "FLOKI-USD");

    // Other tokens
    m.insert("jasmy", "JASMY-USD");
    m.insert("chiliz", "CHZ-USD");
    m.insert("mask-network", "MASK-USD");
    m.insert("blur", "BLUR-USD");
    m.insert("worldcoin", "WLD-USD");

    // Solana ecosystem
    m.insert("jupiter", "JUP-USD");
    m.insert("pyth-network", "PYTH-USD");
    m.insert("jito", "JTO-USD");

    // Derivatives & Perpetuals
    m.insert("dydx", "DYDX-USD");
    m.insert("gmx", "GMX-USD");
    m.insert("raydium", "RAY-USD");

    // RWA & Stablecoins
    m.insert("ondo-finance", "ONDO-USD");
    m.insert("ethena", "ENA-USD");

    // Yield & Options
    m.insert("pendle", "PENDLE-USD");

    // Layer 2 & Scaling
    m.insert("eigen-layer", "EIGEN-USD");
    m.insert("zksync", "ZK-USD");
    m.insert("scroll", "SCR-USD");
    m.insert("mantle", "MNT-USD");

    // Layer 1s
    m.insert("ton", "TON-USD");
    m.insert("tron", "TRX-USD");
    m.insert("xrp", "XRP-USD");

    m
});

/// Lookup Coinbase product ID from Artemis symbol name
///
/// # Arguments
/// * `artemis_symbol` - Artemis symbol name (e.g., "bitcoin", "ethereum")
///
/// # Returns
/// * `Some(&str)` - Coinbase product ID (e.g., "BTC-USD")
/// * `None` - Symbol not found in mapping
///
/// # Example
/// ```
/// use factors_rs::data::mappings::artemis_to_coinbase;
///
/// assert_eq!(artemis_to_coinbase("bitcoin"), Some("BTC-USD"));
/// assert_eq!(artemis_to_coinbase("ethereum"), Some("ETH-USD"));
/// assert_eq!(artemis_to_coinbase("unknown"), None);
/// ```
pub fn artemis_to_coinbase(artemis_symbol: &str) -> Option<&'static str> {
    ARTEMIS_TO_COINBASE.get(artemis_symbol).copied()
}

/// Get all supported Artemis symbols
pub fn get_supported_symbols() -> Vec<&'static str> {
    ARTEMIS_TO_COINBASE.keys().copied().collect()
}

/// Check if an Artemis symbol is supported
pub fn is_supported(artemis_symbol: &str) -> bool {
    ARTEMIS_TO_COINBASE.contains_key(artemis_symbol)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_artemis_to_coinbase_major_coins() {
        assert_eq!(artemis_to_coinbase("bitcoin"), Some("BTC-USD"));
        assert_eq!(artemis_to_coinbase("ethereum"), Some("ETH-USD"));
        assert_eq!(artemis_to_coinbase("solana"), Some("SOL-USD"));
    }

    #[test]
    fn test_artemis_to_coinbase_not_found() {
        assert_eq!(artemis_to_coinbase("nonexistent-token"), None);
    }

    #[test]
    fn test_is_supported() {
        assert!(is_supported("bitcoin"));
        assert!(is_supported("ethereum"));
        assert!(!is_supported("nonexistent-token"));
    }

    #[test]
    fn test_get_supported_symbols() {
        let symbols = get_supported_symbols();
        assert!(symbols.len() > 80); // We have 81+ mappings
        assert!(symbols.contains(&"bitcoin"));
        assert!(symbols.contains(&"ethereum"));
    }
}
