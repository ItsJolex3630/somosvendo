import { formatUsd } from "./money";

export type ReminderVars = {
  nombre: string;
  montoCents: number;
  servicio: string;
  fecha: string;
  diasMora?: number;
};

type TemplateSettings = {
  whatsappReminderTemplate: string;
  emailReminderSubject: string;
  emailReminderTemplate: string;
};

export const OVERDUE_WHATSAPP_TEMPLATE =
  "Hola {nombre}, tu pago de {monto} por {servicio} venció el {fecha} ({dias_mora} día(s) de mora). Te pedimos regularizarlo lo antes posible; de lo contrario, el servicio será suspendido. Cualquier duda, estamos para ayudarte. — Equipo Vendo";

export const OVERDUE_EMAIL_SUBJECT = "Pago vencido — Vendo";

export const OVERDUE_EMAIL_TEMPLATE =
  "Hola {nombre},\n\nTu pago de {monto} por {servicio} venció el {fecha} ({dias_mora} día(s) de mora). Te pedimos regularizarlo lo antes posible para evitar la suspensión del servicio.\n\n— Equipo Vendo";

export function fillTemplate(template: string, vars: ReminderVars): string {
  return template
    .replaceAll("{nombre}", vars.nombre)
    .replaceAll("{monto}", formatUsd(vars.montoCents))
    .replaceAll("{servicio}", vars.servicio)
    .replaceAll("{fecha}", vars.fecha)
    .replaceAll("{dias_mora}", String(vars.diasMora ?? 0));
}

export function buildReminder(
  kind: "due_soon" | "overdue",
  vars: ReminderVars,
  settings: TemplateSettings,
): { whatsapp: string; subject: string; body: string } {
  if (kind === "overdue") {
    return {
      whatsapp: fillTemplate(OVERDUE_WHATSAPP_TEMPLATE, vars),
      subject: fillTemplate(OVERDUE_EMAIL_SUBJECT, vars),
      body: fillTemplate(OVERDUE_EMAIL_TEMPLATE, vars),
    };
  }
  return {
    whatsapp: fillTemplate(settings.whatsappReminderTemplate, vars),
    subject: fillTemplate(settings.emailReminderSubject, vars),
    body: fillTemplate(settings.emailReminderTemplate, vars),
  };
}

export function waUrl(number: string, text: string): string {
  const digits = String(number).replace(/\D/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

export function mailtoUrl(email: string, subject: string, body: string): string {
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
