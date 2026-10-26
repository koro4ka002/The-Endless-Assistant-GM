const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class GMShell extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(options = {}) {
    super(options);
    this.activeTab = "home";
  }

  static DEFAULT_OPTIONS = {
    id: "endless-assistant-gm-shell",
    tag: "div",
    classes: ["ea-root", "ea-gm-shell-window"],
    window: {
      title: "ENDLESS.gm.title",
      icon: "fa-solid fa-gears",
      resizable: true,
      minimizable: true
    },
    position: {
      width: 780,
      height: 500
    },
    actions: {
      switchTab: GMShell.prototype._onSwitchTab,
      toggleEnabled: GMShell.prototype._onToggleEnabled,
      toggleVisibleToPlayers: GMShell.prototype._onToggleVisibleToPlayers
    }
  };

  static PARTS = {
    shell: {
      template: "modules/endless-assistant-gm/templates/shell.hbs",
      templates: ["modules/endless-assistant-gm/templates/modules.hbs"]
    }
  };

  _canRender(options) {
    const api = game.modules.get("endless-assistant")?.api;
    if (!api || !api.canOpenGM()) {
      ui.notifications.warn(game.i18n.localize("ENDLESS.gm.noAccess"));
      return false;
    }
    return super._canRender(options);
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const api = game.modules.get("endless-assistant")?.api;

    if (!api) {
      return {
        isHome: true,
        isModules: false,
        isFeature: false,
        features: [],
        modules: [],
        activeCount: 0
      };
    }

    const gmFeatures = api.features.list("gm");
    
    // Check if activeTab is still valid
    const validTabs = ["home", "modules", ...gmFeatures.map(f => f.id)];
    if (!validTabs.includes(this.activeTab)) {
      this.activeTab = "home";
    }

    const featuresWithActive = gmFeatures.map(f => ({
      ...f,
      isActive: this.activeTab === f.id
    }));

    let allModules = [];
    let activeCount = 0;
    try {
      const all = api.features.listAll();
      activeCount = all.filter(m => m.enabled).length;
      allModules = all.map(m => ({
        ...m,
        canChangeVisibility: m.audience === "both" || m.audience === "player"
      }));
    } catch (e) {
      // Ignored if not GM
    }

    context.isHome = this.activeTab === "home";
    context.isModules = this.activeTab === "modules";
    context.isFeature = !context.isHome && !context.isModules;
    context.activeTab = this.activeTab;
    context.features = featuresWithActive;
    context.modules = allModules;
    context.activeCount = activeCount;

    return context;
  }

  _onFirstRender(context, options) {
    super._onFirstRender(context, options);
    this.boundHandleFeatureChanged = this._onFeatureChanged.bind(this);
    Hooks.on("endlessAssistant.featureChanged", this.boundHandleFeatureChanged);
  }

  _onRender(context, options) {
    super._onRender(context, options);

    const html = this.element;
    if (!html) return;

    // Render active feature if needed
    if (context.isFeature) {
      const mount = html.querySelector(`.ea-gm-feature-mount[data-feature-id="${this.activeTab}"]`);
      if (mount) {
        const api = game.modules.get("endless-assistant")?.api;
        const gmFeatures = api ? api.features.list("gm") : [];
        const feature = gmFeatures.find(f => f.id === this.activeTab);
        if (feature && typeof feature.render === "function") {
          try {
            feature.render(mount, { role: "gm" });
          } catch (err) {
            console.error(`GMShell | Error rendering feature ${this.activeTab}:`, err);
          }
        }
      }
    }
  }

  _onFeatureChanged({ id }) {
    if (this.rendered) {
      this.render();
    }
  }

  async _onSwitchTab(event, target) {
    const tab = target.getAttribute("data-tab");
    if (tab) {
      this.activeTab = tab;
      this.render();
    }
  }

  async _onToggleEnabled(event, target) {
    const featureId = target.getAttribute("data-feature-id");
    const enabled = target.checked;
    const api = game.modules.get("endless-assistant")?.api;
    if (api) {
      try {
        await api.features.setEnabled(featureId, enabled);
      } catch (err) {
        console.error("GMShell | Failed to set feature enabled:", err);
        target.checked = !enabled;
      }
    }
  }

  async _onToggleVisibleToPlayers(event, target) {
    const featureId = target.getAttribute("data-feature-id");
    const visible = target.checked;
    const api = game.modules.get("endless-assistant")?.api;
    if (api) {
      try {
        await api.features.setVisibleToPlayers(featureId, visible);
      } catch (err) {
        console.error("GMShell | Failed to set feature visibility:", err);
        target.checked = !visible;
      }
    }
  }

  async close(options) {
    if (this.boundHandleFeatureChanged) {
      Hooks.off("endlessAssistant.featureChanged", this.boundHandleFeatureChanged);
      this.boundHandleFeatureChanged = null;
    }
    return super.close(options);
  }
}
