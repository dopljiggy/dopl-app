/**
 * Broker trade-page deep-link resolver.
 *
 * Maps a SnapTrade/Salt Edge broker name to a ticker-specific trade URL
 * when the broker publishes a stable public deep link, falling back to
 * the homepage `websiteUrl` otherwise. A wrong deep link (e.g. wrong
 * exchange prefix) is worse than a homepage link, so the pattern list
 * is conservative — only brokers with VERIFIED working URL schemes are
 * included.
 *
 * Verified patterns (Instance 2 review 2026-04-23):
 *   - Robinhood:  https://robinhood.com/stocks/AAPL
 *   - Alpaca:     https://app.alpaca.markets/trade/AAPL  (requires auth)
 *   - Schwab:     https://www.schwab.com/research/stocks/AAPL
 *   - Fidelity:   https://digital.fidelity.com/prgw/digital/research/main?symbol=AAPL
 *   - Tradier:    https://dash.tradier.com/equity/AAPL   (requires auth)
 *
 * Removed (no public ticker deep-link available — fall back to homepage):
 *   - Webull (requires exchange prefix we don't have from SnapTrade)
 *   - Interactive Brokers (no public per-ticker URL)
 *   - TD Ameritrade (domain merged into Schwab, 2023)
 *   - E*TRADE (no public per-ticker URL)
 */

type BrokerPattern = {
  match: RegExp;
  url: (ticker: string) => string;
};

const BROKER_PATTERNS: BrokerPattern[] = [
  {
    match: /robinhood/i,
    url: (t) => `https://robinhood.com/stocks/${t}`,
  },
  {
    match: /alpaca/i,
    url: (t) => `https://app.alpaca.markets/trade/${t}`,
  },
  {
    match: /schwab/i,
    url: (t) => `https://www.schwab.com/research/stocks/${t}`,
  },
  {
    match: /fidelity/i,
    url: (t) =>
      `https://digital.fidelity.com/prgw/digital/research/main?symbol=${t}`,
  },
  {
    match: /tradier/i,
    url: (t) => `https://dash.tradier.com/equity/${t}`,
  },
];

/**
 * Resolve a broker + ticker into a trade-page URL, or null when nothing
 * is actionable (both brokerName and websiteUrl are absent).
 *
 * Policy:
 *   - known broker + ticker → ticker deep link
 *   - known broker + no ticker → homepage (websiteUrl)
 *   - unknown broker → homepage (websiteUrl) regardless of ticker
 *   - no broker info at all → null (caller should hide the CTA)
 */
export function buildBrokerTradeUrl(
  brokerName: string | null,
  websiteUrl: string | null,
  ticker: string | null
): string | null {
  if (!brokerName && !websiteUrl) return null;
  if (!ticker) return websiteUrl ?? null;

  if (brokerName) {
    const pattern = BROKER_PATTERNS.find((p) => p.match.test(brokerName));
    if (pattern) return pattern.url(ticker);
  }

  return websiteUrl ?? null;
}
