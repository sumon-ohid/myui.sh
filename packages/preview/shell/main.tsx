import React from "react";
import { createRoot } from "react-dom/client";
import { Shell } from "./Shell";
import "./shell.css";

const root = document.getElementById("root");
if (!root) throw new Error("root element missing");
createRoot(root).render(
  <React.StrictMode>
    <Shell />
  </React.StrictMode>,
);
