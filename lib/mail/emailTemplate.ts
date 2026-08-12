export interface EmailContent {
    heading: string;
    text: string;
    buttonLabel: string;
    buttonUrl: string;
}

export const renderEmailTemplate = ({ heading, text, buttonLabel, buttonUrl }: EmailContent): string => {
    const year = new Date().getFullYear();

    return `<!DOCTYPE html>
<html lang="pl">
<body style="margin:0;padding:0;background-color:#0b0b0f;font-family:Segoe UI,Helvetica,Arial,sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0b0b0f;padding:40px 0;">
        <tr>
            <td align="center">
                <table width="480" cellpadding="0" cellspacing="0" style="background-color:#16161d;border-radius:16px;overflow:hidden;border:1px solid rgba(255,255,255,0.06);">
                    <tr>
                        <td style="padding:32px 32px 0 32px;text-align:center;">
                            <div style="display:inline-flex;width:48px;height:48px;border-radius:12px;background-color:rgba(139,92,246,0.2);align-items:center;justify-content:center;font-size:24px;line-height:48px;">📺</div>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:20px 32px 0 32px;text-align:center;">
                            <h1 style="color:#ffffff;font-size:22px;margin:0;">${heading}</h1>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:12px 32px 0 32px;text-align:center;">
                            <p style="color:#a1a1aa;font-size:14px;line-height:1.6;margin:0;">${text}</p>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:28px 32px 8px 32px;text-align:center;">
                            <a href="${buttonUrl}" style="display:inline-block;background-color:#8B5CF6;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 28px;border-radius:8px;">${buttonLabel}</a>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:20px 32px 32px 32px;text-align:center;">
                            <p style="color:#52525b;font-size:12px;line-height:1.5;margin:0;">Jeśli przycisk nie działa, skopiuj ten link do przeglądarki:<br><span style="color:#71717a;word-break:break-all;">${buttonUrl}</span></p>
                        </td>
                    </tr>
                </table>
                <p style="color:#3f3f46;font-size:12px;margin-top:20px;">Nocturna &copy; ${year}</p>
            </td>
        </tr>
    </table>
</body>
</html>`;
};
