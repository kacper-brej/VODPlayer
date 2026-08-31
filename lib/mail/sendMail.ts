import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { renderEmailTemplate, renderEmailText, type EmailContent } from "@/lib/mail/emailTemplate";
import { readMailConfig, type MailConfig } from "@/lib/mail/mailConfig";

declare global {
    var __nocturnaMailTransport: Transporter | undefined;
}

const getTransport = (config: MailConfig): Transporter => {
    if (globalThis.__nocturnaMailTransport) return globalThis.__nocturnaMailTransport;

    const transport = nodemailer.createTransport({
        host: config.host,
        port: config.port,
        secure: true,
        auth: {
            user: config.user,
            pass: config.password,
        },
    });

    globalThis.__nocturnaMailTransport = transport;
    return transport;
};

export interface AccountEmail extends EmailContent {
    to: string;
    subject: string;
}

export const sendAccountEmail = async (email: AccountEmail): Promise<boolean> => {
    const config = readMailConfig();
    try {
        await getTransport(config).sendMail({
            from: `"${config.fromName}" <${config.user}>`,
            to: email.to,
            subject: email.subject,
            text: renderEmailText(email),
            html: renderEmailTemplate(email),
        });
        return true;
    } catch (error) {
        const code = typeof error === "object" && error !== null && "code" in error
            && typeof error.code === "string" ? error.code : null;
        console.error("sendAccountEmail: wysyłka nie powiodła się", { code });
        return false;
    }
};
