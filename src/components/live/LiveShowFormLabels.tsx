"use client";

import { useEffect } from "react";

const FIELD_HELP: Record<string, { label: string; help: string }> = {
  Category: {
    label: "Category",
    help: "What type of collectible is this live show for?",
  },
  "Product type": {
    label: "Product type",
    help: "What are you selling or opening during the show?",
  },
  Products: {
    label: "Number of products",
    help: "How many products are planned for this show?",
  },
  "Price floor": {
    label: "Minimum price ($)",
    help: "Lowest price you want to allow for this show.",
  },
  "Price ceiling": {
    label: "Maximum price ($)",
    help: "Highest price you expect for this show.",
  },
};

function enhance(root: HTMLElement) {
  const inputs = Array.from(root.querySelectorAll<HTMLInputElement>("input[placeholder], input[type=number]"));

  for (const input of inputs) {
    const key = input.getAttribute("placeholder") ?? "";
    const config = FIELD_HELP[key];
    if (!config || input.dataset.labeled === "true") continue;

    const wrapper = input.parentElement;
    if (!wrapper) continue;

    const label = document.createElement("label");
    label.className = "mb-2 block text-sm font-semibold text-gray-200";
    label.textContent = config.label;
    label.htmlFor = input.id || `live-show-${key.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
    if (!input.id) input.id = label.htmlFor;

    const help = document.createElement("p");
    help.className = "mb-2 text-xs leading-5 text-gray-500";
    help.textContent = config.help;

    wrapper.classList.add("space-y-0");
    wrapper.insertBefore(label, input);
    wrapper.insertBefore(help, input);
    input.removeAttribute("placeholder");
    input.dataset.labeled = "true";
  }

  const textareas = Array.from(root.querySelectorAll<HTMLTextAreaElement>("textarea"));
  for (const textarea of textareas) {
    if (textarea.dataset.labeled === "true") continue;
    const wrapper = textarea.parentElement;
    if (!wrapper) continue;
    const existingLabel = wrapper.querySelector("label");
    if (!existingLabel) continue;
    const labelText = existingLabel.textContent?.trim();
    if (labelText !== "Description") continue;
    const help = document.createElement("p");
    help.className = "mb-2 text-xs leading-5 text-gray-500";
    help.textContent = "Tell viewers what you are selling, opening, or featuring in this live show.";
    wrapper.insertBefore(help, textarea);
    textarea.dataset.labeled = "true";
  }
}

export default function LiveShowFormLabels() {
  useEffect(() => {
    if (!window.location.pathname.startsWith("/dashboard")) return;

    const run = () => enhance(document.body);
    run();

    const observer = new MutationObserver(run);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return null;
}
