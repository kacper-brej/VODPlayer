export interface EmailContent {
    heading: string;
    text: string;
    buttonLabel: string;
    buttonUrl: string;
    preheader?: string;
    note?: string;
}

const escapeHtml = (value: string): string =>
    value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

const FONT_UI = "'Geist','Helvetica Neue',Helvetica,Arial,sans-serif";
const FONT_DISPLAY = "'Bodoni Moda',Georgia,'Times New Roman',serif";
const FONT_MONO = "'Geist Mono',ui-monospace,SFMono-Regular,Menlo,Consolas,monospace";

export const renderEmailText = ({ heading, text, buttonLabel, buttonUrl, note }: EmailContent): string => {
    const lines = [
        "NOCTURNA",
        "",
        heading,
        "",
        text,
        "",
        `${buttonLabel}: ${buttonUrl}`,
    ];

    if (note) lines.push("", note);

    lines.push("", "Wiadomość wysłana automatycznie. Nie odpowiadaj na nią.", `Nocturna ${new Date().getFullYear()}`);

    return lines.join("\n");
};

export const renderEmailTemplate = ({ heading, text, buttonLabel, buttonUrl, preheader, note }: EmailContent): string => {
    const year = new Date().getFullYear();
    const safeHeading = escapeHtml(heading);
    const safeText = escapeHtml(text);
    const safeLabel = escapeHtml(buttonLabel);
    const safeUrl = escapeHtml(buttonUrl);
    const safePreheader = escapeHtml(preheader ?? text);
    const safeNote = note ? escapeHtml(note) : null;

    const noteRow = safeNote
        ? `                        <tr>
                            <td class="nx-pad" style="padding:0 34px;">
                                <table role="presentation" class="nx-round" width="100%" border="0" cellpadding="0" cellspacing="0">
                                    <tr>
                                        <td class="nx-note" style="border:1px solid #332E3C;border-radius:12px;background-color:#1A1723;padding:14px 16px;font-family:${FONT_UI};font-size:13px;line-height:1.55;color:#A39EAB;">${safeNote}</td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                        <tr><td height="22" style="height:22px;line-height:22px;mso-line-height-rule:exactly;font-size:0;">&nbsp;</td></tr>`
        : "";

    return `<!DOCTYPE html>
<html lang="pl" xmlns="http://www.w3.org/1999/xhtml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark">
<title>${safeHeading}</title>
<!--[if mso]><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml><![endif]-->
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bodoni+Moda:opsz,wght@6..96,500;6..96,600&display=swap">
<style>
:root{color-scheme:dark;supported-color-schemes:dark;}
body,table,td,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;}
table{border-collapse:collapse!important;}
.nx-round{border-collapse:separate!important;}
img{border:0;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic;}
a{color:#B9A0FF;}
@media only screen and (max-width:600px){
.nx-shell{width:100%!important;}
.nx-pad{padding-left:22px!important;padding-right:22px!important;}
.nx-title{font-size:25px!important;}
.nx-cta{display:block!important;width:auto!important;}
}
@media (prefers-color-scheme:light){
.nx-canvas{background-color:#07070A!important;}
.nx-panel{background-color:#15121C!important;}
.nx-title{color:#F3F0EA!important;}
.nx-body,.nx-note,.nx-foot{color:#A39EAB!important;}
}
[data-ogsc] .nx-canvas{background-color:#07070A!important;}
[data-ogsc] .nx-panel{background-color:#15121C!important;}
[data-ogsc] .nx-title{color:#F3F0EA!important;}
[data-ogsc] .nx-body,[data-ogsc] .nx-note,[data-ogsc] .nx-foot{color:#A39EAB!important;}
[data-ogsc] .nx-cta{background-color:#B9A0FF!important;color:#15121C!important;}
</style>
</head>
<body class="nx-canvas" style="margin:0;padding:0;width:100%;background-color:#07070A;">
<div style="display:none;max-height:0;max-width:0;overflow:hidden;opacity:0;font-size:1px;line-height:1px;color:#07070A;mso-hide:all;">${safePreheader}&#8203;&#847;&#847;&#847;&#847;&#847;&#847;&#847;&#847;&#847;&#847;&#847;&#847;&#847;&#847;&#847;&#847;&#847;&#847;&#847;&#847;</div>
<table role="presentation" class="nx-canvas" width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color:#07070A;">
    <tr>
        <td align="center" style="padding:40px 16px 32px 16px;">
            <table role="presentation" class="nx-shell" width="520" border="0" cellpadding="0" cellspacing="0" style="width:520px;max-width:520px;">
                <tr>
                    <td>
                        <table role="presentation" class="nx-panel nx-round" width="100%" border="0" cellpadding="0" cellspacing="0" bgcolor="#15121C" style="background-color:#15121C;background-image:linear-gradient(180deg,#191521 0%,#131019 100%);border:1px solid #332E3C;border-radius:24px;">
                            <tr>
                                <td height="2" style="height:2px;line-height:2px;mso-line-height-rule:exactly;font-size:0;padding:0;">
                                    <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0">
                                        <tr>
                                            <td width="22%" height="2" style="height:2px;line-height:2px;mso-line-height-rule:exactly;font-size:0;">&nbsp;</td>
                                            <td width="56%" height="2" bgcolor="#4A3D6B" style="height:2px;line-height:2px;mso-line-height-rule:exactly;font-size:0;background-color:#4A3D6B;background-image:linear-gradient(90deg,rgba(185,160,255,0) 0%,rgba(185,160,255,0.65) 50%,rgba(185,160,255,0) 100%);">&nbsp;</td>
                                            <td width="22%" height="2" style="height:2px;line-height:2px;mso-line-height-rule:exactly;font-size:0;">&nbsp;</td>
                                        </tr>
                                    </table>
                                </td>
                            </tr>
                            <tr>
                                <td class="nx-pad" style="padding:30px 34px 0 34px;">
                                    <table role="presentation" class="nx-round" border="0" cellpadding="0" cellspacing="0">
                                        <tr>
                                            <td width="38" height="38" align="center" valign="middle" bgcolor="#23202A" style="width:38px;height:38px;background-color:#23202A;border:1px solid #332E3C;border-radius:19px;font-family:${FONT_DISPLAY};font-size:20px;line-height:38px;mso-line-height-rule:exactly;color:#B9A0FF;text-align:center;">N</td>
                                            <td style="padding-left:12px;font-family:${FONT_UI};font-size:11px;line-height:38px;font-weight:500;letter-spacing:0.22em;text-transform:uppercase;color:#A39EAB;mso-line-height-rule:exactly;">Nocturna</td>
                                        </tr>
                                    </table>
                                </td>
                            </tr>
                            <tr>
                                <td class="nx-pad nx-title" style="padding:26px 34px 0 34px;font-family:${FONT_DISPLAY};font-size:28px;line-height:1.18;font-weight:500;letter-spacing:-0.01em;color:#F3F0EA;">${safeHeading}</td>
                            </tr>
                            <tr>
                                <td class="nx-pad nx-body" style="padding:14px 34px 0 34px;font-family:${FONT_UI};font-size:15px;line-height:1.6;color:#A39EAB;">${safeText}</td>
                            </tr>
                            <tr>
                                <td class="nx-pad" style="padding:26px 34px 24px 34px;">
                                    <table role="presentation" class="nx-round" border="0" cellpadding="0" cellspacing="0">
                                        <tr>
                                            <td align="center" bgcolor="#B9A0FF" style="background-color:#B9A0FF;background-image:linear-gradient(180deg,#C7B2FF 0%,#AC90FA 100%);border-radius:12px;mso-padding-alt:0;">
                                                <a class="nx-cta" href="${safeUrl}" style="display:inline-block;padding:0 30px;font-family:${FONT_UI};font-size:15px;font-weight:600;line-height:46px;mso-line-height-rule:exactly;color:#15121C;text-decoration:none;border-radius:12px;">${safeLabel}</a>
                                            </td>
                                        </tr>
                                    </table>
                                </td>
                            </tr>
${noteRow}
                            <tr>
                                <td class="nx-pad" style="padding:0 34px;">
                                    <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0">
                                        <tr>
                                            <td height="1" bgcolor="#332E3C" style="height:1px;line-height:1px;mso-line-height-rule:exactly;font-size:0;background-color:#332E3C;">&nbsp;</td>
                                        </tr>
                                    </table>
                                </td>
                            </tr>
                            <tr>
                                <td class="nx-pad nx-foot" style="padding:18px 34px 26px 34px;font-family:${FONT_UI};font-size:12px;line-height:1.6;color:#7C7686;">
                                    Przycisk nie działa? Wklej ten adres w przeglądarce:<br>
                                    <span style="font-family:${FONT_MONO};font-size:11.5px;color:#A39EAB;word-break:break-all;">${safeUrl}</span>
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>
                <tr>
                    <td class="nx-foot" align="center" style="padding:22px 12px 0 12px;font-family:${FONT_UI};font-size:11.5px;line-height:1.7;color:#5C5766;">
                        Wiadomość wysłana automatycznie. Nie odpowiadaj na nią.<br>
                        <span style="letter-spacing:0.16em;text-transform:uppercase;">Nocturna</span> &copy; ${year}
                    </td>
                </tr>
            </table>
        </td>
    </tr>
</table>
</body>
</html>`;
};
