/**
 * Transaction Parser Utilities
 *
 * Parses broker-specific CSV transaction exports and aggregates them
 * into current holdings with FIFO cost basis calculation.
 */

// ============================================================================
// TYPES
// ============================================================================

export interface Transaction {
  date: Date;
  type: 'buy' | 'sell' | 'deposit' | 'withdrawal' | 'dividend' | 'fee';
  ticker: string;
  security_name: string;
  quantity: number;
  price: number;
  amount: number; // total dollar amount
  fees?: number;
  asset_type?: string;
}

export interface AggregatedHolding {
  ticker: string;
  security_name: string;
  quantity: number;
  average_cost: number; // cost basis per unit
  total_cost_basis: number;
  asset_type: string | null;
}

interface PurchaseLot {
  quantity: number;
  price: number;
  date: Date;
}

// ============================================================================
// CSV PARSING HELPERS
// ============================================================================

function parseCSV(csvText: string): string[][] {
  const lines = csvText.trim().split('\n');
  return lines.map(line => {
    // Simple CSV parser - handles quoted fields
    const fields: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        fields.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    fields.push(current.trim());
    return fields;
  });
}

function parseDate(dateStr: string): Date {
  // Try various date formats
  const date = new Date(dateStr);
  if (!isNaN(date.getTime())) {
    return date;
  }

  // Try MM/DD/YYYY format
  const parts = dateStr.split(/[\/\-]/);
  if (parts.length === 3) {
    const month = parseInt(parts[0]) - 1;
    const day = parseInt(parts[1]);
    const year = parseInt(parts[2]);
    return new Date(year, month, day);
  }

  throw new Error(`Unable to parse date: ${dateStr}`);
}

function normalizeTickerSymbol(ticker: string): string {
  return ticker.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

// ============================================================================
// ROBINHOOD PARSER
// ============================================================================

/**
 * Parses Robinhood transaction history CSV
 * Expected columns: Date, Ticker Symbol, Order Type, Side, Quantity, Average Price, Fees
 */
export function parseRobinhoodTransactions(csvText: string): Transaction[] {
  const rows = parseCSV(csvText);
  if (rows.length < 2) {
    throw new Error('CSV file is empty or has no data rows');
  }

  const header = rows[0].map(h => h.toLowerCase().trim());
  const transactions: Transaction[] = [];

  // Find column indices
  const dateIdx = header.findIndex(h => h.includes('date'));
  const tickerIdx = header.findIndex(h => h.includes('ticker') || h.includes('symbol'));
  const sideIdx = header.findIndex(h => h.includes('side') || h.includes('type'));
  const qtyIdx = header.findIndex(h => h.includes('quantity') || h.includes('qty'));
  const priceIdx = header.findIndex(h => h.includes('price'));
  const feesIdx = header.findIndex(h => h.includes('fee'));

  if (dateIdx === -1 || tickerIdx === -1 || sideIdx === -1 || qtyIdx === -1 || priceIdx === -1) {
    throw new Error('Missing required columns in Robinhood CSV. Expected: Date, Ticker Symbol, Side, Quantity, Average Price');
  }

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.length < 5) continue; // Skip incomplete rows

    try {
      const side = row[sideIdx].toLowerCase().trim();
      const ticker = normalizeTickerSymbol(row[tickerIdx]);
      const quantity = parseFloat(row[qtyIdx]);
      const price = parseFloat(row[priceIdx].replace(/[$,]/g, ''));
      const fees = feesIdx !== -1 ? parseFloat(row[feesIdx].replace(/[$,]/g, '') || '0') : 0;

      if (!ticker || isNaN(quantity) || isNaN(price)) continue;

      let type: Transaction['type'];
      if (side.includes('buy')) {
        type = 'buy';
      } else if (side.includes('sell')) {
        type = 'sell';
      } else {
        continue; // Skip other transaction types
      }

      transactions.push({
        date: parseDate(row[dateIdx]),
        type,
        ticker,
        security_name: ticker, // Robinhood doesn't provide full name
        quantity: Math.abs(quantity),
        price,
        amount: Math.abs(quantity) * price,
        fees,
        asset_type: 'Stock',
      });
    } catch (err) {
      console.warn(`Skipping Robinhood row ${i}:`, err);
    }
  }

  if (transactions.length === 0) {
    throw new Error('No valid transactions found in Robinhood CSV');
  }

  return transactions;
}

// ============================================================================
// INTERACTIVE BROKERS (IBKR) PARSER
// ============================================================================

/**
 * Parses IBKR Flex Query CSV (Activity Statement - Trades section)
 * Expected columns: TradeDate, Symbol, Quantity, TradePrice, IBCommission
 */
export function parseIBKRTransactions(csvText: string): Transaction[] {
  const rows = parseCSV(csvText);
  if (rows.length < 2) {
    throw new Error('CSV file is empty or has no data rows');
  }

  const transactions: Transaction[] = [];
  let inTradesSection = false;
  let headerRow: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    // Detect Trades section
    if (row[0]?.toLowerCase().includes('trades')) {
      inTradesSection = true;
      // Next row should be header
      if (i + 1 < rows.length) {
        headerRow = rows[i + 1].map(h => h.toLowerCase().trim());
      }
      continue;
    }

    // Exit trades section on new section or summary
    if (inTradesSection && row[0]?.toLowerCase().match(/^(total|summary|notes)/)) {
      inTradesSection = false;
      continue;
    }

    if (!inTradesSection || headerRow.length === 0) continue;

    try {
      const dateIdx = headerRow.findIndex(h => h.includes('date'));
      const symbolIdx = headerRow.findIndex(h => h.includes('symbol'));
      const qtyIdx = headerRow.findIndex(h => h.includes('quantity'));
      const priceIdx = headerRow.findIndex(h => h.includes('price'));
      const commissionIdx = headerRow.findIndex(h => h.includes('commission'));

      if (dateIdx === -1 || symbolIdx === -1 || qtyIdx === -1 || priceIdx === -1) continue;

      const ticker = normalizeTickerSymbol(row[symbolIdx]);
      const quantity = parseFloat(row[qtyIdx]);
      const price = parseFloat(row[priceIdx].replace(/[$,]/g, ''));
      const commission = commissionIdx !== -1 ? Math.abs(parseFloat(row[commissionIdx].replace(/[$,]/g, '') || '0')) : 0;

      if (!ticker || isNaN(quantity) || isNaN(price)) continue;

      transactions.push({
        date: parseDate(row[dateIdx]),
        type: quantity > 0 ? 'buy' : 'sell',
        ticker,
        security_name: ticker,
        quantity: Math.abs(quantity),
        price,
        amount: Math.abs(quantity) * price,
        fees: commission,
        asset_type: 'Stock',
      });
    } catch (err) {
      console.warn(`Skipping IBKR row ${i}:`, err);
    }
  }

  if (transactions.length === 0) {
    throw new Error('No valid trades found in IBKR CSV. Make sure you exported the Activity Statement with Trades section.');
  }

  return transactions;
}

// ============================================================================
// COINBASE PARSER
// ============================================================================

/**
 * Parses Coinbase transaction history CSV
 * Expected columns: Timestamp, Transaction Type, Asset, Quantity Transacted, Spot Price, Total, Fees
 */
export function parseCoinbaseTransactions(csvText: string): Transaction[] {
  const rows = parseCSV(csvText);
  if (rows.length < 2) {
    throw new Error('CSV file is empty or has no data rows');
  }

  const header = rows[0].map(h => h.toLowerCase().trim());
  const transactions: Transaction[] = [];

  const timestampIdx = header.findIndex(h => h.includes('timestamp') || h.includes('date'));
  const typeIdx = header.findIndex(h => h.includes('type'));
  const assetIdx = header.findIndex(h => h.includes('asset'));
  const qtyIdx = header.findIndex(h => h.includes('quantity'));
  const priceIdx = header.findIndex(h => h.includes('spot') || h.includes('price'));
  const totalIdx = header.findIndex(h => h.includes('total'));
  const feesIdx = header.findIndex(h => h.includes('fee'));

  if (timestampIdx === -1 || typeIdx === -1 || assetIdx === -1 || qtyIdx === -1) {
    throw new Error('Missing required columns in Coinbase CSV. Expected: Timestamp, Transaction Type, Asset, Quantity');
  }

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.length < 4) continue;

    try {
      const txType = row[typeIdx].toLowerCase().trim();
      const asset = normalizeTickerSymbol(row[assetIdx]);
      const quantity = parseFloat(row[qtyIdx]);
      const price = priceIdx !== -1 ? parseFloat(row[priceIdx].replace(/[$,]/g, '') || '0') : 0;
      const total = totalIdx !== -1 ? parseFloat(row[totalIdx].replace(/[$,]/g, '') || '0') : 0;
      const fees = feesIdx !== -1 ? parseFloat(row[feesIdx].replace(/[$,]/g, '') || '0') : 0;

      if (!asset || isNaN(quantity)) continue;

      let type: Transaction['type'];
      if (txType.includes('buy') || txType.includes('receive')) {
        type = 'buy';
      } else if (txType.includes('sell') || txType.includes('send')) {
        type = 'sell';
      } else {
        continue; // Skip other types
      }

      const effectivePrice = price > 0 ? price : (total / quantity);

      transactions.push({
        date: parseDate(row[timestampIdx]),
        type,
        ticker: asset,
        security_name: asset,
        quantity: Math.abs(quantity),
        price: effectivePrice,
        amount: Math.abs(total || (quantity * effectivePrice)),
        fees,
        asset_type: 'Crypto',
      });
    } catch (err) {
      console.warn(`Skipping Coinbase row ${i}:`, err);
    }
  }

  if (transactions.length === 0) {
    throw new Error('No valid transactions found in Coinbase CSV');
  }

  return transactions;
}

// ============================================================================
// BINANCE PARSER
// ============================================================================

/**
 * Parses Binance trade history CSV
 * Expected columns: Date/Time, Asset, Side, Price, Amount, Total
 */
export function parseBinanceTransactions(csvText: string): Transaction[] {
  const rows = parseCSV(csvText);
  if (rows.length < 2) {
    throw new Error('CSV file is empty or has no data rows');
  }

  const header = rows[0].map(h => h.toLowerCase().trim());
  const transactions: Transaction[] = [];

  const dateIdx = header.findIndex(h => h.includes('date') || h.includes('time'));
  const assetIdx = header.findIndex(h => h.includes('asset') || h.includes('symbol') || h.includes('pair'));
  const sideIdx = header.findIndex(h => h.includes('side') || h.includes('type'));
  const priceIdx = header.findIndex(h => h.includes('price'));
  const amountIdx = header.findIndex(h => h.includes('amount') || h.includes('quantity'));
  const totalIdx = header.findIndex(h => h.includes('total'));

  if (dateIdx === -1 || assetIdx === -1 || sideIdx === -1 || priceIdx === -1 || amountIdx === -1) {
    throw new Error('Missing required columns in Binance CSV. Expected: Date, Asset, Side, Price, Amount');
  }

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.length < 5) continue;

    try {
      const side = row[sideIdx].toLowerCase().trim();
      let asset = row[assetIdx].trim();

      // Extract base asset from trading pair (e.g., BTCUSDT -> BTC)
      // Common quote assets: USDT, USDC, BUSD, BTC, ETH
      asset = asset.replace(/USDT$|USDC$|BUSD$|BTC$|ETH$/i, '');
      asset = normalizeTickerSymbol(asset);

      const quantity = parseFloat(row[amountIdx]);
      const price = parseFloat(row[priceIdx].replace(/[$,]/g, ''));
      const total = totalIdx !== -1 ? parseFloat(row[totalIdx].replace(/[$,]/g, '') || '0') : 0;

      if (!asset || isNaN(quantity) || isNaN(price)) continue;

      let type: Transaction['type'];
      if (side.includes('buy')) {
        type = 'buy';
      } else if (side.includes('sell')) {
        type = 'sell';
      } else {
        continue;
      }

      transactions.push({
        date: parseDate(row[dateIdx]),
        type,
        ticker: asset,
        security_name: asset,
        quantity: Math.abs(quantity),
        price,
        amount: Math.abs(total || (quantity * price)),
        fees: 0, // Binance fees are typically in a separate column or included in price
        asset_type: 'Crypto',
      });
    } catch (err) {
      console.warn(`Skipping Binance row ${i}:`, err);
    }
  }

  if (transactions.length === 0) {
    throw new Error('No valid transactions found in Binance CSV');
  }

  return transactions;
}

// ============================================================================
// AGGREGATION ENGINE (FIFO COST BASIS)
// ============================================================================

/**
 * Aggregates transactions into current holdings using FIFO cost basis
 */
export function aggregateTransactionsToHoldings(transactions: Transaction[]): AggregatedHolding[] {
  // Sort transactions by date (oldest first)
  const sorted = [...transactions].sort((a, b) => a.date.getTime() - b.date.getTime());

  // Track purchase lots for each ticker (FIFO)
  const lotsByTicker = new Map<string, PurchaseLot[]>();

  for (const tx of sorted) {
    if (tx.type !== 'buy' && tx.type !== 'sell') continue;

    const lots = lotsByTicker.get(tx.ticker) || [];

    if (tx.type === 'buy') {
      // Add new purchase lot
      lots.push({
        quantity: tx.quantity,
        price: tx.price,
        date: tx.date,
      });
    } else if (tx.type === 'sell') {
      // Remove from oldest lots first (FIFO)
      let remainingToSell = tx.quantity;

      while (remainingToSell > 0 && lots.length > 0) {
        const oldestLot = lots[0];

        if (oldestLot.quantity <= remainingToSell) {
          // Consume entire lot
          remainingToSell -= oldestLot.quantity;
          lots.shift();
        } else {
          // Partially consume lot
          oldestLot.quantity -= remainingToSell;
          remainingToSell = 0;
        }
      }

      if (remainingToSell > 0) {
        console.warn(`Warning: Sold ${remainingToSell} more ${tx.ticker} than purchased (short sale or missing data)`);
      }
    }

    lotsByTicker.set(tx.ticker, lots);
  }

  // Calculate aggregated holdings
  const holdings: AggregatedHolding[] = [];

  for (const [ticker, lots] of lotsByTicker.entries()) {
    if (lots.length === 0) continue; // Fully sold

    const totalQuantity = lots.reduce((sum, lot) => sum + lot.quantity, 0);
    const totalCost = lots.reduce((sum, lot) => sum + (lot.quantity * lot.price), 0);
    const averageCost = totalCost / totalQuantity;

    // Get asset type and security name from most recent transaction
    const recentTx = sorted.filter(t => t.ticker === ticker).pop();

    holdings.push({
      ticker,
      security_name: recentTx?.security_name || ticker,
      quantity: totalQuantity,
      average_cost: averageCost,
      total_cost_basis: totalCost,
      asset_type: recentTx?.asset_type || null,
    });
  }

  // Sort by ticker
  return holdings.sort((a, b) => a.ticker.localeCompare(b.ticker));
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get display name for broker
 */
export function getBrokerDisplayName(broker: string): string {
  const names: Record<string, string> = {
    'robinhood': 'Robinhood',
    'ibkr': 'Interactive Brokers',
    'coinbase': 'Coinbase',
    'binance': 'Binance',
    'manual': 'Manual Import',
  };
  return names[broker] || broker;
}
