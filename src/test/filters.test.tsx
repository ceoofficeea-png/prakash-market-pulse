import { StrictMode } from "react";
import { act, render, screen, cleanup } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { FiltersProvider, useFilters } from "@/lib/filters";

function Probe() {
  const f = useFilters();
  return <div><output data-testid="period">{f.comparison}</output><output data-testid="from">{f.from}</output><button onClick={() => f.setComparison("yearly")}>Set yearly</button></div>;
}
afterEach(() => { cleanup(); localStorage.clear(); });
it("restores the selected comparison after remount, including StrictMode", () => {
  const first = render(<StrictMode><FiltersProvider><Probe /></FiltersProvider></StrictMode>);
  act(() => screen.getByRole("button", { name: "Set yearly" }).click());
  const from = screen.getByTestId("from").textContent;
  expect(screen.getByTestId("period").textContent).toBe("yearly");
  first.unmount();
  render(<StrictMode><FiltersProvider><Probe /></FiltersProvider></StrictMode>);
  expect(screen.getByTestId("period").textContent).toBe("yearly");
  expect(screen.getByTestId("from").textContent).toBe(from);
  expect(JSON.parse(localStorage.getItem("pp-filters-v1") ?? "{}").comparison).toBe("yearly");
});