import "./styles/global.css";
import { createRoot } from "react-dom/client";
import { App } from "./app";
import { initTheme } from "./lib/theme";

initTheme();

const root = document.getElementById("root");
if (!root) {
  throw new Error("Missing #root");
}
createRoot(root).render(<App />);
