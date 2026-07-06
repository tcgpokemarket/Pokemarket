export default function ListingCard({listing}:{listing:any}){return <article><h3>{listing.title}</h3><p>${listing.price}</p><p>{listing.description}</p></article>}
