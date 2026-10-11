import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { updateService } from "@/app/actions/clients";
import { ServiceForm } from "@/components/service-form";
import { Card, CardContent } from "@/components/ui/card";
import { db } from "@/lib/db/client";
import { clientServices, memberships } from "@/lib/db/schema";

export default async function EditarServicioPage({
  params,
}: {
  params: { id: string; serviceId: string };
}) {
  const service = (
    await db.select().from(clientServices).where(eq(clientServices.id, params.serviceId)).limit(1)
  )[0];
  if (!service || service.clientId !== params.id) notFound();

  const membership = (
    await db.select().from(memberships).where(eq(memberships.clientServiceId, service.id)).limit(1)
  )[0];

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold">Editar servicio</h1>
      <Card>
        <CardContent className="pt-5">
          <ServiceForm
            action={updateService}
            clientId={service.clientId}
            mode="edit"
            defaults={{
              id: service.id,
              serviceType: service.serviceType,
              paymentKind: service.paymentKind,
              amount: String(service.amountCents / 100),
              status: service.status,
              startDate: service.startDate,
              billingDay: membership?.billingDay ?? 1,
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
