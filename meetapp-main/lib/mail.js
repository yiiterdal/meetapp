const nodemailer = require("nodemailer");
const logger = require("./logger");

let transporter;
function transport() {
  if (transporter !== undefined) return transporter;
  const host = String(process.env.SMTP_HOST || "").trim();
  if (!host) {
    transporter = null;
    return transporter;
  }
  transporter = nodemailer.createTransport({
    host,
    port: Number.parseInt(process.env.SMTP_PORT || "587", 10) || 587,
    secure: String(process.env.SMTP_SECURE || "").toLowerCase() === "true",
    auth:
      process.env.SMTP_USER && String(process.env.SMTP_USER).trim()
        ? {
            user: String(process.env.SMTP_USER).trim(),
            pass: String(process.env.SMTP_PASS || ""),
          }
        : undefined,
  });
  return transporter;
}

function fromAddress() {
  return (
    String(process.env.SMTP_FROM || "").trim() ||
    String(process.env.SMTP_USER || "").trim() ||
    "meetingly@localhost"
  );
}

async function sendMailSafe({ to, subject, text, html }) {
  const t = transport();
  if (!t) {
    logger.logInfo("mail.skip", { to, subject, reason: "SMTP_HOST not set" });
    return { skipped: true };
  }
  await t.sendMail({
    from: fromAddress(),
    to,
    subject,
    text,
    html: html || undefined,
  });
  logger.logInfo("mail.sent", { to, subject });
  return { sent: true };
}

module.exports = { sendMailSafe, transport, fromAddress };
