import { NextResponse } from "next/server";
import { DEFAULT_DESTINATION_COUNTRY, getEasyshipRates, getSelectedRate } from "@/lib/easyship";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const destinationCountry = (url.searchParams.get("country") ?? DEFAULT_DESTINATION_COUNTRY).toUpperCase();
    const selected = url.searchParams.get("selected");
    const rates = await getEasyshipRates(destinationCountry);
    return NextResponse.json({
      ...rates,
      selectedRate: getSelectedRate(rates.rates, selected),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load shipping rates" },
      { status: 500 },
    );
  }
}
