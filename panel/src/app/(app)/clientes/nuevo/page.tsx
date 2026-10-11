import { createClient } from "@/app/actions/clients";
import { ClientForm } from "@/components/client-form";
import { Card, CardContent } from "@/components/ui/card";

export default function NuevoClientePage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold">Nuevo cliente</h1>
      <Card>
        <CardContent className="pt-5">
          <ClientForm action={createClient} mode="create" />
        </CardContent>
      </Card>
    </div>
  );
}
