import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CryptoExchangeFilter } from "./CryptoExchangeFilter";

describe("CryptoExchangeFilter", () => {
  async function openMenu(name: RegExp) {
    const trigger = screen.getByRole("button", { name });
    fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false });
    fireEvent.keyDown(trigger, { key: "Enter" });
  }

  it("treats an empty selection as all exchanges and lets users exclude one exchange", async () => {
    const onExchangesChange = vi.fn();

    render(
      <CryptoExchangeFilter
        availableExchanges={[
          { exchange: "binance", coin_count: 236 },
          { exchange: "coinbase", coin_count: 277 },
          { exchange: "kraken", coin_count: 322 },
        ]}
        exchanges={[]}
        onExchangesChange={onExchangesChange}
      />,
    );

    await openMenu(/all exchanges/i);
    fireEvent.click(await screen.findByRole("button", { name: /236\s+coins\s+binance/i }));

    expect(onExchangesChange).toHaveBeenCalledWith(["binance"]);
  });

  it("provides a one-click action to switch back to all exchanges", async () => {
    const onExchangesChange = vi.fn();

    render(
      <CryptoExchangeFilter
        availableExchanges={[
          { exchange: "binance", coin_count: 236 },
          { exchange: "coinbase", coin_count: 277 },
          { exchange: "kraken", coin_count: 322 },
        ]}
        exchanges={["binance", "coinbase"]}
        onExchangesChange={onExchangesChange}
      />,
    );

    await openMenu(/2 exchanges/i);
    fireEvent.click(await screen.findByRole("button", { name: /use all exchanges/i }));

    expect(onExchangesChange).toHaveBeenCalledWith([]);
  });

  it("lets the last selected exchange be removed to fall back to all exchanges", async () => {
    const onExchangesChange = vi.fn();

    render(
      <CryptoExchangeFilter
        availableExchanges={[
          { exchange: "binance", coin_count: 236 },
          { exchange: "coinbase", coin_count: 277 },
          { exchange: "kraken", coin_count: 322 },
        ]}
        exchanges={["binance"]}
        onExchangesChange={onExchangesChange}
      />,
    );

    await openMenu(/binance/i);
    fireEvent.click(await screen.findByRole("button", { name: /236\s+coins\s+binance/i }));

    expect(onExchangesChange).toHaveBeenCalledWith([]);
  });

  it("filters exchange options from the search field", async () => {
    render(
      <CryptoExchangeFilter
        availableExchanges={[
          { exchange: "binance", coin_count: 236 },
          { exchange: "coinbase", coin_count: 277 },
          { exchange: "kraken", coin_count: 322 },
        ]}
        exchanges={[]}
        onExchangesChange={vi.fn()}
      />,
    );

    await openMenu(/all exchanges/i);
    fireEvent.change(await screen.findByPlaceholderText(/search exchanges/i), {
      target: { value: "kra" },
    });

    expect(screen.getByRole("button", { name: /322\s+coins\s+kraken/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /236\s+coins\s+binance/i })).not.toBeInTheDocument();
  });
});
