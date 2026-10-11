import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { GoogleSignIn } from "@/components/google-signin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { login } from "./actions";

const ERROR_MESSAGES: Record<string, string> = {
  missing: "Completa todos los campos.",
  invalid: "Correo o contraseña incorrectos.",
  google: "No pudimos verificar tu cuenta de Google. Inténtalo de nuevo.",
  notallowed: "Esta cuenta no tiene acceso al panel.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const user = await getCurrentUser();
  if (user) redirect("/");

  const error = searchParams.error;

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <div className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            Vendo
          </div>
          <CardTitle className="text-xl">Panel de administración</CardTitle>
          <CardDescription>Ingresa con una cuenta autorizada.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <GoogleSignIn />
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            o con contraseña
            <span className="h-px flex-1 bg-border" />
          </div>
          <form action={login} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Correo</Label>
              <Input id="email" name="email" type="email" autoComplete="email" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
              />
            </div>
            {error ? (
              <p className="text-sm text-destructive">
                {ERROR_MESSAGES[error] ?? "No se pudo iniciar sesión."}
              </p>
            ) : null}
            <Button type="submit" className="w-full">
              Entrar
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
