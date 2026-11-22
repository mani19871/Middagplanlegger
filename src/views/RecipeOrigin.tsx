// Opphav og kreditering for en oppskrift (regel 6, RecipeOrigin i engine/types.ts).
import type { Recipe } from '../engine/types';

const STATUS: Record<NonNullable<Recipe['origin']>['status'], string> = {
  utkast: 'utkast, ikke testkokt',
  testkokt: 'testkokt, ikke kontrollert av redaktør',
  godkjent: 'kontrollert av redaktør',
};

/** Kort tekst om oppskriftsbasen: hvor mange, hvor de kommer fra og hvor mange som er utkast. */
export function recipeBaseText(recipes: Recipe[]): string {
  const licensed = recipes.filter((r) => r.origin?.kind === 'lisensiert').length;
  const drafts = recipes.filter((r) => r.origin?.status === 'utkast').length;
  const own = recipes.length - licensed;
  return `Oppskriftsbasen er liten: ${own} oppskrifter skrevet for Husvett`
    + (licensed > 0 ? ` og ${licensed} fra kilder med tillatelse.` : ', ingen fra andre kilder.')
    + (drafts > 0 ? ` ${drafts} av dem er utkast som ikke er testkokt.` : '');
}

/** Vises ved fremgangsmåten. Lisensierte oppskrifter får krediteringen kilden krever og lenke til originalen. */
export function RecipeOriginNote({ recipe }: { recipe: Recipe }) {
  const o = recipe.origin;
  if (!o) return null;
  if (o.kind === 'lisensiert') return (
    <p className="fine">{o.credit} <a href={o.url} target="_blank" rel="noopener noreferrer">Se originaloppskriften</a> ({STATUS[o.status]})</p>
  );
  return <p className="fine">{o.kind === 'demo' ? 'Demooppskrift' : 'Husvett-oppskrift'} ({STATUS[o.status]})</p>;
}
