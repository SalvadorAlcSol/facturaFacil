import fs from "fs";

const transcriptPath = "C:\\Users\\salca\\.gemini\\antigravity\\brain\\3f8808bf-d44d-47ec-9e07-dec7a1b8914f\\.system_generated\\logs\\transcript.jsonl";

if (fs.existsSync(transcriptPath)) {
  const content = fs.readFileSync(transcriptPath, "utf8");
  const lines = content.split("\n");
  
  for (const line of lines) {
    if (line.includes(".env")) {
      try {
        const obj = JSON.parse(line);
        if (obj.tool_calls) {
          const writeCall = obj.tool_calls.find((c: any) => c.name === "write_to_file" || c.name === "replace_file_content" || c.name === "multi_replace_file_content");
          if (writeCall) {
            console.log(`Step ${obj.step_index}: Edit to file ${writeCall.args.TargetFile || writeCall.args.TargetContent}`);
            if (writeCall.args.CodeContent) {
              console.log("Content:\n", writeCall.args.CodeContent);
            } else if (writeCall.args.ReplacementContent) {
              console.log("Replacement:\n", writeCall.args.ReplacementContent);
            }
          }
        }
      } catch (e) {
        // Ignore
      }
    }
  }
} else {
  console.log("No transcript.");
}
