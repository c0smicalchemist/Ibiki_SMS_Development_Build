import ApiEndpointCard from '../ApiEndpointCard';

export default function ApiEndpointCardExample() {
  const requestExample = `curl -X POST https://api.ibikisms.com/v2/sms/sendsingle \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"recipient": "+1234567890", "message": "Hello from Ibiki SMS!"}'`;

  const responseExample = `{
  "success": true,
  "messageId": "60f1a5b3e6e7c12345678901",
  "status": "queued"
}`;

  return (
    <div className="p-6 max-w-3xl">
      <ApiEndpointCard
        method="POST"
        path="/api/v2/sms/sendsingle"
        title="Send a single SMS message"
        description="Send a single SMS message to a recipient."
        requestExample={requestExample}
        responseExample={responseExample}
      />
    </div>
  );
}
