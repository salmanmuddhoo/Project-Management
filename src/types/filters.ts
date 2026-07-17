/** Portfolio-wide filter state (dashboard, reports, project list). */

export interface PortfolioFilters {
  /** Project ids; empty array = all. */
  projects: string[];
  projectManagers: string[];
  businessUnits: string[];
  statuses: string[];
  priorities: string[];
  sponsors: string[];
  fundingTypes: string[];
  /** Projects whose planned window intersects this range. */
  dateFrom: Date | null;
  dateTo: Date | null;
}

export const EMPTY_FILTERS: PortfolioFilters = {
  projects: [],
  projectManagers: [],
  businessUnits: [],
  statuses: [],
  priorities: [],
  sponsors: [],
  fundingTypes: [],
  dateFrom: null,
  dateTo: null,
};
