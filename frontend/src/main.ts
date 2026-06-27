import "./styles.css";
import { GalleryApp } from "./gallery";

const root = document.querySelector<HTMLElement>("#app");

if (!root) {
  throw new Error("Missing #app root element.");
}

new GalleryApp(root).start().catch((error) => {
  root.innerHTML = `<div class="empty-state">Could not reach the backend.<br><small>${
    error instanceof Error ? error.message : String(error)
  }</small></div>`;
});

