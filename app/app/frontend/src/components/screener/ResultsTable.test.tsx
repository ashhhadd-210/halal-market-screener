import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ResultsTable } from "./ResultsTable";
import type { ScreenerResult } from "@/types/screener";

function buildResult(index: number): ScreenerResult {
  return {
    symbol: `SYM${index}`,
    price: index + 1,
    asset_type: "stocks",
    data_source: "tradingview",
    timeframe: "1h",
    category: `Category ${String(index).padStart(2, "0")}`,
    stickers: [`signal-${index}`],
  };
}

describe("ResultsTable", () => {
  it("reopens the category filter after repeated selections", () => {
    render(
      <ResultsTable
        results={Array.from({ length: 40 }, (_, index) => buildResult(index + 1))}
        loading={false}
        onRequestDetail={vi.fn()}
      />,
    );

    const trigger = screen.getByRole("button", { name: /categories/i });

    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("button", { name: "Category 01" }));
    fireEvent.click(screen.getByRole("button", { name: "Category 02" }));

    expect(screen.getByRole("button", { name: /categories \(2\)/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Category 40" })).toBeInTheDocument();

    fireEvent.click(trigger);
    expect(screen.queryByRole("button", { name: "Category 40" })).not.toBeInTheDocument();

    fireEvent.click(trigger);
    expect(screen.getByRole("button", { name: "Category 40" })).toBeInTheDocument();
  });

  it("filters categories by search and pages large category lists", async () => {
    const results = Array.from({ length: 140 }, (_, index) => ({
      ...buildResult(index + 1),
      category: `Cat ${String(index + 1).padStart(4, "0")}`,
    }));

    render(
      <ResultsTable
        results={results}
        loading={false}
        onRequestDetail={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /categories/i }));

    expect(screen.queryByRole("button", { name: "Cat 0140" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /show 40 more/i })).toBeInTheDocument();

    fireEvent.change(screen.getByRole("textbox", { name: /search categories/i }), {
      target: { value: "0140" },
    });

    expect(await screen.findByRole("button", { name: "Cat 0140" })).toBeInTheDocument();

    fireEvent.change(screen.getByRole("textbox", { name: /search categories/i }), {
      target: { value: "" },
    });

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Cat 0140" })).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /show 40 more/i }));

    expect(await screen.findByRole("button", { name: "Cat 0140" })).toBeInTheDocument();
  });
});
