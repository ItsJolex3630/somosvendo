import { notFound } from "next/navigation";
import { updateMovement } from "@/app/actions/movements";
import { MovementForm } from "@/components/movement-form";
import { Card, CardContent } from "@/components/ui/card";
import { getMovementById, listClientsBasic } from "@/lib/db/queries";

export default async function EditarMovimientoPage({ params }: { params: { id: string } }) {
  const movement = await getMovementById(params.id);
  if (!movement) notFound();

  const clients = await listClientsBasic();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold">Editar movimiento</h1>
      <Card>
        <CardContent className="pt-5">
          <MovementForm
            action={updateMovement}
            clients={clients}
            mode="edit"
            defaults={{
              id: movement.id,
              kind: movement.kind,
              category: movement.category,
              amount: String(movement.amountCents / 100),
              date: movement.movementDate,
              description: movement.description ?? "",
              clientId: movement.clientId,
              vendoSharePct: movement.vendoSharePct ?? undefined,
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
