"use server";

import { createClient } from "@/lib/supabase/server";

export async function updateSpliceWithPropagation(
  spliceId: string,
  comment: string
) {
  const supabase = await createClient();

  // Update this splice and get its port IDs
  const { data: splice, error } = await supabase
    .from("splices")
    .update({ comment })
    .eq("id", spliceId)
    .select("port_from, port_to")
    .single();
  if (error) throw new Error(error.message);

  // Find the elements that own these ports
  const { data: ports } = await supabase
    .from("ports")
    .select("id, element_id")
    .in("id", [splice.port_from, splice.port_to]);
  if (!ports) return;

  const elementIds = [...new Set(ports.map((p) => p.element_id))];
  const { data: elements } = await supabase
    .from("elements")
    .select("id, type")
    .in("id", elementIds);
  if (!elements) return;

  // For closure/equipment, propagate comment to all other splices on that element
  for (const el of elements) {
    if (el.type !== "closure" && el.type !== "equipment") continue;

    const { data: allPorts } = await supabase
      .from("ports")
      .select("id")
      .eq("element_id", el.id);
    if (!allPorts) continue;

    const otherPortIds = allPorts
      .map((p) => p.id)
      .filter((id) => id !== splice.port_from && id !== splice.port_to);
    if (otherPortIds.length === 0) continue;

    const list = otherPortIds.join(",");
    await supabase
      .from("splices")
      .update({ comment })
      .or(`port_from.in.(${list}),port_to.in.(${list})`);
  }
}
