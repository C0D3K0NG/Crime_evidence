/**
 * Express REST API layer for the Crime Evidence Management System.
 *
 * Provides HTTP endpoints that read/write the same `demo_config.json`
 * used by the MCP server. This allows the frontend (and other HTTP
 * consumers) to access and mutate the configuration at runtime.
 */

import express, { Request, Response } from "express";
import cors from "cors";
import { readConfig, writeConfig } from "./server.js";
import authRoutes from "./routes/auth.js";
import evidenceRoutes from "./routes/evidence.js";
import custodyRoutes from "./routes/custody.js";
import boxRoutes from "./routes/boxes.js";
import statRoutes from "./routes/stats.js";
import caseRoutes from "./routes/cases.js";
import evidenceExtrasRouter from "./routes/evidence-extras.js";
import extrasRouter from "./routes/extras.js";
import { prisma } from "./lib/prisma.js";

// ---------------------------------------------------------------------------
// Create Express app
// ---------------------------------------------------------------------------

export function createApp(): express.Express {
    const app = express();

    // Middleware
    app.use(cors());
    app.use(express.json());

    // -------------------------------------------------------------------------
    // GET /api/health — server health check
    // -------------------------------------------------------------------------
    app.get("/api/health", (_req: Request, res: Response) => {
        res.json({
            status: "ok",
            server: "crime-evidence-mcp-server",
            timestamp: new Date().toISOString(),
        });
    });

    // -------------------------------------------------------------------------
    // GET /api/config — full configuration
    // -------------------------------------------------------------------------
    app.get("/api/config", (_req: Request, res: Response) => {
        try {
            const config = readConfig();
            res.json(config);
        } catch (err: any) {
            res.status(500).json({ error: "Failed to read configuration", details: err.message });
        }
    });

    // -------------------------------------------------------------------------
    // GET /api/config/:section — specific section
    // -------------------------------------------------------------------------
    app.get("/api/config/:section", (req: Request, res: Response) => {
        try {
            const config = readConfig();
            const section = req.params.section as string;

            if (!(section in config)) {
                res.status(404).json({
                    error: `Section "${section}" not found`,
                    available_sections: Object.keys(config),
                });
                return;
            }

            res.json({ section, data: config[section] });
        } catch (err: any) {
            res.status(500).json({ error: "Failed to read configuration", details: err.message });
        }
    });

    // -------------------------------------------------------------------------
    // PUT /api/config — update a config value
    // Body: { section: string, key: string, value: any }
    // -------------------------------------------------------------------------
    app.put("/api/config", (req: Request, res: Response) => {
        try {
            const { section, key, value } = req.body;

            if (!section || !key || value === undefined) {
                res.status(400).json({
                    error: "Missing required fields",
                    required: { section: "string", key: "string", value: "any" },
                });
                return;
            }

            const config = readConfig();

            if (!(section in config)) {
                res.status(404).json({
                    error: `Section "${section}" not found`,
                    available_sections: Object.keys(config),
                });
                return;
            }

            const sectionData = config[section];

            if (Array.isArray(sectionData)) {
                res.status(400).json({
                    error: `Section "${section}" is an array and cannot be updated with key-value pairs directly`,
                });
                return;
            }

            const oldValue = sectionData[key];
            sectionData[key] = value;
            config[section] = sectionData;
            writeConfig(config);

            res.json({
                success: true,
                section,
                key,
                old_value: oldValue,
                new_value: value,
            });
        } catch (err: any) {
            res.status(500).json({ error: "Failed to update configuration", details: err.message });
        }
    });

    // -------------------------------------------------------------------------
    // POST /api/config/sections — add a dynamic section
    // Body: { section_name: string, schema: object, overwrite?: boolean }
    // -------------------------------------------------------------------------
    app.post("/api/config/sections", (req: Request, res: Response) => {
        try {
            const { section_name, schema, overwrite = false } = req.body;

            if (!section_name || !schema || typeof schema !== "object") {
                res.status(400).json({
                    error: "Missing required fields",
                    required: {
                        section_name: "string",
                        schema: "object",
                        overwrite: "boolean (optional, default: false)",
                    },
                });
                return;
            }

            const config = readConfig();

            if (!config.dynamic_sections) {
                config.dynamic_sections = {};
            }

            if (config.dynamic_sections[section_name] && !overwrite) {
                res.status(409).json({
                    error: `Dynamic section "${section_name}" already exists. Set overwrite=true to replace.`,
                    existing: config.dynamic_sections[section_name],
                });
                return;
            }

            config.dynamic_sections[section_name] = schema;
            writeConfig(config);

            res.status(201).json({
                success: true,
                section_name,
                schema,
                message: `Dynamic section "${section_name}" added successfully`,
            });
        } catch (err: any) {
            res.status(500).json({ error: "Failed to add dynamic section", details: err.message });
        }
    });

    // -------------------------------------------------------------------------
    // Mount Phase 2 route modules
    // -------------------------------------------------------------------------
    app.use("/api/v1/auth", authRoutes);
    app.use("/api/v1/evidence", evidenceRoutes);
    app.use("/api/v1/evidence/:evidenceId", evidenceExtrasRouter);
    app.use("/api/v1/custody", custodyRoutes);
    app.use("/api/v1/boxes", boxRoutes);
    app.use("/api/v1/stats", statRoutes);
    app.use("/api/v1/cases", caseRoutes);
    app.use("/api/v1", extrasRouter);

    // -------------------------------------------------------------------------
    // Global error handler
    // -------------------------------------------------------------------------
    app.use((err: any, _req: Request, res: Response, _next: any) => {
        console.error("Unhandled error:", err);
        res.status(500).json({ error: "Internal server error" });
    });

    return app;
}

// ---------------------------------------------------------------------------
// Start Express server
// ---------------------------------------------------------------------------

export function startApiServer(port: number = 3000): void {
    const app = createApp();
    app.listen(port, () => {
        console.log(`Crime Evidence REST API running on http://localhost:${port}`);
        console.log(`  Health:  GET  http://localhost:${port}/api/health`);
        console.log(`  Config:  GET  http://localhost:${port}/api/config`);
        console.log(`  Update:  PUT  http://localhost:${port}/api/config`);
        console.log(`  Add:     POST http://localhost:${port}/api/config/sections`);
    });
}
