import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { PaginaPubblica } from "./ui/PaginaPubblica";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <PaginaPubblica />
  </StrictMode>,
);
