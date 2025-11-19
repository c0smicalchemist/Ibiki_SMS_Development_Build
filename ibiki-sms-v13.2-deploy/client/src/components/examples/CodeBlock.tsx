import CodeBlock from '../CodeBlock';

export default function CodeBlockExample() {
  const sampleCode = `curl -X POST https://api.ibikisms.com/v2/sms/sendsingle \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"recipient": "+1234567890", "message": "Hello!"}'`;

  return (
    <div className="p-6">
      <CodeBlock code={sampleCode} />
    </div>
  );
}
