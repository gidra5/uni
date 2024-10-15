import { createSignal } from "solid-js";
import Editor from "solid-simple-code-editor";
import { highlight, languages } from "prismjs/components/prism-core";

import "prismjs/components/prism-clike";
import "prismjs/components/prism-jsx";

const initial = `
function add(a, b) {
  return a + b;
}
`;

export const App = () => {
  const [code, setCode] = createSignal(initial);

  return (
    <Editor
      value={code()}
      onValueChange={(code) => setCode(code)}
      highlight={(code) => highlight(code, languages.jsx, "jsx")}
      padding="10px"
      style={{
        "font-family": '"Fira code", "Fira Mono", monospace',
        "font-size": "12px",
      }}
    />
  );
};
