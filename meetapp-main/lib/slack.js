async function postSlackIncomingWebhook(webhookUrl, text) {
  if (!webhookUrl || typeof webhookUrl !== "string") return { skipped: true };
  const u = webhookUrl.trim();
  if (!u.startsWith("https://hooks.slack.com/")) {
    throw new Error("Invalid Slack Incoming Webhook URL.");
  }
  const res = await fetch(u, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) {
    throw new Error(`Slack webhook failed (${res.status})`);
  }
  return { ok: true };
}

module.exports = { postSlackIncomingWebhook };
