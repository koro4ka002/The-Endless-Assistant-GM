Hooks.once("endlessAssistant.init", api => api.registerShell({
  role: "gm",
  load: async () => (await import("./gm-shell.js")).GMShell
}));
