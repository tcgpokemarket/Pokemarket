import type { Database } from "@/lib/supabase/types";

export type ShipmentGroupRow = Database["public"]["Tables"]["shipment_groups"]["Row"];
export type ShipmentGroupInsert = Database["public"]["Tables"]["shipment_groups"]["Insert"];

export type ShipmentGroupCandidate = {
  id: string;
  buyer_id: string;
  seller_id: string;
  shipping_profile_id: string | null;
  status: string;
  total_weight: number;
  total_length: number;
  total_width: number;
  total_height: number;
  package_type: string;
  tracking_number: string | null;
  shipping_carrier: string | null;
  label_url: string | null;
  locked_at: string | null;
};

export function canJoinShipmentGroup(group: ShipmentGroupCandidate) {
  return group.status === "open" && !group.tracking_number && !group.label_url;
}

export function combineShipmentProfile(base: {
  weight: number;
  length: number;
  width: number;
  height: number;
  package_type: string;
}, next: {
  weight: number;
  length: number;
  width: number;
  height: number;
  package_type: string;
}) {
  return {
    weight: Number(base.weight ?? 0) + Number(next.weight ?? 0),
    length: Math.max(Number(base.length ?? 0), Number(next.length ?? 0)),
    width: Math.max(Number(base.width ?? 0), Number(next.width ?? 0)),
    height: Math.max(Number(base.height ?? 0), Number(next.height ?? 0)),
    package_type: base.package_type || next.package_type || "parcel",
  };
}
