import bcrypt from "bcryptjs";
import { createClient } from "@libsql/client";
import { config as loadEnv } from "dotenv";
import { nanoid } from "nanoid";

loadEnv({ path: ".env.local" });

const DEFAULT_WHATSAPP_TEMPLATE =
  "Hola {nombre} 👋 Te saluda el equipo de Vendo. Te recordamos que tu pago de *{monto}* por tu servicio de *{servicio}* vence el *{fecha}*. ¡Gracias por confiar en nosotros! 🚀";

const DEFAULT_EMAIL_SUBJECT = "Recordatorio de pago — Vendo";

const DEFAULT_EMAIL_TEMPLATE =
  "Hola {nombre},\n\nTe recordamos que tu pago de {monto} por tu servicio de {servicio} vence el {fecha}.\n\n¡Gracias por confiar en nosotros!\n— Equipo Vendo";

async function main() {
  const url = process.env.DATABASE_URL;
  const authToken = process.env.DATABASE_AUTH_TOKEN;
  if (!url) throw new Error("Falta DATABASE_URL en .env.local");

  const client = createClient({ url, authToken });

  // 1. Fila única de settings (solo si no existe)
  const existing = await client.execute("SELECT id FROM settings WHERE id = 'global'");
  if (!existing.rows.length) {
    await client.execute({
      sql: `INSERT INTO settings
              (id, whatsapp_reminder_template, email_reminder_subject, email_reminder_template)
            VALUES ('global', ?, ?, ?)`,
      args: [DEFAULT_WHATSAPP_TEMPLATE, DEFAULT_EMAIL_SUBJECT, DEFAULT_EMAIL_TEMPLATE],
    });
    console.log("✓ settings (fila global) creado");
  } else {
    console.log("- settings ya existe (no se sobrescribe)");
  }

  // 2. Cuentas administradoras desde variables de entorno
  const admins: [string | undefined, string | undefined, string | undefined][] = [
    [process.env.ADMIN1_EMAIL, process.env.ADMIN1_NAME, process.env.ADMIN1_PASSWORD],
    [process.env.ADMIN2_EMAIL, process.env.ADMIN2_NAME, process.env.ADMIN2_PASSWORD],
  ];

  let created = 0;
  for (const [email, name, password] of admins) {
    if (!email || !password) continue;
    const displayName = name || email;
    const hash = await bcrypt.hash(password, 10);
    const found = await client.execute({
      sql: "SELECT id FROM users WHERE email = ?",
      args: [email],
    });
    if (found.rows.length) {
      await client.execute({
        sql: "UPDATE users SET display_name = ?, password_hash = ? WHERE email = ?",
        args: [displayName, hash, email],
      });
      console.log(`- admin ${email} actualizado`);
    } else {
      await client.execute({
        sql: "INSERT INTO users (id, email, display_name, password_hash) VALUES (?, ?, ?, ?)",
        args: [nanoid(), email, displayName, hash],
      });
      console.log(`✓ admin ${email} creado`);
      created += 1;
    }
  }

  if (created === 0 && admins.every(([e]) => !e)) {
    console.warn(
      "⚠ No se definieron ADMINx_EMAIL/PASSWORD en .env.local. No se creó ningún admin.",
    );
  }

  client.close();
  console.log("Seed completado.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
