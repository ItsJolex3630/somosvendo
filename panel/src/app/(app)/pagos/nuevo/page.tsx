import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { registerPayment } from "@/app/actions/payments";
import { PaymentForm } from "@/components/payment-form";
import { Card, CardContent } from "@/components/ui/card";
import { SERVICE_TO_CATEGORY, serviceTypeLabel, type ServiceType } from "@/lib/constants";
import { db } from "@/lib/db/client";
import { clientServices, clients } from "@/lib/db/schema";

export default async function NuevoPagoPage({
  searchParams,
}: {
  searchParams: { clientServiceId?: string; redirect_to?: string };
}) {
  const clientServiceId = searchParams.clientServiceId;
  if (!clientServiceId) notFound();

  const row = (
    await db
      .select({ service: clientServices, clientName: clients.fullName })
      .from(clientServices)
      .innerJoin(clients, eq(clients.id, clientServices.clientId))
      .where(eq(clientServices.id, clientServiceId))
      .limit(1)
  )[0];
  if (!row) notFound();

  const category = SERVICE_TO_CATEGORY[row.service.serviceType as ServiceType] ?? "web_sale";
  const redirectTo = searchParams.redirect_to || `/clientes/${row.service.clientId}`;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold">Registrar pago</h1>
      <Card>
        <CardContent className="pt-5">
          <PaymentForm
            action={registerPayment}
            clientServiceId={clientServiceId}
            clientName={row.clientName}
            serviceLabel={serviceTypeLabel(row.service.serviceType)}
            defaultAmount={String(row.service.amountCents / 100)}
            defaultCategory={category}
            redirectTo={redirectTo}
          />
        </CardContent>
      </Card>
    </div>
  );
}
