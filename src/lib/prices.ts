export interface PriceResult {
  cardName: string
  setName: string
  marketPrice: number | null
  lowPrice: number | null
  highPrice: number | null
  source: string
  trend: 'up' | 'down' | 'neutral'
}

import { fetchPokemonCardPrice } from './pokemon'

export async function fetchCardPrice(cardName: string, setName: string): Promise<PriceResult> {
  try {
    const pricing = await fetchPokemonCardPrice(cardName, setName)
    if (pricing.marketPrice !== null || pricing.lowPrice !== null || pricing.highPrice !== null) {
      return {
        cardName,
        setName,
        marketPrice: pricing.marketPrice,
        lowPrice: pricing.lowPrice,
        highPrice: pricing.highPrice,
        source: pricing.source,
        trend: 'neutral',
      }
    }
  } catch {}

  const tcgPlayerKey = process.env.TCGPLAYER_API_KEY
  const ebayKey = process.env.EBAY_APP_ID

  if (tcgPlayerKey) {
    try {
      const tokenRes = await fetch('https://api.tcgplayer.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `grant_type=client_credentials&client_id=${tcgPlayerKey}&client_secret=${process.env.TCGPLAYER_API_SECRET}`,
      })
      const { access_token } = await tokenRes.json()

      const searchRes = await fetch(
        `https://api.tcgplayer.com/v1.39.0/catalog/products?productName=${encodeURIComponent(cardName)}&groupName=${encodeURIComponent(setName)}&categoryId=3&limit=1`,
        { headers: { Authorization: `bearer ${access_token}` } }
      )
      const searchData = await searchRes.json()

      if (searchData.results?.length) {
        const productId = searchData.results[0].productId
        const priceRes = await fetch(
          `https://api.tcgplayer.com/v1.39.0/pricing/product/${productId}`,
          { headers: { Authorization: `bearer ${access_token}` } }
        )
        const priceData = await priceRes.json()
        const nm = priceData.results?.find((r: { subTypeName: string }) => r.subTypeName === 'Normal')

        return {
          cardName,
          setName,
          marketPrice: nm?.marketPrice ?? null,
          lowPrice: nm?.lowPrice ?? null,
          highPrice: nm?.highPrice ?? null,
          source: 'TCGPlayer',
          trend: 'neutral',
        }
      }
    } catch {}
  }

  if (ebayKey) {
    try {
      const res = await fetch(
        `https://api.ebay.com/buy/browse/v1/item_summary/search?q=${encodeURIComponent(`${cardName} ${setName} pokemon card`)}&category_ids=183454&limit=10&sort=price`,
        { headers: { Authorization: `Bearer ${ebayKey}`, 'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US' } }
      )
      const data = await res.json()
      const prices = data.itemSummaries?.map((i: { price: { value: string } }) => parseFloat(i.price.value)) ?? []
      if (prices.length) {
        const avg = prices.reduce((a: number, b: number) => a + b, 0) / prices.length
        return {
          cardName,
          setName,
          marketPrice: parseFloat(avg.toFixed(2)),
          lowPrice: Math.min(...prices),
          highPrice: Math.max(...prices),
          source: 'eBay',
          trend: 'neutral',
        }
      }
    } catch {}
  }

  return {
    cardName,
    setName,
    marketPrice: null,
    lowPrice: null,
    highPrice: null,
    source: 'unavailable',
    trend: 'neutral',
  }
}
