import { App, Plugin, PluginSettingTab, Setting, WorkspaceRibbon, WorkspaceSplit } from "obsidian";

// Extended interfaces to access internal properties
interface ExtendedWorkspaceSplit extends WorkspaceSplit {
  containerEl: HTMLElement;
  collapsed: boolean;
  expand: () => void;
  collapse: () => void;
}

interface ExtendedWorkspaceRibbon extends WorkspaceRibbon {
  containerEl: HTMLElement;
}

interface OpenSidebarHoverSettings {
  leftSidebar: boolean;
  rightSidebar: boolean;
  syncLeftRight: boolean;
  enforceSameDelay: boolean;
  sidebarDelay: number;
  sidebarExpandDelay: number;
  leftSideBarPixelTrigger: number;
  rightSideBarPixelTrigger: number;
  overlayMode: boolean;
  doubleClickPin: boolean,
  expandCollapseSpeed: number;
  leftSidebarMaxWidth: number;
  rightSidebarMaxWidth: number;
}

const DEFAULT_SETTINGS: OpenSidebarHoverSettings = {
  leftSidebar: true,
  rightSidebar: true,
  syncLeftRight: false,
  enforceSameDelay: true,
  sidebarDelay: 150,
  sidebarExpandDelay: 10,
  leftSideBarPixelTrigger: 20,
  rightSideBarPixelTrigger: 20,
  overlayMode: false,
  doubleClickPin: false,
  expandCollapseSpeed: 370,
  leftSidebarMaxWidth: 325,
  rightSidebarMaxWidth: 325,
};

export default class OpenSidebarHover extends Plugin {
  settings: OpenSidebarHoverSettings;
  isHoveringLeft = false;
  isHoveringRight = false;
  isPinnedLeft = false;
  isPinnedRight =  false;
  leftSplit: ExtendedWorkspaceSplit;
  rightSplit: ExtendedWorkspaceSplit;
  leftRibbon: ExtendedWorkspaceRibbon;
  leftSplitMouseEnterHandler: () => void;
  rightSplitMouseEnterHandler: () => void;
  leftSplitMouseMoveHandler: () => void;
  rightSplitMouseMoveHandler: () => void;
  workspaceChangeTimeout: NodeJS.Timeout | null = null;
  
  // Double-click tracking variables
  private lastClickTime = 0;
  private lastClickTarget: HTMLElement | null = null;
  private doubleClickThreshold = 300;
  
  // Track manually added events for cleanup
  private manualEvents: Array<{
    element: HTMLElement;
    type: string;
    handler: EventListener;
  }> = [];

  handleWorkspaceChange() {
    // Wait to ensure DOM is ready
    if (this.workspaceChangeTimeout) clearTimeout(this.workspaceChangeTimeout);
    
    this.workspaceChangeTimeout = setTimeout(() => {
      this.forceReinitialize();
    }, 100);
  }

  forceReinitialize() {
    // Reset all state and get fresh references
    this.leftSplit = this.app.workspace.leftSplit as any;
    this.rightSplit = this.app.workspace.rightSplit as any;
    this.isHoveringLeft = false;
    this.isHoveringRight = false;
    
    // Clean and reattach
    this.detachManualEvents();
    this.attachManualEvents();
    this.collapseBoth();
  }

  // Event handler for document clicks (now handles both single and double clicks)
  documentClickHandler = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    const now = Date.now();
    
    // Check if this is a double click (same target within threshold)
    const isDoubleClick = this.lastClickTarget === target && 
                         (now - this.lastClickTime) < this.doubleClickThreshold;
    
    // Update tracking variables
    this.lastClickTime = now;
    this.lastClickTarget = target;
    
    // Handle double-click for pinning if enabled
    if (isDoubleClick && this.settings.doubleClickPin) {
      this.handleSidebarDoubleClick(target);
      return; // Skip single-click logic for double-clicks
    }
    
    // Original single-click logic
    // Make sure leftSplit and rightSplit are initialized
    if (!this.leftSplit || !this.rightSplit) return;
    
    const leftSplitEl = this.leftSplit.containerEl;
    const rightSplitEl = this.rightSplit.containerEl;
    
    // If clicking outside sidebar areas and they're expanded, collapse them
    if (!leftSplitEl.contains(target) && !rightSplitEl.contains(target)) {
      if (!this.leftSplit.collapsed && this.settings.leftSidebar && !this.isPinnedLeft) {
        this.collapseLeft();
      }
      if (!this.rightSplit.collapsed && this.settings.rightSidebar && !this.isPinnedRight) {
        this.collapseRight();
      }
    }
  };

  // Handle double-click on sidebar for pinning/unpinning
  handleSidebarDoubleClick(target: HTMLElement) {
    if (!this.leftSplit || !this.rightSplit) return;
    
    const leftSplitEl = this.leftSplit.containerEl;
    const rightSplitEl = this.rightSplit.containerEl;
    
    // Determine which sidebar was double-clicked
    if (leftSplitEl.contains(target)) {
      this.isPinnedLeft = !this.isPinnedLeft;
    }
    
    if (rightSplitEl.contains(target)) {
      this.isPinnedRight = !this.isPinnedRight;
    }
  }

  // Attach manually managed event listeners
  attachManualEvents() {
    // Helper function to track events for cleanup
    const attach = (element: HTMLElement, type: string, handler: EventListener) => {
      element.addEventListener(type, handler);
      this.manualEvents.push({ element, type, handler });
    };
    
    // Implementation with hover class for right split
    if (this.rightSplit?.containerEl) {
      this.rightSplitMouseEnterHandler = () => { 
        this.isHoveringRight = true; 
        this.rightSplit.containerEl.addClass('hovered');
      };
      attach(this.rightSplit.containerEl, "mouseenter", this.rightSplitMouseEnterHandler);
      
      attach(this.rightSplit.containerEl, "mouseleave", this.rightSplitMouseLeaveHandler);
      
      this.rightSplitMouseMoveHandler = () => this.rightSplit.containerEl.addClass('hovered');
      attach(this.rightSplit.containerEl, "mousemove", this.rightSplitMouseMoveHandler);
    }
    
    // Implementation with hover class for left split
    if (this.leftRibbon && this.leftRibbon.containerEl) {
      attach(this.leftRibbon.containerEl, "mouseenter", this.leftRibbonMouseEnterHandler);
    }
    
    if (this.leftSplit?.containerEl) {
      this.leftSplitMouseEnterHandler = () => { 
        this.isHoveringLeft = true; 
        this.leftSplit.containerEl.addClass('hovered');
      };
      attach(this.leftSplit.containerEl, "mouseenter", this.leftSplitMouseEnterHandler);
      
      attach(this.leftSplit.containerEl, "mouseleave", this.leftSplitMouseLeaveHandler);
      
      this.leftSplitMouseMoveHandler = () => this.leftSplit.containerEl.addClass('hovered');
      attach(this.leftSplit.containerEl, "mousemove", this.leftSplitMouseMoveHandler);
    }
  }

  // Detach manually managed event listeners
  detachManualEvents() {
    // Remove all tracked event listeners
    this.manualEvents.forEach(({ element, type, handler }) => {
      element.removeEventListener(type, handler);
    });
    this.manualEvents = [];
    
    // Clean up hover classes
    if (this.rightSplit?.containerEl) {
      this.rightSplit.containerEl.removeClass('hovered');
    }
    if (this.leftSplit?.containerEl) {
      this.leftSplit.containerEl.removeClass('hovered');
    }
  }

  async onload() {
    await this.loadSettings();

    // Apply overlay mode class if enabled in settings
    if (this.settings.overlayMode) {
      document.body.classList.add("sidebar-overlay-mode");
    }
    
    // Add global CSS class to implement the suggested JS-CSS approach
    document.body.classList.add("open-sidebar-hover-plugin");

    // Update CSS variables based on settings
    this.updateCSSVariables();

    this.app.workspace.onLayoutReady(() => {
      // Cast to extended interfaces to access internal properties
      this.leftSplit = this.app.workspace.leftSplit as unknown as ExtendedWorkspaceSplit;
      this.rightSplit = this.app.workspace.rightSplit as unknown as ExtendedWorkspaceSplit;
      this.leftRibbon = this.app.workspace.leftRibbon as unknown as ExtendedWorkspaceRibbon;
      
      // Register auto-cleaned events using Obsidian's API
      this.registerDomEvent(document, "mousemove", this.mouseMoveHandler);
      this.registerDomEvent(document, "click", this.documentClickHandler);
      
      // To prevent plugin from breaking after workspace changes
      this.registerEvent(
        this.app.workspace.on('layout-change', () => {
          this.handleWorkspaceChange();
        })
      );
      
      // Attach manually managed event listeners
      this.attachManualEvents();
    });

    this.addSettingTab(new SidebarHoverSettingsTab(this.app, this));
  }

  onunload() {
    this.saveSettings();

    // Remove overlay mode class if it was added
    document.body.classList.remove("sidebar-overlay-mode");
    
    // Remove the global CSS class
    document.body.classList.remove("open-sidebar-hover-plugin");

    // Clean up all manually added event listeners
    this.detachManualEvents();
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  // Helper method to update CSS variables
  updateCSSVariables() {
    // Create a style element to hold custom CSS variables
    const styleEl = document.createElement('style');
    styleEl.id = 'obsidian-quick-peek-sidebar-variables';
    
    // Remove any existing style element with this ID
    const existingStyle = document.getElementById(styleEl.id);
    if (existingStyle) {
      existingStyle.remove();
    }
    
    // Add the CSS variables to the style element
    styleEl.textContent = `
      :root {
        --sidebar-expand-collapse-speed: ${this.settings.expandCollapseSpeed}ms;
        --sidebar-expand-delay: ${this.settings.sidebarExpandDelay}ms;
        --left-sidebar-max-width: ${this.settings.leftSidebarMaxWidth}px;
        --right-sidebar-max-width: ${this.settings.rightSidebarMaxWidth}px;
      }
      
      body {
        --sidebar-width: ${this.settings.leftSidebarMaxWidth}px !important;
        --right-sidebar-width: ${this.settings.rightSidebarMaxWidth}px !important;
      }
    `;
    
    // Add the style element to the document head
    document.head.appendChild(styleEl);
  }

  // Helpers
  getEditorWidth = () => this.app.workspace.containerEl.clientWidth;

  expandRight() {
    // Start animation by expanding
    this.rightSplit.expand();
    this.isHoveringRight = true;
  }
  
  expandLeft() {
    // Start animation by expanding
    this.leftSplit.expand();
    this.isHoveringLeft = true;
  }
  
  expandBoth() {
    this.expandRight();
    this.expandLeft();
  }
  
  collapseRight() {
    // Only collapse if not pinned
    if (!this.isPinnedRight) {
      this.rightSplit.collapse();
      this.isHoveringRight = false;
    }
  }
  
  collapseLeft() {
    // Only collapse if not pinned
    if (!this.isPinnedLeft) {
      this.leftSplit.collapse();
      this.isHoveringLeft = false;
    }
  }
  
  collapseBoth() {
    this.collapseRight();
    this.collapseLeft();
  }
  
  // Event handlers
  mouseMoveHandler = (event: MouseEvent) => {
    const mouseX = event.clientX;
    
    // Handle right sidebar hover
    if (this.settings.rightSidebar) {
      if (!this.isHoveringRight && this.rightSplit.collapsed && !this.isPinnedRight) {
        const editorWidth = this.getEditorWidth();

        this.isHoveringRight =
          mouseX >= editorWidth - this.settings.rightSideBarPixelTrigger;

        if (this.isHoveringRight && this.rightSplit.collapsed) {
          setTimeout(() => {
            if (this.isHoveringRight) {
              if (this.settings.syncLeftRight) {
                this.expandBoth();
              } else {
                this.expandRight();
              }
            }
          }, this.settings.sidebarExpandDelay);
        }

        setTimeout(() => {
          if (!this.isHoveringRight) {
            this.collapseRight();
          }
        }, this.settings.sidebarDelay);
      }
    }
    
    // Handle left sidebar hover
    if (this.settings.leftSidebar) {
      if (!this.isHoveringLeft && this.leftSplit.collapsed && !this.isPinnedLeft) {
        // Check if mouse is in the left trigger area
        this.isHoveringLeft = mouseX <= this.settings.leftSideBarPixelTrigger;

        if (this.isHoveringLeft && this.leftSplit.collapsed) {
          setTimeout(() => {
            if (this.isHoveringLeft) {
              if (this.settings.syncLeftRight) {
                this.expandBoth();
              } else {
                this.expandLeft();
              }
            }
          }, this.settings.sidebarExpandDelay);
        }

        setTimeout(() => {
          if (!this.isHoveringLeft) {
            this.collapseLeft();
          }
        }, this.settings.sidebarDelay);
      }
    }
  };

  rightSplitMouseLeaveHandler = (event: MouseEvent) => {
    // Don't process if we're leaving to the tab header container or a menu
    const target = event.relatedTarget as HTMLElement;
    if (target && (target.closest('.workspace-tab-header-container-inner') || 
                  (target.hasClass && target.hasClass('menu')) || 
                  target?.classList?.contains('menu') || 
                  target?.closest('.menu'))) {
      return;
    }
    
    if (this.settings.rightSidebar && !this.isPinnedRight) {
      this.isHoveringRight = false;
      // Remove the hovered class
      this.rightSplit.containerEl.removeClass('hovered');

      setTimeout(() => {
        if (!this.isHoveringRight) {
          if (this.settings.syncLeftRight && this.settings.leftSidebar) {
            this.collapseBoth();
          } else {
            this.collapseRight();
          }
        }
      }, this.settings.sidebarDelay);
    }
  };

  leftSplitMouseLeaveHandler = (event: MouseEvent) => {
    // Don't process if we're leaving to the tab header container or a menu
    const target = event.relatedTarget as HTMLElement;
    if (target && (target.closest('.workspace-tab-header-container-inner') || 
                  (target.hasClass && target.hasClass('menu')) || 
                  target?.classList?.contains('menu') || 
                  target?.closest('.menu'))) {
      return;
    }

    if (this.settings.leftSidebar && !this.isPinnedLeft) {
      this.isHoveringLeft = false;
      // Remove the hovered class
      this.leftSplit.containerEl.removeClass('hovered');

      setTimeout(() => {
        if (!this.isHoveringLeft) {
          if (this.settings.syncLeftRight && this.settings.rightSidebar) {
            this.collapseBoth();
          } else {
            this.collapseLeft();
          }
        }
      }, this.settings.sidebarDelay);
    }
  };

  leftRibbonMouseEnterHandler = () => {
    if (this.settings.leftSidebar) {
      this.isHoveringLeft = true;
      setTimeout(() => {
        // Check if still hovering
        if (this.isHoveringLeft) {
          if (this.settings.syncLeftRight && this.settings.rightSidebar) {
            this.expandBoth();
          } else {
            this.expandLeft();
          }
        }
      }, this.settings.sidebarExpandDelay);
    }
  };
}

class SidebarHoverSettingsTab extends PluginSettingTab {
  plugin: OpenSidebarHover;

  constructor(app: App, plugin: OpenSidebarHover) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;

    containerEl.empty();

    // BASIC SETTINGS (no heading)
    new Setting(containerEl)
      .setName("Left sidebar hover")
      .setDesc(
        "Enables the expansion and collapsing of the left sidebar on hover."
      )
      .addToggle((t) =>
        t.setValue(this.plugin.settings.leftSidebar).onChange(async (value) => {
          this.plugin.settings.leftSidebar = value;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("Right sidebar hover")
      .setDesc(
        "Enables the expansion and collapsing of the right sidebar on hover. Only collapses the right panel unless you have a right ribbon."
      )
      .addToggle((t) =>
        t
          .setValue(this.plugin.settings.rightSidebar)
          .onChange(async (value) => {
            this.plugin.settings.rightSidebar = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Sync left and right")
      .setDesc(
        "If enabled, hovering over the right sidebar will also expand the left sidebar at the same time, and vice versa. (Left and Right sidebar must both be enabled above)"
      )
      .addToggle((t) =>
        t
          .setValue(this.plugin.settings.syncLeftRight)
          .onChange(async (value) => {
            this.plugin.settings.syncLeftRight = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Overlay mode")
      .setDesc(
        "When enabled, sidebars will slide over the main content without affecting the layout. When disabled, sidebars will expand by pushing content."
      )
      .addToggle((t) =>
        t
          .setValue(this.plugin.settings.overlayMode)
          .onChange(async (value) => {
            this.plugin.settings.overlayMode = value;
            
            // Update CSS class on body to toggle overlay mode
            if (value) {
              document.body.classList.add("sidebar-overlay-mode");
            } else {
              document.body.classList.remove("sidebar-overlay-mode");
            }
            
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
    .setName("Double Click Pin Sidebar")
    .setDesc(
      "When enabled, double-click to keep the sidebar open. Double-click again to unpin it."
    )
    .addToggle((t) =>
      t
        .setValue(this.plugin.settings.doubleClickPin)
        .onChange(async (value) => {
          this.plugin.settings.doubleClickPin = value;
          await this.plugin.saveSettings();
        })
    );
      
    // BEHAVIOR SECTION
    new Setting(containerEl).setName("Behavior").setHeading();

    new Setting(containerEl)
      .setName("Left sidebar pixel trigger")
      .setDesc(
        "Specify the number of pixels from the left edge of the editor that will trigger the left sidebar to open on hover (must be greater than 0)"
      )
      .addText((text) => {
        text
          .setPlaceholder("30")
          .setValue(this.plugin.settings.leftSideBarPixelTrigger.toString())
          .onChange(async (value) => {
            const v = Number(value);
            if (!value || isNaN(v) || v < 1) {
              this.plugin.settings.leftSideBarPixelTrigger =
                DEFAULT_SETTINGS.leftSideBarPixelTrigger;
            } else {
              this.plugin.settings.leftSideBarPixelTrigger = v;
            }
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName("Right sidebar pixel trigger")
      .setDesc(
        "Specify the number of pixels from the right edge of the editor that will trigger the right sidebar to open on hover (must be greater than 0)"
      )
      .addText((text) => {
        text
          .setPlaceholder("30")
          .setValue(this.plugin.settings.rightSideBarPixelTrigger.toString())
          .onChange(async (value) => {
            const v = Number(value);
            if (!value || isNaN(v) || v < 1) {
              this.plugin.settings.rightSideBarPixelTrigger =
                DEFAULT_SETTINGS.rightSideBarPixelTrigger;
            } else {
              this.plugin.settings.rightSideBarPixelTrigger = v;
            }
            await this.plugin.saveSettings();
          });
      });

    // TIMING SECTION
    new Setting(containerEl).setName("Timing").setHeading();

    new Setting(containerEl)
      .setName("Sidebar collapse delay")
      .setDesc(
        "The delay in milliseconds before the sidebar collapses after the mouse has left. Enter '0' to disable delay."
      )
      .addText((text) => {
        text
          .setPlaceholder("300")
          .setValue(this.plugin.settings.sidebarDelay.toString())
          .onChange(async (value) => {
            const v = Number(value);
            if (!v || isNaN(v) || v < 0) {
              this.plugin.settings.sidebarDelay = DEFAULT_SETTINGS.sidebarDelay;
            } else {
              this.plugin.settings.sidebarDelay = v;
            }
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName("Sidebar expand delay")
      .setDesc(
        "The delay in milliseconds before the sidebar expands after hovering. Default is 200ms."
      )
      .addText((text) => {
        text
          .setPlaceholder("200")
          .setValue(this.plugin.settings.sidebarExpandDelay.toString())
          .onChange(async (value) => {
            const v = Number(value);
            if (!v || isNaN(v) || v < 0) {
              this.plugin.settings.sidebarExpandDelay = DEFAULT_SETTINGS.sidebarExpandDelay;
            } else {
              this.plugin.settings.sidebarExpandDelay = v;
            }
            // Apply the CSS variables immediately
            this.plugin.updateCSSVariables();
            await this.plugin.saveSettings();
          });
      });
      
    new Setting(containerEl)
      .setName("Expand/collapse animation speed")
      .setDesc(
        "The speed of the sidebar expand/collapse animation in milliseconds."
      )
      .addText((text) => {
        text
          .setPlaceholder("300")
          .setValue(this.plugin.settings.expandCollapseSpeed?.toString() || "300")
          .onChange(async (value) => {
            const v = Number(value);
            if (!value || isNaN(v) || v < 0) {
              this.plugin.settings.expandCollapseSpeed = DEFAULT_SETTINGS.expandCollapseSpeed;
            } else {
              this.plugin.settings.expandCollapseSpeed = v;
            }
            // Apply the CSS variables immediately
            this.plugin.updateCSSVariables();
            await this.plugin.saveSettings();
          });
      });

    // APPEARANCE SECTION
    new Setting(containerEl).setName("Appearance").setHeading();

    new Setting(containerEl)
      .setName("Left sidebar maximum width")
      .setDesc(
        "Specify the maximum width in pixels for the left sidebar when expanded"
      )
      .addText((text) => {
        text
          .setPlaceholder("300")
          .setValue(this.plugin.settings.leftSidebarMaxWidth.toString())
          .onChange(async (value) => {
            const v = Number(value);
            if (!value || isNaN(v) || v < 100) {
              this.plugin.settings.leftSidebarMaxWidth = DEFAULT_SETTINGS.leftSidebarMaxWidth;
            } else {
              this.plugin.settings.leftSidebarMaxWidth = v;
            }
            // Apply the CSS variables immediately
            this.plugin.updateCSSVariables();            
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName("Right sidebar maximum width")
      .setDesc(
        "Specify the maximum width in pixels for the right sidebar when expanded"
      )
      .addText((text) => {
        text
          .setPlaceholder("300")
          .setValue(this.plugin.settings.rightSidebarMaxWidth.toString())
          .onChange(async (value) => {
            const v = Number(value);
            if (!value || isNaN(v) || v < 100) {
              this.plugin.settings.rightSidebarMaxWidth = DEFAULT_SETTINGS.rightSidebarMaxWidth;
            } else {
              this.plugin.settings.rightSidebarMaxWidth = v;
            }
            // Apply the CSS variables immediately
            this.plugin.updateCSSVariables();
            await this.plugin.saveSettings();
          });
      });
  }
}