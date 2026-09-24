import { GarmentOutline } from "@/components/garment-hint";
import { GarmentSchematic } from "@/components/garment-schematic";
import { SectionHead } from "@/components/section-head";
import {
  CATEGORY_LABELS,
  silhouetteFor,
  templateFor,
  type Category,
  type Convention,
  type Dimension,
  type HandleSeed,
  type Silhouette,
} from "@/lib/measure/templates";

export const metadata = { title: "Measurements" };

/**
 * The reference for what the measure screen asks, read straight off the
 * templates it runs on. Nothing here is restated by hand, so the page cannot
 * describe a dimension the app does not take, or miss one it does.
 */

const SILHOUETTE_ORDER: { silhouette: Silhouette; title: string }[] = [
  { silhouette: "top", title: "Short sleeve tops" },
  { silhouette: "long_top", title: "Long sleeve tops" },
  { silhouette: "vest", title: "Sleeveless tops" },
  { silhouette: "bottom", title: "Trousers" },
  { silhouette: "shorts", title: "Shorts" },
];

const CONVENTION_LABELS: Record<Convention, string> = {
  edge_to_edge: "Edge to edge",
  seam_to_seam: "Seam to seam",
  one_inch_below_pit: "1in below pit",
  hps_to_hem: "HPS to hem",
  back_waistband: "Back waistband",
};

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

/** Where the pins land before anyone touches them, as a fraction of the mask. */
function describeSeed(seed: HandleSeed): string {
  switch (seed.kind) {
    case "widest_chord":
      return `Widest span, ${pct(seed.from)}–${pct(seed.to)} down`;
    case "horizontal":
      return `Across at ${pct(seed.at)} down`;
    case "vertical":
      return `Centre, ${pct(seed.from)} to ${pct(seed.to)} down`;
    case "diagonal":
      return `(${pct(seed.fromX)}, ${pct(seed.fromY)}) → (${pct(seed.toX)}, ${pct(seed.toY)})`;
  }
}

function categoriesFor(silhouette: Silhouette): Category[] {
  return (Object.keys(CATEGORY_LABELS) as Category[]).filter(
    (c) => silhouetteFor(c) === silhouette,
  );
}

export default function MeasurementsPage() {
  const groups = SILHOUETTE_ORDER.map(({ silhouette, title }) => {
    const categories = categoriesFor(silhouette);
    return {
      silhouette,
      title,
      categories,
      dimensions: templateFor(categories[0]),
    };
  });

  return (
    <div className="mx-auto max-w-[1600px]">
      {groups.map((group, index) => (
        <section key={group.silhouette} className="mb-14">
          {/* The first head sits at the page top, under the compact header. */}
          <SectionHead
            bleed={index === 0}
            aside={`${group.dimensions.length} dimensions`}
          >
            {group.title}
          </SectionHead>

          <div className="mb-6 flex items-center gap-4">
            <GarmentOutline silhouette={group.silhouette} size={28} />
            {/* Display only: pointer events off so the chip's hover border
                does not promise a filter that is not there. */}
            <ul className="pointer-events-none flex flex-wrap gap-2">
              {group.categories.map((c) => (
                <li key={c} className="chip">
                  {CATEGORY_LABELS[c]}
                </li>
              ))}
            </ul>
          </div>

          <ul className="grid grid-cols-2 gap-x-3 gap-y-10 md:grid-cols-3 md:gap-x-5 lg:grid-cols-4">
            {group.dimensions.map((dimension) => (
              <DimensionTile
                key={dimension.key}
                dimension={dimension}
                silhouette={group.silhouette}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function DimensionTile({
  dimension,
  silhouette,
}: {
  dimension: Dimension;
  silhouette: Silhouette;
}) {
  return (
    <li>
      {/* The item page's diagram with only this line on it, drawn active.
          Silhouette heights differ; the square box keeps a row of names on
          one line. */}
      <div className="mb-3 aspect-square">
        <GarmentSchematic
          silhouette={silhouette}
          dimensions={[dimension]}
          values={{}}
          activeKey={dimension.key}
          className="h-full w-full"
        />
      </div>

      <p className="label">{dimension.label}</p>
      <p className="data mb-2 text-fg3">
        {dimension.prefix} · {dimension.key}
      </p>
      <p className="mb-3 text-fg2">{dimension.guide}</p>

      <dl className="data">
        <Row term="Convention">
          {CONVENTION_LABELS[dimension.defaultConvention]}
        </Row>
        <Row term="Doubled">{dimension.defaultIsDoubled ? "Yes" : "No"}</Row>
        <Row term="Required">{dimension.optional ? "No" : "Yes"}</Row>
        <Row term="Pins start">{describeSeed(dimension.seed)}</Row>
      </dl>
    </li>
  );
}

function Row({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div className="rule-top flex justify-between gap-3 py-1.5">
      <dt className="whitespace-nowrap text-fg3">{term}</dt>
      <dd className="text-right">{children}</dd>
    </div>
  );
}
