import { northstarCsv } from "@/lib/demo/northstar";

/** The demo company's monthly totals, as an example of the format PIVOT reads. */
export function GET() {
  return new Response(northstarCsv(), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": 'attachment; filename="pivot-sample-northstar.csv"',
      "cache-control": "public, max-age=3600",
    },
  });
}
