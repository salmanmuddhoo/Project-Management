/** Portfolio-wide filter state (dashboard, projects, reports). */

export interface PortfolioFilters {
  /** Project ids; empty array = all. */
  projects: string[];
  managers: string[];
  /** RAG health/risk buckets: "Green" | "Amber" | "Red". */
  health: string[];
  dateFrom: Date | null;
  dateTo: Date | null;
}

export const EMPTY_FILTERS: PortfolioFilters = {
  projects: [],
  managers: [],
  health: [],
  dateFrom: null,
  dateTo: null,
};
