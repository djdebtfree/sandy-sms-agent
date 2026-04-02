export default function handler(req, res) {
  const url = (req.url || '').split('?')[0];

  if (url === '/health' || url === '/' || url === '') {
    return res.status(200).json({
      status: 'ok',
      service: 'sandy-sms-agent',
      runtime: 'vercel',
      timestamp: new Date().toISOString(),
    });
  }

  res.status(501).json({
    error: 'This endpoint requires the full Sandy SMS Agent runtime',
    hint: 'Use the Railway deployment for full functionality',
    path: url,
  });
}
