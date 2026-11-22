// Regelfilen for husholdningsvarer (utvidelse C), sjekket og normalisert ved oppstart. Mønstre og ord, aldri tilbud.
// Delt av appen, synk-valideringen (varegruppene i innstillingene) og serveren (hva som hentes og vises fra Tjek).
import raw from './household-rules.json';
import { parseHouseholdRules, type HouseholdRuleSet } from '../engine/household';

export const HOUSEHOLD_RULES: HouseholdRuleSet = parseHouseholdRules(raw);
export const HOUSEHOLD_DESCRIPTION: string | undefined = (raw as { description?: string }).description;
