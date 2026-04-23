import { describe, it, expect } from "vitest";
import { buildBrokerTradeUrl } from "@/lib/broker-deeplinks";

describe("buildBrokerTradeUrl", () => {
  describe("verified deep-link patterns", () => {
    it("returns Robinhood ticker page for 'Robinhood'", () => {
      expect(
        buildBrokerTradeUrl("Robinhood", "https://robinhood.com", "AAPL")
      ).toBe("https://robinhood.com/stocks/AAPL");
    });

    it("returns Alpaca ticker page for 'Alpaca'", () => {
      expect(
        buildBrokerTradeUrl("Alpaca", "https://app.alpaca.markets", "MSFT")
      ).toBe("https://app.alpaca.markets/trade/MSFT");
    });

    it("returns Schwab research page for 'Schwab'", () => {
      expect(
        buildBrokerTradeUrl("Schwab", "https://www.schwab.com", "GOOG")
      ).toBe("https://www.schwab.com/research/stocks/GOOG");
    });

    it("returns Fidelity research page for 'Fidelity'", () => {
      expect(
        buildBrokerTradeUrl("Fidelity", "https://www.fidelity.com", "AMZN")
      ).toBe(
        "https://digital.fidelity.com/prgw/digital/research/main?symbol=AMZN"
      );
    });

    it("returns Tradier equity page for 'Tradier'", () => {
      expect(
        buildBrokerTradeUrl("Tradier", "https://dash.tradier.com", "TSLA")
      ).toBe("https://dash.tradier.com/equity/TSLA");
    });

    it("matches broker name case-insensitively", () => {
      expect(
        buildBrokerTradeUrl("robinhood", "https://robinhood.com", "AAPL")
      ).toBe("https://robinhood.com/stocks/AAPL");
    });
  });

  describe("brokers without public deep links fall back to homepage", () => {
    it("Webull falls back to homepage (no stable public ticker URL)", () => {
      expect(
        buildBrokerTradeUrl("Webull", "https://www.webull.com", "AAPL")
      ).toBe("https://www.webull.com");
    });

    it("Interactive Brokers falls back to homepage", () => {
      expect(
        buildBrokerTradeUrl(
          "Interactive Brokers",
          "https://www.interactivebrokers.com",
          "AAPL"
        )
      ).toBe("https://www.interactivebrokers.com");
    });

    it("TD Ameritrade falls back to homepage (domain dead)", () => {
      expect(
        buildBrokerTradeUrl(
          "TD Ameritrade",
          "https://www.tdameritrade.com",
          "AAPL"
        )
      ).toBe("https://www.tdameritrade.com");
    });

    it("E*TRADE falls back to homepage", () => {
      expect(
        buildBrokerTradeUrl("E*TRADE", "https://us.etrade.com", "AAPL")
      ).toBe("https://us.etrade.com");
    });

    it("falls back to homepage when broker name is unknown", () => {
      expect(
        buildBrokerTradeUrl(
          "Some Unknown Broker",
          "https://unknownbroker.com",
          "AAPL"
        )
      ).toBe("https://unknownbroker.com");
    });
  });

  describe("edge cases", () => {
    it("falls back to homepage when ticker is null", () => {
      expect(
        buildBrokerTradeUrl("Robinhood", "https://robinhood.com", null)
      ).toBe("https://robinhood.com");
    });

    it("returns null when both broker name and website are absent", () => {
      expect(buildBrokerTradeUrl(null, null, "AAPL")).toBeNull();
    });

    it("returns null when both broker name and website are absent and ticker is null", () => {
      expect(buildBrokerTradeUrl(null, null, null)).toBeNull();
    });

    it("returns website when broker name is null but website is set", () => {
      expect(buildBrokerTradeUrl(null, "https://some.broker", "AAPL")).toBe(
        "https://some.broker"
      );
    });
  });
});
