import "./styles.css";
import { GalleryApp } from "./gallery";

const root = document.querySelector<HTMLElement>("#app");

if (!root) {
  throw new Error("Missing #app root element.");
}

new GalleryApp(root).start();

