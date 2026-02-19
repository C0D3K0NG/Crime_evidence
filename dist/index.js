/**
 * Entry point for the Crime Evidence MCP Server.
 *
 * Supports three startup modes via --mode flag:
 *   --mode mcp   → MCP server only (stdio transport)
 *   --mode api   → Express REST API only (port 3000)
 *   (default)    → Express REST API on port 3000
 *
 * The MCP stdio transport and Express can't easily run in the same
 * process (stdio is consumed by the MCP protocol), so the default
 * mode starts the REST API. Use --mode mcp for LLM client connections.
 */
import "dotenv/config";
import { startMcpServer } from "./server.js";
import { startApiServer } from "./api.js";
// ---------------------------------------------------------------------------
// Parse CLI arguments
// ---------------------------------------------------------------------------
function getMode() {
    const args = process.argv.slice(2);
    const modeIndex = args.indexOf("--mode");
    if (modeIndex !== -1 && args[modeIndex + 1]) {
        return args[modeIndex + 1].toLowerCase();
    }
    return "api"; // default: start REST API
}
// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
    const mode = getMode();
    switch (mode) {
        case "mcp":
            console.error("Starting in MCP mode (stdio transport)...");
            await startMcpServer();
            break;
        case "api":
            console.log("Starting in API mode (Express REST server)...");
            startApiServer(3001);
            break;
        default:
            console.error(`Unknown mode: "${mode}". Use --mode mcp or --mode api`);
            process.exit(1);
    }
}
main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
});
//# sourceMappingURL=index.js.map