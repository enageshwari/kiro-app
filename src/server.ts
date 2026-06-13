import express from 'express';
import path from 'path';

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, '..', 'public')));

// Health check endpoint for ALB / ECS container health checks
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
