import fs from "fs";

const transcriptPath = "C:\\Users\\salca\\.gemini\\antigravity\\brain\\3f8808bf-d44d-47ec-9e07-dec7a1b8914f\\.system_generated\\logs\\transcript.jsonl";

if (fs.existsSync(transcriptPath)) {
  const content = fs.readFileSync(transcriptPath, "utf8");
  const lines = content.split("\n");
  
  for (const line of lines) {
    if (line.includes("task-247") || line.includes("run_command")) {
      try {
        const obj = JSON.parse(line);
        if (obj.tool_calls) {
          const runDevCall = obj.tool_calls.find((c: any) => c.name === "run_command" && (c.args.CommandLine?.includes("dev") || c.args.CommandLine?.includes("server")));
          if (runDevCall) {
            console.log(`Step ${obj.step_index}: Launched server with command:`, runDevCall.args);
          }
        }
      } catch (e) {
        // Ignore JSON parse errors
      }
    }
  }
} else {
  console.log("No transcript file.");
}
