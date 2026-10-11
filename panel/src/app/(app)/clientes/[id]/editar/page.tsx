import { notFound } from "next/navigation";
import { updateClient } from "@/app/actions/clients";
import { ClientForm } from "@/components/client-form";
import { Card, CardContent } from "@/components/ui/card";
import { getClientDetail } from "@/lib/db/queries";

export default async function EditarClientePage({ params }: { params: { id: string } }) {
  const client = await getClientDetail(params.id);
  if (!client) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold">Editar cliente</h1>
      <Card>
        <CardContent className="pt-5">
          <ClientForm
            action={updateClient}
            mode="edit"
            defaults={{
              id: client.id,
              fullName: client.fullName,
              email: client.email,
              whatsapp: client.whatsappNumber,
              notes: client.notes,
              isActive: client.isActive,
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
