import { App, Plugin, PluginSettingTab, Setting, WorkspaceRibbon, WorkspaceSplit } from "obsidian";

// Extended interfaces to access internal properties
interface ExtendedWorkspaceSplit extends WorkspaceSplit {
  containerEl: HTMLElement;
  collapsed: boolean;
  expand: () => void;
  collapse: () => void;
  resizeHandleEl: HTMLElement;
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
  doubleClickPin: boolean;
  onlyWhenFocused: boolean;
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
  onlyWhenFocused: false,
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
  private rightTriggerZoneEl: HTMLElement | null = null;
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

  // Helper to check if user is actively editing (rename input, context menu open, etc.)
  isActivelyEditing(): boolean {
    // Check for open context menus
    const hasOpenMenu = document.querySelector('.menu') !== null;
    if (hasOpenMenu) return true;

    // Check for items being renamed in file explorer
    const hasRenameInput = document.querySelector('.is-being-renamed') !== null;
    if (hasRenameInput) return true;

    // Check if an input or editable element inside a sidebar is focused
    const activeEl = document.activeElement as HTMLElement;
    if (activeEl) {
      const isInput = activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA';
      const isEditable = activeEl.isContentEditable;

      if (isInput || isEditable) {
        // Check if the focused element is within either sidebar
        const inLeftSidebar = this.leftSplit?.containerEl?.contains(activeEl);
        const inRightSidebar = this.rightSplit?.containerEl?.contains(activeEl);
        if (inLeftSidebar || inRightSidebar) return true;
      }
    }

    return false;
  }


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

    // Don't collapse if user is actively editing (rename, menu open, etc.)
    if (this.isActivelyEditing()) return;

    // Don't collapse if window is not focused and setting is enabled
    if (this.settings.onlyWhenFocused && !document.hasFocus()) return;

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
    const attach = (element: HTMLElement, type: string, handler: EventListener) => {
      element.addEventListener(type, handler);
      this.manualEvents.push({ element, type, handler });
    };

    // Right split: mouseenter triggers expand when collapsed, maintains hover when expanded
    if (this.rightSplit?.containerEl) {
      this.rightSplitMouseEnterHandler = () => {
        if (this.settings.onlyWhenFocused && !document.hasFocus()) return;
        this.isHoveringRight = true;
        this.rightSplit.containerEl.addClass('hovered');
        if (this.settings.rightSidebar && this.rightSplit.collapsed && !this.isPinnedRight) {
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
      };
      attach(this.rightSplit.containerEl, "mouseenter", this.rightSplitMouseEnterHandler);
      attach(this.rightSplit.containerEl, "mouseleave", this.rightSplitMouseLeaveHandler);

      // Resize handle as additional enter target for collapsed state
      if (this.rightSplit.resizeHandleEl) {
        attach(this.rightSplit.resizeHandleEl, "mouseenter", this.rightSplitMouseEnterHandler);
      }

      // Programmatic trigger zone at the right edge of the workspace.
      // Unlike the left sidebar (which has the always-visible left ribbon as a
      // trigger), the right sidebar has no equivalent element. When collapsed,
      // its containerEl is effectively hidden, so mouseenter never fires. This
      // thin absolutely-positioned div acts as the right-edge hover target.
      //
      // position:absolute requires the parent to be a positioning context.
      // Obsidian's workspace container is position:static by default, so the
      // trigger zone would anchor to a distant ancestor instead. Ensure the
      // container is position:relative before appending.
      const wsContainer = this.app.workspace.containerEl;
      if (getComputedStyle(wsContainer).position === 'static') {
        wsContainer.style.position = 'relative';
      }
      this.rightTriggerZoneEl = document.createElement('div');
      this.rightTriggerZoneEl.className = 'right-sidebar-trigger-zone';
      this.rightTriggerZoneEl.style.cssText = `
        position: absolute;
        top: 0;
        right: 0;
        width: ${this.settings.rightSideBarPixelTrigger}px;
        height: 100%;
        z-index: 1;
        pointer-events: auto;
      `;
      wsContainer.appendChild(this.rightTriggerZoneEl);
      attach(this.rightTriggerZoneEl, 'mouseenter', this.rightSplitMouseEnterHandler);
    }

    // Left ribbon: triggers left expand
    if (this.leftRibbon?.containerEl) {
      attach(this.leftRibbon.containerEl, "mouseenter", this.leftRibbonMouseEnterHandler);
    }

    // Left split: mouseenter triggers expand when collapsed, maintains hover when expanded
    if (this.leftSplit?.containerEl) {
      this.leftSplitMouseEnterHandler = () => {
        if (this.settings.onlyWhenFocused && !document.hasFocus()) return;
        this.isHoveringLeft = true;
        this.leftSplit.containerEl.addClass('hovered');
        if (this.settings.leftSidebar && this.leftSplit.collapsed && !this.isPinnedLeft) {
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
      };
      attach(this.leftSplit.containerEl, "mouseenter", this.leftSplitMouseEnterHandler);
      attach(this.leftSplit.containerEl, "mouseleave", this.leftSplitMouseLeaveHandler);

      // Resize handle as additional enter target for collapsed state
      if (this.leftSplit.resizeHandleEl) {
        attach(this.leftSplit.resizeHandleEl, "mouseenter", this.leftSplitMouseEnterHandler);
      }
    }
  }

  // Detach manually managed event listeners
  detachManualEvents() {
    // Remove all tracked event listeners
    this.manualEvents.forEach(({ element, type, handler }) => {
      element.removeEventListener(type, handler);
    });
    this.manualEvents = [];

    // Remove trigger zone element
    if (this.rightTriggerZoneEl) {
      this.rightTriggerZoneEl.remove();
      this.rightTriggerZoneEl = null;
    }
    
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

    // Register hotkey commands to toggle sidebars
    this.addCommand({
      id: 'toggle-left-sidebar',
      name: 'Toggle left sidebar',
      callback: () => {
        this.toggleLeftSidebar();
      }
    });

    this.addCommand({
      id: 'toggle-right-sidebar',
      name: 'Toggle right sidebar',
      callback: () => {
        this.toggleRightSidebar();
      }
    });

    this.addCommand({
      id: 'toggle-both-sidebars',
      name: 'Toggle both sidebars',
      callback: () => {
        this.toggleBothSidebars();
      },
      hotkeys: [{ modifiers: [], key: 'Escape' }]
    });

    this.app.workspace.onLayoutReady(() => {
      // Cast to extended interfaces to access internal properties
      this.leftSplit = this.app.workspace.leftSplit as unknown as ExtendedWorkspaceSplit;
      this.rightSplit = this.app.workspace.rightSplit as unknown as ExtendedWorkspaceSplit;
      this.leftRibbon = this.app.workspace.leftRibbon as unknown as ExtendedWorkspaceRibbon;
      
      // Collapse sidebars when mouse enters the root editing area
      const rootSplitEl = (this.app.workspace.rootSplit as unknown as ExtendedWorkspaceSplit).containerEl;
      this.registerDomEvent(rootSplitEl, 'mouseenter', () => {
        // Only collapse a sidebar if the mouse is NOT currently tracked as
        // hovering over it. The isHoveringLeft/isHoveringRight flags are set
        // by stable mouseenter/mouseleave handlers on the sidebar containers
        // (which don't fire when moving between children).
        if (this.settings.leftSidebar && !this.isPinnedLeft && !this.isHoveringLeft) {
          this.leftSplit?.containerEl?.removeClass('hovered');
          this.collapseLeft();
        }
        if (this.settings.rightSidebar && !this.isPinnedRight && !this.isHoveringRight) {
          this.rightSplit?.containerEl?.removeClass('hovered');
          this.collapseRight();
        }
      });

      // Collapse when mouse leaves the window entirely
      this.registerDomEvent(document, 'mouseleave', () => {
        if (!this.isPinnedLeft) this.collapseLeft();
        if (!this.isPinnedRight) this.collapseRight();
      });

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
        --left-trigger-width: ${this.settings.leftSideBarPixelTrigger}px;
        --right-trigger-width: ${this.settings.rightSideBarPixelTrigger}px;
      }
      
      body {
        --sidebar-width: ${this.settings.leftSidebarMaxWidth}px !important;
        --right-sidebar-width: ${this.settings.rightSidebarMaxWidth}px !important;
      }
    `;
    
    // Add the style element to the document head
    document.head.appendChild(styleEl);
  }

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

  // Toggle left sidebar only - used by hotkey command
  // When showing via hotkey, sidebar is pinned and won't auto-hide until hotkey is pressed again
  toggleLeftSidebar() {
    if (!this.leftSplit) return;

    const leftExpanded = !this.leftSplit.collapsed;

    if (leftExpanded) {
      this.isPinnedLeft = false;
      this.leftSplit.collapse();
      this.isHoveringLeft = false;
    } else {
      this.expandLeft();
      this.isPinnedLeft = true;
    }
  }

  // Toggle right sidebar only - used by hotkey command
  toggleRightSidebar() {
    if (!this.rightSplit) return;

    const rightExpanded = !this.rightSplit.collapsed;

    if (rightExpanded) {
      this.isPinnedRight = false;
      this.rightSplit.collapse();
      this.isHoveringRight = false;
    } else {
      this.expandRight();
      this.isPinnedRight = true;
    }
  }

  // Toggle both sidebars - used by hotkey command
  toggleBothSidebars() {
    const leftExpanded = this.leftSplit && !this.leftSplit.collapsed;
    const rightExpanded = this.rightSplit && !this.rightSplit.collapsed;

    if (leftExpanded || rightExpanded) {
      // At least one sidebar is expanded - collapse both and unpin
      this.isPinnedLeft = false;
      this.isPinnedRight = false;
      if (this.leftSplit) {
        this.leftSplit.collapse();
        this.isHoveringLeft = false;
      }
      if (this.rightSplit) {
        this.rightSplit.collapse();
        this.isHoveringRight = false;
      }
    } else {
      // Both sidebars are collapsed - expand and pin both
      if (this.leftSplit) {
        this.expandLeft();
        this.isPinnedLeft = true;
      }
      if (this.rightSplit) {
        this.expandRight();
        this.isPinnedRight = true;
      }
    }
  }
  
  rightSplitMouseLeaveHandler = () => {
    if (this.settings.onlyWhenFocused && !document.hasFocus()) return;
    if (this.isActivelyEditing()) return;

    if (this.settings.rightSidebar && !this.isPinnedRight) {
      this.isHoveringRight = false;

      setTimeout(() => {
        // Re-check: if mouse re-entered the sidebar, don't collapse
        if (!this.isHoveringRight && !this.isActivelyEditing()) {
          this.rightSplit.containerEl.removeClass('hovered');
          if (this.settings.syncLeftRight && this.settings.leftSidebar) {
            this.collapseBoth();
          } else {
            this.collapseRight();
          }
        }
      }, this.settings.sidebarDelay);
    }
  };

  leftSplitMouseLeaveHandler = () => {
    if (this.settings.onlyWhenFocused && !document.hasFocus()) return;
    if (this.isActivelyEditing()) return;

    if (this.settings.leftSidebar && !this.isPinnedLeft) {
      this.isHoveringLeft = false;

      setTimeout(() => {
        // Re-check: if mouse re-entered the sidebar, don't collapse
        if (!this.isHoveringLeft && !this.isActivelyEditing()) {
          this.leftSplit.containerEl.removeClass('hovered');
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

    new Setting(containerEl)
    .setName("Only when focused")
    .setDesc(
      "When enabled, sidebar hover will only trigger when Obsidian is the focused application. Useful when using split screen with other apps."
    )
    .addToggle((t) =>
      t
        .setValue(this.plugin.settings.onlyWhenFocused)
        .onChange(async (value) => {
          this.plugin.settings.onlyWhenFocused = value;
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