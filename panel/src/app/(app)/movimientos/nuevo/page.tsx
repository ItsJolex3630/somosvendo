import { createMovement } from "@/app/actions/movements";
import { MovementForm } from "@/components/movement-form";
import { Card, CardContent } from "@/components/ui/card";
import { listClientsBasic } from "@/lib/db/queries";

export default async function NuevoMovimientoPage({
  searchParams,
}: {
  searchParams: {
    kind?: string;
    category?: string;
    amount?: string;
    date?: string;
    description?: string;
    clientId?: string;
    clientServiceId?: string;
    vendoSharePct?: string;
  };
}) {
  const clients = await listClientsBasic();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold">Nuevo movimiento</h1>
      <Card>
        <CardContent className="pt-5">
          <MovementForm
            action={createMovement}
            clients={clients}
            mode="create"
            defaults={{
              kind: searchParams.kind === "expense" ? "expense" : "income",
              category: searchParams.category,
              amount: searchParams.amount,
              date: searchParams.date,
              description: searchParams.description,
              clientId: searchParams.clientId,
              clientServiceId: searchParams.clientServiceId,
              vendoSharePct: searchParams.vendoSharePct
                ? Number(searchParams.vendoSharePct)
                : undefined,
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
