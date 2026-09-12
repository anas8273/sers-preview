import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../root-router";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { seedDefaultTemplates } from "../db";
import { renderHtmlToPdf } from "../pdf-renderer";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  registerOAuthRoutes(app);

  app.post('/api/export-pdf', async (req, res) => {
    try {
      const { html, filename } = req.body;
      if (!html) {
        res.status(400).json({ error: 'Missing html content' });
        return;
      }
      const pdfBuffer = await renderHtmlToPdf(html, {
        format: 'A4',
        printBackground: true,
        margin: { top: '0', right: '0', bottom: '0', left: '0' },
      });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename || 'document.pdf')}`);
      res.setHeader('Content-Length', pdfBuffer.length.toString());
      res.send(pdfBuffer);
    } catch (err) {
      console.error('[export-pdf] Error:', err);
      res.status(500).json({ error: 'PDF generation failed' });
    }
  });

  app.post('/api/export-docx', express.json({ limit: '50mb' }), async (req, res) => {
    try {
      const { data, html, imageBase64, filename, width, height } = req.body;
      let docxBuffer: Buffer;

      if (html) {
        const { renderHtmlToDocxPuppeteer } = await import('../pdf-renderer');
        docxBuffer = await renderHtmlToDocxPuppeteer(html);
      } else if (imageBase64) {
        const { renderImageToDocx } = await import('../docx-renderer');
        docxBuffer = await renderImageToDocx(imageBase64, width, height);
      } else if (data) {
        const { renderStructuredDocx } = await import('../docx-renderer');
        docxBuffer = await renderStructuredDocx(data);
      } else {
        res.status(400).json({ error: 'Missing data, imageBase64, or html content' });
        return;
      }

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename || 'document.docx')}`);
      res.setHeader('Content-Length', docxBuffer.length.toString());
      res.send(docxBuffer);
    } catch (err) {
      console.error('[export-docx] Error:', err);
      res.status(500).json({ error: 'DOCX generation failed' });
    }
  });

  app.get('/api/image-proxy', async (req, res) => {
    const url = req.query.url as string;
    if (!url) {
      res.status(400).json({ error: 'Missing url parameter' });
      return;
    }
    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
      });
      if (!response.ok) {
        res.status(response.status).json({ error: 'Failed to fetch image' });
        return;
      }
      const contentType = response.headers.get('content-type') || 'image/png';
      const buffer = Buffer.from(await response.arrayBuffer());
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.send(buffer);
    } catch (err) {
      console.error('[image-proxy] Error:', err);
      res.status(500).json({ error: 'Proxy error' });
    }
  });

  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, async () => {
    console.log(`Server running on http://localhost:${port}/`);
    try {
      await seedDefaultTemplates();
    } catch (e) {
      console.error('[seed] Failed to seed default templates:', e);
    }
  });
}

startServer().catch(console.error);
