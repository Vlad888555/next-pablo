"use client";

import { useState } from "react";
import { askAgent } from "./action";

export function Form() {
  const [result, setResult] = useState<string | null>(null);
  return (
    <div>
      <form
        action={async (fd) => {
          const text = await askAgent(fd);
          setResult(text);
        }}
      >
        <input name="q" placeholder="Ask the agent" required />
        <button type="submit">Ask</button>
      </form>
      {result && (
        <pre style={{ whiteSpace: "pre-wrap", marginTop: 12 }}>{result}</pre>
      )}
    </div>
  );
}
